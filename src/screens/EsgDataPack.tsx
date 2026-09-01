import { esgMap, esgMapSummary, esgTable, YEAR_COLS, type EsgStatus } from "../lib/esgData";
import { useCalc } from "../lib/useCalc";
import { useUI, activeEf } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

const STATUS_BADGE: Record<EsgStatus, string> = {
  "자동 제공": "bg-teal/10 text-teal",
  "부분 제공": "bg-review/10 text-review",
  "범위 외": "bg-line text-body",
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ESG 공시(지속가능경영보고서·K-ESG) 대응 데이터 팩 — 시스템 데이터를 공시 지표 체계로 재구성 */
export default function EsgDataPack() {
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const invStatus = useUI((s) => s.invStatus);

  const csvExport = () => {
    const lines = [
      "# DEMO · 합성데이터 — 공식 공시·제3자 검증 사용 불가",
      "# ESG 공시 데이터 팩 (K-ESG 가이드라인 v2.0 분류체계 참고) · 원주공장",
      `# 계산버전 ${calc.version} · 배출계수 ${ef.version} · 명세서 상태 ${invStatus}`,
      `구분,항목,단위,${YEAR_COLS.join(",")},추세(CAGR 2023-2025),비고`,
      ...esgTable.map((r) =>
        [
          r.section,
          r.item,
          r.unit,
          ...r.vals.map((v) => (v === null ? "-" : v)),
          r.trend ?? "-",
          r.note ?? "",
        ].join(","),
      ),
      "",
      "K-ESG 분류번호,범주,진단항목,제공 상태,시스템 데이터,데이터 원천",
      ...esgMap.map((m) => `${m.code},${m.category},"${m.item}",${m.status},"${m.value}","${m.source}"`),
    ];
    download("ESG공시데이터팩_원주공장_DEMO.csv", "﻿" + lines.join("\n"), "text/csv");
  };

  const jsonExport = () => {
    const body = {
      notice: "DEMO · 합성데이터 — 공식 공시 또는 제3자 검증 자료로 사용 불가",
      purpose: "지속가능경영보고서(ESG Facts & Figures)·K-ESG 대응 작성 지원 데이터 팩",
      framework: "K-ESG 가이드라인 v2.0 (2024.12, 산업통상자원부·한국생산성본부) 분류체계 참고",
      site: "원주공장",
      data_origin: "SYNTHETIC",
      calcVersion: calc.version,
      emissionFactor: ef,
      inventoryStatus: invStatus,
      yearColumns: YEAR_COLS,
      quantitative: esgTable,
      kEsgMapping: esgMap,
      gaps: esgMap.filter((m) => m.status !== "자동 제공").map((m) => `${m.code} ${m.item} — ${m.note ?? m.value}`),
    };
    download("ESG공시데이터팩_원주공장_DEMO.json", JSON.stringify(body, null, 2), "application/json");
  };

  return (
    <>
      {/* 목적·다운로드 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-body">
          지속가능경영보고서·K-ESG 대응용 — 시스템이 관리하는 데이터를 공시 지표 체계(4개년 시계열·원단위·추세)로 재구성해 내려받습니다
        </span>
        <div className="flex gap-2">
          <button onClick={csvExport} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
            데이터 팩 CSV
          </button>
          <button onClick={jsonExport} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-navy hover:border-accent/50">
            데이터 팩 JSON
          </button>
        </div>
      </div>

      {/* 상태 카드 4 */}
      <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">자동 제공 지표</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-teal">
            {esgMapSummary.auto}<span className="text-[13px] font-semibold text-body"> / {esgMap.length} 항목</span>
          </div>
          <div className="mt-1.5 text-[12px] text-body">부분 제공 {esgMapSummary.partial} · 범위 외 {esgMapSummary.out}</div>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">데이터 기간</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">4<span className="text-[13px] font-semibold text-body"> 개년</span></div>
          <div className="mt-1.5 text-[12px] text-body">2023–2025 확정 + 2026 상반기 · 추세(CAGR) 포함</div>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">산정 근거</div>
          <div className="tnum mt-1.5 text-[18px] leading-tight font-bold text-navy">{calc.version}</div>
          <div className="mt-1.5 text-[12px] text-body">배출계수 {ef.version} · 명세서 {invStatus}</div>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">참고 체계</div>
          <div className="mt-1.5 text-[15px] leading-tight font-bold text-navy">K-ESG 가이드라인 v2.0</div>
          <div className="mt-1.5 text-[12px] text-body">환경(E)·정보공시(P) 진단항목 매핑 · GRI 형식 표</div>
        </div>
      </section>

      {/* 4개년 정량 데이터 표 (보고서 부록 형식) */}
      <section className="rounded-[10px] border border-line/60 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-navy">
            환경 정량 데이터 <span className="text-[12px] font-normal text-body">(지속가능경영보고서 ESG Facts &amp; Figures 부록 형식)</span>
          </span>
          <span className="text-[12px] text-slate-400">추세 = 확정연도(2023–2025) 연평균성장률</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-2 font-medium">구분</th>
                <th className="py-2 font-medium">항목</th>
                <th className="py-2 font-medium">단위</th>
                {YEAR_COLS.map((c) => (
                  <th key={c} className={`py-2 text-right font-medium ${c.includes("2026") ? "text-accent" : ""}`}>{c}</th>
                ))}
                <th className="py-2 pl-4 font-medium">추세 (CAGR)</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {esgTable.map((r, i) => {
                const firstOfSection = i === 0 || esgTable[i - 1].section !== r.section;
                return (
                  <tr key={r.section + r.item} className={`border-b border-line/50 last:border-0 ${firstOfSection && i > 0 ? "border-t border-line" : ""}`} title={r.note ?? ""}>
                    <td className="py-2 font-medium text-navy">{firstOfSection ? r.section : ""}</td>
                    <td className="py-2 text-body">{r.item}{r.note && <span className="text-slate-400"> *</span>}</td>
                    <td className="py-2 text-slate-400">{r.unit}</td>
                    {r.vals.map((v, j) => (
                      <td key={j} className={`py-2 text-right ${j === 3 ? "font-semibold text-navy" : "text-body"}`}>
                        {v === null ? "—" : fmt(v, r.digits ?? 0)}
                      </td>
                    ))}
                    <td className="py-2 pl-4 text-body">{r.trend ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[12px] text-body">
          * 표시 항목은 행에 비고 있음(마우스 오버) · 2026년은 상반기(1~6월)로 연간 값과 직접 비교 불가 · 감축실적은 Scope 합계에서 미차감(별도 실적)
        </div>
      </section>

      {/* K-ESG 진단항목 매핑 */}
      <section className="rounded-[10px] border border-line/60 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-navy">
            K-ESG 진단항목 대응 현황 <span className="text-[12px] font-normal text-body">(환경 E·정보공시 P — 시스템 데이터 연결)</span>
          </span>
          <span className="text-[12px] text-slate-400">사회(S)·지배구조(G) 영역은 본 시스템 범위 외</span>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-body">
              <th className="py-2 font-medium">분류번호</th>
              <th className="py-2 font-medium">범주 · 진단항목</th>
              <th className="py-2 font-medium">제공 상태</th>
              <th className="py-2 font-medium">시스템 데이터</th>
              <th className="py-2 font-medium">데이터 원천</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {esgMap.map((m) => (
              <tr key={m.code} className="border-b border-line/50 last:border-0">
                <td className="py-2 font-semibold text-navy">{m.code}</td>
                <td className="py-2">
                  <div className="font-medium text-navy">{m.item}</div>
                  <div className="text-[11.5px] text-slate-400">{m.category}</div>
                </td>
                <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${STATUS_BADGE[m.status]}`}>{m.status}</span></td>
                <td className="max-w-80 py-2 text-body">{m.value}{m.note && <div className="text-[11.5px] text-slate-400">{m.note}</div>}</td>
                <td className="py-2 text-body">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[12px] text-body">
          K-ESG 가이드라인 v2.0(2024.12, 산업통상자원부·한국생산성본부)의 분류체계를 참고한 데모 매핑이며 공식 진단·평가 결과가 아닙니다 ·
          모든 수치는 합성데이터(SYNTHETIC)로 공식 공시에 사용할 수 없습니다
        </div>
      </section>
    </>
  );
}
