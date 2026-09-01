import { useState } from "react";
import { mrv } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, type Role } from "../store";

/* 화면 상단 1단: 도움말 아이콘 + 사용자(역할) 메뉴 + 산정근거 — 최소 구성 */
export function TopActions() {
  const { role, setRole, openEvidence, openGuide } = useUI();
  const [userOpen, setUserOpen] = useState(false);
  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        onClick={openGuide}
        aria-label="가이드 열기"
        title="시스템 개요·시연 순서 가이드"
        className="flex size-7 items-center justify-center rounded-full border border-line bg-white text-[13px] font-bold text-accent transition-colors hover:border-accent/50"
      >
        ?
      </button>
      <button
        onClick={() => setUserOpen(!userOpen)}
        title="사용자·역할 전환 (데모)"
        className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap text-navy transition-colors hover:border-accent/50"
      >
        <span className="flex size-4.5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
          {role.slice(0, 1)}
        </span>
        {role} ▾
      </button>
      {userOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
          <div className="absolute top-9 right-24 z-50 w-40 rounded-lg border border-line bg-white py-1.5 shadow-lg">
            <div className="px-3 pb-1 text-[11px] text-slate-400">역할 전환 (데모)</div>
            {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setUserOpen(false); }}
                className={`block w-full px-3 py-1.5 text-left text-[13px] transition-colors ${
                  role === r ? "bg-accent/8 font-semibold text-accent" : "text-navy hover:bg-surface"
                }`}
              >
                {r}
                {r === "검토자" && <span className="ml-1 text-[11px] text-slate-400">— 검토 처리</span>}
                {r === "승인자" && <span className="ml-1 text-[11px] text-slate-400">— 최종 승인</span>}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onClick={openEvidence}
        className="rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90"
      >
        산정근거
      </button>
    </div>
  );
}

/* 화면 상단 2단: 조회 컨텍스트 — 접기 가능, 줄바꿈 허용, 가로 스크롤 금지 */
export default function ContextBar() {
  const calc = useCalc();
  const [open, setOpen] = useState(false);
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
      <span className="tnum text-[12.5px] font-semibold text-navy">{value}</span>
    </span>
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[10px] border border-line/60 bg-white px-4 py-2">
      <Item label="사업장" value={mrv.meta.site} />
      <Item label="보고기간" value="2026.01–06" />
      <Item label="계산버전" value={calc.version} />
      {open && (
        <>
          <Item label="경계" value={mrv.meta.boundary} />
          <Item label="기준기간" value="2025.01–12" />
          <Item label="집계" value={mrv.meta.aggLabel} />
          <Item label="대상 설비" value={`${mrv.meta.equipCount}대`} />
          <Item label="계측 태그" value={`${mrv.meta.tagCount}점`} />
          <Item label="갱신" value={updatedAt} />
        </>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto text-[12px] font-medium whitespace-nowrap text-accent hover:underline"
      >
        {open ? "간단히 ▴" : "상세조건 ▾"}
      </button>
    </div>
  );
}
