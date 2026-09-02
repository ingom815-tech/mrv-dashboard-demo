// 표준·양식 정합 데이터 — M&V 계획서/결과보고서(ESCO 표준계약 양식), IPMVP Core Concepts 2022,
// ISO 50006:2023 기능명세서 대비 시스템 구현 현황. 정직 표기: 구현/부분/향후를 구분한다.

/* toe 환산 (데모): 전력 1 MWh = 0.229 toe (1차 에너지 기준 상당, 데모 가정) */
export const TOE_PER_MWH = 0.229;

/* ---------- 표준 정합성 매트릭스 ---------- */
export type ComplyStatus = "구현" | "부분" | "향후";
/* 바로가기 — 구현 근거가 있는 화면·보고서 절로 이동 */
export interface ComplyNav {
  go: "mvplan" | "form" | "approve" | "history" | "verify" | "master" | "evidence";
  anchor?: string; // 보고서 절 앵커 (mvsec-N)
  label: string;
}
export interface ComplyRow {
  clause: string;
  title: string;
  status: ComplyStatus;
  impl: string; // 시스템 구현 내용 (화면·데이터·산출물)
  note?: string;
  nav?: ComplyNav;
}

/* IPMVP Core Concepts 2022 — 조항별 대응 */
export const ipmvpMatrix: ComplyRow[] = [
  { clause: "4", title: "M&V 원칙 (정확·완전·보수적·일관·투명)", status: "구현", impl: "보수적 가정(냉매 보충=누출, 기준기간 성능저하 포함) · 원본 보존 · 감사로그 · 산정근거 추적성 패널", nav: { go: "evidence", label: "산정근거 열기" } },
  { clause: "5", title: "M&V 프로세스", status: "구현", impl: "계획 수립(M&V PLAN) → 계측 → 산정 → 검토·승인 → 보고서 생성 파이프라인", nav: { go: "mvplan", label: "M&V 계획서" } },
  { clause: "5.1", title: "독립 검증자 검토", status: "부분", impl: "내부 검토자·승인자 역할 분리 구현", note: "외부 독립 검증기관 연계는 데이터팩 제공으로 지원 — 직접 연계 향후", nav: { go: "approve", label: "검토·승인 탭" } },
  { clause: "7.1", title: "측정경계 (Measurement Boundary)", status: "구현", impl: "중앙 냉수플랜트 전력 사용량 경계 — 경계 내 계측 13점, 시스템 경계 정의 화면", nav: { go: "mvplan", anchor: "mvsec-3", label: "계획서 3절" } },
  { clause: "7.2", title: "측정기간 (기준·설치·보고)", status: "구현", impl: "기준기간 2025 연간(363일) · 설치 2026-01-01(CH-01R) · 보고기간 2026 상반기", nav: { go: "mvplan", anchor: "mvsec-4", label: "계획서 4·5절" } },
  { clause: "7.3", title: "기준기간 조건 기록", status: "구현", impl: "운용조건(냉수 7℃ 공급 등)·주요인자 기록, 기준선 학습 데이터 보존", nav: { go: "mvplan", anchor: "mvsec-4", label: "계획서 4절" } },
  { clause: "7.4.1", title: "일상적 조정 (Routine Adjustments)", status: "구현", impl: "냉방도일·생산량 회귀모델로 자동 조정 (kWh/일 = a + b·CDD + c·생산량)", nav: { go: "mvplan", anchor: "mvsec-6", label: "계획서 6절" } },
  { clause: "7.4.2", title: "비일상적 조정 (Non-Routine)", status: "구현", impl: "NR 등록(사유·기간·조정량) → 승인된 건만 반영 → 새 계산버전 생성 · 감사로그", nav: { go: "approve", label: "검토·승인 탭" } },
  { clause: "7.5.1", title: "Avoided Energy Consumption", status: "구현", impl: "절감량 = 조정 기준선 − 실제 사용량 (본 시스템의 기본 산정 방식)", nav: { go: "form", anchor: "mvsec-4", label: "결과보고서 4절" } },
  { clause: "7.5.2", title: "Normalized Savings", status: "향후", impl: "—", note: "정규화 조건(평년 기상 등) 기반 산정 미지원 — 확장 대상" },
  { clause: "7.6", title: "운영 검증 (Operational Verification)", status: "부분", impl: "설치·교체는 변경관리 이력으로 확인 (CH-01→CH-01R)", note: "현장 시운전·성능 확인 절차 기록은 향후", nav: { go: "master", label: "변경관리 화면" } },
  { clause: "8", title: "옵션 선택 근거 문서화", status: "구현", impl: "M&V 계획서 3절 — 옵션 선택 이유·상호작용 효과 기술", nav: { go: "mvplan", anchor: "mvsec-3", label: "계획서 3절" } },
  { clause: "9.2", title: "Option B (경계 내 전체 계측)", status: "구현", impl: "15분 주기 전 전력 계측 · 데이터 품질 규칙 · 결측/추정 처리", nav: { go: "verify", label: "데이터 검증 화면" } },
  { clause: "9.1/9.3/9.4", title: "Option A · C · D", status: "향후", impl: "—", note: "핵심 매개변수 추정(A)·전체 시설(C)·시뮬레이션(D) 미지원" },
  { clause: "—", title: "불확도·샘플링", status: "부분", impl: "기준선 모델 불확도(90% 신뢰수준, z=1.645) 산정·표기", note: "계측기 합성 불확도 미포함(툴팁 명시) · 전수 계측으로 샘플링 해당 없음", nav: { go: "form", anchor: "mvsec-8", label: "결과보고서 8절" } },
];

/* ISO 50006:2023 — 조항별 대응 */
export const iso50006Matrix: ComplyRow[] = [
  { clause: "4", title: "EnPI·EnB 개요", status: "구현", impl: "EnPI: 일 전력 사용량·kW/RT·COP / EnB: 기준선 모델 BL-v1.0 (버전관리)", nav: { go: "mvplan", anchor: "mvsec-4", label: "계획서 4절" } },
  { clause: "5.3", title: "EnPI 경계 정의", status: "구현", impl: "설비군·측정경계 정의 (냉수플랜트 상세 / 공장 전체 요약)", nav: { go: "mvplan", anchor: "mvsec-3", label: "계획서 3절" } },
  { clause: "5.5", title: "관련 변수 정의·정량화", status: "구현", impl: "냉방도일(기준 18℃)·생산량 — 통계 유의성 확인 후 모델 채택", nav: { go: "mvplan", anchor: "mvsec-4", label: "계획서 4절" } },
  { clause: "5.6.1-2", title: "데이터 수집·품질", status: "구현", impl: "15분 자동수집 · 상태코드 7종(VALID~SYNTHETIC) · 수집률/정상률/추정률 관리", nav: { go: "verify", label: "데이터 검증 화면" } },
  { clause: "5.6.3", title: "측정 (계측기 관리)", status: "구현", impl: "계측기 사양·정확도·교정주기 관리, 만료 시 검증 이슈(DQ-04) 생성", nav: { go: "master", label: "설비·센서 화면" } },
  { clause: "5.6.4", title: "수집 주기 적정성", status: "구현", impl: "15분(전력·온도)/60분(생산) — 일 단위 EnPI 산정에 충분", nav: { go: "master", label: "설비·센서 화면" } },
  { clause: "5.6.5", title: "이상치 식별·분석", status: "구현", impl: "물리범위·급변·고착 자동 검출(R-02) · 원본 보존 후 별도 정제값", nav: { go: "verify", label: "데이터 검증 화면" } },
  { clause: "6.2.1", title: "통계 모델 EnPI", status: "구현", impl: "OLS 회귀 · R² 0.973 · CV(RMSE) 3.9% · NMBE — 적합도 화면 표기", nav: { go: "mvplan", anchor: "mvsec-6", label: "계획서 6절" } },
  { clause: "6.2.3", title: "공학 모델", status: "향후", impl: "—", note: "물리 시뮬레이션 기반 모델 미지원" },
  { clause: "7", title: "에너지 베이스라인(EnB) 수립", status: "구현", impl: "기준기간 12개월 · 제외규칙 명시 · 모델·기간·조건 문서화(BL-v1.0)", nav: { go: "mvplan", anchor: "mvsec-4", label: "계획서 4절" } },
  { clause: "8", title: "EnB 정규화·조정", status: "구현", impl: "일상 조정(회귀 정규화) + 비일상 조정(승인 기반) — 조정 전/후 비교 화면", nav: { go: "form", anchor: "mvsec-4", label: "결과보고서 4절" } },
  { clause: "9", title: "EnB 유지·갱신", status: "부분", impl: "비일상 조정·계수 변경 시 새 계산버전 생성, 기존본 보존", note: "정기 재수립(모델 재적합) 주기 정책은 향후", nav: { go: "history", label: "이력·버전 비교 탭" } },
];

export const matrixSummary = (rows: ComplyRow[]) => ({
  ok: rows.filter((r) => r.status === "구현").length,
  partial: rows.filter((r) => r.status === "부분").length,
  todo: rows.filter((r) => r.status === "향후").length,
  total: rows.length,
});

/* ---------- ECM (에너지효율개선 기술) 목록 — 계획서 2절·결과보고서 1.3절 ---------- */
export interface EcmRow {
  no: number;
  asset: string;
  ecm: string;
  saveFactor: string; // 에너지절감요소
}
export const ecmList: EcmRow[] = [
  { no: 1, asset: "CH-01 냉동기 1", ecm: "고효율 냉동기 교체 (CH-01R, 저GWP R-1233zd(E))", saveFactor: "압축 효율 개선 · 부분부하 성능" },
  { no: 2, asset: "CHWP 냉수펌프", ecm: "인버터(VFD) 제어 도입", saveFactor: "반송 동력 저감 (유량 비례 제어)" },
  { no: 3, asset: "CT-01 냉각탑", ecm: "냉각탑 팬 제어 최적화", saveFactor: "응축 온도 관리 · 팬 동력 저감" },
];

/* ---------- 요구사항 (결과보고서 1.1절) ---------- */
export const mvRequirements: Array<[string, string[]]> = [
  ["에너지사용자 (공장, 데모)", ["제3자가 신뢰할 수 있는 절감량 산정·검증", "데이터 품질과 제외·조정 내역의 투명한 공개"]],
  ["진단·검증 수행자 (데모)", ["계측 기반 자동 산정으로 수기 개입 최소화", "증적·감사로그로 검증 대응 자료 자동 구성"]],
];

/* ---------- 측정·수집 방법 표 (계획서 4.4·결과보고서 3.4) ---------- */
export const dataCollection: Array<[string, string, string]> = [
  ["전력 사용량 (종속변수)", "전력계 PM-* 5점 · 15분 자동수집", "0.5급 · 한전 청구서 월별 대사"],
  ["냉방도일 (독립변수)", "기상 센서 WS-01 외기온도 → 일별 CDD 계산", "±0.3℃ · 기상청 관측값 대조(데모)"],
  ["생산량 (독립변수)", "MES 연계 60분 · 월말 수기보정 이력 관리", "라인 합계 ton/일"],
];
