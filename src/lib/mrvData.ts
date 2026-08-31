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
  };
}

export function buildCalc(nrStatus: NrStatusMap): CalcBundle {
  const nrList = (data.nonRoutine as NonRoutine[]).map((n) => ({
    ...n,
    status: nrStatus[n.id] ?? n.status,
  }));
  const sv = MRV.computeSavings(daily, baseline, cfg, nrList, EF, TARIFF);
  const svDaily = sv.daily as DailyRec[];
  const monthly = (
    MRV.monthly(sv.daily, { sum: ["adjBaseNR", "kwhDay", "saving"] }) as Array<{
      month: string;
      n: number;
      nUsed: number;
      sums: { adjBaseNR?: number; kwhDay?: number; saving?: number };
    }>
  )
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map<MonthPoint>((m) => ({
      month: m.month,
      label: `${Number(m.month.slice(5))}월`,
      baseMWh: (m.sums.adjBaseNR ?? 0) / 1000,
      actMWh: (m.sums.kwhDay ?? 0) / 1000,
      saveMWh: (m.sums.saving ?? 0) / 1000,
      nUsed: m.nUsed,
      nExcluded: m.n - m.nUsed,
      estDays: svDaily.filter((d) => d.date.slice(0, 7) === m.month && d.usable && d.estimated).length,
    }));
  // 원본 대비 추가로 승인된 비일상적 조정 수만큼 버전 증가 (기존 확정본 보존 개념)
  const extra = (data.nonRoutine as NonRoutine[]).filter(
    (n) => n.status !== "승인 완료" && (nrStatus[n.id] ?? n.status) === "승인 완료",
  ).length;
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

// ---------- MRV Assurance 3단 ----------
const m = baseline.model;
export interface AssuranceRow {
  stage: string;
  label: string;
  status: "PASS" | "REVIEW" | "FAIL";
  evidence: string;
}
const assurance: AssuranceRow[] = [
  {
    stage: "Measurement",
    label: "계측·수집",
    status: "PASS",
    evidence: `정상률 ${(trustRate * 100).toFixed(1)}% · 결측률 ${(quality.totals.missRate * 100).toFixed(2)}%`,
  },
  {
    stage: "Baseline",
    label: "기준선 모델",
    status: baseline.pass ? "PASS" : "FAIL",
    evidence: m ? `CV(RMSE) ${(m.cvRmse * 100).toFixed(1)}% · R² ${m.r2.toFixed(3)} · ${baseline.version}` : "-",
  },
  {
    stage: "Verification",
    label: "검증·승인",
    status: "REVIEW",
    evidence: `교정 만료 1건 · 비일상 조정 검토 1건 · 승인 전`,
  },
];

export const mrv = {
  cfg,
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
