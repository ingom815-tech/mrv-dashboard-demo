// 태양광·ESS 상세 모듈 — KS C IEC 61724-1(PV 성능 모니터링) 기준 합성데이터.
// 사업 형태: 공장 구내 자가용 전기설비(자가소비 + 잉여 상계) — 발전사업자 아님 → REC 발급 대상 아님(참고 표기만).
// factoryData의 태양광·ESS 요약값(발전 840 MWh · 자가소비율 91.2% · ESS 88%)과 정합.

/* ---------- 설비 사양 (데모 가정 — 사양서 제공 시 교체) ---------- */
export const PV_SPEC = {
  arrayKwp: 1200, // 모듈 정격 (STC)
  inverters: 4, // 300 kW × 4
  tempCoefPct: -0.38, // %/℃ (결정질 통상값, 데모)
  degradePctYr: 0.5,
  tilt: "15° 고정형 · 방위 정남 (지붕형, 데모)",
  monitorClass: "Class B (상업용 정밀도)", // IEC 61724-1 4장
};
export const ESS_SPEC = {
  battKwh: 1000,
  pcsKw: 250,
  roundTripPct: 88,
  dod: 90,
  policy: "경부하(심야) 충전 → 최대부하(주간 피크) 방전 · 피크컷 우선 (데모 정책)",
};

/* ---------- TOU 요금 (한전 기본공급약관·시행세칙 체계 준용 — 단가는 데모 가정) ---------- */
export const TOU = {
  contract: "산업용(을) 고압A 선택Ⅱ 상당 (데모 가정)",
  rates: [
    { zone: "경부하", won: 94, hours: "23~09시" },
    { zone: "중간부하", won: 146, hours: "09~11 · 12~13 · 17~23시" },
    { zone: "최대부하", won: 229, hours: "11~12 · 13~17시 (하계 기준)" },
  ],
};

/* ---------- 월별 성과 (2026 상반기) — PR = E_AC / (P0 × H_POA) (IEC 61724-1 10장) ---------- */
export interface PvMonth {
  label: string;
  poaKwhM2: number; // 경사면 일사량 H_POA
  expectMWh: number; // 기대 발전 (PR 기준치 0.83)
  actMWh: number;
  pr: number; // 성능비 Performance Ratio
  event?: string;
}
const PR_REF = 0.83;
const mkM = (label: string, poa: number, act: number, event?: string): PvMonth => ({
  label,
  poaKwhM2: poa,
  expectMWh: Math.round(((PV_SPEC.arrayKwp * poa * PR_REF) / 1000) * 10) / 10,
  actMWh: act,
  pr: Math.round(((act * 1000) / (PV_SPEC.arrayKwp * poa)) * 1000) / 10, // % (E_AC / (P0×H_POA))
  event,
});
export const pvMonthly: PvMonth[] = [
  mkM("1월", 115, 110),
  mkM("2월", 120, 118),
  mkM("3월", 155, 142, "인버터 2 정지 6일 (팬 교체)"),
  mkM("4월", 153, 152, "4/14 통신 결측 3h — 보정"),
  mkM("5월", 170, 158, "오염 누적 → 5/28 패널 세척"),
  mkM("6월", 160, 160),
];
export const pvH1 = {
  genMWh: pvMonthly.reduce((s, m) => s + m.actMWh, 0), // 840
  poaSum: pvMonthly.reduce((s, m) => s + m.poaKwhM2, 0), // 873
  selfMWh: 766, // 자가소비 (factoryData 정합)
  surplusMWh: 74, // 잉여 상계 (자가용 — 한전 상계거래)
  availabilityPct: 98.6, // 인버터 가동률 (정지 6일 반영)
  capacityFactorPct: 15.8,
};
export const pvPrH1 = Math.round(((pvH1.genMWh * 1e6) / (PV_SPEC.arrayKwp * pvH1.poaSum * 1000)) * 1000) / 10; // 80.2%

/* ---------- 손실 분해 (IEC 61724-1 부속서 C 준용 — 데모 분해) ---------- */
export interface LossStage {
  name: string;
  mwh: number; // 음수 = 손실
  note?: string;
}
export const lossWaterfall: LossStage[] = [
  { name: "이론 발전 (STC)", mwh: 1048, note: "P0 × H_POA — 손실 0 가정" },
  { name: "온도 손실", mwh: -52, note: "모듈온도 상승 (계수 −0.38%/℃)" },
  { name: "오염 손실", mwh: -28, note: "5월 누적 → 세척 후 회복" },
  { name: "인버터·변환", mwh: -26, note: "효율 98.2% + MPPT" },
  { name: "정지 손실", mwh: -24, note: "3월 인버터 2 정지 6일" },
  { name: "배선·미스매치", mwh: -30 },
  { name: "클리핑", mwh: -12, note: "PCS 정격 초과 출력 제한" },
  { name: "기타 (저조도 등)", mwh: -36 },
  { name: "실측 발전", mwh: 840 },
];

/* ---------- ESS 성과 (2026 상반기) ---------- */
export const essH1 = {
  chargeMWh: 112,
  dischargeMWh: 99,
  roundTripPct: 88.4, // 99/112
  peakCutKw: 210, // 하계 피크 기여 (데모)
  cycleCount: 121,
  sohPct: 98.9, // 배터리 건강도 (데모)
};
/* TOU 차익 (데모): 방전 가치(최대 60%·중간 40%) − 충전 비용(경부하) */
export const essSavingKrw = Math.round(
  essH1.dischargeMWh * 1000 * (0.6 * 229 + 0.4 * 146) - essH1.chargeMWh * 1000 * 94,
); // ≈ 8.9백만원

/* ---------- 대표일 24h 프로파일 (하계 데모) ---------- */
export interface HourPoint {
  h: string;
  pvKw: number;
  loadKw: number;
  essKw: number; // +방전 / −충전
  zone: "경부하" | "중간" | "최대";
}
const zoneOf = (h: number): HourPoint["zone"] =>
  h >= 23 || h < 9 ? "경부하" : (h >= 11 && h < 12) || (h >= 13 && h < 17) ? "최대" : "중간";
const pvCurve = [0, 0, 0, 0, 0, 10, 80, 220, 420, 610, 780, 900, 950, 940, 860, 700, 500, 290, 110, 20, 0, 0, 0, 0];
const loadCurve = [1750, 1700, 1680, 1670, 1700, 1800, 2050, 2350, 2600, 2750, 2850, 2900, 2870, 2950, 3000, 2980, 2900, 2750, 2500, 2300, 2100, 1950, 1850, 1780];
const essCurve = [0, 0, -250, -250, -250, -125, 0, 0, 0, 0, 0, 60, 0, 250, 250, 250, 190, 0, 0, 0, 0, 0, 0, 0];
export const dayProfile: HourPoint[] = pvCurve.map((pv, h) => ({
  h: `${h}시`,
  pvKw: pv,
  loadKw: loadCurve[h],
  essKw: essCurve[h],
  zone: zoneOf(h),
}));

/* ---------- 온실가스 연계 (자가용 — Scope 2 회피) ---------- */
export const pvGhg = {
  efCurrent: 0.4594, // 시스템 적용 계수 (EF-v1.0)
  efLatest: 0.433, // 2021~2023 평균 소비단 (지침 수집 보고서) — 계수 갱신 시나리오
  avoided: Math.round(766 * 0.4594 * 10) / 10, // 351.9 tCO₂eq
  avoidedLatest: Math.round(766 * 0.433 * 10) / 10, // 331.7
};

/* ---------- 계측 구성 (IEC 61724-1 표 3 — Class B 필수 변수) ---------- */
export interface PvMeter {
  meter: string;
  variable: string; // 표 3 측정 변수
  spec: string;
  cycle: string;
  state: "정상" | "점검";
}
export const pvMeters: PvMeter[] = [
  { meter: "POA 일사계 (PYR-01)", variable: "경사면 일사강도 G_POA", spec: "±5% (Class B 허용)", cycle: "1분 샘플 · 15분 기록", state: "정상" },
  { meter: "모듈온도 센서 (RTD ×2)", variable: "모듈 온도 T_mod", spec: "±2℃", cycle: "1분 · 15분", state: "정상" },
  { meter: "외기온도 (WS-01 공용)", variable: "주변 온도 T_amb", spec: "±1℃", cycle: "15분", state: "정상" },
  { meter: "인버터 내장 계측 (INV-01~04)", variable: "AC 출력 P_AC·E_AC", spec: "±1% (정산용 전력량계 대사)", cycle: "15분", state: "정상" },
  { meter: "ESS PCS·BMS (PCS-01)", variable: "충·방전 전력, SOC", spec: "±1%", cycle: "15분", state: "정상" },
];

/* ---------- IEC 61724-1 정합성 (해설서·체크리스트 기준) ---------- */
export type IecStatus = "충족" | "부분" | "향후";
export interface IecRow {
  clause: string;
  title: string;
  status: IecStatus;
  impl: string;
  note?: string;
}
export const iecMatrix: IecRow[] = [
  { clause: "4", title: "모니터링 시스템 분류", status: "충족", impl: "Class B(상업용) 선언 — 등급별 요구 정밀도·변수 적용" },
  { clause: "5.1·5.2", title: "측정 불확도·교정", status: "충족", impl: "센서 정확도 명시 · 교정주기 관리(계측기 대장 연동)" },
  { clause: "6", title: "데이터 수집 시점·보고", status: "충족", impl: "1분 샘플·15분 기록(부속서 A 간격) · 월·기간 보고" },
  { clause: "7 (표 3)", title: "등급별 필수 측정 변수", status: "충족", impl: "G_POA·T_mod·T_amb·P_AC·E_AC — Class B 필수 변수 계측" },
  { clause: "7.2.1", title: "조사강도 센서 설치·정렬", status: "부분", impl: "어레이 동일 경사면 설치", note: "센서 정기 세척·정렬 점검 기록은 향후 관리 항목" },
  { clause: "7.3.4", title: "오염률 모니터링", status: "부분", impl: "PR 저하 추세로 간접 감지 (5월 사례)", note: "오염 측정 전용 장치는 미설치 — Class B 선택 항목" },
  { clause: "8.1", title: "일광 시간 필터", status: "충족", impl: "야간·저조도 구간을 PR 산정에서 제외" },
  { clause: "8.2.1", title: "잘못된 판독값 제거", status: "충족", impl: "물리범위·고착 검출 규칙(R-02) 재사용 — 원본 보존" },
  { clause: "8.2.2", title: "누락 데이터 처리", status: "충족", impl: "결측 구간 보정 규칙 명시 (4/14 통신 결측 3h 사례)" },
  { clause: "9", title: "계산 변수", status: "충족", impl: "기대 발전량·비손실 등 산정식 문서화" },
  { clause: "10", title: "성능지표 (PR 등)", status: "충족", impl: "PR = E_AC/(P0×H_POA) 월별·기간 산정", note: "해설서 기준 적용 (원문 미확인 절은 해설서 산식 준용 명시)" },
  { clause: "부속서 C·D", title: "손실 요인·시스템별 방정식", status: "부분", impl: "손실 워터폴 분해(온도·오염·정지 등)", note: "요인별 정밀 분해는 데모 가정" },
];
export const iecSummary = {
  ok: iecMatrix.filter((r) => r.status === "충족").length,
  partial: iecMatrix.filter((r) => r.status === "부분").length,
  todo: iecMatrix.filter((r) => r.status === "향후").length,
};

/* ---------- 데이터 검증용 — 태그별 품질 통계 (2026 상반기, 데모) ---------- */
export interface PvTagQuality {
  tag: string;
  meter: string;
  desc: string;
  collectPct: number;
  validPct: number;
  estPct: number;
  note: string;
}
export const pvTagQuality: PvTagQuality[] = [
  { tag: "POA_IRR", meter: "PYR-01", desc: "경사면 일사강도", collectPct: 99.9, validPct: 99.6, estPct: 0, note: "야간 구간은 일광 필터로 산정 제외 (IEC 8.1)" },
  { tag: "MOD_T", meter: "RTD-01·02", desc: "모듈 온도", collectPct: 99.8, validPct: 99.7, estPct: 0, note: "2점 평균 · 편차 3℃ 초과 시 검토 플래그" },
  { tag: "INV1~4_AC", meter: "INV-01~04", desc: "인버터 AC 출력·발전량", collectPct: 99.7, validPct: 96.4, estPct: 0.2, note: "3월 INV-2 정지 6일 · 4/14 결측 3h 적산 보정" },
  { tag: "PV_E", meter: "정산 전력량계", desc: "발전량 (정산 기준)", collectPct: 100, validPct: 100, estPct: 0, note: "인버터 합산과 월별 대사 (차이 0.4% 이내)" },
  { tag: "ESS_P/SOC", meter: "PCS-01·BMS", desc: "충·방전 전력·SOC", collectPct: 99.9, validPct: 99.9, estPct: 0, note: "충·방전 적산 vs 전력량계 교차 검증" },
];

/* IEC 61724-1 8장 — 데이터 품질 규칙 적용 현황 (기존 상태코드 체계에 매핑) */
export const pvQualityRules = [
  { clause: "8.1", name: "일광 시간 필터", rule: "일사량 임계 미만(야간·저조도) 구간은 PR 산정에서 제외", mapped: "상태코드 VALID 유지 · 산정 플래그만 제외", example: "동절기 16시 이후 저조도 구간 자동 제외" },
  { clause: "8.2.1", name: "잘못된 판독값 제거", rule: "물리범위(0~1,500 W/m²)·급변·고착 검출 시 해당 판독 제거", mapped: "OUTLIER — 원본 보존, 정제값 별도 (R-02 재사용)", example: "PYR-01 순간 스파이크 3건 제거 (상반기)" },
  { clause: "8.2.2", name: "누락 데이터 처리", rule: "결측 구간은 보정 방법을 명시하고 라벨 유지", mapped: "ESTIMATED — 인버터 적산값 기반 보정", example: "4/14 통신 결측 3h → 적산 보정 (PV-03)" },
];

/* ---------- 품질 이슈 (기존 DQ 체계와 동일 구조) ---------- */
export const pvIssues = [
  { id: "PV-01", title: "인버터 2 정지 — 냉각팬 교체", period: "2026-03-09 ~ 03-14", impact: "정지 손실 약 24 MWh · 3월 PR 76.3%로 하락", action: "부품 교체 완료 · 가동률 산정 반영", state: "조치 완료" },
  { id: "PV-02", title: "패널 오염 누적 (봄철 황사)", period: "2026-04 ~ 05-28", impact: "5월 PR 77.5% — 오염 손실 추정 28 MWh", action: "5/28 세척 → 6월 PR 83.3% 회복 확인", state: "조치 완료" },
  { id: "PV-03", title: "통신 결측 3시간", period: "2026-04-14 09:00~12:00", impact: "결측 구간 인버터 적산값으로 보정 (라벨 유지)", action: "게이트웨이 재기동 · 보정 규칙 적용", state: "규칙 적용" },
];

/* ---------- 측정값 → 보고값 재구성 (MRV 추적 핵심 — 검증자 관점) ----------
   태양광 발전량 확정은 회귀 기준선이 아니라 "인버터 적산 ↔ 정산 계량기 대사"로 수행.
   정비 정지는 발전 손실이지 데이터 제외가 아님 — 실측 그대로 보고 대상 (혼동 방지 명시). */
export interface PvReconStep {
  kind: "원천" | "보정" | "검증" | "확정" | "연계";
  step: string;
  value: string;
  note: string;
}
export const pvRecon: PvReconStep[] = [
  { kind: "원천", step: "인버터 적산값 (15분)", value: "835.4 MWh", note: "INV-01~04 합산 — 4/14 통신 결측 3h 구간 제외 상태" },
  { kind: "보정", step: "통신 결측 보정", value: "+1.2 MWh", note: "적산 기반 보간 · ESTIMATED 라벨 유지 (PV-03 · 승인 완료)" },
  { kind: "검증", step: "검증 인버터 합산", value: "836.6 MWh", note: "이상 판독 3건 OUTLIER 제거 반영 (발전량 영향 없음)" },
  { kind: "검증", step: "정산 계량기 대사", value: "840.0 MWh", note: "PV_E 월별 대조 — 차이 0.4% (허용 내) → 계량기 기준 채택" },
  { kind: "확정", step: "확정 발전량", value: "840.0 MWh", note: "보고 대상 — 승인 시 계산버전에 잠금" },
  { kind: "연계", step: "자가소비량", value: "766.0 MWh", note: "수전점 구매전력 감소량과 대조 · 잉여 상계 74 MWh 분리" },
  { kind: "연계", step: "Scope 2 회피량", value: "351.9 tCO₂eq", note: "× EF 0.4594 (EF-v1.0) — 참고치, 명세서엔 구매전력 감소로 반영" },
];

/* ---------- 데이터 품질·검증 예외 — 사건이 보고값에 어떻게 반영됐는지 ---------- */
export interface PvException {
  type: "보정" | "제거" | "손실" | "검토";
  item: string;
  impact: string;
  handling: string;
  approval: string;
  ref: string;
}
export const pvExceptions: PvException[] = [
  { type: "보정", item: "통신 결측 3시간 (4/14)", impact: "+1.2 MWh 보간", handling: "인버터 적산 기반 · ESTIMATED 라벨 유지", approval: "승인 완료", ref: "PV-03" },
  { type: "제거", item: "일사계 이상 판독 3건", impact: "PR 정밀도 (발전량 영향 없음)", handling: "OUTLIER — 원본 보존 · 정제값 별도 (R-02)", approval: "규칙 승인분", ref: "IEC 8.2.1" },
  { type: "손실", item: "인버터 2 정지 6일 (3월)", impact: "발전 손실 약 24 MWh", handling: "데이터 제외 아님 — 실측 그대로 보고 · 가동률에 반영", approval: "검토 완료", ref: "PV-01" },
  { type: "검토", item: "패널 오염 누적 (4~5월)", impact: "손실 추정 28 MWh", handling: "손실 분해로 분리 표시 — 보고값 조정 없음", approval: "검토 중", ref: "PV-02" },
];

/* ---------- 계산 근거·증빙 (요약 + 해당 화면 연결) ---------- */
export interface PvCalcRow {
  item: string;
  detail: string;
  nav?: { menu: "verify" | "report" | "master"; hash: string; label: string };
}
export const pvCalcBasis: PvCalcRow[] = [
  { item: "산정식", detail: "PR = E_AC / (P0 × H_POA) · 기대 발전 = P0 × H_POA × PR기준 0.83 · 회피량 = 자가소비 × 배출계수" },
  { item: "기준값(기대치)", detail: "PR 기준 0.83 — 설계값·초년도 실적 기반 (데모 가정). 회귀 기준선(IPMVP형)이 아닌 기대치 비교 방식" },
  { item: "배출계수", detail: "EF-v1.0 · 0.4594 tCO₂/MWh (소비단) — 버전관리, 최신 0.4330 갱신 시나리오", nav: { menu: "master", hash: "#/master/factor", label: "배출계수 관리 ›" } },
  { item: "계측·교정", detail: "IEC 표 3 Class B 5종 — 계측기 대장·교정주기 연동", nav: { menu: "master", hash: "#/master/asset", label: "계측기 대장 ›" } },
  { item: "데이터 보정 규칙", detail: "IEC 8장 3종(일광 필터·오판독 제거·누락 보정) → 기존 상태코드 체계 매핑", nav: { menu: "verify", hash: "#/verify/pv", label: "데이터 검증 ›" } },
  { item: "계산 버전·이력", detail: "CALC-2026H1-v1 — 변경 시 새 버전 생성 · 감사로그 기록", nav: { menu: "report", hash: "#/report/history", label: "변경이력 ›" } },
  { item: "검토·승인", detail: "검토자 확인 → 승인자 확정 시 잠금 (역할 분리) — 현재 검토 중", nav: { menu: "report", hash: "#/report/approve", label: "검토·승인 ›" } },
];

/* ---------- 사업장별 커스텀 구성 (SaaS — 설비 구조·반영 지표는 고객마다 다름) ---------- */
export const pvSiteConfig = {
  site: "제1공장",
  template: "태양광·ESS 표준 템플릿 — KS C IEC 61724-1 Class B",
  custom: "제1공장 커스텀 v1.2",
  note: "설비 구조와 반영 지표는 사업장 온보딩에서 선택하고 설비·연계 관리에서 변경합니다 — 사업장(고객)마다 다르게 구성됩니다.",
  structure: [
    { item: "PV 어레이 1,200 kWp · 인버터 4대", state: "사용" },
    { item: "정산 전력량계 (발전량 확정 기준)", state: "사용" },
    { item: "ESS 1,000 kWh / PCS 250 kW", state: "사용" },
    { item: "오염률 측정 장치", state: "미설치 — 지표 비활성" },
  ],
  kpiSet: [
    { name: "확정 발전량", kind: "표준 필수", on: true },
    { name: "유효 데이터율", kind: "표준 필수", on: true },
    { name: "성능비 PR", kind: "표준 (IEC 10장)", on: true },
    { name: "자가소비·잉여 상계", kind: "사업장 커스텀", on: true },
    { name: "Scope 2 회피량", kind: "사업장 커스텀", on: true },
    { name: "ESS 왕복효율·피크 기여", kind: "사업장 커스텀", on: true },
    { name: "오염률 (측정식)", kind: "표준 선택", on: false, why: "전용 센서 미설치 — PR 추세로 간접 감지" },
    { name: "REC 발급량", kind: "제도 연동", on: false, why: "자가용 설비 — 발급 대상 아님" },
  ] as Array<{ name: string; kind: string; on: boolean; why?: string }>,
};

/* ---------- 사업 형태·REC (자가용 판단 반영) ---------- */
export const pvBiz = {
  type: "자가용 전기설비 — 공장 구내 자가소비 + 잉여 상계 (발전사업자 아님)",
  rec: "REC 발급 대상 아님 — RPS 공급인증서(REC=MWh×가중치)는 공급의무 이행용 발전사업 체계. 발전사업 전환 시 참고: 잉여 판매분 기준 산정 가능",
  surplus: "잉여 74 MWh는 한전 상계거래(약관 준용)로 처리 — 요금 차감 반영 (데모 가정)",
  ghgNote: "자가소비 766 MWh는 구매전력 대체로 Scope 2 회피 — 명세서에는 구매전력 감소로 자동 반영 (별도 감축사업 인증은 외부사업(KOC) 절차 필요)",
};
