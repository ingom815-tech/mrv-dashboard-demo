// 온실가스 배출량 및 에너지 사용량 명세서 — 데모 데이터 계층
// 기존 MRV 데이터(factoryData·mrvData)를 명세서 항목에 연결한다. 별도 재입력 없음.
// 모든 값은 합성데이터(data_origin = SYNTHETIC)이며 공식 제출·검증에 사용할 수 없다.
import { mrv } from "./mrvData";
import { factory } from "./factoryData";

/* ---------- 단위 변환 (데모 계수) ---------- */
export const CONV = {
  MWH_TO_TJ: 0.0036, // 1 MWh = 3.6 GJ
  LNG_KNM3_TO_TJ: 0.0394, // 1 천Nm³ ≈ 39.4 GJ
  LNG_EF: 2.1, // kgCO₂/Nm³ (데모, Tier 2 상당)
  ELEC_EF: 0.4594, // tCO₂eq/MWh (EF-v1.0)
};

/* ---------- 연도별 인벤토리 (2023~2026, 합성) ---------- */
export interface YearInv {
  year: string;
  note?: string;
  gridMWh: number; // 구매전력
  lngKNm3: number; // LNG 천Nm³
  pvSelfMWh: number; // 태양광 자가소비
  refrigTco2: number; // 냉매 비산
  productionTon: number;
  scope1: number;
  scope2: number;
}
const mkYear = (year: string, gridMWh: number, lngKNm3: number, pvSelfMWh: number, refrigTco2: number, productionTon: number, note?: string): YearInv => ({
  year,
  note,
  gridMWh,
  lngKNm3,
  pvSelfMWh,
  refrigTco2,
  productionTon,
  scope1: Math.round(lngKNm3 * CONV.LNG_EF) + Math.round(refrigTco2),
  scope2: Math.round(gridMWh * CONV.ELEC_EF),
});
export const years: YearInv[] = [
  mkYear("2023", 25100, 3050, 610, 35, 8900),
  mkYear("2024", 25600, 3010, 690, 30, 9150),
  mkYear("2025", 26300, 3080, 730, 28, 9400),
  mkYear("2026", 12023, 1486, 766, Math.round(mrv.refrigerant.total * 100) / 100, 4580, "상반기(1~6월) — 데모 보고기간"),
];
export const cur = years[3];
export const prev = years[2];

export const inv = {
  scope1: factory.scope1, // 3,120(LNG) + 냉매 — factoryData와 동일 값 사용
  scope2: factory.scope2,
  total: factory.totalEmission,
  energyMWh: factory.totalEnergyMWh,
  energyTJ:
    Math.round((cur.gridMWh * CONV.MWH_TO_TJ + cur.lngKNm3 * CONV.LNG_KNM3_TO_TJ) * 10) / 10,
  intensity: Math.round((factory.totalEmission / cur.productionTon) * 100) / 100, // tCO₂eq/t
  intensityPrev: Math.round(((prev.scope1 + prev.scope2) / prev.productionTon) * 100) / 100,
  qualityGrade: "B+ (데모 자체등급)",
};

/* ---------- 에너지원별 사용량 (원천 단위 → 보고 단위) ---------- */
export type SourceKind = "자동수집" | "시스템 계산" | "수기 입력" | "추정값" | "합성데이터" | "해당 없음";
export interface EnergyRow {
  name: string;
  raw: string; // 원천 단위 표기
  mwh: number | null;
  tj: number | null;
  source: SourceKind;
  origin: string; // 원천 시스템·태그
  note?: string;
}
export const energyRows: EnergyRow[] = [
  { name: "전기 (구매전력)", raw: `${(cur.gridMWh * 1000).toLocaleString("ko-KR")} kWh`, mwh: cur.gridMWh, tj: Math.round(cur.gridMWh * CONV.MWH_TO_TJ * 10) / 10, source: "자동수집", origin: "전력계 PM-* 5점 + 한전 청구서 대사" },
  { name: "LNG (도시가스)", raw: `${cur.lngKNm3.toLocaleString("ko-KR")} 천Nm³`, mwh: 4280, tj: Math.round(cur.lngKNm3 * CONV.LNG_KNM3_TO_TJ * 10) / 10, source: "수기 입력", origin: "가스미터 GM-01·02 (GM-03 연계 대기)", note: "가스미터 2점 연계 시 자동수집 전환" },
  { name: "외부 구매 스팀", raw: "0 ton", mwh: null, tj: 0, source: "해당 없음", origin: "—", note: "외부 스팀 미사용 (자체 보일러 생산)" },
  { name: "태양광 발전 (자가소비)", raw: "766 MWh", mwh: 766, tj: Math.round(766 * CONV.MWH_TO_TJ * 10) / 10, source: "자동수집", origin: "인버터 4대 (INV-01~04)", note: "총 에너지 사용량에서 구매전력 차감분 — 별도 성과 관리" },
  { name: "ESS 충·방전", raw: "충전 112 / 방전 99 MWh", mwh: null, tj: null, source: "자동수집", origin: "PCS-01", note: "왕복효율 88% · 사용량 합계에 중복 미산입" },
];

/* ---------- 배출원 목록 (설비군 → 법정 배출시설·활동 매핑) ---------- */
export interface EmissionSource {
  groupKey: string;
  groupName: string;
  facilityCode: string;
  facilityName: string;
  activityCode: string;
  activityName: string;
  scope: "Scope 1" | "Scope 2" | "—";
  activityData: string;
  tags: string;
  method: string; // 수집 방법
  tier: string;
  tco2: number | null;
  evidence: string;
  state: "완료" | "검토 필요" | "매핑만";
  detail: boolean; // 대표 상세 구현 여부
}
export const emissionSources: EmissionSource[] = [
  {
    groupKey: "boiler", groupName: "보일러·스팀", facilityCode: "F-001", facilityName: "보일러 1·2호기",
    activityCode: "S1-COMB-01", activityName: "고정연소 (기체연료)", scope: "Scope 1",
    activityData: `LNG ${cur.lngKNm3.toLocaleString("ko-KR")} 천Nm³`, tags: "GM-01·02 (GM-03 대기)",
    method: "계측 + 월별 수기 보정", tier: "Tier 2 (데모)", tco2: 3120, evidence: "EV-2026-015 외 1", state: "검토 필요", detail: true,
  },
  {
    groupKey: "grid", groupName: "사업장 전체 (전력)", facilityCode: "U-001", facilityName: "수전설비 (22.9kV)",
    activityCode: "S2-ELEC-01", activityName: "구매전력 사용 (간접배출)", scope: "Scope 2",
    activityData: `${(cur.gridMWh * 1000).toLocaleString("ko-KR")} kWh`, tags: "PM-* 5점 · 한전 대사",
    method: "자동수집 (15분)", tier: "간접배출 계수법", tco2: Math.round(factory.scope2), evidence: "EV-2026-015", state: "완료", detail: true,
  },
  {
    groupKey: "refrig", groupName: "냉매·비산배출", facilityCode: "F-020", facilityName: "냉동·냉장 설비 (CH-01R·CH-02)",
    activityCode: "S1-FUG-01", activityName: "냉매 누출 (비산배출)", scope: "Scope 1",
    activityData: "R-134a 보충 9 kg", tags: "정비기록 (수기)",
    method: "보충량 기반 산정", tier: "Tier 1 (데모)", tco2: Math.round(mrv.refrigerant.total * 100) / 100, evidence: "EV-2026-014", state: "검토 필요", detail: true,
  },
  { groupKey: "air", groupName: "압축공기", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함", scope: "Scope 2", activityData: "1,860 MWh (배분)", tags: "PM-CMP", method: "자동수집", tier: "—", tco2: null, evidence: "—", state: "매핑만", detail: false },
  { groupKey: "hvac", groupName: "공조기·환기", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함", scope: "Scope 2", activityData: "2,310 MWh (배분)", tags: "BMS", method: "자동수집", tier: "—", tco2: null, evidence: "—", state: "매핑만", detail: false },
  { groupKey: "chiller", groupName: "냉동·냉장 설비", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함 · MRV 감축 별도", scope: "Scope 2", activityData: "1,049 MWh", tags: "PM-CH1 외 12점", method: "자동수집 (15분)", tier: "—", tco2: null, evidence: "MRV 증적 5건", state: "완료", detail: false },
  { groupKey: "light", groupName: "조명·일반전력", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함", scope: "Scope 2", activityData: "3,020 MWh (배분)", tags: "PM-LT", method: "자동수집", tier: "—", tco2: null, evidence: "—", state: "매핑만", detail: false },
  { groupKey: "line", groupName: "생산라인", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함", scope: "Scope 2", activityData: "3,940 MWh (배분)", tags: "MES 연동", method: "자동수집 + 수기 보정", tier: "—", tco2: null, evidence: "—", state: "매핑만", detail: false },
  { groupKey: "pv", groupName: "태양광·ESS", facilityCode: "R-001", facilityName: "태양광 발전설비 (1.2MW)", activityCode: "—", activityName: "자가발전 (배출 미산정)", scope: "—", activityData: "발전 840 MWh", tags: "INV-01~04", method: "자동수집", tier: "—", tco2: null, evidence: "—", state: "완료", detail: false },
  { groupKey: "water", groupName: "용수·폐수", facilityCode: "U-001", facilityName: "수전설비 (포함)", activityCode: "S2-ELEC-01", activityName: "구매전력 사용에 포함", scope: "Scope 2", activityData: "610 MWh (배분)", tags: "PM-WT", method: "자동수집", tier: "—", tco2: null, evidence: "—", state: "매핑만", detail: false },
];

/* 대표 배출원 상세 (3종) */
export interface SourceDetail {
  groupKey: string;
  formula: string;
  factor: string;
  factorSrc: string;
  monthlyNote: string;
  origin: string;
  edit: string;
}
export const sourceDetails: Record<string, SourceDetail> = {
  boiler: {
    groupKey: "boiler",
    formula: "배출량 = LNG 사용량(Nm³) × 2.1 kgCO₂/Nm³ ÷ 1,000",
    factor: "2.1 kgCO₂/Nm³ (CH₄·N₂O 포함 환산, 데모)",
    factorSrc: "데모 가정값 — 공식 계수 아님 · 적용연도 2026",
    monthlyNote: "동절기(1~2월) 집중 · 가스미터 GM-03 연계 후 15분 자동수집 전환",
    origin: "GM-01·02 자동 + 월말 검침 수기 보정 2일",
    edit: "담당자 직접 수정 불가 — 활동자료·계수 수정 후 재계산",
  },
  grid: {
    groupKey: "grid",
    formula: "배출량 = 구매전력(MWh) × 0.4594 tCO₂eq/MWh",
    factor: "0.4594 tCO₂eq/MWh (EF-v1.0, 소비단)",
    factorSrc: "데모 입력값 — 기준정보 배출계수 버전관리 연동 · 기준연도 2024",
    monthlyNote: "15분 계측 합산과 한전 청구서 월별 대사 (차이 0.3% 이내)",
    origin: "PM-* 5점 (Modbus 가상연계) · 원본 보존",
    edit: "담당자 직접 수정 불가 — 계수 변경 시 새 계산버전 생성",
  },
  refrig: {
    groupKey: "refrig",
    formula: "배출량 = 보충량(kg) × GWP(1,430) ÷ 1,000 · 초기충전 미산입",
    factor: "GWP 1,430 (R-134a) · 저GWP R-1233zd(E)=1",
    factorSrc: "냉매 GWP 표 (기준정보) · 보충≠누출 가정의 보수적 산정(데모)",
    monthlyNote: "5월 정기점검 보충 9 kg 1건 — 수기 기록 검토 필요",
    origin: "정비 작업내역서 (EV-2026-014) 수기 입력",
    edit: "담당자 직접 수정 불가 — 정비기록 등록 후 재계산",
  },
};

/* ---------- 자동 검증 규칙 결과 ---------- */
export interface CheckRow {
  rule: string;
  status: "정상" | "확인 필요" | "생성 불가";
  detail: string;
  action?: string;
}
export const checks: CheckRow[] = [
  { rule: "필수 기본정보", status: "정상", detail: "업체·사업장 필수 12항목 입력 완료" },
  { rule: "조직경계 확정", status: "정상", detail: "원주공장 전체 · 전년 대비 변경 없음" },
  { rule: "설비-배출활동 연결", status: "정상", detail: "10개 설비군 전체 매핑 완료" },
  { rule: "활동자료 누락", status: "정상", detail: "전력·LNG·냉매 활동자료 연결됨" },
  {
    rule: "계측기 교정 만료", status: "확인 필요",
    detail: "FM-CHW 유량계 교정 만료 (열량 KPI 한정 · 전력 산정 영향 없음)",
    action: "설비·연계 관리 → 설비·센서에서 재교정 등록 후 영향평가(DQ-04) 승인",
  },
  { rule: "배출계수 지정", status: "정상", detail: "전력 EF-v1.0 · LNG 데모계수 · GWP 표 적용" },
  { rule: "배출계수 적용연도", status: "정상", detail: "보고연도와 정합 (데모 기준)" },
  { rule: "단위 변환", status: "정상", detail: "kWh→MWh→TJ · Nm³→TJ 자동 변환 검증 통과" },
  {
    rule: "전년 대비 급증·급감", status: "확인 필요",
    detail: "보고기간이 상반기 6개월이라 연간 대비 −53% 표시 — 기간 차이 주석 필요",
    action: "보고서 미리보기 각주에 '상반기 데모 기간' 문구 자동 포함 확인",
  },
  { rule: "합계-세부 일치", status: "정상", detail: "Scope 합계 = 배출원 합계 (오차 0)" },
  {
    rule: "추정데이터 사용", status: "확인 필요",
    detail: "2026-05-08 통신장애 2시간 비례 추정(ESTIMATED) 사용 — 명세서 주석 대상",
    action: "데이터 검증 → 냉동·냉장 이슈 DQ-06 확인 후 검토 의견에 명기",
  },
  { rule: "증빙자료 연결", status: "정상", detail: "증적 5건 연결 (교정성적서는 갱신 대기)" },
  { rule: "미승인 수기 수정", status: "정상", detail: "계산 결과 직접 수정 이력 없음" },
  { rule: "Scope 중복 분류", status: "정상", detail: "전력 배분값은 참고 표기 — S2 합계에 1회만 산입" },
  { rule: "설비 신설·교체 반영", status: "정상", detail: "CH-01→CH-01R 교체 이력 반영 (2026-01-01)" },
];
export const checkSummary = {
  ok: checks.filter((c) => c.status === "정상").length,
  warn: checks.filter((c) => c.status === "확인 필요").length,
  block: checks.filter((c) => c.status === "생성 불가").length,
};

/* ---------- 보고서 섹션 목록 ---------- */
export interface Section {
  name: string;
  link: "자동 연결" | "자동 계산" | "일부 입력" | "일부 누락";
  review: "완료" | "검토 필요";
  owner: string;
  updated: string;
}
export const sections: Section[] = [
  { name: "업체·사업장 정보", link: "자동 연결", review: "완료", owner: "작성자(데모)", updated: "2026-07-02 09:12" },
  { name: "조직경계", link: "일부 입력", review: "완료", owner: "작성자(데모)", updated: "2026-07-02 09:30" },
  { name: "배출시설·배출원", link: "자동 연결", review: "완료", owner: "작성자(데모)", updated: "2026-07-02 10:05" },
  { name: "배출량·에너지", link: "자동 계산", review: "검토 필요", owner: "작성자(데모)", updated: "2026-07-02 10:41" },
  { name: "감축실적 (MRV)", link: "자동 연결", review: "완료", owner: "작성자(데모)", updated: "2026-07-02 10:50" },
  { name: "증빙자료", link: "일부 누락", review: "검토 필요", owner: "계측팀(데모)", updated: "2026-07-02 11:02" },
];

/* ---------- 업체·사업장 기본정보 (합성) ---------- */
export const orgInfo: Array<[string, string]> = [
  ["법인명", "삼양식품㈜ (데모)"],
  ["대표자", "홍길동 (데모)"],
  ["사업자등록번호", "000-00-00000 (데모)"],
  ["사업장명", "원주공장"],
  ["소재지", "강원특별자치도 원주시 ○○로 00 (데모)"],
  ["업종", "식료품 제조업 (C10)"],
  ["주요 생산제품", "면류·스낵 (데모)"],
  ["연간 생산량", "9,400 t (2025) · 4,580 t (2026 상반기)"],
  ["담당부서", "에너지관리팀 (데모)"],
  ["작성 담당자", "작성자(데모)"],
  ["검토자", "MRV 검토자(데모)"],
  ["승인자", "MRV 승인자(데모)"],
];

export const boundary = {
  scope: "원주공장 전체",
  operational: "Scope 1 (고정연소·비산) + Scope 2 (구매전력)",
  included: "원주공장 1개 사업장 (본 데모 범위)",
  excluded: "사택·복지시설 (소량배출, 데모 가정)",
  excludedReason: "연간 배출량 미미 (소량배출시설 기준, 데모)",
  changed: "전년 대비 변경 없음",
  attachments: "공장 배치도·공정도·에너지 흐름도 (데모 — 파일 미첨부, 향후 지원 예정)",
};

/* 데이터 준비율 (데모) */
export const readinessPct =
  Math.round(((sections.filter((s) => s.link === "자동 연결" || s.link === "자동 계산").length + 0.5) / sections.length) * 100);

/* ---------- 월별 활동자료·배출량 (2026 상반기, 별지 11 서식 5-1·5-11 대응) ---------- */
export interface InvMonth {
  m: string;
  elecMWh: number;
  lngKNm3: number;
  scope1: number; // LNG 고정연소
  scope2: number; // 간접배출
}
const mkMonth = (m: string, elecMWh: number, lngKNm3: number): InvMonth => ({
  m,
  elecMWh,
  lngKNm3,
  scope1: Math.round(lngKNm3 * CONV.LNG_EF * 10) / 10,
  scope2: Math.round(elecMWh * CONV.ELEC_EF * 10) / 10,
});
/* 합계 = 전력 12,023 MWh · LNG 1,486 천Nm³ (연간 표와 정합) — 동절기 LNG·하절기 전력 가중 */
export const invMonthly: InvMonth[] = [
  mkMonth("2026-01", 1985, 384),
  mkMonth("2026-02", 1872, 342),
  mkMonth("2026-03", 1918, 265),
  mkMonth("2026-04", 1996, 178),
  mkMonth("2026-05", 2075, 152),
  mkMonth("2026-06", 2177, 165),
];

/* ---------- 배출시설 명부 (별지 11 서식 3-1 대응) ---------- */
export interface FacilityRow {
  code: string; // 법정 배출시설 코드 (별지 10 참고2)
  facilityId: string;
  name: string;
  ownName: string;
  scale: string;
  small: boolean; // 소규모배출시설 여부
  target: boolean; // 할당대상 여부 (데모)
  change?: string;
}
export const facilityList: FacilityRow[] = [
  { code: "0055", facilityId: "F-001", name: "일반 보일러시설", ownName: "보일러 1·2호기", scale: "10 t/h × 2 (데모)", small: false, target: true },
  { code: "—", facilityId: "U-001", name: "수전설비 (간접배출)", ownName: "22.9kV 수전반", scale: "계약전력 4,500 kW (데모)", small: false, target: true },
  { code: "0014", facilityId: "F-020", name: "냉동 및 냉방용 냉매 사용 시설", ownName: "냉동기 CH-01R·CH-02", scale: "1,400 kW_th × 2", small: true, target: false, change: "CH-01→CH-01R 교체 (2026-01-01)" },
  { code: "—", facilityId: "R-001", name: "태양광 발전설비 (배출 미산정)", ownName: "지붕형 1.2MW", scale: "인버터 4대", small: true, target: false },
];

/* ---------- 산정계획서 (별지 10) — 시스템 기준정보에서 자동 구성 ---------- */
export const planMeta = {
  docNo: "PLAN-2026-v1.1",
  base: "별지 제10호 서식 (배출량 산정계획서) 참고 · 데모 요약",
  approvedAt: "2026-01-05 (v1.0) · 2026-02-01 변경 (v1.1: GM-03 신설계획 추가)",
  consistency: "명세서 산정방법 = 산정계획서 등록 방법 — 자동 정합 검증 통과 (불일치 0건)",
};

/* 서식 4-1·4-2·4-3: 활동자료 모니터링 방법·측정기기 (개선/신설계획 포함) */
export interface MeterRow {
  meter: string;
  kind: "자동 (15분)" | "자동 (일간)" | "수기";
  point: string; // 측정지점
  facility: string;
  spec: string; // 정확도·불확도
  calibDue: string;
  state: "정상" | "개선계획" | "신설계획";
  plan?: string; // 4-2 개선 / 4-3 신설 내용
}
export const meterPlan: MeterRow[] = [
  { meter: "전력계 PM-* (5점)", kind: "자동 (15분)", point: "수전반·설비군 분기", facility: "U-001", spec: "0.5급 · ±0.5%", calibDue: "2027-03", state: "정상" },
  { meter: "가스미터 GM-01", kind: "자동 (일간)", point: "보일러 1호기 인입", facility: "F-001", spec: "±1.0%", calibDue: "2027-01", state: "정상" },
  { meter: "가스미터 GM-02", kind: "자동 (일간)", point: "보일러 2호기 인입", facility: "F-001", spec: "±1.0%", calibDue: "2027-01", state: "정상" },
  { meter: "가스미터 GM-03", kind: "자동 (일간)", point: "공정용 소규모 인입", facility: "F-001", spec: "±1.0% (사양)", calibDue: "설치 후 등록", state: "신설계획", plan: "서식 4-3 신설계획 — 2026-08 설치·연계 예정, 완료 시 월별 수기 보정 제거" },
  { meter: "유량계 FM-CHW", kind: "자동 (15분)", point: "냉수 헤더", facility: "F-020", spec: "±0.5%", calibDue: "2026-04 (만료)", state: "개선계획", plan: "서식 4-2 개선계획 — 재교정 등록 후 영향평가(DQ-04) 승인 · 열량 KPI 한정, 배출량 산정 영향 없음" },
  { meter: "냉매 보충 기록", kind: "수기", point: "정비 작업내역서", facility: "F-020", spec: "보충량 kg 단위", calibDue: "—", state: "정상" },
];

/* 서식 5-1·5-2: 산정등급(Tier) 적용계획 */
export interface TierRow {
  activity: string;
  activityCode: string;
  param: string; // 매개변수
  minTier: string;
  applyTier: string;
  ok: boolean;
  rationale: string;
}
export const tierPlan: TierRow[] = [
  { activity: "고정연소 (기체연료)", activityCode: "1002", param: "활동자료 (LNG 사용량)", minTier: "Tier 2", applyTier: "Tier 2", ok: true, rationale: "가스미터 계측 + 공급사 청구서 대사 (데모 기준)" },
  { activity: "고정연소 (기체연료)", activityCode: "1002", param: "배출계수", minTier: "Tier 2", applyTier: "Tier 2", ok: true, rationale: "국가 고유계수 상당 데모값 2.1 kgCO₂/Nm³ 적용" },
  { activity: "간접배출 (구매전력)", activityCode: "—", param: "활동자료 (전력 사용량)", minTier: "계측", applyTier: "계측 (15분)", ok: true, rationale: "전력계 5점 자동수집 · 한전 청구서 월별 대사 0.3% 이내" },
  { activity: "냉매 비산배출", activityCode: "—", param: "활동자료 (보충량)", minTier: "Tier 1", applyTier: "Tier 1", ok: true, rationale: "보충량 기반 산정 (보충≠누출 보수적 가정, 데모)" },
];

/* 서식 8: 품질관리(QA/QC) 담당자·문서 */
export const qaqcRoles: Array<[string, string, string]> = [
  ["작성자(데모) · 에너지관리팀", "산정 총괄", "활동자료 수집·명세서 작성·검토 요청"],
  ["MRV 검토자(데모)", "검토", "산정방법·데이터 품질 검토, 수정 요청 권한"],
  ["MRV 승인자(데모)", "승인", "최종 승인 — 승인 후 데이터 변경 시 승인 자동 해제"],
  ["계측팀(데모)", "측정기기 관리", "교정 일정·성적서 등록 (증적 레지스트리 연동)"],
];
export const qaqcDocs = "품질관리 문서: 데이터 관리 규정(상태코드 7종·원본 보존)ㆍ교정관리 대장ㆍ감사로그 — 시스템 내 자동 관리";

/* 서식 10: 산정계획서 변경 내역 */
export const planChanges: Array<[string, string, string, string]> = [
  ["2026-01-01", "배출시설 변경", "F-020 냉동기 CH-01 → CH-01R 교체 (저GWP R-1233zd(E))", "v1.0 반영"],
  ["2026-02-01", "측정기기 신설계획", "GM-03 가스미터 신설·연계 계획 등록 (서식 4-3)", "v1.1 생성"],
  ["2026-05-02", "개선계획 등록", "FM-CHW 재교정·영향평가 계획 (서식 4-2, DQ-04 연동)", "v1.1 유지"],
];

/* 별지 11 중 데모에서 생략한 서식 (정직 표기) */
export const omittedForms =
  "이동연소(5-2~5-5)·공정배출(5-6)·폐기물(5-7~5-10)·CO₂ 포집(5-15)·CDM(4-3)·온실가스/에너지 이동(7)·기타 온실가스(9)·사업장 고유 Tier 3 계수(10)·굴뚝연속측정 CEMS(11)·첨부 서식 — 해당 없음 또는 데모 범위 외(향후 지원 예정)";
