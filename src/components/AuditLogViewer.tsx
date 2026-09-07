import { useMemo, useState } from "react";
import { useUI, type Role } from "../store";

/* 감사로그 뷰어 — 행위자·대상·검색 필터 + CSV 내보내기.
   모든 처리(검토·승인·수기 입력·등록·삭제·로그인)는 자동 기록되며 화면에서 삭제 기능을 제공하지 않음. */
export default function AuditLogViewer() {
  const audit = useUI((s) => s.audit);
  const [actor, setActor] = useState<"전체" | Role>("전체");
  const [target, setTarget] = useState("전체");
  const [q, setQ] = useState("");

  const targets = useMemo(() => ["전체", ...Array.from(new Set(audit.map((a) => a.target)))], [audit]);
  const rows = audit.filter(
    (a) =>
      (actor === "전체" || a.actor === actor) &&
      (target === "전체" || a.target === target) &&
      (q.trim() === "" || `${a.action} ${a.target} ${a.detail}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const badge = (action: string) =>
    action.includes("승인") && !action.includes("해제")
      ? "bg-teal/10 text-teal"
      : action.includes("검토")
        ? "bg-accent/10 text-accent"
        : action.includes("삭제") || action.includes("해제")
          ? "bg-risk/10 text-risk"
          : "bg-line text-body";

  const csvExport = () => {
    const head = "# DEMO · 합성데이터 — 감사로그 내보내기 (공식 증적 아님)\n일시,행위자,행위,대상,내용\n";
    const body = rows
      .map((a) => [new Date(a.ts).toLocaleString("ko-KR", { hour12: false }), a.actor, a.action, a.target, `"${a.detail.replace(/"/g, '""')}"`].join(","))
      .join("\n");
    const blob = new Blob(["﻿" + head + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "감사로그_DEMO.csv";
    el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-[10px] border border-line/60 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[15px] font-semibold text-navy">
          변경이력·감사로그 <span className="tnum text-[12px] font-normal text-body">({rows.length}건 표시 / 총 {audit.length}건)</span>
        </span>
        <span className="hidden text-[12px] text-slate-400 md:inline">모든 처리·수정이 자동 기록되며 화면에서 삭제할 수 없습니다</span>
        <button onClick={csvExport} className="ml-auto min-h-8 rounded-lg border border-line px-3 py-1 text-[12px] font-medium text-navy hover:border-accent/50">
          CSV 내보내기
        </button>
      </div>

      {/* 필터 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
          행위자
          <select value={actor} onChange={(e) => setActor(e.target.value as typeof actor)} aria-label="행위자 필터"
            className="min-h-8 rounded-lg border border-line bg-white px-2 py-1 text-[12.5px] text-navy">
            {(["전체", "일반", "검토자", "승인자"] as const).map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
          대상
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="대상 필터"
            className="min-h-8 max-w-40 rounded-lg border border-line bg-white px-2 py-1 text-[12.5px] text-navy">
            {targets.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="내용 검색…"
          aria-label="감사로그 검색"
          className="min-h-8 w-44 rounded-lg border border-line bg-white px-2.5 py-1 text-[12.5px] text-navy placeholder:text-slate-300 focus:border-accent focus:outline-none"
        />
        {(actor !== "전체" || target !== "전체" || q !== "") && (
          <button onClick={() => { setActor("전체"); setTarget("전체"); setQ(""); }} className="text-[12px] font-medium text-accent hover:underline">
            필터 해제
          </button>
        )}
      </div>

      {audit.length === 0 ? (
        <div className="text-[12px] text-body">기록 없음 — 검토·승인, 수기 입력, 등록·삭제 등 처리 시 자동 기록됩니다.</div>
      ) : rows.length === 0 ? (
        <div className="text-[12px] text-body">필터 조건에 맞는 기록이 없습니다.</div>
      ) : (
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {rows.map((a, i) => (
            <div key={a.ts + i} className="tnum flex items-start gap-3 border-b border-line/50 py-1.5 text-[12px] last:border-0">
              <span className="w-32 shrink-0 text-body">
                {new Date(a.ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
              <span className="w-12 shrink-0 font-medium text-navy">{a.actor}</span>
              <span className={`w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold whitespace-nowrap ${badge(a.action)}`}>
                {a.action}
              </span>
              <span className="hidden w-24 shrink-0 truncate text-body md:block" title={a.target}>{a.target}</span>
              <span className="wrap min-w-0 leading-snug text-body">
                <span className="md:hidden font-medium text-navy">{a.target} — </span>{a.detail}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11.5px] text-slate-400">
        localStorage 보존 (데모) — 실제 SaaS에서는 서버 측 불변 저장(append-only)·보존 기한 정책으로 관리
      </div>
    </section>
  );
}
