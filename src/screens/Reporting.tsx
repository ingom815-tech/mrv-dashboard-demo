import { useState } from "react";
import { mrv, reviewItems, perfCurve, type NonRoutine } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";
import InventoryReport from "./InventoryReport";
import MrvReportPreview from "./MrvReportPreview";
import EsgDataPack from "./EsgDataPack";
import StandardsCompliance from "./StandardsCompliance";
import type { ComplyNav } from "../lib/standardsData";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

const TABS = [
  { key: "approve", label: "검토·승인" },
  { key: "draft", label: "보고서 작성" },
  { key: "mvplan", label: "M&V 계획서" },
  { key: "form", label: "결과보고서 양식" },
  { key: "standards", label: "표준 준수" },
  { key: "history", label: "이력·버전 비교" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const initialTab = (): TabKey => {
  const seg = window.location.hash.split("/")[2];
  return (TABS.find((t) => t.key === seg)?.key ?? "approve") as TabKey;
};

const stateBadge = (s: string) =>
  s === "승인 완료" || s === "완료"
    ? "bg-teal/10 text-teal"
    : s === "검토 완료"
      ? "bg-accent/10 text-accent"
      : "bg-review/10 text-review";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reporting() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  // 보고 범위: 냉수플랜트 MRV 보고서 | 공장 종합 명세서 (온실가스·에너지 명세서 작성 기능)
  const [rptScope, setRptScope] = useState<string>(() => {
    const seg = window.location.hash.split("/")[2];
    return seg === "inventory" ? "inventory" : seg === "boiler" ? "boiler" : seg === "esg" ? "esg" : "chiller";
  });
  const [copied, setCopied] = useState(false);
  // 승인 실수 방지: 첫 탭에서 무장(arm), 두 번째 탭에서 확정 (모바일 지시문 §8.7)
  const [armId, setArmId] = useState<string | null>(null);
  const { role, reviewStates, markReviewed, approve, audit, resetDemoStates, openEvidence, setMenu, projects } =
    useUI();
  /* 보고서 생성 대상 프로젝트만 목록에 노출 (설비·연계 관리에서 대상 선택) */
  const reportProjects = projects.filter((p) => p.report);
  const scopeProject = projects.find((p) => (p.builtin ?? p.id) === rptScope);
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(reviewStates);
  const approved = verify.state === "승인 완료";

  /* AI 설명문 초안 — 시스템이 이미 가진 산정 결과에서 규칙 기반으로 생성 (데모) */
  const draft = [
    {
      title: "성과 요약",
      text: `보고기간(2026.01–06) 동안 중앙 냉수플랜트의 조정 기준선 대비 전력사용량은 ${fmt(calc.kpi.saveMWh)} MWh 감소했으며, 이는 기준선 대비 ${pct(calc.kpi.savePct)}의 절감성과에 해당합니다. 적용 배출계수(${ef.version}, ${ef.value} ${ef.unit}) 기준 탄소 감축량은 ${fmt(calc.kpi.co2, 1)} tCO₂eq입니다. 본 수치는 ${approved ? "검토·승인이 완료된 확정값" : "검증·승인 전의 잠정값"}입니다.`,
      basis: () => openEvidence(),
      basisLabel: "산정근거",
    },
    {
      title: "절감 원인",
      text: `동일 냉동부하 구간 비교 시 시스템 효율(kW/RT)은 평균 ${fmt(perfCurve.sameLoadImprovePct * 100, 1)}% 개선되었으며, 주요 요인은 냉동기 1 신설 교체, 냉수펌프 인버터(VFD) 제어, 냉각탑 제어 최적화입니다. 부하 변동이 아닌 설비 효율 개선이 절감의 주된 원인임을 부하율–효율 성능곡선으로 확인했습니다.`,
      basis: () => setMenu("equipment"),
      basisLabel: "설비 분석",
    },
    {
      title: "데이터 품질·조정 사항",
      text: `보고기간 181일 중 ${calc.kpi.nDays}일을 산정에 사용했고, 정비(11일)·통신장애(1일) 등 ${calc.kpi.nExcluded}일은 사전 정의된 규칙(R-01)에 따라 제외했습니다. 데이터 정상률은 ${pct(mrv.kpi.trustRate)}이며, 비일상적 조정 ${calc.nrApplied.map((n) => `${n.id}(${reviewStates[n.id] ?? n.status})`).join(", ")}을 반영${verify.pending > 0 ? " 대기 중" : ""}했습니다. 산정 불확도는 90% 신뢰수준에서 ±${fmt(calc.kpi.uncertaintyPct * 100, 1)}%입니다.`,
      basis: () => setMenu("verify"),
      basisLabel: "데이터 검증",
    },
  ];
  const draftFull = draft.map((d) => `[${d.title}]\n${d.text}`).join("\n\n");

  /* 보고서 작성 현황 — 각 영역이 어느 데이터에서 채워지는지 */
  const sections: Array<{ area: string; src: string; state: string; go?: () => void }> = [
    { area: "사업장 및 설비정보", src: "시스템 관리", state: "완료", go: () => setMenu("master") },
    { area: "에너지 사용량", src: "계측데이터 (15분×13점)", state: "완료" },
    { area: "기준선 및 조정조건", src: "MRV 산정결과", state: "완료", go: openEvidence },
    { area: "에너지 절감성과", src: "MRV 산정결과", state: "완료" },
    { area: "탄소 감축성과", src: `배출계수 ${ef.version}·산정결과`, state: "완료" },
    {
      area: "데이터 품질 및 제외사항", src: "검증이력",
      state: verify.pending > 0 ? "검토 필요" : "완료", go: () => setMenu("verify"),
    },
    {
      area: "증빙자료", src: "증적 레지스트리 (5건)",
      state: reviewStates["DQ-04"] === "승인 완료" ? "완료" : "1건 보완 필요", go: () => setMenu("verify"),
    },
  ];
  const doneCount = sections.filter((s) => s.state === "완료").length;

  const dataPack = () => {
    const body = {
      notice: "DEMO · 합성데이터 — 공식 MRV/명세서 작성에 사용 불가",
      purpose: "외부 보고(명세서·지속가능경영보고서) 작성 지원 데이터팩",
      data_origin: "SYNTHETIC",
      calcVersion: calc.version,
      verifyState: verify.state,
      activityData: { monthly: calc.monthly, reportDays: calc.kpi.nDays, excludedDays: calc.kpi.nExcluded },
      results: calc.kpi,
      emissionFactor: ef,
      refrigerantSeparate: mrv.refrigerant,
      facility: { site: mrv.meta.site, boundary: mrv.meta.boundary, equipment: mrv.equip.map((e) => e.name) },
      evidenceIndex: ["EV-2026-011", "EV-2026-012", "EV-2026-013", "EV-2026-014", "EV-2026-015"],
      gaps: [
        ...(reviewStates["DQ-04"] !== "승인 완료" ? ["FM-CHW 교정성적서 갱신·영향평가 (DQ-04)"] : []),
        ...(verify.pending > 0 ? [`검토 대기 ${verify.pending}건 승인 처리`] : []),
        "공식 배출계수 출처·발전단/소비단 구분 확정",
      ],
      esgDraft: draft[0].text,
    };
    download(`MRV_데이터팩_${calc.version}_DEMO.json`, JSON.stringify(body, null, 2), "application/json");
  };
  const csvExport = () => {
    const head = "# DEMO · 합성데이터 — 공식 MRV 사용 불가\n월,조정기준선(MWh),실제(MWh),절감(MWh),절감률,제외일\n";
    const rows = calc.monthly
      .map((m) => `${m.month},${m.baseMWh.toFixed(1)},${m.actMWh.toFixed(1)},${m.saveMWh.toFixed(1)},${((m.saveMWh / m.baseMWh) * 100).toFixed(1)}%,${m.nExcluded}`)
      .join("\n");
    download(`월별성과_${calc.version}_DEMO.csv`, "﻿" + head + rows, "text/csv");
  };

  return (
    <div className="flex min-h-screen flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[20px] leading-tight font-bold text-navy md:text-[24px]">보고·승인</h1>
          <span
            className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다."
          >
            DEMO · 합성데이터
          </span>
        </div>
        <TopActions />
      </header>
      <ContextBar />

      {/* 보고서 유형 분리: ① MRV 성과보고서(프로젝트별 드롭다운 — 확장 대응) ② 공장 종합 명세서(별도 관리) */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center rounded-lg border border-line/60 bg-white p-0.5">
          {(
            [
              ["mrv", "MRV 성과보고서", "프로젝트별"],
              ["inventory", "에너지·배출 명세서", "공장 종합"],
              ["esg", "ESG 공시 데이터", "K-ESG·보고서 부록"],
            ] as Array<[string, string, string]>
          ).map(([key, label, sub]) => {
            const on =
              key === "mrv" ? rptScope === "chiller" || rptScope === "boiler" : rptScope === key;
            return (
              <button
                key={key}
                onClick={() => setRptScope(key === "mrv" ? "chiller" : (key as "inventory" | "esg"))}
                className={`rounded-md px-3.5 py-1.5 text-[13px] transition-colors ${
                  on ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
                }`}
              >
                {label} <span className={`text-[11px] ${on ? "opacity-70" : "text-slate-400"}`}>{sub}</span>
              </button>
            );
          })}
        </div>

        {rptScope !== "inventory" && rptScope !== "esg" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12.5px] text-slate-400">
              프로젝트
              <select
                aria-label="MRV 프로젝트 선택"
                value={rptScope}
                onChange={(e) => setRptScope(e.target.value)}
                className="min-h-9 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-navy"
              >
                {reportProjects.map((p) => (
                  <option key={p.id} value={p.builtin ?? p.id}>
                    {p.id.startsWith("CAND") ? "계획 전" : p.id} · {p.name} — {p.stage === "검증 중" ? "산정 중" : p.stage}
                  </option>
                ))}
              </select>
            </label>
            <span className="tnum text-[12px] text-slate-400">
              생성 대상 {reportProjects.length} · 제외 {projects.length - reportProjects.length}
            </span>
            <button onClick={() => setMenu("master")} className="text-[12.5px] font-medium text-accent hover:underline">
              프로젝트 등록·관리 ›
            </button>
          </div>
        )}
      </div>

      {rptScope === "inventory" && (
        <>
          <div className="no-print rounded-lg border border-review/30 bg-review/6 px-3.5 py-2 text-[12.5px] text-review">
            본 자료는 명세서 작성 지원 기능의 테스트 화면이며, 공식 제출 또는 제3자 검증 자료로 사용할 수 없습니다. (DEMO · 합성데이터)
          </div>
          <InventoryReport />
        </>
      )}

      {/* ---------- ESG 공시 데이터 팩 (K-ESG·지속가능경영보고서 대응) ---------- */}
      {rptScope === "esg" && (
        <>
          <div className="rounded-lg border border-review/30 bg-review/6 px-3.5 py-2 text-[12.5px] text-review">
            본 자료는 ESG 공시 작성 지원 기능의 테스트 화면이며, 모든 수치는 합성데이터로 공식 공시 또는 제3자 검증 자료로 사용할 수 없습니다. (DEMO)
          </div>
          <EsgDataPack />
        </>
      )}

      {/* ---------- 보일러 MRV (개시 전) — 동일 양식 재사용 확장 데모 ---------- */}
      {rptScope === "boiler" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                보일러 폐열회수 개선 (MVP-2026-02 · 계획) — 개시 전 준비 상태
              </span>
              <span className="rounded bg-review/10 px-2 py-0.5 text-[11px] font-bold text-review">프로젝트 개시 전</span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["측정경계 정의", "완료", "보일러·스팀 (LNG 사용량 경계)", undefined],
                  ["데이터 연계", "진행 중", "가스미터 GM-01·02 연계 완료 · GM-03 연계 진행 중", () => setMenu("master")],
                  ["기준기간 데이터", "8 / 12개월", "2026-06까지 12개월 확보 예정 (2025-07 개시)", undefined],
                  ["M&V 계획", "초안 예정", "MVP-2026-02 초안 — 냉수플랜트 계획서 양식 재사용", undefined],
                ] as Array<[string, string, string, (() => void) | undefined]>
              ).map(([k, v, sub, go]) => (
                <div
                  key={k}
                  onClick={go}
                  className={`rounded-lg border border-line/60 p-3 ${go ? "cursor-pointer transition-colors hover:border-accent/50" : ""}`}
                >
                  <div className="text-[12px] text-body">{k}</div>
                  <div className={`tnum mt-0.5 text-[15px] font-bold ${v === "완료" ? "text-teal" : "text-review"}`}>{v}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{sub}{go && <span className="text-accent"> · 연계 관리 ›</span>}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-body">
              개시 조건이 충족되면 냉수플랜트와 동일한 산정 파이프라인(기준선 OLS → 조정 → 절감량 → 검토·승인)과 동일한
              보고서 양식이 이 프로젝트에 그대로 적용됩니다 — 아래는 그 양식의 미리보기입니다.
            </div>
          </section>
          <MrvReportPreview mode="template" />
        </>
      )}

      {/* ---------- 후보 단계 프로젝트 (신규 등록) — 보고서 생성 전 준비 안내 ---------- */}
      {scopeProject && !scopeProject.builtin && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-navy">
              {scopeProject.name} <span className="tnum text-[12px] font-normal text-body">대상 설비군 {scopeProject.group}</span>
            </span>
            <span className="rounded bg-line px-2 py-0.5 text-[11px] font-bold text-body">후보 단계 — 보고서 생성 전</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-body">
            {["① 사전진단", "② 데이터 연계 점검", "③ M&V 계획 수립·승인", "④ 기준기간 데이터 확보", "⑤ 개시 → 보고서 자동 생성"].map((s, i) => (
              <span key={s} className={`rounded-lg px-2.5 py-1.5 ${i === 0 ? "bg-accent text-white" : "bg-surface"}`}>{s}</span>
            ))}
          </div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-body">
            프로젝트가 개시되면 냉수플랜트와 동일한 산정 파이프라인·보고서 양식이 자동 적용됩니다.
            사전진단 및 데이터 연계 상태는 <button onClick={() => setMenu("master")} className="font-medium text-accent hover:underline">설비·연계 관리 ›</button>에서 확인하세요.
          </div>
        </section>
      )}
      {!scopeProject && !["chiller", "boiler", "inventory", "esg"].includes(rptScope) && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4 text-[13px] text-body">
          선택한 프로젝트가 목록에서 제외되었거나 삭제되었습니다 — 위 드롭다운에서 다른 프로젝트를 선택하세요.
        </section>
      )}

      {rptScope === "chiller" && (
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-[13px] whitespace-nowrap transition-colors ${
              tab === t.key ? "border-accent font-semibold text-accent" : "border-transparent text-body hover:text-navy"
            }`}
          >
            {t.label}
            {t.key === "approve" && verify.pending > 0 && (
              <span className="tnum ml-1.5 rounded-full bg-review/15 px-1.5 text-[11px] font-bold text-review">
                {verify.pending}
              </span>
            )}
          </button>
        ))}
      </div>
      )}

      {/* ---------- 탭 1: 검토·승인 ---------- */}
      {rptScope === "chiller" && tab === "approve" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                검토 워크플로우{" "}
                <span className="text-[12px] font-normal text-body">
                  검토 필요 → 검토 완료(검토자) → 승인 완료(승인자) · 역할 분리
                </span>
              </span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${stateBadge(verify.state)}`}>
                전체 상태 {verify.state}
              </span>
            </div>
            {role === "일반" && (
              <div className="mb-2 rounded bg-surface px-3 py-2 text-[12px] text-body">
                일반 역할은 조회만 가능합니다. 우측 상단에서 검토자 또는 승인자 역할을 선택하면 처리 버튼이
                활성화됩니다. 승인 완료된 항목은 어떤 역할도 수정할 수 없습니다.
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {reviewItems.map((r) => {
                const st = reviewStates[r.id];
                return (
                  <div key={r.id} className="rounded-lg border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-navy">
                          {r.id} · {r.title}
                        </span>
                        <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-body">{r.kind}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${stateBadge(st)}`}>{st}</span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {st === "검토 필요" && (
                          <button
                            onClick={() => markReviewed(r.id)}
                            disabled={role !== "검토자"}
                            className="min-h-11 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 md:min-h-0"
                          >
                            검토 완료 처리
                          </button>
                        )}
                        {st === "검토 완료" && (
                          <button
                            onClick={() => {
                              if (armId !== r.id) { setArmId(r.id); return; }
                              approve(r.id);
                              setArmId(null);
                            }}
                            disabled={role !== "승인자"}
                            className={`min-h-11 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 md:min-h-0 ${
                              armId === r.id ? "bg-review" : "bg-teal"
                            }`}
                          >
                            {armId === r.id ? "한 번 더 눌러 승인 확정" : "승인"}
                          </button>
                        )}
                        {st === "승인 완료" && <span className="text-[12px] font-medium text-teal">확정 — 수정 불가</span>}
                      </div>
                    </div>
                    <div className="tnum mt-1 text-[12px] text-body">{r.period}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-body">{r.detail}</div>
                    <div className="mt-1 text-[12px]">
                      <span className="font-medium text-navy">산정 영향</span>{" "}
                      <span className={r.affectsCalc ? "font-medium text-accent" : "text-body"}>{r.impact}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {calc.version !== "CALC-2026H1-v1" && (
              <div className="tnum mt-3 rounded-lg bg-teal/8 px-4 py-2.5 text-[12px] text-navy">
                비일상적 조정 승인 반영 → 새 계산버전 <b>{calc.version}</b> 생성 · 절감량{" "}
                <b className="text-teal">{fmt(calc.kpi.saveMWh)} MWh ({pct(calc.kpi.savePct)})</b> · 탄소 감축{" "}
                <b className="text-teal">{fmt(calc.kpi.co2, 1)} tCO₂eq</b> (기존 v1 확정본은 보존됨 — 데모)
              </div>
            )}
          </section>

          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">비일상적 조정 목록</span>
              <button onClick={resetDemoStates} className="text-[12px] font-medium text-accent hover:underline">
                데모 상태 초기화
              </button>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-2 font-medium">ID</th>
                  <th className="py-2 font-medium">내용</th>
                  <th className="py-2 font-medium">기간</th>
                  <th className="py-2 text-right font-medium">조정량</th>
                  <th className="py-2 pl-3 font-medium">상태</th>
                  <th className="py-2 font-medium">승인자</th>
                </tr>
              </thead>
              <tbody>
                {(calc.nrApplied as NonRoutine[]).map((n) => {
                  const st = reviewStates[n.id] ?? n.status;
                  return (
                    <tr key={n.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2 font-medium text-navy">{n.id}</td>
                      <td className="py-2 text-body">{n.title}</td>
                      <td className="py-2 text-body">{n.start} ~ {n.end}</td>
                      <td className="py-2 text-right text-body">{n.kwhAdj !== 0 ? `${fmt(n.kwhAdj)} kWh` : "제외기간"}</td>
                      <td className="py-2 pl-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(st)}`}>{st}</span>
                      </td>
                      <td className="py-2 text-body">{st === "승인 완료" ? n.approver || "승인자(데모)" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ---------- 탭 2: 보고서 작성 ---------- */}
      {rptScope === "chiller" && tab === "draft" && (
        <>
          {/* 상단 요약 */}
          <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["보고기간", "2026년 상반기"],
              ["산정 버전", calc.version],
              ["데이터 상태", verify.pending > 0 ? `검토 필요 ${verify.pending}건` : "검증 완료"],
              ["보고서 상태", approved ? "승인 완료" : "초안 작성 중"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[10px] border border-line/60 bg-white px-4 py-3">
                <div className="text-[12px] text-body">{k}</div>
                <div className={`tnum mt-0.5 text-[15px] font-bold ${String(v).includes("검토 필요") ? "text-review" : "text-navy"}`}>{v}</div>
              </div>
            ))}
          </section>

          {/* 작성 현황 — 시스템 데이터가 그대로 이어짐 (재입력 없음) */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                보고서 작성 현황 <span className="tnum text-[12px] font-normal text-body">({doneCount}/{sections.length} 완료)</span>
              </span>
              <span className="text-[12px] text-slate-400">모든 항목은 시스템 데이터에서 자동으로 채워집니다 — 재입력 없음</span>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-body">
                  <th className="py-2 font-medium">보고 영역</th>
                  <th className="py-2 font-medium">데이터 출처</th>
                  <th className="py-2 pl-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr
                    key={s.area}
                    onClick={s.go}
                    className={`border-b border-line/50 last:border-0 ${s.go ? "cursor-pointer hover:bg-surface" : ""}`}
                  >
                    <td className="py-2 font-medium text-navy">{s.area}</td>
                    <td className="py-2 text-body">{s.src}</td>
                    <td className="py-2 pl-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(s.state)}`}>{s.state}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* AI 설명문 초안 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-navy">설명문 초안</span>
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">AI 초안 · 데모(규칙 기반)</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(draftFull).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="rounded-lg border border-line px-3 py-1 text-[12px] font-medium text-navy hover:border-accent/50"
              >
                {copied ? "복사됨 ✓" : "전체 복사"}
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {draft.map((d) => (
                <div key={d.title} className="rounded-lg bg-surface/70 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-navy">{d.title}</span>
                    <button onClick={d.basis} className="text-[12px] font-medium text-accent hover:underline">
                      근거 보기 · {d.basisLabel} ›
                    </button>
                  </div>
                  <p className="tnum mt-1 text-[13.5px] leading-relaxed text-navy">{d.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-slate-400">
              초안의 모든 수치는 화면과 동일한 산정 결과({calc.version})에서 생성됩니다 · 문장은 검토 후 사용
            </div>
          </section>

          {/* 월별 확정성과 + 출력 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">월별 성과 (보고서 본문 표)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setTab("form")} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
                  ① 보고서 양식 보기·인쇄
                </button>
                <button onClick={dataPack} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy hover:border-accent/50">
                  ② 외부 보고용 데이터팩 (JSON)
                </button>
                <button onClick={csvExport} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy hover:border-accent/50">
                  월별 CSV
                </button>
              </div>
            </div>
            <table className="tnum w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-2 font-medium">월</th>
                  <th className="py-2 text-right font-medium">조정 기준선 (MWh)</th>
                  <th className="py-2 text-right font-medium">실제 (MWh)</th>
                  <th className="py-2 text-right font-medium">절감 (MWh)</th>
                  <th className="py-2 text-right font-medium">절감률</th>
                  <th className="py-2 text-right font-medium">제외일</th>
                </tr>
              </thead>
              <tbody>
                {calc.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-2 font-medium text-navy">{m.month}</td>
                    <td className="py-2 text-right text-body">{fmt(m.baseMWh, 1)}</td>
                    <td className="py-2 text-right text-body">{fmt(m.actMWh, 1)}</td>
                    <td className="py-2 text-right font-semibold text-teal">{fmt(m.saveMWh, 1)}</td>
                    <td className="py-2 text-right text-body">{pct(m.saveMWh / m.baseMWh)}</td>
                    <td className="py-2 text-right text-body">{m.nExcluded}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 text-navy">합계</td>
                  <td className="py-2 text-right text-navy">{fmt(calc.kpi.saveMWh + calc.savings.sumAct / 1000, 1)}</td>
                  <td className="py-2 text-right text-navy">{fmt(calc.savings.sumAct / 1000, 1)}</td>
                  <td className="py-2 text-right text-teal">{fmt(calc.kpi.saveMWh, 1)}</td>
                  <td className="py-2 text-right text-navy">{pct(calc.kpi.savePct)}</td>
                  <td className="py-2 text-right text-navy">{calc.kpi.nExcluded}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 text-[11.5px] text-slate-400">
              데이터팩은 활동자료·계수·시설정보·증빙목록·보완 필요 항목을 담은 명세서 작성 지원용입니다 (완전 자동 작성 아님) ·
              모든 출력에 DEMO·합성데이터 표기 포함
            </div>
          </section>

          {/* 냉매 별도 표 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 text-[15px] font-semibold text-navy">냉매 비산배출 — 전력 감축량과 합산하지 않는 별도 항목</div>
            <table className="tnum w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-2 font-medium">일자</th>
                  <th className="py-2 font-medium">설비</th>
                  <th className="py-2 font-medium">냉매</th>
                  <th className="py-2 text-right font-medium">GWP</th>
                  <th className="py-2 pl-5 font-medium">구분</th>
                  <th className="py-2 text-right font-medium">양 (kg)</th>
                  <th className="py-2 text-right font-medium">배출 (tCO₂eq)</th>
                </tr>
              </thead>
              <tbody>
                {(mrv.refrigerant.items as Array<{ date: string; asset: string; type: string; gwp: number; kind: string; kg: number; tco2: number; counted: boolean }>).map((r) => (
                  <tr key={r.date + r.asset} className="border-b border-line/60">
                    <td className="py-2 text-body">{r.date}</td>
                    <td className="py-2 text-body">{r.asset}</td>
                    <td className="py-2 text-body">{r.type}</td>
                    <td className="py-2 text-right text-body">{fmt(r.gwp)}</td>
                    <td className="py-2 pl-5 text-body">{r.kind}{!r.counted && " (배출 아님)"}</td>
                    <td className="py-2 text-right text-body">{fmt(r.kg)}</td>
                    <td className="py-2 text-right font-medium text-navy">{r.counted ? fmt(r.tco2, 2) : "—"}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={6} className="py-2 text-navy">보고기간 냉매 배출 합계 (전력 감축과 별도)</td>
                  <td className="py-2 text-right text-navy">{fmt(mrv.refrigerant.total, 2)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ---------- 탭: 표준 준수 (IPMVP·ISO 50006 대조 — 근거 화면 딥링크) ---------- */}
      {rptScope === "chiller" && tab === "standards" && (
        <StandardsCompliance
          onNav={(nav: ComplyNav) => {
            if (nav.go === "verify" || nav.go === "master") {
              setMenu(nav.go);
              return;
            }
            if (nav.go === "evidence") {
              openEvidence();
              return;
            }
            setTab(nav.go);
            if (nav.anchor) {
              // 탭 전환 렌더 후 해당 절로 스크롤
              setTimeout(() => document.getElementById(nav.anchor!)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
            }
          }}
        />
      )}

      {/* ---------- 탭 3: M&V 계획서 (ESCO 양식 14절) ---------- */}
      {rptScope === "chiller" && tab === "mvplan" && <MrvReportPreview mode="plan" />}

      {/* ---------- 탭 4: M&V 결과보고서 양식 (ESCO 양식 10절, A4 인쇄) ---------- */}
      {rptScope === "chiller" && tab === "form" && <MrvReportPreview mode="report" />}

      {/* ---------- 탭 4: 이력·버전 비교 ---------- */}
      {rptScope === "chiller" && tab === "history" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">계산버전 비교</span>
              <span className="tnum text-[12px] text-body">CALC-2026H1-v1 (확정본 보존) vs 현재 {calc.version}</span>
            </div>
            {calc.version === "CALC-2026H1-v1" ? (
              <div className="text-[12.5px] text-body">
                현재 버전이 v1입니다 — 비일상적 조정 승인 또는 배출계수 등록 시 새 버전이 생성되고 여기서 v1과의
                차이를 비교합니다.
              </div>
            ) : (
              <table className="tnum w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-body">
                    <th className="py-2 font-medium">항목</th>
                    <th className="py-2 text-right font-medium">v1 (확정본)</th>
                    <th className="py-2 text-right font-medium">{calc.version.replace("CALC-2026H1-", "")} (현재)</th>
                    <th className="py-2 pl-4 font-medium">변화 원인</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["조정 기준선 (MWh)", mrv.calc0.savings.sumBase / 1000, calc.savings.sumBase / 1000, 1,
                        reviewStates["NR-01"] === "승인 완료" ? "NR-01 설정온도 조정 승인" : "—"],
                      ["절감량 (MWh)", mrv.calc0.kpi.saveMWh, calc.kpi.saveMWh, 1, "조정 기준선 변경"],
                      ["탄소감축량 (tCO₂eq)", mrv.calc0.kpi.co2, calc.kpi.co2, 1,
                        ef.version !== "EF-v1.0" ? `배출계수 ${ef.version} 적용` : "절감량 변경"],
                      ["배출계수", 0.4594, ef.value, 4, ef.version !== "EF-v1.0" ? "신규 등록" : "변경 없음"],
                    ] as Array<[string, number, number, number, string]>
                  ).map(([label, v1, v2, d, why]) => (
                    <tr key={label} className="border-b border-line/50 last:border-0">
                      <td className="py-2 font-medium text-navy">{label}</td>
                      <td className="py-2 text-right text-body">{fmt(v1, d)}</td>
                      <td className={`py-2 text-right font-semibold ${Math.abs(v1 - v2) > 1e-9 ? "text-accent" : "text-body"}`}>
                        {fmt(v2, d)}
                        {Math.abs(v1 - v2) > 1e-9 && (
                          <span className="ml-1 text-[11px] font-medium text-slate-400">
                            ({v2 - v1 > 0 ? "+" : ""}{fmt(v2 - v1, d)})
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-4 text-body">{Math.abs(v1 - v2) > 1e-9 ? why : "변경 없음"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 text-[15px] font-semibold text-navy">
              변경이력·감사로그 <span className="tnum text-[12px] font-normal text-body">({audit.length}건 · localStorage 보존)</span>
            </div>
            {audit.length === 0 ? (
              <div className="text-[12px] text-body">기록 없음 — 검토·승인 탭에서 처리 시 기록됩니다.</div>
            ) : (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {audit.map((a, i) => (
                  <div key={i} className="tnum flex items-center gap-3 border-b border-line/50 py-1.5 text-[12px] last:border-0">
                    <span className="w-36 shrink-0 text-body">
                      {new Date(a.ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                    </span>
                    <span className="w-14 shrink-0 font-medium text-navy">{a.actor}</span>
                    <span className={`w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ${stateBadge(a.action)}`}>
                      {a.action}
                    </span>
                    <span className="w-14 shrink-0 text-body">{a.target}</span>
                    <span className="min-w-0 truncate text-body">{a.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
