// 산정 엔진 결과를 화면에서 쓰기 위한 단일 계산 모듈
// engine/ 원본을 그대로 import — 수정 금지, 회귀 테스트는 node test/engine.test.mjs
import { generate } from "../../engine/synth.js";
import * as MRV from "../../engine/mrv.js";

// 배출계수·단가는 데모 입력값 (기준정보 관리에서 버전관리 예정)
export const EF = {
  value: 0.4594,
  unit: "tCO₂eq/MWh",
  name: "전력 배출계수 (데모 입력값)",
  source: "데모 가정 — 공식 계수 아님",
  baseYear: 2024,
  version: "EF-v1.0",
  status: "적용 중",
};
export const TARIFF = { value: 145, unit: "원/kWh", name: "전력 단가(데모 가정값)" };

const data = generate();
const cfg = data.meta.assumptions;
const daily = MRV.aggregateDaily(data);
const baseline = MRV.fitBaseline(daily, cfg);
const quality = MRV.quality(data, [cfg.reportStart, cfg.reportEnd]);
const refrigerant = MRV.refrigerantEmissions(data.refrigerant, [cfg.reportStart, cfg.reportEnd]);

export interface MonthPoint {
  month: string; // "2026-01"
  label: string; // "1월"
  baseMWh: number;
  actMWh: number;
  saveMWh: number;
  cumSaveMWh: number; // 누적 절감량
  nrAdjMWh: number; // 승인된 비일상적 조정 반영량
  bandMWh: number; // 조정 기준선 90% 신뢰구간 반폭 (±)
  bandLowMWh: number; // 밴드 하단 (스택 렌더링용)
  bandWidthMWh: number; // 밴드 폭 (하단→상단)
  events: string[]; // 해당 월 이벤트 (제외·추정·설정변경·정비)
  nUsed: number;
  nExcluded: number;
  estDays: number; // 비례 추정이 적용된 일수
}

type DailyRec = {
  date: string;
  post: boolean;
  saving: number | null;
  estimated: boolean;
  usable: boolean;
  kwhDay: number;
  copDay: number | null;
  sysKwRT: number | null;
  ch1KwRT: number | null;
  ch2KwRT: number | null;
  dT: number | null;
  approach: number | null;
  ch1: number;
  ch2: number;
  chwp: number;
  cwp: number;
  ct: number;
  qthKwh: number;
  nrAdj?: number;
};

// ---------- 산정 번들: 비일상적 조정 승인 상태를 입력으로 재계산 ----------
// 승인 상태가 바뀌면(NR-01 승인 등) 조정 기준선이 달라지므로 새 계산버전을 생성한다 (CLAUDE.md 확정사항)
export interface NonRoutine {
  id: string;
  title: string;
  start: string;
  end: string;
  type: string;
  kwhAdj: number;
  unit: string;
  reason: string;
  status: string;
  approver: string;
  approvedAt: string;
}
export type NrStatusMap = Record<string, string>;

export interface CalcBundle {
  savings: ReturnType<typeof MRV.computeSavings>;
  monthly: MonthPoint[];
  version: string;
  nrApplied: NonRoutine[];
  kpi: {
    saveMWh: number;
    savePct: number;
    co2: number;
    costKrw: number;
    nDays: number;
    nExcluded: number;
    uncertaintyPct: number; // 절감량 상대 불확도 (90% 신뢰수준, IPMVP 근사식)
  };
}

export interface CalcOverrides {
  efValue?: number; // 적용 배출계수 (기본 EF-v1.0)
  tariffValue?: number; // 가정단가 원/kWh
  extraVersions?: number; // 배출계수 등록 등 추가 버전 수 (계산버전 번호에 반영)
}

export function buildCalc(nrStatus: NrStatusMap, overrides: CalcOverrides = {}): CalcBundle {
  const nrList = (data.nonRoutine as NonRoutine[]).map((n) => ({
    ...n,
    status: nrStatus[n.id] ?? n.status,
  }));
  const sv = MRV.computeSavings(
    daily,
    baseline,
    cfg,
    nrList,
    { value: overrides.efValue ?? EF.value },
    { value: overrides.tariffValue ?? TARIFF.value },
  );
  const svDaily = sv.daily as DailyRec[];
  const rmse = baseline.model ? baseline.model.rmse : 0;
  let cum = 0;
  const monthly = (
    MRV.monthly(sv.daily, { sum: ["adjBaseNR", "kwhDay", "saving", "nrAdj"] }) as Array<{
      month: string;
      n: number;
      nUsed: number;
      sums: { adjBaseNR?: number; kwhDay?: number; saving?: number; nrAdj?: number };
    }>
  )
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map<MonthPoint>((m) => {
      const baseMWh = (m.sums.adjBaseNR ?? 0) / 1000;
      const saveMWh = (m.sums.saving ?? 0) / 1000;
      cum += saveMWh;
      // 월 합계 기준선의 90% 신뢰구간: ±1.645 × RMSE × √일수 (일별 오차 독립 가정)
      const bandMWh = (1.645 * rmse * Math.sqrt(Math.max(1, m.nUsed))) / 1000;
      const estDays = svDaily.filter(
        (d) => d.date.slice(0, 7) === m.month && d.usable && d.estimated,
      ).length;
      const nExcluded = m.n - m.nUsed;
      const events: string[] = [];
      if (nExcluded > 0) events.push(`산정 제외 ${nExcluded}일`);
      if (estDays > 0) events.push(`비례 추정 ${estDays}일`);
      if (m.month === "2026-03") events.push("냉동기 2 정비 (NR-02)");
      if (m.month >= "2026-05") events.push("냉수 공급온도 7→9℃ (NR-01)");
      return {
        month: m.month,
        label: `${Number(m.month.slice(5))}월`,
        baseMWh,
        actMWh: (m.sums.kwhDay ?? 0) / 1000,
        saveMWh,
        cumSaveMWh: cum,
        nrAdjMWh: (m.sums.nrAdj ?? 0) / 1000,
        bandMWh,
        bandLowMWh: baseMWh - bandMWh,
        bandWidthMWh: bandMWh * 2,
        events,
        nUsed: m.nUsed,
        nExcluded,
        estDays,
      };
    });
  // 원본 대비 추가로 승인된 비일상적 조정 수만큼 버전 증가 (기존 확정본 보존 개념)
  const extra =
    (data.nonRoutine as NonRoutine[]).filter(
      (n) => n.status !== "승인 완료" && (nrStatus[n.id] ?? n.status) === "승인 완료",
    ).length + (overrides.extraVersions ?? 0);
  return {
    savings: sv,
    monthly,
    version: `CALC-2026H1-v${1 + extra}`,
    nrApplied: nrList,
    kpi: {
      saveMWh: sv.sumSave / 1000,
      savePct: sv.savePct,
      co2: sv.co2,
      costKrw: sv.cost,
      nDays: sv.nDays,
      nExcluded: sv.nExcluded,
      // IPMVP 근사: U = 1.645 × 1.26 × CV(RMSE) × √((1+2/n)/m) ÷ F  (90% 신뢰수준)
      uncertaintyPct:
        baseline.model && sv.savePct > 0
          ? (1.645 * 1.26 * baseline.model.cvRmse * Math.sqrt((1 + 2 / baseline.model.n) / Math.max(1, sv.nDays))) /
            sv.savePct
          : 0,
    },
  };
}

const calc0 = buildCalc({});
const savings = calc0.savings;
const repDaily = savings.daily as DailyRec[];
const monthly = calc0.monthly;

// 검토 필요 건수 = 품질 이슈(검토 필요) + 비일상적 조정(검토 필요)
const reviewIssues = [
  ...quality.issues
    .filter((i: { state: string }) => i.state === "검토 필요")
    .map((i: { id: string; title: string }) => ({ id: i.id, title: i.title, kind: "데이터 이슈" })),
  ...(data.nonRoutine as Array<{ id: string; title: string; status: string }>)
    .filter((n) => n.status === "검토 필요")
    .map((n) => ({ id: n.id, title: n.title, kind: "비일상적 조정" })),
];

// 데이터 신뢰도 = 보고기간 전체 태그 기준 (정상 + 추정) 비율
const trustRate = quality.totals.validRate + quality.totals.estRate;

// ---------- 검토·승인 워크플로우 대상 항목 ----------
export interface ReviewItem {
  id: string;
  kind: string;
  title: string;
  period: string;
  detail: string;
  impact: string;
  affectsCalc: boolean; // 승인 시 산정 결과가 바뀌는 항목 여부
  initialState: string;
}
const nr01 = (data.nonRoutine as NonRoutine[]).find((n) => n.id === "NR-01")!;
const dq04 = quality.issues.find((i: { id: string }) => i.id === "DQ-04") as {
  title: string;
  period: string;
  action: string;
  impact: string;
};
export const reviewItems: ReviewItem[] = [
  {
    id: "NR-01",
    kind: "비일상적 조정",
    title: nr01.title,
    period: `${nr01.start} ~ ${nr01.end}`,
    detail: nr01.reason,
    impact: `승인 시 조정 기준선 ${nr01.kwhAdj.toLocaleString("ko-KR")} kWh 반영 → 새 계산버전 생성`,
    affectsCalc: true,
    initialState: nr01.status,
  },
  {
    id: "DQ-04",
    kind: "데이터 이슈",
    title: dq04.title,
    period: dq04.period,
    detail: dq04.action,
    impact: dq04.impact,
    affectsCalc: false,
    initialState: "검토 필요",
  },
];

// ---------- 계측 커버리지 (물리 계측점만, 계산값 제외) ----------
type TagQ = {
  tag: string;
  collectRate: number;
  outlierRate: number;
  expired: boolean | string;
  meter: { type?: string };
};
const physTags = (quality.byTag as TagQ[]).filter((t) => t.meter.type !== "계산값");
const coverage = {
  total: physTags.length,
  collected: physTags.filter((t) => t.collectRate >= 0.99).length,
  warn: physTags.filter((t) => Boolean(t.expired) || t.outlierRate > 0).length,
  missing: physTags.filter((t) => t.collectRate < 0.99).length,
};
const coverageOk = coverage.total - coverage.warn - coverage.missing;

// ---------- 설비군 대표 KPI ----------
const usableDays = repDaily.filter((d) => d.usable);
const avgOf = (sel: (d: DailyRec) => number | null) => {
  const v = usableDays.map(sel).filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
// 기준기간 평균 (효율 지표의 기준 대비 비교용 — 부하 이동에 왜곡되는 kWh 비교 대신 효율로 비교)
const baseDays = (daily as DailyRec[]).filter(
  (d) => d.date >= cfg.baselineStart && d.date <= cfg.baselineEnd && d.usable,
);
const avgBase = (sel: (d: DailyRec) => number | null) => {
  const v = baseDays.map(sel).filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const ratio = (rep: number | null, base: number | null) =>
  rep !== null && base !== null && base !== 0 ? (rep - base) / base : 0;

type Contrib = { key: string; label: string; before: number; after: number };
const contrib = savings.contrib as Contrib[];
const totalCut = contrib.reduce((s, c) => s + Math.max(0, c.before - c.after), 0);
const cShare = (key: string) => {
  const c = contrib.find((x) => x.key === key);
  return c ? Math.max(0, c.before - c.after) / totalCut : 0;
};
const cDelta = (key: string) => {
  const c = contrib.find((x) => x.key === key);
  return c && c.before > 0 ? (c.after - c.before) / c.before : 0;
};
const cAfter = (key: string) => contrib.find((x) => x.key === key)?.after ?? 0;
// 냉동기는 신설기로 부하가 이동해 개별 kWh 기여가 왜곡됨 → 냉동기군 합산 기여로 표기
const chillerCut =
  contrib
    .filter((c) => c.key === "ch1" || c.key === "ch2")
    .reduce((s, c) => s + (c.before - c.after), 0) / totalCut;

export type EquipGroup = "heat" | "pump" | "air";
export interface EquipCard {
  key: string;
  name: string;
  group: EquipGroup;
  kpiValue: string;
  kpiLabel: string;
  deltaPct: number; // 기준 대비 증감 (음수 = 개선). 냉동기는 kW/RT, 펌프는 kWh/일 기준
  deltaLabel: string;
  shareText: string; // 절감 기여도 표기
  state: "ok" | "warn" | "review";
  stateLabel: string;
}

const equip: EquipCard[] = [
  {
    key: "ch1",
    name: "냉동기 1 (신설)",
    group: "heat",
    kpiValue: (avgOf((d) => d.ch1KwRT) ?? 0).toFixed(2),
    kpiLabel: "kW/RT",
    deltaPct: ratio(avgOf((d) => d.ch1KwRT), avgBase((d) => d.ch1KwRT)),
    deltaLabel: "효율 기준 대비",
    shareText: `냉동기군 기여 ${Math.round(chillerCut * 100)}%`,
    state: "ok",
    stateLabel: "정상",
  },
  {
    key: "ch2",
    name: "냉동기 2 (기존)",
    group: "heat",
    kpiValue: (avgOf((d) => d.ch2KwRT) ?? 0).toFixed(2),
    kpiLabel: "kW/RT",
    deltaPct: ratio(avgOf((d) => d.ch2KwRT), avgBase((d) => d.ch2KwRT)),
    deltaLabel: "효율 기준 대비",
    shareText: "효율저하 이력 검토",
    state: "warn",
    stateLabel: "주의",
  },
  {
    key: "chwp",
    name: "냉수펌프",
    group: "pump",
    kpiValue: Math.round(cAfter("chwp")).toLocaleString("ko-KR"),
    kpiLabel: "kWh/일",
    deltaPct: cDelta("chwp"),
    deltaLabel: "기준 대비",
    shareText: `기여 ${Math.round(cShare("chwp") * 100)}%`,
    state: "ok",
    stateLabel: "정상",
  },
  {
    key: "cwp",
    name: "냉각수펌프",
    group: "pump",
    kpiValue: Math.round(cAfter("cwp")).toLocaleString("ko-KR"),
    kpiLabel: "kWh/일",
    deltaPct: cDelta("cwp"),
    deltaLabel: "기준 대비",
    shareText: `기여 ${Math.round(cShare("cwp") * 100)}%`,
    state: "ok",
    stateLabel: "정상",
  },
  {
    key: "ct",
    name: "냉각탑",
    group: "air",
    kpiValue: (avgOf((d) => d.approach) ?? 0).toFixed(1),
    kpiLabel: "℃ 접근온도",
    deltaPct: cDelta("ct"),
    deltaLabel: "전력 기준 대비",
    shareText: `기여 ${Math.round(cShare("ct") * 100)}%`,
    state: "ok",
    stateLabel: "정상",
  },
];

// ---------- 주별 성능 집계 (설비성과 화면) ----------
export interface WeekPoint {
  key: string; // 주 시작일(일요일) YYYY-MM-DD
  post: boolean;
  sysKwRT: number | null;
  cop: number | null;
  dT: number | null;
  approach: number | null;
  ch1: number | null; // kWh/일 평균
  ch2: number | null;
  chwp: number | null;
  cwp: number | null;
  ct: number | null;
  kwh: number | null;
  usableN: number;
}

const weekKey = (date: string) => {
  const d = new Date(date + "T12:00:00"); // 정오 기준 — 타임존에 따른 날짜 밀림 방지
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const allDaily = daily as DailyRec[];
const weekMap = new Map<string, DailyRec[]>();
for (const d of allDaily) {
  const k = weekKey(d.date);
  if (!weekMap.has(k)) weekMap.set(k, []);
  weekMap.get(k)!.push(d);
}
const weekly: WeekPoint[] = [...weekMap.entries()]
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .map(([k, days]) => {
    const u = days.filter((d) => d.usable);
    const avg = (sel: (d: DailyRec) => number | null) => {
      const v = u.map(sel).filter((x): x is number => x !== null && Number.isFinite(x));
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    return {
      key: k,
      post: days.some((d) => d.post),
      sysKwRT: avg((d) => d.sysKwRT),
      cop: avg((d) => d.copDay),
      dT: avg((d) => d.dT),
      approach: avg((d) => d.approach),
      ch1: avg((d) => d.ch1),
      ch2: avg((d) => d.ch2),
      chwp: avg((d) => d.chwp),
      cwp: avg((d) => d.cwp),
      ct: avg((d) => d.ct),
      kwh: avg((d) => d.kwhDay),
      usableN: u.length,
    };
  });

export interface PerfKpi {
  key: string;
  label: string;
  unit: string;
  base: number | null;
  rep: number | null;
  deltaPct: number;
  betterLow: boolean;
  digits: number;
}
const mkKpi = (
  key: string,
  label: string,
  unit: string,
  sel: (d: DailyRec) => number | null,
  betterLow: boolean,
  digits: number,
): PerfKpi => {
  const base = avgBase(sel);
  const rep = avgOf(sel);
  return { key, label, unit, base, rep, deltaPct: ratio(rep, base), betterLow, digits };
};
const perfKpis: PerfKpi[] = [
  mkKpi("sysKwRT", "시스템 효율", "kW/RT", (d) => d.sysKwRT, true, 2),
  mkKpi("cop", "플랜트 COP", "", (d) => d.copDay, false, 2),
  mkKpi("dT", "냉수 ΔT", "℃", (d) => d.dT, false, 1),
  mkKpi("approach", "냉각탑 접근온도", "℃", (d) => d.approach, true, 1),
];

export interface PerfRow {
  key: string;
  name: string;
  kpiLabel: string;
  unit: string;
  base: number | null;
  rep: number | null;
  deltaPct: number;
  digits: number;
  shareText: string;
  state: "ok" | "warn";
  stateLabel: string;
}
const cBefore = (key: string) => contrib.find((x) => x.key === key)?.before ?? 0;
const perfTable: PerfRow[] = [
  {
    key: "ch1", name: "냉동기 1 (신설)", kpiLabel: "kW/RT", unit: "kW/RT",
    base: avgBase((d) => d.ch1KwRT), rep: avgOf((d) => d.ch1KwRT),
    deltaPct: ratio(avgOf((d) => d.ch1KwRT), avgBase((d) => d.ch1KwRT)), digits: 2,
    shareText: `냉동기군 기여 ${Math.round(chillerCut * 100)}%`, state: "ok", stateLabel: "정상",
  },
  {
    key: "ch2", name: "냉동기 2 (기존)", kpiLabel: "kW/RT", unit: "kW/RT",
    base: avgBase((d) => d.ch2KwRT), rep: avgOf((d) => d.ch2KwRT),
    deltaPct: ratio(avgOf((d) => d.ch2KwRT), avgBase((d) => d.ch2KwRT)), digits: 2,
    shareText: "기준기간 효율저하 이력", state: "warn", stateLabel: "주의",
  },
  {
    key: "chwp", name: "냉수펌프", kpiLabel: "kWh/일", unit: "kWh/일",
    base: cBefore("chwp"), rep: cAfter("chwp"), deltaPct: cDelta("chwp"), digits: 0,
    shareText: `절감 기여 ${Math.round(cShare("chwp") * 100)}%`, state: "ok", stateLabel: "정상",
  },
  {
    key: "cwp", name: "냉각수펌프", kpiLabel: "kWh/일", unit: "kWh/일",
    base: cBefore("cwp"), rep: cAfter("cwp"), deltaPct: cDelta("cwp"), digits: 0,
    shareText: `절감 기여 ${Math.round(cShare("cwp") * 100)}%`, state: "ok", stateLabel: "정상",
  },
  {
    key: "ct", name: "냉각탑", kpiLabel: "접근온도 ℃", unit: "℃",
    base: avgBase((d) => d.approach), rep: avgOf((d) => d.approach),
    deltaPct: ratio(avgOf((d) => d.approach), avgBase((d) => d.approach)), digits: 1,
    shareText: `절감 기여 ${Math.round(cShare("ct") * 100)}%`, state: "ok", stateLabel: "정상",
  },
];

const events = data.meta.events as unknown as {
  fouling: [string, string];
  maintenance: [string, string];
};

// ---------- MRV Assurance 4단계 ----------
const m = baseline.model;
// NMBE = Σ잔차 ÷ ((n−p)·ȳ) — 절편 포함 OLS는 0에 수렴 (표시용)
const nmbe = m
  ? m.resid.reduce((s: number, r: { r: number }) => s + r.r, 0) / ((m.n - 3) * m.yMean)
  : 0;
export type AssuranceStatus = "PASS" | "REVIEW" | "FAIL" | "CONDITIONAL" | "PASS·EX";
export interface AssuranceRow {
  stage: string;
  label: string;
  status: AssuranceStatus;
  evidence: string;
  evidCount: number; // 증적 건수 (데모)
}
const assurance: AssuranceRow[] = [
  {
    stage: "Measurement",
    label: "계측·수집",
    status: "PASS",
    evidence: `정상률 ${(trustRate * 100).toFixed(1)}% · 결측 ${(quality.totals.missRate * 100).toFixed(2)}% · 교정 주의 1건(열량 KPI 한정)`,
    evidCount: 14,
  },
  {
    stage: "Baseline",
    label: "기준선 모델",
    status: baseline.pass ? "PASS" : "FAIL",
    evidence: m
      ? `CV(RMSE) ${(m.cvRmse * 100).toFixed(1)}% · NMBE ${(nmbe * 100).toFixed(1)}% · R² ${m.r2.toFixed(3)}`
      : "-",
    evidCount: 3,
  },
  {
    stage: "Calculation",
    label: "산정 재현",
    status: "PASS",
    evidence: `재현오차 0.00% · 입력 스냅샷 #${((((data.meta.seed as number) >>> 0) * 2654435761) >>> 0).toString(16).slice(0, 6)} 확인 · 회귀 테스트 11건 통과`,
    evidCount: 2,
  },
  {
    stage: "Verification",
    label: "검증·승인",
    status: "REVIEW",
    evidence: "검토 대기 2건 · 승인 전",
    evidCount: 5,
  },
];
export const baselineStats = { nmbe };

// ---------- 부하율–효율 성능곡선 (설비성과) ----------
// 부하율 = 일 냉열 생산량 ÷ 정격 냉각능력(2대 × 1,400 kW_th × 24h)
const CAPACITY_KWH_TH = 2 * (cfg.chillerCapacityKw as number) * 24;
export interface LoadPoint {
  loadPct: number;
  kwRT: number;
  period: "base" | "rep";
}
const loadPoints: LoadPoint[] = allDaily
  .filter((d) => d.usable && d.sysKwRT !== null && d.qthKwh > 0)
  .map((d) => ({
    loadPct: (d.qthKwh / CAPACITY_KWH_TH) * 100,
    kwRT: d.sysKwRT!,
    period: (d.date >= cfg.reportStart ? "rep" : "base") as "base" | "rep",
  }))
  .filter((p) => p.loadPct >= 5 && p.kwRT < 3);
// 기간별 2차 회귀 성능곡선: kW/RT = a + b·부하율 + c·부하율² (관측 5~95백분위 구간만 표시)
const pctl = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const fitCurve = (period: "base" | "rep") => {
  const pts = loadPoints.filter((x) => x.period === period);
  const fit = MRV.ols(pts.map((p) => [p.loadPct, p.loadPct * p.loadPct, p.kwRT]));
  if (!fit) return [];
  const loads = pts.map((p) => p.loadPct);
  const lo = pctl(loads, 0.03);
  const hi = pctl(loads, 0.985);
  const out: Array<{ loadPct: number; kwRT: number }> = [];
  for (let x = lo; x <= hi; x += (hi - lo) / 40) {
    out.push({ loadPct: x, kwRT: fit.a + fit.b * x + fit.c * x * x });
  }
  return out;
};
const baseCurve = fitCurve("base");
const repCurve = fitCurve("rep");
// 동일 부하 구간(두 기간 공통 범위)에서의 평균 효율 개선율
const overlapLo = Math.max(baseCurve[0]?.loadPct ?? 0, repCurve[0]?.loadPct ?? 0);
const overlapHi = Math.min(
  baseCurve[baseCurve.length - 1]?.loadPct ?? 0,
  repCurve[repCurve.length - 1]?.loadPct ?? 0,
);
const curveAt = (curve: Array<{ loadPct: number; kwRT: number }>, x: number) => {
  let best = curve[0];
  for (const p of curve) if (Math.abs(p.loadPct - x) < Math.abs(best.loadPct - x)) best = p;
  return best?.kwRT ?? 0;
};
let impSum = 0;
let impN = 0;
for (let x = overlapLo; x <= overlapHi; x += 2) {
  const b = curveAt(baseCurve, x);
  const r = curveAt(repCurve, x);
  if (b > 0) {
    impSum += (b - r) / b;
    impN++;
  }
}
export const perfCurve = {
  points: loadPoints,
  baseCurve,
  repCurve,
  // 정상 운전영역: 보고기간 부하율 25~90백분위
  normalBand: [pctl(loadPoints.filter((p) => p.period === "rep").map((p) => p.loadPct), 0.25), pctl(loadPoints.filter((p) => p.period === "rep").map((p) => p.loadPct), 0.9)] as [number, number],
  sameLoadImprovePct: impN ? impSum / impN : 0,
  domainX: [0, Math.ceil((pctl(loadPoints.map((p) => p.loadPct), 0.995) + 5) / 5) * 5] as [number, number],
  nBase: loadPoints.filter((p) => p.period === "base").length,
  nRep: loadPoints.filter((p) => p.period === "rep").length,
  overlapRange: [Math.round(overlapLo), Math.round(overlapHi)] as [number, number],
};

// ---------- 절감 기여도 Waterfall (설비성과) ----------
// 일평균 사용량 변화 × 산정일수 기준 분해. 기준선 모델 보정과의 차이는 잔차 항목으로 표시
export interface WaterfallItem {
  key: string;
  label: string;
  value: number; // MWh (+절감)
  kind: "item" | "residual" | "total";
}
const compMWh = (k: string) => {
  const c = contrib.find((x) => x.key === k)!;
  return ((c.before - c.after) * savings.nDays) / 1000;
};
const chillerMWh = compMWh("ch1") + compMWh("ch2");
const wfItems = [
  { key: "chiller", label: "냉동기 교체", value: chillerMWh },
  { key: "chwp", label: "펌프 VFD 제어", value: compMWh("chwp") },
  { key: "cwp", label: "냉각수계통 개선", value: compMWh("cwp") },
  { key: "ct", label: "냉각탑 최적화", value: compMWh("ct") },
];
const wfSum = wfItems.reduce((s, x) => s + x.value, 0);
export const waterfall: WaterfallItem[] = [
  ...wfItems.map((x) => ({ ...x, kind: "item" as const })),
  { key: "resid", label: "기준선·생산량 보정", value: savings.sumSave / 1000 - wfSum, kind: "residual" },
  { key: "total", label: "최종 잠정 절감량", value: savings.sumSave / 1000, kind: "total" },
];

// ---------- 데이터 품질 히트맵 (태그 × 일, 월 단위) ----------
export type HeatStatus = "ok" | "est" | "bad" | "excl";
export interface HeatRow {
  tag: string;
  cells: Array<{ date: string; status: HeatStatus }>;
}
const heatRank: Record<string, number> = { MISSING: 3, INVALID: 3, OUTLIER: 2, ESTIMATED: 2, MANUAL: 1, VALID: 0 };
export function qualityHeatmap(month: string): HeatRow[] {
  const rows = (data.rows as unknown as Array<{ date: string; excl: boolean; s: Record<string, string> }>).filter(
    (r) => r.date.slice(0, 7) === month,
  );
  const days = [...new Set(rows.map((r) => r.date))].sort();
  return (data.tags as TagMeta[]).map((tg) => ({
    tag: tg.id,
    cells: days.map((d) => {
      let worst = 0;
      let excl = false;
      for (const r of rows) {
        if (r.date !== d) continue;
        if (r.excl) excl = true;
        const rank = heatRank[r.s[tg.id]] ?? 0;
        if (rank > worst) worst = rank;
      }
      const status: HeatStatus = excl ? "excl" : worst >= 3 ? "bad" : worst >= 1 ? "est" : "ok";
      return { date: d, status };
    }),
  }));
}

// ---------- Issue Queue (심각도순) ----------
export interface QueueItem {
  id: string;
  sev: "High" | "Medium" | "Low";
  when: string;
  tag: string;
  rule: string;
  impact: string;
  affects: boolean;
  owner: string;
  state: string; // 신규·조사 중·처리 대기·승인 대기·조치 완료·산정 제외
}
const sevMap: Record<string, "High" | "Medium" | "Low"> = { high: "High", mid: "Medium", low: "Low", info: "Low" };
// 업무상태 통일: 신규 → 조사 중 → 처리 대기 → 승인 대기 → 조치 완료 / 산정 제외
const queueState: Record<string, string> = {
  "조치 완료": "조치 완료",
  "규칙 적용": "조치 완료",
  "검토 필요": "처리 대기",
  "승인 완료": "산정 제외",
};
const queueOwner: Record<string, string> = {
  "DQ-05": "계측팀(데모)",
  "DQ-06": "계측팀(데모)",
  "DQ-03": "자동 규칙",
  "DQ-04": "계측팀(데모)",
  "NR-02": "운영팀(데모)",
};
export const issueQueue: QueueItem[] = (
  quality.issues as Array<{ id: string; sev: string; period: string; tag: string; title: string; impact: string; state: string }>
)
  .map((i) => ({
    id: i.id,
    sev: sevMap[i.sev] ?? "Low",
    when: i.period.split("~")[0].trim(),
    tag: i.tag,
    rule: i.title,
    impact: i.impact,
    affects: /제외|추정/.test(i.impact),
    owner: queueOwner[i.id] ?? "—",
    state: queueState[i.state] ?? i.state,
  }))
  .sort((a, b) => ["High", "Medium", "Low"].indexOf(a.sev) - ["High", "Medium", "Low"].indexOf(b.sev));

// ---------- 태그 → 영향 KPI 매핑 (기준정보 Drawer·추적성) ----------
export const tagKpiMap: Record<string, { kpis: string[]; inCalc: boolean; note?: string }> = {
  CH1_kW: { kpis: ["SYS_kW 합산", "냉동기 1 kW/RT", "에너지 절감량"], inCalc: true },
  CH2_kW: { kpis: ["SYS_kW 합산", "냉동기 2 kW/RT", "에너지 절감량"], inCalc: true },
  CHWP_kW: { kpis: ["SYS_kW 합산", "반송동력", "에너지 절감량"], inCalc: true },
  CWP_kW: { kpis: ["SYS_kW 합산", "에너지 절감량"], inCalc: true },
  CT_kW: { kpis: ["SYS_kW 합산", "에너지 절감량"], inCalc: true },
  SYS_kW: { kpis: ["일 사용량", "기준선 모델", "에너지 절감량"], inCalc: true },
  CHW_flow: { kpis: ["Q_th", "COP", "kW/RT"], inCalc: false, note: "전력 산정에는 직접 사용되지 않음 — 열량 KPI 한정, 교정 만료 영향평가 대기" },
  CHW_sT: { kpis: ["Q_th", "ΔT", "COP"], inCalc: false },
  CHW_rT: { kpis: ["Q_th", "ΔT", "COP"], inCalc: false },
  Q_th: { kpis: ["COP", "kW/RT", "부하율"], inCalc: false },
  CW_inT: { kpis: ["접근온도"], inCalc: false },
  OAT: { kpis: ["냉방도일(기준선 변수)"], inCalc: true },
  WBT: { kpis: ["접근온도 산정 게이트"], inCalc: false },
  PROD: { kpis: ["생산량(기준선 변수)"], inCalc: true },
  CH_n: { kpis: ["운전대수·부하배분"], inCalc: false },
};

// 입력 데이터 스냅샷 의사 해시 (seed 기반 결정론 — 재현성 표시용)
export const snapshotHash = ((((data.meta.seed as number) >>> 0) * 2654435761) >>> 0)
  .toString(16)
  .padStart(8, "0");

// ---------- Asset Passport (기준정보, 데모 메타) ----------
export interface AssetPassport {
  asset: string;
  id: string;
  maker: string;
  model: string;
  rating: string;
  installed: string;
  status: string;
  inMrv: boolean;
  readiness: string;
  kpis: string[];
  history: Array<{ date: string; what: string }>;
}
export const assetPassports: AssetPassport[] = [
  {
    asset: "CH-01 냉동기 1", id: "CH-01", maker: "터보냉동기 제조사(데모)", model: "TCH-1400N (R-1233zd(E))",
    rating: "1,400 kW_th (398 RT)", installed: "2026-01-01 (신설 교체)", status: "운전 중", inMrv: true, readiness: "100%",
    kpis: ["kW/RT", "COP", "부하율"],
    history: [
      { date: "2026-01-01", what: "신설 가동 — 개선 조치 (kW/RT −18% 가정)" },
      { date: "2026-01-05", what: "냉매 초기 충전 420 kg (배출 아님)" },
    ],
  },
  {
    asset: "CH-02 냉동기 2", id: "CH-02", maker: "원심냉동기 제조사(데모)", model: "CCH-1400 (R-134a)",
    rating: "1,400 kW_th (398 RT)", installed: "2015-06-01 (기존)", status: "운전 중", inMrv: true, readiness: "100%",
    kpis: ["kW/RT", "COP", "부하율"],
    history: [
      { date: "2025-09-01", what: "응축기 오염 — 효율저하 추세 시작 (kW/RT +10%)" },
      { date: "2026-03-10", what: "대규모 정비(응축기 세관) — 제외기간 NR-02" },
      { date: "2026-05-14", what: "정기점검 냉매 보충 9 kg" },
    ],
  },
  {
    asset: "CHWP 냉수펌프", id: "CHWP", maker: "펌프 제조사(데모)", model: "CP-200 + VFD",
    rating: "110 kW", installed: "2026-01-01 (VFD 신설)", status: "운전 중", inMrv: true, readiness: "100%",
    kpis: ["kWh/일", "반송동력비"],
    history: [{ date: "2026-01-01", what: "인버터(VFD) 설치 — 개선 조치 (−25% 가정)" }],
  },
  {
    asset: "CWP 냉각수펌프", id: "CWP", maker: "펌프 제조사(데모)", model: "CP-250",
    rating: "132 kW", installed: "2015-06-01", status: "운전 중", inMrv: true, readiness: "100%",
    kpis: ["kWh/일"],
    history: [{ date: "2026-01-01", what: "ΔT 3.6→5.0℃ 개선 연동 유량 저감" }],
  },
  {
    asset: "CT-01 냉각탑", id: "CT-01", maker: "냉각탑 제조사(데모)", model: "CT-500",
    rating: "팬 55 kW", installed: "2015-06-01", status: "운전 중", inMrv: true, readiness: "100%",
    kpis: ["접근온도", "kWh/일"],
    history: [{ date: "2026-01-01", what: "팬 제어 최적화 — 개선 조치 (−15% 가정)" }],
  },
];

// ---------- 기준정보: 태그·계측기·설비 계층·냉매 GWP ----------
export interface TagMeta {
  id: string;
  asset: string;
  unit: string;
  kind: string;
  desc: string;
}
export interface MeterMeta {
  tag: string;
  meter: string;
  type: string;
  accuracy: string;
  calib: string;
  expiry: string;
  src: string;
  period: number;
}
const gwpList = [...new Map(
  (data.refrigerant as Array<{ type: string; gwp: number }>).map((r) => [r.type, r.gwp]),
).entries()].map(([type, gwp]) => ({ type, gwp }));

export const mrv = {
  cfg,
  tags: data.tags as TagMeta[],
  meters: data.meters as MeterMeta[],
  gwpList,
  daily,
  baseline,
  savings,
  quality,
  refrigerant,
  monthly,
  reviewIssues,
  equip,
  assurance,
  perf: {
    weekly,
    kpis: perfKpis,
    table: perfTable,
    events: { fouling: events.fouling, maintenance: events.maintenance, install: cfg.installDate as string },
  },
  coverage: { ...coverage, ok: coverageOk },
  calc0,
  kpi: {
    ...calc0.kpi,
    trustRate,
    collectRate: quality.totals.collectRate,
    missRate: quality.totals.missRate,
    estRate: quality.totals.estRate,
    verifyState: "검토 중", // NR-01·DQ-04 검토 필요 → 승인 전 단계
    reviewCount: reviewIssues.length,
  },
  meta: {
    site: "원주공장",
    boundary: "중앙 냉수플랜트",
    periodLabel: "2026.01 – 06",
    aggLabel: "월간",
    calcVersion: "CALC-2026H1-v1",
    generatedAt: data.meta.generatedAt as string,
    seed: data.meta.seed as number,
    equipCount: 5,
    tagCount: physTags.length,
  },
};
