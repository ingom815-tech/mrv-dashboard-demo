import { ipmvpMatrix, iso50006Matrix, matrixSummary, type ComplyNav, type ComplyRow } from "../lib/standardsData";

/* 표준 준수 현황 — 국제표준(IPMVP·ISO 50006) 요구 조항 대비 시스템 기능의 충족 여부 대조표.
   각 행의 "근거 보기"를 누르면 실제 구현된 화면·보고서 절로 이동한다 (말이 아니라 클릭으로 증명). */
export default function StandardsCompliance({ onNav }: { onNav: (nav: ComplyNav) => void }) {
  const total = [...ipmvpMatrix, ...iso50006Matrix];
  const ts = matrixSummary(total);

  const Section = ({ title, doc, rows }: { title: string; doc: string; rows: ComplyRow[] }) => {
    const s = matrixSummary(rows);
    return (
      <section className="rounded-[10px] border border-line/60 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold text-navy">{title}</span>
          <span className="text-[12px] text-slate-400">{doc}</span>
          <span className="tnum ml-auto flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded bg-teal/10 px-1.5 py-0.5 text-teal">구현 {s.ok}</span>
            <span className="rounded bg-review/10 px-1.5 py-0.5 text-review">부분 {s.partial}</span>
            <span className="rounded bg-line px-1.5 py-0.5 text-body">향후 {s.todo}</span>
          </span>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-body">
              <th className="py-1.5 font-medium">조항</th>
              <th className="py-1.5 font-medium">표준 요구사항</th>
              <th className="py-1.5 font-medium">상태</th>
              <th className="py-1.5 font-medium">시스템 구현</th>
              <th className="py-1.5 pl-3 font-medium">근거 보기</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((r) => (
              <tr key={r.clause + r.title} className={`border-b border-line/40 last:border-0 ${r.status === "향후" ? "text-slate-400" : ""}`}>
                <td className="py-2 font-semibold whitespace-nowrap text-navy">{r.clause}</td>
                <td className="wrap max-w-56 py-2 font-medium">{r.title}</td>
                <td className="py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                    r.status === "구현" ? "bg-teal/10 text-teal" : r.status === "부분" ? "bg-review/10 text-review" : "bg-line text-body"
                  }`}>{r.status}</span>
                </td>
                <td className="wrap py-2">
                  {r.impl}
                  {r.note && <div className="text-[11.5px] text-slate-400">{r.note}</div>}
                </td>
                <td className="py-2 pl-3">
                  {r.nav ? (
                    <button
                      onClick={() => onNav(r.nav!)}
                      className="min-h-8 rounded-lg border border-accent/40 px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap text-accent transition-colors hover:bg-accent/8"
                    >
                      {r.nav.label} ›
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-slate-400">확장 예정</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };

  return (
    <>
      {/* 요약 줄 — 이 화면의 용도 */}
      <section className="rounded-[10px] border border-line/60 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="tnum text-[15px] font-semibold text-navy">
            국제표준 요구 {ts.total}개 조항 — <span className="text-teal">구현 {ts.ok}</span> · <span className="text-review">부분 {ts.partial}</span> · <span className="text-body">향후 {ts.todo}</span>
          </div>
          <span className="text-[12.5px] text-body">
            이 시스템의 산정·검증 기능이 표준의 어느 조항을 충족하는지 대조한 표 — 각 행의 <b className="text-accent">근거 보기</b>를 누르면 실제 구현 화면·보고서 절로 이동합니다
          </span>
        </div>
      </section>

      <Section title="IPMVP Core Concepts 2022" doc="에너지 절감량 측정·검증(M&V) 국제 프로토콜 — 기능명세서 v1.0 대비" rows={ipmvpMatrix} />
      <Section title="ISO 50006:2023" doc="에너지성과지표(EnPI)·베이스라인(EnB) 국제표준 — 기능명세서 v1.0 대비" rows={iso50006Matrix} />

      <div className="text-[12px] text-body">
        "부분·향후" 항목은 데모 범위 밖이거나 확장 대상임을 정직하게 표기한 것으로, 해당 조항의 비고에 사유를 명시 ·
        전체 항목은 사용자 제공 기능명세서(IPMVP·ISO 50006 v1.0)의 요구사항 기준 · DEMO — 공식 적합성 평가 결과 아님
      </div>
    </>
  );
}
