import { create } from "zustand";

export type MenuKey = "overview" | "analysis" | "verify" | "settings";

interface UIState {
  menu: MenuKey;
  evidenceOpen: boolean;
  selectedMonth: string | null;
  setMenu: (m: MenuKey) => void;
  openEvidence: () => void;
  closeEvidence: () => void;
  selectMonth: (m: string | null) => void;
}

// 상세 화면에서 돌아와도 보고기간·선택 상태 유지 (v2.1 §4.1)
export const useUI = create<UIState>((set) => ({
  menu: "overview",
  evidenceOpen: false,
  selectedMonth: null,
  setMenu: (menu) => set({ menu }),
  openEvidence: () => set({ evidenceOpen: true }),
  closeEvidence: () => set({ evidenceOpen: false }),
  selectMonth: (selectedMonth) => set({ selectedMonth }),
}));
