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
const savings = MRV.computeSavings(daily, baseline, cfg, data.nonRoutine, EF, TARIFF);
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
  saving: number | null;
  estimated: boolean;
  usable: boolean;
  copDay: number | null;
  ch1KwRT: number | null;
  ch2KwRT: number | null;
  dT: number | null;
  approach: number | null;
};

const repDaily = savings.daily as DailyRec[];

const monthly = (
  MRV.monthly(savings.daily, { sum: ["adjBaseNR", "kwhDay", "saving"] }) as Array<{
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
    estDays: repDaily.filter((d) => d.date.slice(0, 7) === m.month && d.usable && d.estimated).length,
  }));

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
  coverage: { ...coverage, ok: coverageOk },
  kpi: {
    saveMWh: savings.sumSave / 1000,
    savePct: savings.savePct,
    co2: savings.co2,
    costKrw: savings.cost,
    trustRate,
    collectRate: quality.totals.collectRate,
    missRate: quality.totals.missRate,
    estRate: quality.totals.estRate,
    verifyState: "검토 중", // NR-01·DQ-04 검토 필요 → 승인 전 단계
    reviewCount: reviewIssues.length,
    nDays: savings.nDays,
    nExcluded: savings.nExcluded,
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
