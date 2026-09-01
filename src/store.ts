import { create } from "zustand";
import { reviewItems, EF, TARIFF, type EquipGroup } from "./lib/mrvData";

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

export type MenuKey = "overview" | "equipment" | "verify" | "report" | "master";

// URL 해시로 화면 딥링크 지원 (#/equipment 등) — 스크린샷·공유용
const MENU_KEYS: MenuKey[] = ["overview", "equipment", "verify", "report", "master"];
const initialMenu: MenuKey =
  MENU_KEYS.find((k) => k === window.location.hash.split("/")[1]) ?? "overview";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  traceOpen: boolean;
  openTrace: () => void;
  closeTrace: () => void;
  guideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  selectedMonth: string | null;
  equipFilter: EquipGroup | "all";
  selectedEquip: string;
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
}

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
  selectedMonth: null,
  equipFilter: "all",
  selectedEquip: "ch1",
  role: "일반",
  reviewStates: { ...defaultStates(), ...loadJson<Record<string, ReviewState>>(LS_STATES, {}) },
  audit: loadJson<AuditEntry[]>(LS_AUDIT, []),
  efList: loadJson<EfVersion[]>("mrv-ef-list", defaultEfList()),
  tariffValue: loadJson<number>("mrv-tariff", TARIFF.value),
  setMenu: (menu) => set({ menu }),
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
    set({
      reviewStates: defaultStates(),
      audit: nextAudit,
      efList: defaultEfList(),
      tariffValue: TARIFF.value,
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
