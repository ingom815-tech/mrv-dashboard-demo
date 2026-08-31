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
}

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

export const mrv = {
  cfg,
  daily,
  baseline,
  savings,
  quality,
  refrigerant,
  monthly,
  reviewIssues,
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
    calcVersion: "CALC-2026H1-v1 (데모)",
    generatedAt: data.meta.generatedAt as string,
    seed: data.meta.seed as number,
  },
};
