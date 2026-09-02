/* 작성 근거 박스 — 이 보고서가 어떤 공식 규정·법령·표준·양식에 따라 작성되는지 문서 머리에 명시.
   공문서 서식이 법령 근거를 문서 상단에 쓰는 관행을 따르며, 인쇄물에도 포함된다. */
export default function LegalBasis({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="mt-4 rounded-lg border border-navy/20 bg-surface/60 px-4 py-3">
      <div className="mb-1.5 text-[12px] font-bold tracking-wide text-navy">작성 근거 — 준거 규정·표준</div>
      <div className="flex flex-col gap-1">
        {items.map(([doc, detail]) => (
          <div key={doc} className="flex flex-wrap items-baseline gap-x-2 text-[12px] leading-relaxed">
            <span className="font-semibold text-navy">「{doc}」</span>
            <span className="text-body">{detail}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">
        본 데모는 위 규정·표준의 서식과 절 구조를 준용하며, 공식 제출·검증 효력은 없음 (DEMO · 합성데이터)
      </div>
    </div>
  );
}
