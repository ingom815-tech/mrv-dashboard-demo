// 원주공장 전체 계층 — 10개 설비군의 합성 요약데이터 (결정론, 데모)
// 냉동·냉장 설비군만 실제 MRV 엔진 산정값을 사용하고, 나머지는 합성 요약값이다.
import { mrv } from "./mrvData";

export type Zone = "utility" | "production" | "env";
export type DetailLevel = "full" | "boiler" | "template";
export type LinkState = "연결 완료" | "일부 연결" | "연결 대기" | "오류" | "수기 입력";

export interface GroupKpi {
  label: string;
  value: string;
}

export interface EquipGroupInfo {
  key: string;
  name: string;
  zone: Zone;
  detail: DetailLevel;
  scope: 1 | 2 | 0; // 0 = 발전(자가소비)
  unit: string;
  usage: number; // 보고기간(6개월) 사용량·배출량·발전량
  deltaPct: number; // 기준 대비 (음수 = 감소)
  deltaBase: string; // 비교 기준 표기
  meters: [number, number]; // 연계 계측기 [연결, 전체]
  linkState: LinkState;
  state: "정상" | "검토 필요" | "보완 필요" | "MRV 검증 중";
  note: string;
  kpis: GroupKpi[]; // 설비군 분석 템플릿용 대표 KPI
  monthly: number[]; // 보고기간 월별 (1~6월)
  baseMonthly: number[]; // 기준기간 동월
  events?: Array<string | undefined>; // 월별 주요 운영 이벤트 (마커)
}

/* 냉동·냉장 실측(엔진) 월별 */
const chActual = mrv.calc0.monthly.map((m) => m.actMWh);
const chBase = mrv.calc0.monthly.map((m) => m.baseMWh);
const chSave = mrv.calc0.kpi.saveMWh;

/* 결정론 월별 분포 생성: 총량 × 고정 가중치 */
const dist = (total: number, w: number[]) => {
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (total * x) / s);
};
const FLAT = [1, 1, 1, 1, 1, 1];
const WINTER = [1.35, 1.25, 1.05, 0.85, 0.75, 0.75]; // 난방·스팀형
const SUMMER = [0.7, 0.75, 0.9, 1.1, 1.25, 1.3]; // 냉방·계절형
const PROD = [0.95, 0.9, 0.98, 1.02, 1.05, 1.1]; // 생산 연동

const mk = (
  g: Omit<EquipGroupInfo, "monthly" | "baseMonthly"> & { profile?: number[] },
): EquipGroupInfo => {
  // events는 그대로 전달됨
  const profile = g.profile ?? FLAT;
  const monthly = dist(g.usage, profile);
  const baseMonthly = dist(g.usage / (1 + g.deltaPct), profile);
  const { profile: _p, ...rest } = g;
  return { ...rest, monthly, baseMonthly };
};

export const equipGroups: EquipGroupInfo[] = [
  mk({
    key: "boiler", name: "보일러·스팀", zone: "utility", detail: "boiler", scope: 1,
    unit: "MWh", usage: 4280, deltaPct: 0.031, deltaBase: "전년 대비", meters: [7, 9],
    linkState: "일부 연결", state: "보완 필요", note: "가스미터 2점 연계 대기 · 증기유량 수기 보정",
    kpis: [
      { label: "보일러 효율", value: "88.4%" },
      { label: "연료 사용량", value: "412 천Nm³" },
      { label: "증기 원단위", value: "1.42 t/t" },
      { label: "직접배출", value: "812 tCO₂eq" },
    ],
    profile: WINTER,
  }),
  mk({
    key: "air", name: "압축공기", zone: "utility", detail: "template", scope: 2,
    unit: "MWh", usage: 1860, deltaPct: -0.024, deltaBase: "전년 대비", meters: [5, 6],
    linkState: "일부 연결", state: "정상", note: "무부하율 개선 여지 — 누설점검 권고",
    kpis: [
      { label: "비동력", value: "0.118 kW/Nm³" },
      { label: "무부하율", value: "14.2%" },
      { label: "토출압력", value: "6.8 bar" },
      { label: "누설률(추정)", value: "9.1%" },
    ],
    profile: PROD,
  }),
  mk({
    key: "hvac", name: "공조기·환기", zone: "utility", detail: "template", scope: 2,
    unit: "MWh", usage: 2310, deltaPct: -0.012, deltaBase: "전년 대비", meters: [6, 6],
    linkState: "연결 완료", state: "정상", note: "BMS 연계 정상 · 스케줄 준수 97%",
    kpis: [
      { label: "팬 전력", value: "512 MWh" },
      { label: "SFP", value: "1.46 W/CMH" },
      { label: "외기도입률", value: "22%" },
      { label: "스케줄 준수", value: "97.4%" },
    ],
    profile: SUMMER,
  }),
  {
    key: "chiller", name: "냉동·냉장 설비", zone: "utility", detail: "full", scope: 2,
    unit: "MWh", usage: Math.round(mrv.calc0.savings.sumAct / 100) / 10,
    deltaPct: -mrv.calc0.kpi.savePct, deltaBase: "조정 기준선 대비", meters: [13, 13],
    linkState: "연결 완료", state: "MRV 검증 중",
    note: `상세 MRV 실증 — 검증 절감 ${Math.round(chSave)} MWh`,
    kpis: [
      { label: "COP", value: "6.71" },
      { label: "시스템 kW/RT", value: "0.95" },
      { label: "냉수 ΔT", value: "5.0℃" },
      { label: "접근온도", value: "3.5℃" },
    ],
    monthly: chActual,
    baseMonthly: chBase,
  },
  mk({
    key: "light", name: "조명·일반전력", zone: "utility", detail: "template", scope: 2,
    unit: "MWh", usage: 3020, deltaPct: 0.008, deltaBase: "전년 대비", meters: [8, 8],
    linkState: "연결 완료", state: "정상", note: "LED 전환 완료 구역 82%",
    kpis: [
      { label: "면적당 전력", value: "38.2 kWh/㎡" },
      { label: "피크전력", value: "1,240 kW" },
      { label: "야간 기저부하", value: "312 kW" },
      { label: "역률", value: "96.8%" },
    ],
  }),
  mk({
    key: "pv", name: "태양광·ESS", zone: "utility", detail: "template", scope: 0,
    unit: "MWh 발전", usage: 840, deltaPct: 0.052, deltaBase: "전년 대비", meters: [4, 4],
    linkState: "연결 완료", state: "정상", note: "자가소비율 91.2% · REC 별도 관리",
    kpis: [
      { label: "발전량", value: "840 MWh" },
      { label: "자가소비율", value: "91.2%" },
      { label: "이용률", value: "15.8%" },
      { label: "ESS 왕복효율", value: "88%" },
    ],
    profile: SUMMER,
  }),
  mk({
    key: "line", name: "생산라인", zone: "production", detail: "template", scope: 2,
    unit: "MWh", usage: 3940, deltaPct: 0.042, deltaBase: "전년 대비", meters: [3, 4],
    linkState: "일부 연결", state: "정상", note: "생산량 +12% 반영 — 원단위는 개선",
    kpis: [
      { label: "에너지 원단위", value: "0.86 MWh/t" },
      { label: "가동률", value: "84.2%" },
      { label: "생산량", value: "4,580 t" },
      { label: "원단위 변화", value: "−6.3%" },
    ],
    profile: PROD,
  }),
  mk({
    key: "water", name: "용수·폐수", zone: "env", detail: "template", scope: 2,
    unit: "MWh", usage: 610, deltaPct: -0.005, deltaBase: "전년 대비", meters: [2, 3],
    linkState: "일부 연결", state: "정상", note: "폐수처리 송풍기 전력 위주",
    kpis: [
      { label: "용수 사용량", value: "182 천t" },
      { label: "제품당 용수", value: "39.7 t/t" },
      { label: "처리 전력", value: "610 MWh" },
      { label: "방류 수질", value: "적합" },
    ],
  }),
  mk({
    key: "fuel", name: "연료·직접배출", zone: "env", detail: "template", scope: 1,
    unit: "tCO₂eq", usage: 3120, deltaPct: 0.029, deltaBase: "전년 대비", meters: [2, 2],
    linkState: "연결 완료", state: "정상", note: "LNG 연소 (보일러·직화설비) — Scope 1",
    kpis: [
      { label: "LNG 사용량", value: "1,486 천Nm³" },
      { label: "직접배출", value: "3,120 tCO₂eq" },
      { label: "적용 계수", value: "2.10 kg/Nm³" },
      { label: "산정 방식", value: "Tier 2(데모)" },
    ],
    profile: WINTER,
  }),
  {
    key: "refrig", name: "냉매·비산배출", zone: "env", detail: "template", scope: 1,
    unit: "tCO₂eq", usage: Math.round(mrv.refrigerant.total * 100) / 100,
    deltaPct: -0.18, deltaBase: "전년 대비", meters: [1, 1],
    linkState: "수기 입력", state: "검토 필요",
    note: "보충량 기록 기반 · 저GWP 전환으로 감소 추세",
    kpis: [
      { label: "보충량", value: "9 kg (R-134a)" },
      { label: "비산배출", value: `${mrv.refrigerant.total.toFixed(2)} tCO₂eq` },
      { label: "초기충전(미산입)", value: "420 kg" },
      { label: "저GWP 전환", value: "1/2대" },
    ],
    monthly: dist(mrv.refrigerant.total, [0.2, 0, 0, 0, 0.8, 0]),
    baseMonthly: dist(mrv.refrigerant.total / 0.82, FLAT),
  },
];

export const ZONES: Array<{ key: Zone; name: string }> = [
  { key: "utility", name: "유틸리티·에너지" },
  { key: "production", name: "생산설비" },
  { key: "env", name: "환경·직접배출" },
];

/* ---------- 공장 전체 집계 ---------- */
const elec = equipGroups.filter((g) => g.scope === 2);
const elecMWh = elec.reduce((s, g) => s + g.usage, 0);
const pvSelf = 840 * 0.912; // 자가소비 발전량
const gridMWh = elecMWh - pvSelf;
const EF = 0.4594;
const scope2 = (gridMWh / 1000) * EF * 1000; // tCO₂eq — 데모 단순화
const scope1 = equipGroups.filter((g) => g.scope === 1 && g.unit === "tCO₂eq").reduce((s, g) => s + g.usage, 0)
  + 812; // 보일러 직접배출(연료 그룹과 중복 없는 데모 단순 가정 제외) — 아래에서 재정의
// 데모 단순화: Scope1 = 연료·직접배출 + 냉매
const scope1Total = 3120 + mrv.refrigerant.total;
const totalEnergyMWh = elecMWh + 4280; // 전력 + 보일러 연료환산(MWh)
void scope1;

export const factory = {
  name: "삼양식품 원주공장 (데모)",
  totalEnergyMWh,
  scope1: scope1Total,
  scope2,
  totalEmission: scope1Total + scope2,
  verifiedSaveMWh: mrv.calc0.kpi.saveMWh, // MRV 검증(잠정) 절감 — 냉동·냉장 실증분만
  verifiedCo2: mrv.calc0.kpi.co2,
  linkRate:
    equipGroups.reduce((s, g) => s + g.meters[0], 0) /
    equipGroups.reduce((s, g) => s + g.meters[1], 0),
  metersConnected: equipGroups.reduce((s, g) => s + g.meters[0], 0),
  metersTotal: equipGroups.reduce((s, g) => s + g.meters[1], 0),
};

/* 공장 월별 사용량 (전력+연료환산 MWh) — 기준 vs 보고 + 검증 절감 + 목표선 */
export interface FactoryMonth {
  label: string;
  baseMWh: number;
  actMWh: number;
  verifiedSaveMWh: number;
  targetMWh: number;
  event?: string;
}
const energyGroups = equipGroups.filter((g) => g.unit.startsWith("MWh") && g.scope !== 0);
export const factoryMonthly: FactoryMonth[] = [0, 1, 2, 3, 4, 5].map((i) => {
  const act = energyGroups.reduce((s, g) => s + g.monthly[i], 0);
  const base = energyGroups.reduce((s, g) => s + g.baseMonthly[i], 0);
  return {
    label: `${i + 1}월`,
    baseMWh: base,
    actMWh: act,
    verifiedSaveMWh: mrv.calc0.monthly[i].saveMWh,
    targetMWh: base * 0.95, // 목표: 기준 대비 −5% (데모 가정)
    event: i === 0 ? "냉동기 교체 가동" : i === 2 ? "냉동기 2 정비" : undefined,
  };
});

/* 처리할 일 — 설비군 태그 포함 (분석 범위 필터링용) */
export interface FactoryTodo {
  title: string;
  meta: string;
  target: "master" | "verify" | "report";
  group: string; // 설비군 key
}
export const factoryTodos: FactoryTodo[] = [
  { title: "보일러·스팀 가스미터 2점 연계", meta: "설비·연계 관리 · 연결 대기", target: "master", group: "boiler" },
  { title: "증기유량계 교정이력 미등록", meta: "설비·연계 관리 · 등록 필요", target: "master", group: "boiler" },
  { title: "냉매 보충 기록 검토 (수기 입력)", meta: "데이터 검증 · 검토 필요", target: "verify", group: "refrig" },
];

/* 월별 주요 운영 이벤트 (설비군별, 데모) */
export const GROUP_EVENTS: Record<string, Array<string | undefined>> = {
  boiler: ["동절기 스팀수요 증가", "가스미터 연계 누락 구간", undefined, undefined, undefined, undefined],
  air: [undefined, undefined, undefined, "누설점검 실시", undefined, undefined],
  hvac: [undefined, undefined, undefined, undefined, "냉방 전환·운전시간 변경", undefined],
  light: [undefined, undefined, "LED 전환(2구역)", undefined, undefined, "피크전력 갱신"],
  pv: [undefined, undefined, undefined, undefined, undefined, "출력제한 1회"],
  line: [undefined, undefined, undefined, "생산량 증가 +12%", undefined, undefined],
  water: [undefined, undefined, "폐수처리 설비 정비", undefined, undefined, undefined],
  fuel: ["동절기 연료 사용 증가", undefined, undefined, undefined, undefined, undefined],
  refrig: [undefined, undefined, undefined, undefined, "냉매 보충 9 kg — 기록 검토", undefined],
};

/* 분석 지표 목록 (범위별) — 기본 지표만 월별 시계열 제공, 나머지는 요약값 */
export interface MetricOption {
  key: string;
  label: string;
  hasSeries?: boolean;
}
export const SCOPE_METRICS: Record<string, MetricOption[]> = {
  factory: [
    { key: "energy", label: "에너지 사용량", hasSeries: true },
    { key: "emission", label: "온실가스 배출량" },
    { key: "linkRate", label: "데이터 연계율" },
  ],
  boiler: [
    { key: "fuelEnergy", label: "연료 환산 에너지", hasSeries: true },
    { key: "gas", label: "가스 사용량" },
    { key: "efficiency", label: "보일러 효율" },
    { key: "steamIntensity", label: "증기 원단위" },
    { key: "scope1", label: "직접배출량" },
  ],
  air: [
    { key: "electricity", label: "전력사용량", hasSeries: true },
    { key: "specificPower", label: "비동력" },
    { key: "unloadRate", label: "무부하 운전율" },
    { key: "pressure", label: "공급압력" },
  ],
  hvac: [
    { key: "electricity", label: "전력사용량", hasSeries: true },
    { key: "fanPower", label: "팬 전력" },
    { key: "outdoorAir", label: "외기량" },
    { key: "comfort", label: "온습도 적정률" },
  ],
  chiller: [
    { key: "mrvSavings", label: "MRV 에너지 절감", hasSeries: true },
    { key: "sysEff", label: "시스템 효율" },
    { key: "cop", label: "플랜트 COP" },
    { key: "deltaT", label: "냉수 ΔT" },
    { key: "approach", label: "냉각탑 접근온도" },
  ],
  light: [
    { key: "electricity", label: "전력사용량", hasSeries: true },
    { key: "peak", label: "피크전력" },
    { key: "perArea", label: "면적당 전력" },
    { key: "hours", label: "운영시간" },
  ],
  pv: [
    { key: "generation", label: "발전량", hasSeries: true },
    { key: "selfUse", label: "자가소비량" },
    { key: "selfRate", label: "자가소비율" },
    { key: "essCycle", label: "ESS 충·방전량" },
  ],
  line: [
    { key: "energyIntensity", label: "에너지 원단위", hasSeries: true },
    { key: "energy", label: "에너지 사용량", hasSeries: true },
    { key: "production", label: "생산량" },
    { key: "utilization", label: "가동률" },
  ],
  water: [
    { key: "waterUse", label: "용수 사용량", hasSeries: true },
    { key: "treatPower", label: "처리 전력", hasSeries: true },
    { key: "wastewater", label: "폐수 처리량" },
    { key: "waterIntensity", label: "용수 원단위" },
  ],
  fuel: [
    { key: "scope1", label: "직접배출량", hasSeries: true },
    { key: "fuelUse", label: "연료 사용량" },
    { key: "byFuel", label: "연료별 배출 기여도" },
  ],
  refrig: [
    { key: "fugitive", label: "비산배출량", hasSeries: true },
    { key: "charge", label: "냉매 보충량" },
    { key: "recovery", label: "냉매 회수량" },
    { key: "byType", label: "냉매별 배출량" },
  ],
};
export const DEFAULT_METRIC: Record<string, string> = Object.fromEntries(
  Object.entries(SCOPE_METRICS).map(([k, v]) => [k, v[0].key]),
);

/* 특수 시계열 (합성, data_origin = SYNTHETIC) */
export const WATER_USE = { act: dist(182, PROD), base: dist(183, PROD) }; // 천t
export const LINE_PROD = { act: dist(4580, PROD), base: dist(4580 / 1.12, PROD) }; // t

/* 설비군 상태 한 줄 요약 */
export const groupSummary = {
  total: equipGroups.length,
  full: equipGroups.filter((g) => g.linkState === "연결 완료").length,
  partial: equipGroups.filter((g) => g.linkState === "일부 연결").length,
  manual: equipGroups.filter((g) => g.linkState === "수기 입력").length,
  review: equipGroups.filter((g) => g.state === "검토 필요" || g.state === "보완 필요").length,
};
