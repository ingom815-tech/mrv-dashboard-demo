import { create } from "zustand";
import type { EquipGroup } from "./lib/mrvData";

export type MenuKey = "overview" | "equipment" | "verify" | "master";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  selectedMonth: string | null;
  equipFilter: EquipGroup | "all";
  setMenu: (m: MenuKey) => void;
  openEvidence: () => void;
  closeEvidence: () => void;
  selectMonth: (m: string | null) => void;
  setEquipFilter: (g: EquipGroup | "all") => void;
}

// 상세 화면에서 돌아와도 보고기간·선택 필터 유지 (지시문 §9)
export const useUI = create<UIState>((set) => ({
  menu: "overview",
  evidenceOpen: false,
  selectedMonth: null,
  equipFilter: "all",
  setMenu: (menu) => set({ menu }),
  openEvidence: () => set({ evidenceOpen: true }),
  closeEvidence: () => set({ evidenceOpen: false }),
  selectMonth: (selectedMonth) => set({ selectedMonth }),
  setEquipFilter: (equipFilter) => set({ equipFilter }),
}));
