// ESG 공시 데이터 팩 — K-ESG 가이드라인 v2.0(2024.12, 산업통상자원부·한국생산성본부) 분류체계 참고
// 지속가능경영보고서(ESG Facts & Figures) 부록 표 형식으로 MRV 시스템 데이터를 재구성한다.
// 시스템이 관리하지 않는 항목(폐기물·오염물질 등)은 "범위 외"로 정직하게 표기 — 임의 생성 금지.
import { years, inv } from "./inventoryData";

const y = years; // [2023, 2024, 2025, 2026(상반기)]

/* 추세: K-ESG 공통 개념 — 연평균성장률(CAGR). 2026은 상반기라 확정연도 2023→2025 기준으로 산정 */
export const cagr = (first: number, last: number, yrs: number) =>
  first > 0 ? Math.pow(last / first, 1 / yrs) - 1 : 0;
const trendLabel = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%/년 (${v >= 0 ? "증가" : "감소"})`;

/* 4개년 파생값 */
const total = y.map((r) => r.scope1 + r.scope2);
const energyTJ = y.map((r) => Math.round((r.gridMWh * 0.0036 + r.lngKNm3 * 0.0394) * 10) / 10);
const energyMWhAll = y.map((r) => r.gridMWh + r.pvSelfMWh); // 구매전력 + 재생 자가소비
const renewPct = y.map((r) => r.pvSelfMWh / (r.gridMWh + r.pvSelfMWh));
const intensity = y.map((r) => Math.round(((r.scope1 + r.scope2) / r.productionTon) * 100) / 100);
/* 용수 취수량 (합성, 연간 m³) — 공장 종합현황 용수 시계열과 동일 데모 계열의 연간 집계 가정 */
const waterM3 = [182000, 176500, 171300, 84200];

/* ---------- K-ESG 환경(E)·정보공시(P) 진단항목 ↔ 시스템 데이터 매핑 ---------- */
export type EsgStatus = "자동 제공" | "부분 제공" | "범위 외";
export interface EsgMapRow {
  code: string; // K-ESG 분류번호
  category: string; // 범주
  item: string; // 진단항목
  status: EsgStatus;
  value: string; // 시스템이 제공하는 값 요약
  source: string; // 데이터 원천
  note?: string;
}
export const esgMap: EsgMapRow[] = [
  {
    code: "E-3-1", category: "온실가스", item: "온실가스 배출량 (Scope1 & Scope2)",
    status: "자동 제공",
    value: `2026 상반기 ${total[3].toLocaleString()} tCO₂eq (S1 ${y[3].scope1.toLocaleString()} · S2 ${y[3].scope2.toLocaleString()}) · 4개년 시계열`,
    source: "명세서 모듈 (계측→시스템 계산)",
  },
  {
    code: "E-3-2", category: "온실가스", item: "온실가스 배출량 (Scope3)",
    status: "범위 외", value: "—", source: "—", note: "공급망 배출 미산정 — 향후 지원 예정",
  },
  {
    code: "E-3-3", category: "온실가스", item: "온실가스 배출량 검증",
    status: "부분 제공", value: "내부 검토·승인 워크플로우 (역할 분리·감사로그)",
    source: "보고·승인 모듈", note: "제3자 검증은 시스템 범위 외 — 검증기관 제출용 데이터팩 제공",
  },
  {
    code: "E-4-1", category: "에너지", item: "에너지 사용량",
    status: "자동 제공",
    value: `2026 상반기 ${energyTJ[3]} TJ (${inv.energyMWh.toLocaleString()} MWh) · 원단위·추세 포함`,
    source: "전력계 15분 계측 + 가스미터",
  },
  {
    code: "E-4-2", category: "에너지", item: "재생에너지 사용 비율",
    status: "자동 제공",
    value: `2026 상반기 ${(renewPct[3] * 100).toFixed(1)}% (태양광 자가소비 ${y[3].pvSelfMWh} MWh)`,
    source: "태양광 인버터 4대 (INV-01~04)",
  },
  {
    code: "E-5-1", category: "용수", item: "용수 사용량",
    status: "부분 제공", value: `2026 상반기 취수량 ${waterM3[3].toLocaleString()} m³ (연간 집계는 데모 가정)`,
    source: "용수·폐수 설비군 (PM-WT)", note: "재사용 용수 비율(E-5-2)은 범위 외",
  },
  {
    code: "E-6-1", category: "폐기물", item: "폐기물 배출량 / 재활용 비율",
    status: "범위 외", value: "—", source: "—", note: "폐기물 관리 시스템 미연계 — 향후 지원 예정",
  },
  {
    code: "E-7-1", category: "오염물질", item: "대기·수질 오염물질 배출량",
    status: "범위 외", value: "—", source: "—", note: "TMS 연계 범위 외 — 향후 지원 예정",
  },
  {
    code: "E-10-5", category: "기후변화 대응", item: "온실가스 배출량 감축 실적",
    status: "자동 제공",
    value: "냉수플랜트 MRV 절감 420 MWh · 193 tCO₂eq (기준선 대비, 검증 워크플로우 연동)",
    source: "MRV 산정 엔진 (IPMVP Option B 후보)",
  },
  {
    code: "P-3-1", category: "정보공시 검증", item: "ESG 정보공시 검증",
    status: "부분 제공", value: "데이터 출처 배지·증적 레지스트리·계산버전 추적으로 검증 대응 자료 제공",
    source: "증적 레지스트리 (5건)", note: "공시 검증 자체는 외부 기관 수행",
  },
];
export const esgMapSummary = {
  auto: esgMap.filter((r) => r.status === "자동 제공").length,
  partial: esgMap.filter((r) => r.status === "부분 제공").length,
  out: esgMap.filter((r) => r.status === "범위 외").length,
};

/* ---------- 4개년 정량 데이터 표 (지속가능경영보고서 부록 형식) ---------- */
export interface EsgDataRow {
  section: string;
  item: string;
  unit: string;
  vals: Array<number | null>; // [2023, 2024, 2025, 2026H1]
  digits?: number;
  trend?: string; // CAGR 2023→2025
  note?: string;
}
export const YEAR_COLS = ["2023", "2024", "2025", "2026 상반기"];
export const esgTable: EsgDataRow[] = [
  { section: "온실가스", item: "직접배출 (Scope 1)", unit: "tCO₂eq", vals: y.map((r) => r.scope1), trend: trendLabel(cagr(y[0].scope1, y[2].scope1, 2)) },
  { section: "온실가스", item: "간접배출 (Scope 2)", unit: "tCO₂eq", vals: y.map((r) => r.scope2), trend: trendLabel(cagr(y[0].scope2, y[2].scope2, 2)) },
  { section: "온실가스", item: "합계 (Scope 1+2)", unit: "tCO₂eq", vals: total, trend: trendLabel(cagr(total[0], total[2], 2)) },
  { section: "온실가스", item: "원단위 배출량 (생산량 대비)", unit: "tCO₂eq/t", vals: intensity, digits: 2, trend: trendLabel(cagr(intensity[0], intensity[2], 2)) },
  { section: "온실가스", item: "냉매 비산배출 (별도)", unit: "tCO₂eq", vals: y.map((r) => r.refrigTco2), digits: 2, note: "보충량 × GWP · 감축량과 미합산" },
  { section: "에너지", item: "구매전력", unit: "MWh", vals: y.map((r) => r.gridMWh) },
  { section: "에너지", item: "LNG (도시가스)", unit: "천Nm³", vals: y.map((r) => r.lngKNm3) },
  { section: "에너지", item: "총 에너지 사용량", unit: "TJ", vals: energyTJ, digits: 1, trend: trendLabel(cagr(energyTJ[0], energyTJ[2], 2)) },
  { section: "에너지", item: "총 전력 사용량 (재생 포함)", unit: "MWh", vals: energyMWhAll },
  { section: "재생에너지", item: "태양광 자가소비", unit: "MWh", vals: y.map((r) => r.pvSelfMWh) },
  { section: "재생에너지", item: "재생에너지 사용 비율 (전력 기준)", unit: "%", vals: renewPct.map((v) => Math.round(v * 1000) / 10), digits: 1, trend: trendLabel(cagr(renewPct[0], renewPct[2], 2)) },
  { section: "감축실적", item: "MRV 검증 절감량 (전력)", unit: "MWh", vals: [null, null, null, 420], note: "냉수플랜트 효율개선 · 기준선 대비" },
  { section: "감축실적", item: "MRV 검증 감축량 (온실가스)", unit: "tCO₂eq", vals: [null, null, null, 193.0], digits: 1, note: "Scope 합계에서 미차감 · 별도 실적" },
  { section: "용수", item: "취수량", unit: "m³", vals: waterM3, trend: trendLabel(cagr(waterM3[0], waterM3[2], 2)), note: "연간 집계 데모 가정" },
  { section: "생산", item: "생산량", unit: "t", vals: y.map((r) => r.productionTon) },
];
