import { create } from "zustand";
import typesJson from "./equipmentTypes.json";

/* 설비 커스텀 설정 — 데이터 접근 계층 (SaaS 전제).
   데모: localStorage 저장. SaaS 전환 시 이 파일의 load/save 함수만 서버 API 호출로 교체하면
   화면·산정 연동 코드는 그대로 동작함 (스키마 동일 — docs/equipment-schema.md 참조).
   산정 엔진(engine/*.js)은 수정하지 않음: 데모 연동(demo:true) 설비만 엔진 산정 결과에 매핑되고,
   신규 등록 설비는 필수 항목 충족 시 "수집 대기" 상태로 표시됨 (합성데이터 없음을 정직 표기). */

/* ---------- 유형 템플릿 ---------- */
export interface FieldDef {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  efLink: boolean; // 기본 배출계수(환산 기준) 연결 여부
}
export interface TypeDef {
  key: string;
  name: string;
  fields: FieldDef[];
}
export const EQUIP_SOURCES = typesJson.sources as string[];
export const EQUIP_TYPES = typesJson.types as TypeDef[];
export const typeOf = (key: string): TypeDef => EQUIP_TYPES.find((t) => t.key === key) ?? EQUIP_TYPES[0];

/* ---------- 설비 레코드 ---------- */
export interface FieldConn {
  on: boolean; // 연결 여부 (필수 항목은 항상 true로 강제)
  source: string; // EQUIP_SOURCES 중 하나
}
export interface EquipmentRec {
  id: string;
  name: string;
  type: string; // TypeDef.key
  location: string;
  phase: "도입 전" | "도입 후"; // 개선 설비 여부 (도입 전/후 구분)
  fields: Record<string, FieldConn>; // FieldDef.key → 연결 설정
  demo?: boolean; // 데모 합성데이터·엔진 산정에 연동된 기본 설비 (삭제 불가)
  engineTag?: string; // 엔진 태그 매핑 (데모 설비 전용 — synth.js TAGS 참조)
}

/* ---------- 전역 설정 (목표·단가·환산 기준 참조) ---------- */
export interface EquipSettings {
  targetCo2H1: number; // 반기 목표 감축량 (tCO₂e) — 목표 대비 달성률의 분모
  note: string;
}

const LS_EQUIP = "mrv-equip-config";
const LS_EQUIP_SET = "mrv-equip-settings";

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 데모 — 저장 실패 무시 */
  }
};

/* 기본 시드 — 엔진 합성데이터(냉수플랜트 5설비)와 매핑된 데모 설비 */
const chillerOn = (extra: string[] = []): Record<string, FieldConn> => {
  const out: Record<string, FieldConn> = {};
  for (const f of typeOf("chiller").fields) {
    const on = f.required || extra.includes(f.key);
    out[f.key] = { on, source: on ? "커넥터(데모 합성데이터)" : EQUIP_SOURCES[0] };
  }
  return out;
};
export const defaultEquipment = (): EquipmentRec[] => [
  { id: "EQ-01", name: "냉동기 1 (CH-01)", type: "chiller", location: "냉수플랜트", phase: "도입 후", demo: true, engineTag: "CH1_kW", fields: chillerOn(["chw_out_t", "chw_in_t", "chw_flow", "oat", "refrigerant"]) },
  { id: "EQ-02", name: "냉동기 2 (CH-02)", type: "chiller", location: "냉수플랜트", phase: "도입 전", demo: true, engineTag: "CH2_kW", fields: chillerOn(["chw_out_t", "chw_in_t", "chw_flow", "oat", "refrigerant"]) },
  { id: "EQ-03", name: "냉수 1차펌프 (CHWP)", type: "chiller", location: "냉수플랜트", phase: "도입 후", demo: true, engineTag: "CHWP_kW", fields: chillerOn(["chw_flow"]) },
  { id: "EQ-04", name: "냉각수펌프 (CWP)", type: "chiller", location: "냉수플랜트", phase: "도입 전", demo: true, engineTag: "CWP_kW", fields: chillerOn([]) },
  { id: "EQ-05", name: "냉각탑 (CT-01)", type: "chiller", location: "옥외", phase: "도입 후", demo: true, engineTag: "CT_kW", fields: chillerOn(["oat"]) },
];
export const defaultSettings = (): EquipSettings => ({
  targetCo2H1: 220, // 데모 가정값 — 실제 목표 아님
  note: "목표는 데모 가정값 — 실제 기대성과 아님",
});

/* 필수 항목 충족 여부 — 미충족 설비는 산정 대상에서 제외 */
export const requiredOk = (e: EquipmentRec): boolean =>
  typeOf(e.type).fields.filter((f) => f.required).every((f) => e.fields[f.key]?.on);

/* ---------- 반응형 스토어 (zustand) — 데이터 접근은 위 load/save 계층만 사용 ---------- */
interface EquipStore {
  equipment: EquipmentRec[];
  settings: EquipSettings;
  addEquipment: (e: Omit<EquipmentRec, "id">) => void;
  updateEquipment: (id: string, patch: Partial<EquipmentRec>) => void;
  removeEquipment: (id: string) => void;
  setSettings: (patch: Partial<EquipSettings>) => void;
  resetEquipment: () => void;
}
export const useEquip = create<EquipStore>((set, get) => ({
  equipment: load<EquipmentRec[]>(LS_EQUIP, defaultEquipment()),
  settings: load<EquipSettings>(LS_EQUIP_SET, defaultSettings()),
  addEquipment: (e) => {
    const id = `EQ-${String(Date.now()).slice(-6)}`;
    const next = [...get().equipment, { ...e, id }];
    save(LS_EQUIP, next);
    set({ equipment: next });
  },
  updateEquipment: (id, patch) => {
    const next = get().equipment.map((x) => (x.id === id ? { ...x, ...patch } : x));
    save(LS_EQUIP, next);
    set({ equipment: next });
  },
  removeEquipment: (id) => {
    const target = get().equipment.find((x) => x.id === id);
    if (!target || target.demo) return; // 데모 연동 설비는 삭제 불가 (합성데이터 정합)
    const next = get().equipment.filter((x) => x.id !== id);
    save(LS_EQUIP, next);
    set({ equipment: next });
  },
  setSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    save(LS_EQUIP_SET, next);
    set({ settings: next });
  },
  resetEquipment: () => {
    save(LS_EQUIP, defaultEquipment());
    save(LS_EQUIP_SET, defaultSettings());
    set({ equipment: defaultEquipment(), settings: defaultSettings() });
  },
}));
