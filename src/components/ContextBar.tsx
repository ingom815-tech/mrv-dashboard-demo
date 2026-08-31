import { mrv } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, type Role } from "../store";

/* 전 화면 공통 컨텍스트 바 — 사업장·경계·기간·대상·계산버전·갱신시각·역할 (고도화 지시 §3) */
export default function ContextBar() {
  const calc = useCalc();
  const { role, setRole, openEvidence } = useUI();
  const updatedAt = new Date(mrv.meta.generatedAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const Item = ({ label, value }: { label: string; value: string }) => (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="tnum text-[12px] font-semibold text-navy">{value}</span>
    </span>
  );
  return (
    <div className="flex shrink-0 items-center gap-4 overflow-x-auto rounded-lg border border-line/60 bg-white px-4 py-2">
      <Item label="사업장" value={mrv.meta.site} />
      <Item label="경계" value={mrv.meta.boundary} />
      <Item label="기준기간" value="2025.01–12" />
      <Item label="보고기간" value="2026.01–06" />
      <Item label="집계" value={mrv.meta.aggLabel} />
      <Item label="대상 설비" value={`${mrv.meta.equipCount}대`} />
      <Item label="계측 태그" value={`${mrv.meta.tagCount}점`} />
      <Item label="계산버전" value={calc.version} />
      <Item label="갱신" value={updatedAt} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          역할
          {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                role === r ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={openEvidence}
          className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          산정근거
        </button>
      </div>
    </div>
  );
}
