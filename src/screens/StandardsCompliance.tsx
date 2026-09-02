import { ipmvpMatrix, iso50006Matrix, matrixSummary, type ComplyNav, type ComplyRow } from "../lib/standardsData";

/* 보고서 기준(프레임워크)별 표준 정합성 패널 — 해당 보고서 위에 접힘 상태로 붙는다.
   각 행의 "근거 보기"를 누르면 실제 구현된 화면·보고서 절로 이동 (말이 아니라 클릭으로 증명). */
export default function FrameworkPanel({
  framework,
  onNav,
  forceOpen,
}: {
  framework: "ipmvp" | "iso";
  onNav: (nav: ComplyNav) => void;
  forceOpen?: boolean;
}) {
  const rows: ComplyRow[] = framework === "ipmvp" ? ipmvpMatrix : iso50006Matrix;
  const title = framework === "ipmvp" ? "IPMVP Core Concepts 2022" : "ISO 50006:2023";
  const docDesc =
    framework === "ipmvp"
      ? "에너지 절감량 측정·검증(M&V) 국제 프로토콜 — 이 보고서가 따르는 기준"
      : "에너지성과지표(EnPI)·베이스라인(EnB) 국제표준 — 이 보고서가 따르는 기준";
  const s = matrixSummary(rows);

  return (
    <details className="no-print rounded-[10px] border border-line/60 bg-white" open={forceOpen || undefined}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-[14px] font-semibold text-navy">{title} 정합성</span>
        <span className="tnum flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded bg-teal/10 px-1.5 py-0.5 text-teal">구현 {s.ok}</span>
          <span className="rounded bg-review/10 px-1.5 py-0.5 text-review">부분 {s.partial}</span>
          <span className="rounded bg-line px-1.5 py-0.5 text-body">향후 {s.todo}</span>
        </span>
        <span className="ml-auto text-[12px] text-slate-400">조항별 대조 · 근거 화면 이동 ▾</span>
      </summary>
      <div className="border-t border-line/60 px-4 pt-2 pb-3">
        <div className="mb-2 text-[12.5px] text-body">
          {docDesc} · 각 행의 <b className="text-accent">근거 보기</b>를 누르면 실제 구현 화면·보고서 절로 이동합니다
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
        <div className="mt-2 text-[12px] text-body">
          "부분·향후" 항목은 데모 범위 밖이거나 확장 대상임을 정직하게 표기 · 사용자 제공 기능명세서 v1.0 기준 · DEMO — 공식 적합성 평가 결과 아님
        </div>
      </div>
    </details>
  );
}
