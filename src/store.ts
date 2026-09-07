import { create } from "zustand";
import { reviewItems, EF, TARIFF, type EquipGroup } from "./lib/mrvData";
import { DEFAULT_METRIC } from "./lib/factoryData";

// ---------- 배출계수 버전관리 (CLAUDE.md: 등록·적용·버전관리, 변경 시 새 계산버전) ----------
export interface EfVersion {
  version: string;
  value: number;
  unit: string;
  source: string;
  baseYear: number;
  validFrom: string;
  validTo: string;
  status: "적용 중" | "이력";
  registeredAt: string;
}
const defaultEfList = (): EfVersion[] => [
  {
    version: "EF-v1.0",
    value: EF.value,
    unit: EF.unit,
    source: EF.source,
    baseYear: EF.baseYear,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    status: "적용 중",
    registeredAt: "2026-01-01 00:00",
  },
];

// ---------- 검토·승인 워크플로우 (localStorage 영속) ----------
export type ReviewState = "검토 필요" | "검토 완료" | "승인 완료";
export type Role = "일반" | "검토자" | "승인자";
export interface AuditEntry {
  ts: string;
  actor: Role;
  action: string;
  target: string;
  detail: string;
}

const LS_STATES = "mrv-review-states";
const LS_AUDIT = "mrv-audit-log";

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const saveJson = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 저장 실패는 무시 (데모) */
  }
};

const defaultStates = (): Record<string, ReviewState> =>
  Object.fromEntries(reviewItems.map((r) => [r.id, r.initialState as ReviewState]));

/* 2026-09 단순화 개편: 기본 모드(고객용) 3화면 + 관리자 모드(기존 화면 전부 재배치, 삭제 없음) */
export type MenuKey =
  | "summary" | "equipperf" | "reportdoc" // 기본 모드
  | "overview" | "equipment" | "verify" | "report" | "master" | "equipconfig"; // 관리자 모드

// URL 해시로 화면 딥링크 지원 (#/equipment 등) — 스크린샷·공유용
const MENU_KEYS: MenuKey[] = ["summary", "equipperf", "reportdoc", "overview", "equipment", "verify", "report", "master", "equipconfig"];
export const ADMIN_MENUS: MenuKey[] = ["overview", "equipment", "verify", "report", "master", "equipconfig"];
const initialMenu: MenuKey =
  MENU_KEYS.find((k) => k === window.location.hash.split("/")[1]) ?? "summary";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  traceOpen: boolean;
  openTrace: () => void;
  closeTrace: () => void;
  guideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  /* 알림 센터 — 파생 알림(저장 안 함) + 읽음 상태만 영속 */
  notifOpen: boolean;
  openNotif: () => void;
  closeNotif: () => void;
  notifRead: string[];
  markNotifRead: (ids: string[]) => void;
  /* 관리자 모드 — 기본 진입 시 비노출, 좌측 내비 하단 토글 */
  adminMode: boolean;
  setAdminMode: (v: boolean) => void;
  selectedMonth: string | null;
  equipFilter: EquipGroup | "all";
  selectedEquip: string;
  equipGroup: string; // 설비군 분석 선택 (all | boiler | chiller | ...)
  setEquipGroup: (g: string) => void;
  analysisScope: string; // 공장 종합현황 분석 범위 (factory | 설비군 key)
  analysisMetric: string; // 분석 지표
  setAnalysisScope: (s: string) => void; // 범위 변경 시 기본 지표로 자동 전환
  setAnalysisMetric: (m: string) => void;
  role: Role;
  reviewStates: Record<string, ReviewState>;
  audit: AuditEntry[];
  efList: EfVersion[];
  tariffValue: number;
  setMenu: (m: MenuKey) => void;
  openEvidence: () => void;
  closeEvidence: () => void;
  selectMonth: (m: string | null) => void;
  setEquipFilter: (g: EquipGroup | "all") => void;
  setSelectedEquip: (k: string) => void;
  setRole: (r: Role) => void;
  markReviewed: (id: string) => void;
  approve: (id: string) => void;
  resetDemoStates: () => void;
  registerEf: (input: { value: number; source: string; baseYear: number; validFrom: string; validTo: string }) => void;
  setTariff: (v: number) => void;
  logAudit: (action: string, target: string, detail: string) => void;
  invStatus: InvStatus;
  invAction: (a: "request" | "reviewOk" | "fix" | "approve" | "reset", opinion?: string) => void;
  /* 명세서 수기 입력 필드 (담당자 정보·예외 사유·확인 필요 소명 — 계산값은 입력 불가) */
  invInputs: Record<string, string>;
  setInvInput: (key: string, label: string, value: string) => void;
  revokeInvApproval: () => void; // 승인 해제 (승인자 전용) — 수정 재개용
  /* MRV 프로젝트 관리 */
  projects: ProjectRec[];
  addProject: (name: string, group: string) => void;
  removeProject: (id: string) => void;
  toggleProjectReport: (id: string) => void;
  reorderProjects: (fromId: string, toId: string) => void;
  /* M&V 계획서 — 실무자 선택 항목 + 승인 흐름 */
  planInputs: Record<string, string>;
  setPlanInput: (key: string, label: string, value: string) => void;
  planStatus: PlanStatus;
  planAction: (a: "request" | "approve" | "revoke", opinion?: string) => void;
  /* ESG 공시 데이터 — 2030 환경목표 수기 입력 + 확정 흐름 (공시 검증은 외부 기관 소관이라 2단계만) */
  esgInputs: Record<string, string>;
  setEsgInput: (key: string, label: string, value: string) => void;
  esgStatus: "작성 중" | "확정";
  esgAction: (a: "confirm" | "revoke") => void;
  /* 로그인 (데모 — 인증 서버 없음, SaaS 전환 시 SSO/OAuth) */
  authed: boolean;
  loginAs: (email: string) => void;
  logout: () => void;
  /* 사업장(공장) 등록·선택 — SaaS 멀티사업장 */
  sites: SiteRec[];
  currentSite: string;
  setCurrentSite: (id: string) => void;
  addSite: (name: string, region: string) => void;
  removeSite: (id: string) => void;
  siteOnboardNext: (id: string, stepLabel: string, patch: Record<string, string>) => void;
  /* 사용자·권한 관리 */
  users: UserRec[];
  inviteUser: (email: string, roleTo: Role) => void;
  changeUserRole: (id: string, roleTo: Role) => void;
  removeUser: (id: string) => void;
  acceptInvite: (id: string) => void;
}

/* 명세서(인벤토리 보고서) 상태 흐름 */
export type InvStatus = "작성 중" | "검토 요청" | "수정 요청" | "검토 완료·승인 대기" | "승인 완료";

/* M&V 계획서 상태 — 계획은 사전 승인이 원칙 (IPMVP): 승인 전 결과보고서는 초안 취급 */
export type PlanStatus = "작성 중" | "승인 대기" | "승인 완료";

/* ---------- 사업장(공장) 관리 — SaaS 멀티사업장 구조 ---------- */
export interface SiteRec {
  id: string;
  name: string;
  region: string;
  status: "운영 중" | "온보딩 중";
  demo?: boolean; // 합성데이터가 존재하는 기본 사업장 (삭제 불가)
  onboard?: number; // 완료된 온보딩 단계 수 (1 = 등록 완료, 5 = 개시 요청 완료)
  onboardData?: Record<string, string>; // 단계별 입력 요약 (설비군·연계 소스·기준기간 등)
}
const defaultSites = (): SiteRec[] => [
  { id: "SITE-01", name: "제1공장", region: "강원 (데모)", status: "운영 중", demo: true },
];

/* ---------- 사용자·권한 관리 (조직 계정 — SaaS) ---------- */
export interface UserRec {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
  status: "활성" | "초대 대기";
  self?: boolean; // 현재 로그인 사용자 (삭제 불가)
}
const defaultUsers = (): UserRec[] => [
  { id: "U-01", name: "작성자(데모)", email: "demo@example.com", role: "일반", org: "에너지관리팀", status: "활성", self: true },
  { id: "U-02", name: "MRV 검토자(데모)", email: "reviewer@example.com", role: "검토자", org: "에너지관리 담당", status: "활성" },
  { id: "U-03", name: "MRV 승인자(데모)", email: "approver@example.com", role: "승인자", org: "MRV 책임자", status: "활성" },
];

/* ---------- MRV 프로젝트 관리 (목록·추가·삭제·보고서 생성 대상 선택) ---------- */
export interface ProjectRec {
  id: string;
  name: string;
  group: string; // 대상 설비군
  stage: "검증 중" | "개시 전" | "후보";
  report: boolean; // 보고서 생성 대상 여부
  builtin?: "chiller" | "boiler" | "pv"; // 상세 구현이 있는 기본 프로젝트 (삭제 불가)
}
const defaultProjects = (): ProjectRec[] => [
  { id: "MVP-2026-01", name: "중앙 냉수플랜트 효율개선", group: "냉동·냉장", stage: "검증 중", report: true, builtin: "chiller" },
  { id: "GEN-2026-01", name: "태양광·ESS 발전 성과", group: "태양광·ESS", stage: "검증 중", report: true, builtin: "pv" },
  { id: "MVP-2026-02", name: "보일러 폐열회수", group: "보일러·스팀", stage: "개시 전", report: true, builtin: "boiler" },
  { id: "CAND-01", name: "압축공기 누설개선", group: "압축공기", stage: "후보", report: false },
];
/* 저장된 목록에 기본(builtin) 프로젝트가 빠져 있으면 보충 — 기능 추가 시 기존 localStorage 마이그레이션 */
const withBuiltinProjects = (list: ProjectRec[]): ProjectRec[] => {
  const missing = defaultProjects().filter((d) => d.builtin && !list.some((p) => p.builtin === d.builtin));
  return missing.length ? [...list, ...missing] : list;
};

// 상세 화면에서 돌아와도 보고기간·선택 필터 유지 (지시문 §9)
export const useUI = create<UIState>((set, get) => ({
  menu: initialMenu,
  evidenceOpen: false,
  traceOpen: false,
  openTrace: () => set({ traceOpen: true }),
  closeTrace: () => set({ traceOpen: false }),
  // 첫 방문이면 가이드를 자동으로 1회 연다 (표시 즉시 seen 처리)
  guideOpen: (() => {
    const seen = loadJson<boolean>("mrv-guide-seen", false);
    if (!seen) saveJson("mrv-guide-seen", true);
    return !seen;
  })(),
  openGuide: () => set({ guideOpen: true }),
  closeGuide: () => set({ guideOpen: false }),
  notifOpen: false,
  openNotif: () => set({ notifOpen: true }),
  closeNotif: () => set({ notifOpen: false }),
  notifRead: loadJson<string[]>("mrv-notif-read", []),
  markNotifRead: (ids) => {
    const next = Array.from(new Set([...get().notifRead, ...ids]));
    saveJson("mrv-notif-read", next);
    set({ notifRead: next });
  },
  // 관리자 화면 해시로 직접 진입한 경우 토글도 켜진 상태로 시작
  adminMode: loadJson<boolean>("mrv-admin-mode", false) || ADMIN_MENUS.includes(initialMenu),
  setAdminMode: (v) => {
    saveJson("mrv-admin-mode", v);
    // 관리자 모드를 끄면 관리자 화면에서 기본 첫 화면으로 복귀
    const cur = get().menu;
    set(v ? { adminMode: v } : { adminMode: v, menu: ADMIN_MENUS.includes(cur) ? "summary" : cur });
  },
  selectedMonth: null,
  equipFilter: "all",
  selectedEquip: "ch1",
  equipGroup: window.location.hash.split("/")[2] && window.location.hash.startsWith("#/equipment")
    ? window.location.hash.split("/")[2]
    : "all",
  setEquipGroup: (equipGroup) => set({ equipGroup }),
  analysisScope: (() => {
    const seg = window.location.hash.split("/");
    return seg[1] === "overview" && seg[2] && DEFAULT_METRIC[seg[2]] ? seg[2] : "factory";
  })(),
  analysisMetric: (() => {
    const seg = window.location.hash.split("/");
    const s = seg[1] === "overview" && seg[2] && DEFAULT_METRIC[seg[2]] ? seg[2] : "factory";
    return DEFAULT_METRIC[s] ?? "energy";
  })(),
  setAnalysisScope: (analysisScope) =>
    set({ analysisScope, analysisMetric: DEFAULT_METRIC[analysisScope] ?? "energy" }),
  setAnalysisMetric: (analysisMetric) => set({ analysisMetric }),
  role: "일반",
  reviewStates: { ...defaultStates(), ...loadJson<Record<string, ReviewState>>(LS_STATES, {}) },
  audit: loadJson<AuditEntry[]>(LS_AUDIT, []),
  efList: loadJson<EfVersion[]>("mrv-ef-list", defaultEfList()),
  tariffValue: loadJson<number>("mrv-tariff", TARIFF.value),
  // 딥링크(알림·가이드·근거 링크)로 관리자 화면 이동 시 관리자 모드 자동 활성 (내비 맥락 일치)
  setMenu: (menu) => {
    if (ADMIN_MENUS.includes(menu) && !get().adminMode) {
      saveJson("mrv-admin-mode", true);
      set({ menu, adminMode: true });
    } else set({ menu });
  },
  setSelectedEquip: (selectedEquip) => set({ selectedEquip }),
  openEvidence: () => set({ evidenceOpen: true }),
  closeEvidence: () => set({ evidenceOpen: false }),
  selectMonth: (selectedMonth) => set({ selectedMonth }),
  setEquipFilter: (equipFilter) => set({ equipFilter }),
  setRole: (role) => set({ role }),
  // 역할 분리: 검토는 검토자만, 승인은 승인자만. 승인 완료 건은 수정 불가 (CLAUDE.md 확정사항)
  markReviewed: (id) => {
    const { role, reviewStates, audit } = get();
    if (role !== "검토자" || reviewStates[id] !== "검토 필요") return;
    const next = { ...reviewStates, [id]: "검토 완료" as ReviewState };
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actor: role,
      action: "검토 완료",
      target: id,
      detail: `${id} 검토 완료 처리`,
    };
    const nextAudit = [entry, ...audit];
    saveJson(LS_STATES, next);
    saveJson(LS_AUDIT, nextAudit);
    set({ reviewStates: next, audit: nextAudit });
  },
  approve: (id) => {
    const { role, reviewStates, audit } = get();
    if (role !== "승인자" || reviewStates[id] !== "검토 완료") return;
    const next = { ...reviewStates, [id]: "승인 완료" as ReviewState };
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actor: role,
      action: "승인 완료",
      target: id,
      detail: `${id} 승인 — 확정본 보존, 필요 시 새 계산버전 생성`,
    };
    const nextAudit = [entry, ...audit];
    saveJson(LS_STATES, next);
    saveJson(LS_AUDIT, nextAudit);
    set({ reviewStates: next, audit: nextAudit });
  },
  // 배출계수 등록: 기존 적용본은 이력으로 보존, 새 버전 적용 → 새 계산버전으로 재산정
  registerEf: (input) => {
    const { role, efList, audit } = get();
    if (role === "일반") return; // 일반 역할은 기준정보 수정 불가
    const ver = `EF-v1.${efList.length}`;
    const next: EfVersion[] = [
      ...efList.map((e) => ({ ...e, status: "이력" as const })),
      {
        version: ver,
        value: input.value,
        unit: EF.unit,
        source: input.source || "데모 입력",
        baseYear: input.baseYear,
        validFrom: input.validFrom,
        validTo: input.validTo,
        status: "적용 중",
        registeredAt: new Date().toLocaleString("sv-SE").slice(0, 16),
      },
    ];
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actor: role,
      action: "계수 등록",
      target: ver,
      detail: `배출계수 ${input.value} ${EF.unit} 등록·적용 — 새 계산버전 생성`,
    };
    const nextAudit = [entry, ...audit];
    saveJson("mrv-ef-list", next);
    saveJson(LS_AUDIT, nextAudit);
    set({ efList: next, audit: nextAudit });
  },
  setTariff: (v) => {
    if (get().role === "일반" || !Number.isFinite(v) || v <= 0) return;
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actor: get().role,
      action: "단가 변경",
      target: "TARIFF",
      detail: `가정단가 ${v} 원/kWh 적용`,
    };
    const nextAudit = [entry, ...get().audit];
    saveJson("mrv-tariff", v);
    saveJson(LS_AUDIT, nextAudit);
    set({ tariffValue: v, audit: nextAudit });
  },
  invStatus: loadJson<InvStatus>("mrv-inv-status", "작성 중"),
  // 명세서 상태 흐름: 작성 중 → 검토 요청 → (검토자) 검토 완료·승인 대기 | 수정 요청 → (승인자) 승인 완료
  invAction: (a, opinion) => {
    const { role, invStatus, logAudit } = get();
    let next: InvStatus | null = null;
    if (a === "request" && (invStatus === "작성 중" || invStatus === "수정 요청")) next = "검토 요청";
    if (a === "reviewOk" && role === "검토자" && invStatus === "검토 요청") next = "검토 완료·승인 대기";
    if (a === "fix" && role === "검토자" && invStatus === "검토 요청") next = "수정 요청";
    if (a === "approve" && role === "승인자" && invStatus === "검토 완료·승인 대기") next = "승인 완료";
    if (a === "reset") next = "작성 중";
    if (!next) return;
    saveJson("mrv-inv-status", next);
    set({ invStatus: next });
    logAudit(
      a === "request" ? "검토 요청" : a === "reviewOk" ? "검토 완료" : a === "fix" ? "수정 요청" : a === "approve" ? "명세서 승인" : "초기화",
      "명세서",
      `${next}${opinion ? ` — 의견: ${opinion}` : ""} (RPT-2026-DEMO)`,
    );
  },
  invInputs: loadJson<Record<string, string>>("mrv-inv-inputs", {}),
  // 수기 입력 정책: 계산 결과는 수정 불가, 허용된 필드만 입력. 검토 중 데이터가 바뀌면 상태를 '작성 중'으로 회귀
  setInvInput: (key, label, value) => {
    const { invStatus, invInputs, logAudit } = get();
    if (invStatus === "승인 완료") return; // 승인 완료본은 수정 불가 (해제 후 수정)
    const next = { ...invInputs, [key]: value };
    saveJson("mrv-inv-inputs", next);
    set({ invInputs: next });
    if (invStatus === "검토 요청" || invStatus === "검토 완료·승인 대기") {
      saveJson("mrv-inv-status", "작성 중");
      set({ invStatus: "작성 중" });
      logAudit("수기 입력 변경", "명세서", `'${label}' 변경 — 검토 중 데이터 변경으로 상태를 '작성 중'으로 회귀 (재검토 필요)`);
    } else {
      logAudit("수기 입력", "명세서", `'${label}' 입력·수정 (RPT-2026-DEMO)`);
    }
  },
  // 프로젝트 관리 — 일반 역할은 조회만 (기준정보 수정 권한과 동일 정책)
  projects: withBuiltinProjects(loadJson<ProjectRec[]>("mrv-projects", defaultProjects())),
  addProject: (name, group) => {
    const { role, projects, logAudit } = get();
    if (role === "일반" || !name.trim()) return;
    const seq = projects.filter((p) => p.id.startsWith("CAND-")).length + 1;
    const next: ProjectRec[] = [
      ...projects,
      { id: `CAND-${String(seq + 1).padStart(2, "0")}`, name: name.trim(), group, stage: "후보", report: false },
    ];
    saveJson("mrv-projects", next);
    set({ projects: next });
    logAudit("프로젝트 등록", name.trim(), `대상 설비군 ${group} · 단계 후보 — 사전진단 후 M&V 계획 수립 대상`);
  },
  removeProject: (id) => {
    const { role, projects, logAudit } = get();
    const target = projects.find((p) => p.id === id);
    if (role === "일반" || !target || target.builtin) return; // 상세 구현 프로젝트는 삭제 불가
    const next = projects.filter((p) => p.id !== id);
    saveJson("mrv-projects", next);
    set({ projects: next });
    logAudit("프로젝트 삭제", target.name, `${id} 삭제 — 후보 단계 프로젝트 (감사로그 보존)`);
  },
  /* 드래그·버튼으로 표시 순서 변경 — 보고·승인 프로젝트 드롭다운 순서에도 반영 (전 역할 허용·감사로그) */
  reorderProjects: (fromId, toId) => {
    const { projects, logAudit } = get();
    if (fromId === toId) return;
    const list = [...projects];
    const fi = list.findIndex((p) => p.id === fromId);
    const ti = list.findIndex((p) => p.id === toId);
    if (fi < 0 || ti < 0) return;
    const [item] = list.splice(fi, 1);
    list.splice(ti, 0, item);
    saveJson("mrv-projects", list);
    set({ projects: list });
    logAudit("프로젝트 순서 변경", item.name, `표시 순서 ${fi + 1} → ${ti + 1}`);
  },
  toggleProjectReport: (id) => {
    const { role, projects, logAudit } = get();
    if (role === "일반") return;
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const next = projects.map((p) => (p.id === id ? { ...p, report: !p.report } : p));
    saveJson("mrv-projects", next);
    set({ projects: next });
    logAudit("보고서 대상 변경", target.name, `보고서 생성 ${target.report ? "제외" : "포함"} 처리`);
  },
  /* M&V 계획서: 선택 항목 편집 — 승인 완료본은 잠금, 승인 대기 중 수정 시 '작성 중' 회귀 */
  planInputs: loadJson<Record<string, string>>("mrv-plan-inputs", {}),
  setPlanInput: (key, label, value) => {
    const { planStatus, planInputs, logAudit } = get();
    if (planStatus === "승인 완료") return;
    const next = { ...planInputs, [key]: value };
    saveJson("mrv-plan-inputs", next);
    set({ planInputs: next });
    if (planStatus === "승인 대기") {
      saveJson("mrv-plan-status", "작성 중");
      set({ planStatus: "작성 중" });
      logAudit("계획 변경", "M&V 계획서", `'${label}' 변경 — 승인 대기 중 수정으로 '작성 중' 회귀 (재요청 필요)`);
    } else {
      logAudit("계획 입력", "M&V 계획서", `'${label}' 입력·수정 (MVP-2026-01)`);
    }
  },
  planStatus: loadJson<PlanStatus>("mrv-plan-status", "승인 대기"),
  planAction: (a, opinion) => {
    const { role, planStatus, planInputs, logAudit } = get();
    let next: PlanStatus | null = null;
    // Option B 외 선택 시 승인 요청 불가 (시스템 지원 범위 검증)
    const opt = planInputs["option"] ?? "B";
    if (a === "request" && planStatus === "작성 중" && opt === "B") next = "승인 대기";
    if (a === "approve" && role === "승인자" && planStatus === "승인 대기") next = "승인 완료";
    if (a === "revoke" && role === "승인자" && planStatus === "승인 완료") next = "작성 중";
    if (!next) return;
    saveJson("mrv-plan-status", next);
    set({ planStatus: next });
    logAudit(
      a === "request" ? "계획 승인 요청" : a === "approve" ? "계획 승인" : "계획 승인 해제",
      "M&V 계획서",
      `${next}${opinion ? ` — 의견: ${opinion}` : ""} (MVP-2026-01 · 계획서 버전 이력 보존)`,
    );
  },
  /* 사업장 관리 — 데모 데이터는 SITE-01에만 존재, 신규 등록분은 온보딩 중 상태 */
  sites: loadJson<SiteRec[]>("mrv-sites", defaultSites()),
  currentSite: loadJson<string>("mrv-current-site", "SITE-01"),
  setCurrentSite: (id) => {
    if (!get().sites.some((s) => s.id === id)) return;
    saveJson("mrv-current-site", id);
    set({ currentSite: id });
  },
  addSite: (name, region) => {
    const { role, sites, logAudit } = get();
    if (role === "일반" || !name.trim()) return;
    const id = `SITE-${String(sites.length + 1).padStart(2, "0")}`;
    const next: SiteRec[] = [...sites, { id, name: name.trim(), region: region.trim() || "미지정", status: "온보딩 중", onboard: 1, onboardData: {} }];
    saveJson("mrv-sites", next);
    set({ sites: next });
    logAudit("사업장 등록", name.trim(), `${id} 등록 — 온보딩(설비·계측·기준선) 후 운영 전환`);
  },
  /* 온보딩 단계 진행 — 단계별 입력을 저장하고 감사로그 기록 (일반 역할 조회만) */
  siteOnboardNext: (id, stepLabel, patch) => {
    const { role, sites, logAudit } = get();
    const target = sites.find((s) => s.id === id);
    if (role === "일반" || !target || target.demo) return;
    const nextStep = Math.min((target.onboard ?? 1) + 1, 5);
    const next = sites.map((s) =>
      s.id === id ? { ...s, onboard: nextStep, onboardData: { ...(s.onboardData ?? {}), ...patch } } : s,
    );
    saveJson("mrv-sites", next);
    set({ sites: next });
    logAudit("온보딩 단계 완료", target.name, `${stepLabel} 완료 (${nextStep}/5)${nextStep === 5 ? " — 개시 요청, 계측 수집 대기" : ""}`);
  },
  removeSite: (id) => {
    const { role, sites, currentSite, logAudit } = get();
    const target = sites.find((s) => s.id === id);
    if (role === "일반" || !target || target.demo) return;
    const next = sites.filter((s) => s.id !== id);
    saveJson("mrv-sites", next);
    set({ sites: next });
    if (currentSite === id) {
      saveJson("mrv-current-site", "SITE-01");
      set({ currentSite: "SITE-01" });
    }
    logAudit("사업장 삭제", target.name, `${id} 삭제 (온보딩 중 사업장)`);
  },
  /* 사용자 관리 — 초대·역할 변경·삭제 (검토자·승인자만, 감사로그 기록). 초대는 데모라 이메일 미발송 */
  users: loadJson<UserRec[]>("mrv-users", defaultUsers()),
  inviteUser: (email, roleTo) => {
    const { role, users, logAudit } = get();
    if (role === "일반" || !email.trim() || users.some((u) => u.email === email.trim())) return;
    const id = `U-${String(users.length + 1).padStart(2, "0")}`;
    const next: UserRec[] = [
      ...users,
      { id, name: `${email.split("@")[0]} (초대)`, email: email.trim(), role: roleTo, org: "미지정", status: "초대 대기" },
    ];
    saveJson("mrv-users", next);
    set({ users: next });
    logAudit("사용자 초대", email.trim(), `역할 ${roleTo} 초대 발송 (데모 — 실제 이메일 미발송, SaaS에서 초대 메일·SSO 연동)`);
  },
  changeUserRole: (id, roleTo) => {
    const { role, users, logAudit } = get();
    if (role === "일반") return;
    const target = users.find((u) => u.id === id);
    if (!target || target.role === roleTo) return;
    const next = users.map((u) => (u.id === id ? { ...u, role: roleTo } : u));
    saveJson("mrv-users", next);
    set({ users: next });
    if (target.self) set({ role: roleTo }); // 본인 역할 변경은 세션 역할과 동기화
    logAudit("역할 변경", target.name, `${target.role} → ${roleTo}${target.self ? " (본인 — 세션 역할 동기화)" : ""}`);
  },
  removeUser: (id) => {
    const { role, users, logAudit } = get();
    const target = users.find((u) => u.id === id);
    if (role === "일반" || !target || target.self) return;
    const next = users.filter((u) => u.id !== id);
    saveJson("mrv-users", next);
    set({ users: next });
    logAudit("사용자 삭제", target.name, `${target.email} 계정 제거 (감사로그 보존)`);
  },
  acceptInvite: (id) => {
    const { users, logAudit } = get();
    const target = users.find((u) => u.id === id);
    if (!target || target.status !== "초대 대기") return;
    const next = users.map((u) => (u.id === id ? { ...u, status: "활성" as const, name: u.name.replace(" (초대)", " (데모)") } : u));
    saveJson("mrv-users", next);
    set({ users: next });
    logAudit("초대 수락", target.email, "초대 수락 처리 (데모) — 계정 활성화");
  },
  /* 데모 로그인 — 세션 표시용 (임의 자격증명 허용, 서버 검증 없음을 화면에 명시) */
  authed: loadJson<boolean>("mrv-authed", false),
  loginAs: (email) => {
    saveJson("mrv-authed", true);
    set({ authed: true });
    get().logAudit("로그인", "세션", `${email || "demo@example.com"} 데모 로그인 (인증 서버 없음)`);
  },
  logout: () => {
    get().logAudit("로그아웃", "세션", "데모 세션 종료");
    saveJson("mrv-authed", false);
    set({ authed: false });
  },
  /* ESG: 목표 입력은 확정 전만, 확정/해제는 검토자·승인자 (감사로그 기록) */
  esgInputs: loadJson<Record<string, string>>("mrv-esg-inputs", {}),
  setEsgInput: (key, label, value) => {
    const { esgStatus, esgInputs, logAudit } = get();
    if (esgStatus === "확정") return;
    const next = { ...esgInputs, [key]: value };
    saveJson("mrv-esg-inputs", next);
    set({ esgInputs: next });
    logAudit("ESG 목표 입력", "ESG 공시 데이터", `'${label}' 입력·수정`);
  },
  esgStatus: loadJson<"작성 중" | "확정">("mrv-esg-status", "작성 중"),
  esgAction: (a) => {
    const { role, esgStatus, logAudit } = get();
    if (role === "일반") return;
    const next = a === "confirm" && esgStatus === "작성 중" ? "확정" : a === "revoke" && esgStatus === "확정" ? "작성 중" : null;
    if (!next) return;
    saveJson("mrv-esg-status", next);
    set({ esgStatus: next });
    logAudit(a === "confirm" ? "ESG 데이터 확정" : "ESG 확정 해제", "ESG 공시 데이터", `${next} — 부록 문서·데이터 팩 기준 (외부 공시 검증은 별도)`);
  },
  revokeInvApproval: () => {
    const { role, invStatus, logAudit } = get();
    if (role !== "승인자" || invStatus !== "승인 완료") return;
    saveJson("mrv-inv-status", "작성 중");
    set({ invStatus: "작성 중" });
    logAudit("승인 해제", "명세서", "승인자 승인 해제 — 수정 재개, 재검토·재승인 필요 (기존 승인 이력은 감사로그 보존)");
  },
  logAudit: (action, target, detail) => {
    const entry: AuditEntry = { ts: new Date().toISOString(), actor: get().role, action, target, detail };
    const nextAudit = [entry, ...get().audit];
    saveJson(LS_AUDIT, nextAudit);
    set({ audit: nextAudit });
  },
  resetDemoStates: () => {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actor: get().role,
      action: "초기화",
      target: "전체",
      detail: "데모 검토·승인 상태 초기화",
    };
    const nextAudit = [entry, ...get().audit];
    saveJson(LS_STATES, {});
    saveJson(LS_AUDIT, nextAudit);
    saveJson("mrv-ef-list", defaultEfList());
    saveJson("mrv-tariff", TARIFF.value);
    saveJson("mrv-inv-status", "작성 중");
    saveJson("mrv-inv-inputs", {});
    saveJson("mrv-projects", defaultProjects());
    saveJson("mrv-plan-inputs", {});
    saveJson("mrv-plan-status", "승인 대기");
    saveJson("mrv-esg-inputs", {});
    saveJson("mrv-esg-status", "작성 중");
    saveJson("mrv-sites", defaultSites());
    saveJson("mrv-current-site", "SITE-01");
    saveJson("mrv-users", defaultUsers());
    saveJson("mrv-notif-read", []);
    set({
      notifRead: [],
      sites: defaultSites(),
      currentSite: "SITE-01",
      users: defaultUsers(),
      planInputs: {},
      planStatus: "승인 대기",
      esgInputs: {},
      esgStatus: "작성 중",
      reviewStates: defaultStates(),
      audit: nextAudit,
      efList: defaultEfList(),
      tariffValue: TARIFF.value,
      invStatus: "작성 중",
      invInputs: {},
      projects: defaultProjects(),
    });
  },
}));

export const activeEf = (efList: EfVersion[]): EfVersion =>
  efList.find((e) => e.status === "적용 중") ?? efList[efList.length - 1];

// 전체 검증 상태 파생: 하나라도 검토 필요 → 검토 중, 전부 승인 → 승인 완료
export const deriveVerify = (states: Record<string, ReviewState>) => {
  const vals = Object.values(states);
  const pending = vals.filter((v) => v === "검토 필요").length;
  const state = vals.every((v) => v === "승인 완료")
    ? "승인 완료"
    : pending > 0
      ? "검토 중"
      : "검토 완료";
  return { state, pending };
};
