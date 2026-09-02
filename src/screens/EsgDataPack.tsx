import { useState } from "react";
import { esgMap, esgMapSummary, esgTable, YEAR_COLS, type EsgStatus } from "../lib/esgData";
import { useCalc } from "../lib/useCalc";
import { useUI, activeEf } from "../store";
import ManualField from "../components/ManualField";
import LegalBasis from "../components/LegalBasis";

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

/* 2030 환경목표 — 실무자 수기 입력 (지속가능경영보고서 '2030 환경목표' 표 형식, 데모 기본값) */
const GOAL_FIELDS: Array<{ key: string; label: string; def: string; current: string }> = [
  { key: "goalGhg", label: "온실가스 배출량 목표", def: "2030년까지 기준연도(2023) 대비 20% 감축 (데모 가정)", current: "원단위 2.02 → 1.89 tCO₂eq/t (−6.4%, 2026 상반기)" },
  { key: "goalEnergy", label: "에너지 원단위 목표", def: "2030년까지 원단위 사용량 최대 9% 감축 (데모 가정)", current: "총 에너지 210.5 → 216.0 TJ (연간) · MRV 절감 420 MWh 반영 중" },
  { key: "goalRenew", label: "재생에너지 목표", def: "자가소비 재생에너지 비중 10% 달성 (데모 가정)", current: "전력 기준 2.4% → 6.0% (2026 상반기)" },
];

/* ESG 공시(지속가능경영보고서·K-ESG) 대응 데이터 팩 + 인쇄용 환경 데이터 부록 */
export default function EsgDataPack() {
  const [view, setView] = useState<"pack" | "doc">("pack");
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const invStatus = useUI((s) => s.invStatus);
  const { role, esgInputs, setEsgInput, esgStatus, esgAction } = useUI();
  const gv = (k: string) => esgInputs[k] ?? GOAL_FIELDS.find((g) => g.key === k)!.def;
  const confirmed = esgStatus === "확정";

  const csvExport = () => {
    const lines = [
      "# DEMO · 합성데이터 — 공식 공시·제3자 검증 사용 불가",
      "# ESG 공시 데이터 팩 (K-ESG 가이드라인 v2.0 분류체계 참고) · 원주공장",
      `# 계산버전 ${calc.version} · 배출계수 ${ef.version} · 명세서 상태 ${invStatus} · ESG 데이터 ${esgStatus}`,
      `구분,항목,단위,${YEAR_COLS.join(",")},추세(CAGR 2023-2025),비고`,
      ...esgTable.map((r) =>
        [r.section, r.item, r.unit, ...r.vals.map((v) => (v === null ? "-" : v)), r.trend ?? "-", r.note ?? ""].join(","),
      ),
      "",
      "2030 환경목표 (수기 입력)",
      ...GOAL_FIELDS.map((g) => `목표,${g.label},"${gv(g.key)}","현재: ${g.current}"`),
      "",
      "K-ESG 분류번호,범주,진단항목,제공 상태,시스템 데이터,데이터 출처",
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
      esgStatus,
      goals2030: Object.fromEntries(GOAL_FIELDS.map((g) => [g.label, gv(g.key)])),
      yearColumns: YEAR_COLS,
      quantitative: esgTable,
      kEsgMapping: esgMap,
      gaps: esgMap.filter((m) => m.status !== "자동 제공").map((m) => `${m.code} ${m.item} — ${m.note ?? m.value}`),
    };
    download("ESG공시데이터팩_원주공장_DEMO.json", JSON.stringify(body, null, 2), "application/json");
  };

  return (
    <>
      {/* 보기 전환 + 상태 + 다운로드 */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line/60 bg-white p-0.5">
          {(
            [
              ["pack", "데이터 팩 화면"],
              ["doc", "환경 데이터 부록 (인쇄)"],
            ] as Array<["pack" | "doc", string]>
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${view === k ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${confirmed ? "bg-teal/10 text-teal" : "bg-review/10 text-review"}`}>
          ESG 데이터 {esgStatus}
        </span>
        <div className="ml-auto flex gap-2">
          {view === "doc" && (
            <button onClick={() => window.print()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
              PDF 인쇄·저장
            </button>
          )}
          <button onClick={csvExport} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-navy hover:border-accent/50">
            데이터 팩 CSV
          </button>
          <button onClick={jsonExport} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-navy hover:border-accent/50">
            JSON
          </button>
        </div>
      </div>

      {/* ================= 데이터 팩 화면 ================= */}
      {view === "pack" && (
        <>
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

          {/* 2030 환경목표 — 수기 입력 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-navy">
                2030 환경목표 <span className="rounded bg-review/10 px-1 py-0.5 text-[10px] font-bold text-review">수기 입력</span>
                <span className="ml-1 text-[12px] font-normal text-slate-400">· 지속가능경영보고서 "2030 환경목표" 표 대응 — 부록 문서에 반영</span>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={role === "일반" || confirmed}
                  onClick={() => esgAction("confirm")}
                  title={role === "일반" ? "검토자·승인자 역할만 확정 가능" : undefined}
                  className="min-h-8 rounded-lg bg-teal px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  데이터 확정
                </button>
                <button
                  disabled={role === "일반" || !confirmed}
                  onClick={() => esgAction("revoke")}
                  className="min-h-8 rounded-lg border border-review/50 px-3 py-1 text-[12px] font-semibold text-review hover:bg-review/8 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  확정 해제
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {GOAL_FIELDS.map((g) => (
                <div key={g.key} className="flex flex-col gap-1">
                  <span className="text-[12px] text-body">{g.label}</span>
                  <ManualField fieldKey={g.key} label={g.label} stored={gv(g.key)} disabled={confirmed} multiline commit={setEsgInput} />
                  <span className="tnum text-[11.5px] text-slate-400">현재: {g.current}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-body">
              확정 시 입력 잠금 (감사로그 기록) · 공시 검증은 외부 검증기관 소관 — 본 확정은 내부 작성 완료 표시
            </div>
          </section>

          {/* 4개년 정량 데이터 표 */}
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
                    <td className="wrap max-w-80 py-2 text-body">{m.value}{m.note && <div className="text-[11.5px] text-slate-400">{m.note}</div>}</td>
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
      )}

      {/* ================= 환경 데이터 부록 (A4 인쇄 문서) ================= */}
      {view === "doc" && (
        <div className="print-root mx-auto w-full max-w-[800px] rounded-[10px] border border-line/60 bg-white p-10 text-[13px] leading-relaxed text-navy shadow-sm">
          {/* 표지 */}
          <div className="relative border-b-2 border-navy pb-6 text-center">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-18deg] text-[38px] font-black tracking-widest text-review/10 select-none">DEMO · 합성데이터</span>
            </div>
            <div className="text-[12px] tracking-widest text-slate-400">지속가능경영보고서 부록 형식 준용 (데모 요약본)</div>
            <div className="mt-2 text-[24px] font-bold">환경 데이터 부록 — ESG Facts &amp; Figures</div>
            <div className="mt-1 text-[14px]">원주공장 · 2023–2026 (상반기)</div>
            <div className="tnum mt-3 text-[12px] text-body">
              계산버전 {calc.version} · 배출계수 {ef.version} · 명세서 {invStatus} · ESG 데이터 {esgStatus}
            </div>
            <div className="mt-2 text-[11.5px] text-review">
              본 자료는 ESG 공시 작성 지원 기능의 테스트 출력물이며, 공식 공시 또는 제3자 검증 자료로 사용할 수 없습니다.
            </div>
          </div>

          <LegalBasis
            items={[
              ["K-ESG 가이드라인 v2.0", "산업통상자원부·한국생산성본부 (2024.12) — 환경(E)·정보공시(P) 진단항목 분류체계 준용"],
              ["GRI Standards 2021 (참고)", "지속가능경영보고서 작성 국제 기준 — ESG Facts & Figures 부록 표 형식 준용"],
              ["온실가스 배출권거래제 지침 (연계)", "Scope 1·2 배출량은 명세서(별지 제11호) 산정 결과와 동일 원천"],
            ]}
          />

          {/* 1. 2030 환경목표 */}
          <h3 className="mt-6 mb-2 text-[15px] font-bold">1. 2030 환경목표 <span className="text-[11px] font-normal text-slate-400">수기 입력 · 현재 실적 병기</span></h3>
          <table className="tnum w-full border-t border-navy text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-body">
                <th className="px-2.5 py-1.5 text-left font-medium">구분</th>
                <th className="px-2.5 py-1.5 text-left font-medium">2030 목표</th>
                <th className="px-2.5 py-1.5 text-left font-medium">현재 실적 (시스템 산정)</th>
              </tr>
            </thead>
            <tbody>
              {GOAL_FIELDS.map((g) => (
                <tr key={g.key} className="border-b border-line">
                  <td className="w-36 px-2.5 py-1.5">{g.label.replace(" 목표", "")}</td>
                  <td className="wrap px-2.5 py-1.5">{gv(g.key)}</td>
                  <td className="wrap px-2.5 py-1.5 text-body">{g.current}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 2. 4개년 정량 데이터 */}
          <h3 className="mt-6 mb-2 text-[15px] font-bold">2. 환경 정량 데이터 (4개년)</h3>
          <table className="tnum w-full border-t border-navy text-[12px]">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-body">
                <th className="px-2 py-1.5 text-left font-medium">구분</th>
                <th className="px-2 py-1.5 text-left font-medium">항목</th>
                <th className="px-2 py-1.5 text-left font-medium">단위</th>
                {YEAR_COLS.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-right font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {esgTable.map((r, i) => {
                const firstOfSection = i === 0 || esgTable[i - 1].section !== r.section;
                return (
                  <tr key={r.section + r.item} className="border-b border-line">
                    <td className="px-2 py-1.5 font-medium">{firstOfSection ? r.section : ""}</td>
                    <td className="px-2 py-1.5">{r.item}</td>
                    <td className="px-2 py-1.5 text-slate-400">{r.unit}</td>
                    {r.vals.map((v, j) => (
                      <td key={j} className={`px-2 py-1.5 text-right ${j === 3 ? "font-semibold" : ""}`}>{v === null ? "—" : fmt(v, r.digits ?? 0)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11.5px] text-body">
            주) 2026년은 상반기(1~6월) — 연간 값과 직접 비교 불가 · MRV 감축실적(420 MWh·193 tCO₂eq)은 Scope 합계에서 미차감(별도 실적) · 냉매 비산배출 별도
          </p>

          {/* 3. K-ESG 대응 요약 */}
          <h3 className="mt-6 mb-2 text-[15px] font-bold">3. K-ESG 진단항목 대응 요약</h3>
          <p>
            K-ESG 가이드라인 v2.0의 환경(E)·정보공시(P) 진단항목 {esgMap.length}개 중 <b className="text-teal">자동 제공 {esgMapSummary.auto}</b> ·
            부분 제공 {esgMapSummary.partial} · 범위 외 {esgMapSummary.out}. 자동 제공 항목(E-3-1 온실가스 배출량, E-4-1 에너지 사용량,
            E-4-2 재생에너지 비율, E-10-5 감축 실적)은 계측 기반 시스템 산정값으로 원천 추적이 가능하며, 상세 대응표는 데이터 팩 화면 참조.
          </p>

          {/* 4. 확정 정보 */}
          <h3 className="mt-6 mb-2 text-[15px] font-bold">4. 작성·확정 정보</h3>
          <table className="tnum w-full border-t border-navy text-[12.5px]">
            <tbody>
              {(
                [
                  ["작성 기준일", "2026-07-02 (데모)"],
                  ["데이터 상태", `${esgStatus}${confirmed ? " — 입력 잠금" : " — 목표 입력 가능 (데이터 팩 화면)"}`],
                  ["산정 근거", `${calc.version} · 배출계수 ${ef.version} · 명세서 ${invStatus}`],
                  ["작성 담당", "에너지관리팀 (데모) · 확정 처리 감사로그 기록"],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <tr key={k} className="border-b border-line">
                  <td className="w-36 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                  <td className="px-2.5 py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 text-center text-[11.5px] text-review">
            DEMO · 합성데이터 — 본 부록은 지속가능경영보고서 작성 지원용 테스트 출력물이며 공식 공시·제3자 검증 자료로 사용할 수 없습니다.
          </div>
        </div>
      )}
    </>
  );
}
