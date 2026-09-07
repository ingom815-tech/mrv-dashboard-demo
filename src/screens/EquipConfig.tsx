import { useState } from "react";
import { Lock, Trash2, Plus, ChevronLeft } from "lucide-react";
import {
  useEquip,
  EQUIP_TYPES,
  EQUIP_SOURCES,
  typeOf,
  requiredOk,
  type EquipmentRec,
  type FieldConn,
} from "../config/equipmentStore";
import { Btn, Segment, Switch, Input, Card } from "../components/ui";

/* 설비 설정 (관리자 모드) — 고객사가 설비·계측 연결을 직접 등록하는 SaaS 커스텀 화면.
   스키마: src/config/equipmentTypes.json · 저장: equipmentStore(localStorage, SaaS 전환 시 API 교체).
   필수 항목 미충족 설비는 산정 대상에서 제외되고 주의 배지로 표시됨. */

const emptyFields = (typeKey: string): Record<string, FieldConn> =>
  Object.fromEntries(
    typeOf(typeKey).fields.map((f) => [f.key, { on: f.required, source: f.required ? EQUIP_SOURCES[0] : EQUIP_SOURCES[0] }]),
  );

function Wizard({ initial, onDone, onCancel }: {
  initial?: EquipmentRec;
  onDone: (e: Omit<EquipmentRec, "id"> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? EQUIP_TYPES[0].key);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [phase, setPhase] = useState<"도입 전" | "도입 후">(initial?.phase ?? "도입 후");
  const [fields, setFields] = useState<Record<string, FieldConn>>(initial?.fields ?? emptyFields(type));
  const tdef = typeOf(type);

  const pickType = (k: string) => {
    setType(k);
    setFields(emptyFields(k));
  };
  const setOn = (key: string, on: boolean) => setFields((f) => ({ ...f, [key]: { ...f[key], on } }));
  const setSource = (key: string, source: string) => setFields((f) => ({ ...f, [key]: { ...f[key], source } }));
  const step1Ok = name.trim().length > 0;

  return (
    <Card
      title={
        <span className="text-[15px] font-semibold text-ink">
          {initial ? "설비 편집" : "설비 추가"} <span className="tk-label">· {step}/3 단계</span>
        </span>
      }
      action={
        <Btn kind="secondary" small onClick={onCancel}>취소</Btn>
      }
    >
      {step === 1 && (
        <div className="flex max-w-[560px] flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="tk-label">설비명</span>
            <Input value={name} onChange={setName} placeholder="예: 3층 공조기 AHU-03" ariaLabel="설비명" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="tk-label">설비 유형</span>
            <Segment
              ariaLabel="설비 유형 선택"
              options={EQUIP_TYPES.map((t) => ({ key: t.key, label: t.name.split(" ")[0] }))}
              value={type}
              onChange={pickType}
            />
            <span className="tk-label">{tdef.name} — 필수 {tdef.fields.filter((f) => f.required).length} · 선택 {tdef.fields.filter((f) => !f.required).length}개 계측 항목</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="tk-label">설치 위치</span>
            <Input value={location} onChange={setLocation} placeholder="예: 본관 3층 기계실" ariaLabel="설치 위치" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="tk-label">도입 전 / 후 구분 (개선 설비 여부)</span>
            <Segment
              ariaLabel="도입 전후 구분"
              options={[{ key: "도입 후" as const, label: "도입 후 (개선 설비)" }, { key: "도입 전" as const, label: "도입 전 (기존 설비)" }]}
              value={phase}
              onChange={setPhase}
            />
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => setStep(2)} disabled={!step1Ok}>다음 — 계측 항목</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-1">
          <div className="tk-label mb-2">
            {tdef.name} 템플릿의 계측 항목 — 필수 항목은 고정 연결(해제 불가), 선택 항목은 스위치로 켜고 끕니다.
          </div>
          {tdef.fields.map((f) => (
            <div key={f.key} className="flex items-center gap-3 border-b border-[#f0f2f4] py-2.5 last:border-0">
              {f.required ? (
                <Lock size={16} className="shrink-0 text-brand" />
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-[14px] font-medium text-ink">{f.label}</span>
                <span className="tk-label ml-1.5">({f.unit})</span>
                {f.required && <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand">필수</span>}
                {f.efLink && <span className="tk-label ml-2">환산 기준 연결</span>}
              </span>
              <Switch on={fields[f.key]?.on ?? false} onChange={(v) => setOn(f.key, v)} disabled={f.required} label={`${f.label} 연결`} />
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <Btn kind="secondary" onClick={() => setStep(1)}><ChevronLeft size={15} /> 이전</Btn>
            <Btn onClick={() => setStep(3)}>다음 — 데이터 소스</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-1">
          <div className="tk-label mb-2">연결한 각 항목의 데이터 소스를 선택합니다. 데모에서는 합성데이터 커넥터만 실제 값이 흐릅니다.</div>
          {tdef.fields.filter((f) => fields[f.key]?.on).map((f) => (
            <div key={f.key} className="flex flex-wrap items-center gap-3 border-b border-[#f0f2f4] py-2.5 last:border-0">
              <span className="min-w-40 text-[14px] font-medium text-ink">{f.label}</span>
              <Segment
                ariaLabel={`${f.label} 데이터 소스`}
                options={EQUIP_SOURCES.map((s) => ({ key: s, label: s.replace("(데모 합성데이터)", "") }))}
                value={fields[f.key].source}
                onChange={(s) => setSource(f.key, s)}
              />
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <Btn kind="secondary" onClick={() => setStep(2)}><ChevronLeft size={15} /> 이전</Btn>
            <Btn onClick={() => onDone({ id: initial?.id, name: name.trim(), type, location: location.trim(), phase, fields, demo: initial?.demo, engineTag: initial?.engineTag })}>
              {initial ? "변경 저장" : "설비 등록"}
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function EquipConfig() {
  const { equipment, addEquipment, updateEquipment, removeEquipment, resetEquipment } = useEquip();
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<EquipmentRec | null>(null);
  const editing = equipment.find((e) => e.id === editId);

  const done = (e: Omit<EquipmentRec, "id"> & { id?: string }) => {
    if (e.id) updateEquipment(e.id, e);
    else addEquipment(e);
    setMode("list");
    setEditId(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tk-title">설비 설정</h1>
          <p className="tk-label mt-1">설비와 계측 연결을 직접 등록하면 성과 화면과 산정 대상이 함께 갱신됩니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
          {mode === "list" && (
            <>
              <Btn kind="secondary" small onClick={resetEquipment}>기본값 복원</Btn>
              <Btn onClick={() => { setMode("add"); setEditId(null); }}><Plus size={16} /> 설비 추가</Btn>
            </>
          )}
        </div>
      </header>

      {mode !== "list" && (
        <Wizard
          initial={mode === "edit" ? editing : undefined}
          onDone={done}
          onCancel={() => { setMode("list"); setEditId(null); }}
        />
      )}

      {mode === "list" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((e) => {
            const ok = requiredOk(e);
            const tdef = typeOf(e.type);
            const onCount = Object.values(e.fields).filter((f) => f.on).length;
            return (
              <Card key={e.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-semibold text-ink">{e.name}</div>
                    <div className="tk-label mt-0.5">{tdef.name} · {e.location || "위치 미입력"} · {e.phase}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${ok ? "bg-brand/10 text-brand" : "bg-warn/10 text-warn"}`}>
                    {ok ? "필수 충족" : "필수 미충족"}
                  </span>
                </div>
                <div className="tk-label mt-3">
                  계측 항목 {onCount}개 연결
                  {e.demo && <span className="ml-2 rounded bg-[#f2f4f6] px-1.5 py-0.5 text-[10.5px] font-semibold text-sub">데모 데이터 연동{e.engineTag ? ` · ${e.engineTag}` : ""}</span>}
                </div>
                {!ok && (
                  <div className="mt-2 rounded-lg bg-warn/8 px-3 py-2 text-[12.5px] text-warn">
                    필수 계측 항목이 연결되지 않아 산정 대상에서 제외됩니다.
                  </div>
                )}
                {!e.demo && ok && (
                  <div className="mt-2 rounded-lg bg-[#f2f4f6] px-3 py-2 text-[12.5px] text-sub">
                    수집 대기 — 데모에는 합성데이터가 없어 실측 반영 전 상태로 표시됩니다.
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <Btn kind="secondary" small onClick={() => { setEditId(e.id); setMode("edit"); }}>편집</Btn>
                  <Btn kind="danger" small disabled={e.demo} onClick={() => setConfirmDel(e)}>
                    <Trash2 size={14} /> 삭제
                  </Btn>
                  {e.demo && <span className="tk-label self-center">데모 설비 — 삭제 불가</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="tk-label">
        스키마·저장 구조: src/config/equipmentTypes.json · equipmentStore(localStorage) — SaaS 전환 시 동일 스키마로 서버 API 교체 (docs/equipment-schema.md)
      </p>

      {/* 삭제 확인 모달 */}
      {confirmDel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setConfirmDel(null)} />
          <div className="tk-card relative w-full max-w-[380px] p-6">
            <div className="text-[16px] font-semibold text-ink">설비를 삭제할까요?</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
              "{confirmDel.name}" 설비와 계측 연결 설정이 삭제됩니다. 이 동작은 되돌릴 수 없습니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Btn kind="secondary" onClick={() => setConfirmDel(null)}>취소</Btn>
              <Btn kind="danger" onClick={() => { removeEquipment(confirmDel.id); setConfirmDel(null); }}>삭제</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
