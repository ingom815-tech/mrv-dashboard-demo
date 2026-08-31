import { create } from "zustand";
import type { EquipGroup } from "./lib/mrvData";

export type MenuKey = "overview" | "equipment" | "verify" | "master";

// URL 해시로 화면 딥링크 지원 (#/equipment 등) — 스크린샷·공유용
const HASH_MENU: Record<string, MenuKey> = {
  "#/overview": "overview",
  "#/equipment": "equipment",
  "#/verify": "verify",
  "#/master": "master",
};
const initialMenu: MenuKey = HASH_MENU[window.location.hash] ?? "overview";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  selectedMonth: string | null;
  equipFilter: EquipGroup | "all";
  selectedEquip: string;
  setMenu: (m: MenuKey) => void;
  openEvidence: () => void;
  closeEvidence: () => void;
  selectMonth: (m: string | null) => void;
  setEquipFilter: (g: EquipGroup | "all") => void;
  setSelectedEquip: (k: string) => void;
}

// 상세 화면에서 돌아와도 보고기간·선택 필터 유지 (지시문 §9)
export const useUI = create<UIState>((set) => ({
  menu: initialMenu,
  evidenceOpen: false,
  selectedMonth: null,
  equipFilter: "all",
  selectedEquip: "ch1",
  setMenu: (menu) => set({ menu }),
  setSelectedEquip: (selectedEquip) => set({ selectedEquip }),
  openEvidence: () => set({ evidenceOpen: true }),
  closeEvidence: () => set({ evidenceOpen: false }),
  selectMonth: (selectedMonth) => set({ selectedMonth }),
  setEquipFilter: (equipFilter) => set({ equipFilter }),
}));
