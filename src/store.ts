import { create } from "zustand";
import { reviewItems, type EquipGroup } from "./lib/mrvData";

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

export type MenuKey = "overview" | "equipment" | "verify" | "master";

// URL 해시로 화면 딥링크 지원 (#/equipment 등) — 스크린샷·공유용
const MENU_KEYS: MenuKey[] = ["overview", "equipment", "verify", "master"];
const initialMenu: MenuKey =
  MENU_KEYS.find((k) => k === window.location.hash.split("/")[1]) ?? "overview";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  selectedMonth: string | null;
  equipFilter: EquipGroup | "all";
  selectedEquip: string;
  role: Role;
  reviewStates: Record<string, ReviewState>;
  audit: AuditEntry[];
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
}

// 상세 화면에서 돌아와도 보고기간·선택 필터 유지 (지시문 §9)
export const useUI = create<UIState>((set, get) => ({
  menu: initialMenu,
  evidenceOpen: false,
  selectedMonth: null,
  equipFilter: "all",
  selectedEquip: "ch1",
  role: "일반",
  reviewStates: { ...defaultStates(), ...loadJson<Record<string, ReviewState>>(LS_STATES, {}) },
  audit: loadJson<AuditEntry[]>(LS_AUDIT, []),
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
    set({ reviewStates: defaultStates(), audit: nextAudit });
  },
}));

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
