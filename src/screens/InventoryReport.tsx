import { Fragment, useState } from "react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  years,
  inv,
  energyRows,
  emissionSources,
  sourceDetails,
  checks,
  checkSummary,
  sections,
  orgInfo,
  boundary,
  readinessPct,
  invMonthly,
  facilityList,
  planMeta,
  meterPlan,
  tierPlan,
  qaqcRoles,
  qaqcDocs,
  planChanges,
  omittedForms,
  type EmissionSource,
  type SourceKind,
} from "../lib/inventoryData";
import { evidenceRegistry } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf, type InvStatus } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

const TABS = [
  { key: "home", label: "보고서 홈" },
  { key: "plan", label: "산정계획서" },
  { key: "basic", label: "기본정보·보고범위" },
  { key: "totals", label: "배출량·에너지" },
  { key: "sources", label: "배출원 상세" },
  { key: "reduction", label: "감축실적" },
  { key: "check", label: "검토·승인" },
  { key: "preview", label: "보고서 미리보기" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SRC_BADGE: Record<SourceKind, string> = {
  자동수집: "bg-teal/10 text-teal",
  "시스템 계산": "bg-accent/10 text-accent",
  "수기 입력": "bg-review/10 text-review",
  추정값: "bg-review/10 text-review",
  합성데이터: "bg-line text-body",
  "해당 없음": "bg-line text-body",
};
const badge = (s: string) =>
  s === "완료" || s === "정상" || s === "자동 연결" || s === "자동 계산" || s === "승인 완료"
    ? "bg-teal/10 text-teal"
    : s === "생성 불가"
      ? "bg-risk/10 text-risk"
      : s === "매핑만" || s === "작성 중"
        ? "bg-line text-body"
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

const STEP_FLOW: Array<{ name: string; done: (s: InvStatus, warn: number) => "완료" | "진행 중" | "검토 필요" | "미작성" }> = [
  { name: "범위 설정", done: () => "완료" },
  { name: "데이터 연결", done: () => "완료" },
  { name: "오류 검토", done: (_s, w) => (w > 0 ? "검토 필요" : "완료") },
  { name: "작성 완료", done: (s) => (s === "작성 중" || s === "수정 요청" ? "진행 중" : "완료") },
  { name: "승인", done: (s) => (s === "승인 완료" ? "완료" : s === "검토 완료·승인 대기" || s === "검토 요청" ? "진행 중" : "미작성") },
  { name: "출력", done: (s) => (s === "승인 완료" ? "진행 중" : "미작성") },
];

export default function InventoryReport() {
  const [tab, setTab] = useState<TabKey>("home");
  const [openSrc, setOpenSrc] = useState<string | null>("boiler");
  const [opinion, setOpinion] = useState("");
  const { role, invStatus, invAction, reviewStates, setMenu } = useUI();
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(reviewStates);
  const approved = invStatus === "승인 완료";

  const csvExport = () => {
    const lines = [
      "# DEMO · 합성데이터 — 공식 제출·검증 사용 불가",
      "# 온실가스 배출량 및 에너지 사용량 명세서 데이터 (RPT-2026-DEMO)",
      "구분,항목,값,단위,데이터 출처",
      `배출량,Scope 1,${inv.scope1.toFixed(1)},tCO2eq,시스템 계산`,
      `배출량,Scope 2,${inv.scope2.toFixed(1)},tCO2eq,시스템 계산`,
      `배출량,합계,${inv.total.toFixed(1)},tCO2eq,시스템 계산`,
      `에너지,총 사용량,${inv.energyMWh},MWh,시스템 계산`,
      `에너지,총 사용량,${inv.energyTJ},TJ,시스템 계산`,
      ...energyRows.map((r) => `에너지원,${r.name},"${r.raw}",원천단위,${r.source}`),
      ...emissionSources.filter((s) => s.tco2 !== null).map((s) => `배출원,${s.facilityName} ${s.activityName},${s.tco2},tCO2eq,${s.method}`),
      `감축실적(별도),냉수플랜트 MRV 절감,${calc.kpi.saveMWh.toFixed(1)},MWh,MRV 엔진`,
      `감축실적(별도),냉수플랜트 MRV 감축,${calc.kpi.co2.toFixed(1)},tCO2eq,MRV 엔진`,
      `버전,계산버전,${calc.version},,`,
      `버전,배출계수,${ef.version} (${ef.value}),tCO2eq/MWh,`,
      `상태,보고서,${invStatus},,`,
    ];
    download(`명세서데이터_2026상반기_DEMO.csv`, "﻿" + lines.join("\n"), "text/csv");
  };

  return (
    <>
      {/* 명세서 탭 */}
      <div className="no-print flex shrink-0 flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
              tab === t.key ? "border-accent font-semibold text-accent" : "border-transparent text-body hover:text-navy"
            }`}
          >
            {t.label}
            {t.key === "check" && checkSummary.warn > 0 && (
              <span className="tnum ml-1.5 rounded-full bg-review/15 px-1.5 text-[11px] font-bold text-review">{checkSummary.warn}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------- ① 보고서 홈 ---------- */}
      {tab === "home" && (
        <>
          {/* 보고조건 */}
          <section className="rounded-[10px] border border-line/60 bg-white px-4 py-3">
            <div className="tnum grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-4">
              {(
                [
                  ["보고서 유형", "온실가스 배출량·에너지 사용량 명세서"],
                  ["사업장", "원주공장"],
                  ["보고연도", "2026년 (상반기 데모)"],
                  ["보고기간", "2026.01.01 – 06.30"],
                  ["계산 버전", calc.version],
                  ["배출계수", `${ef.version} (${ef.value})`],
                  ["작성자", "작성자(데모)"],
                  ["현재 상태", invStatus],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11.5px] text-slate-400">{k}</span>
                  <span className={`min-w-0 truncate font-semibold ${k === "현재 상태" ? (approved ? "text-teal" : "text-review") : "text-navy"}`}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 상태 카드 4 */}
          <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">데이터 준비율</div>
              <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">{readinessPct}%</div>
              <div className="mt-1.5 text-[12px] text-body">6개 섹션 중 4개 자동 연결·계산</div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">자동 연결 항목</div>
              <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-teal">12<span className="text-[13px] font-semibold text-body"> 항목</span></div>
              <div className="mt-1.5 text-[12px] text-body">설비·계측·에너지·계수·증빙 재사용</div>
            </div>
            <button onClick={() => setTab("check")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
              <div className="text-[13px] font-medium text-body">검토 필요 항목</div>
              <div className={`tnum mt-1.5 text-[26px] leading-none font-bold ${checkSummary.warn > 0 ? "text-review" : "text-teal"}`}>
                {checkSummary.warn}<span className="text-[13px] font-semibold text-body"> 건</span>
              </div>
              <div className="mt-1.5 text-[12px] text-body">자동 검증 {checks.length}개 규칙 · 생성 불가 {checkSummary.block}건</div>
            </button>
            <button onClick={() => setTab("check")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
              <div className="text-[13px] font-medium text-body">승인 상태</div>
              <div className={`tnum mt-1.5 text-[22px] leading-none font-bold ${approved ? "text-teal" : "text-review"}`}>{invStatus}</div>
              <div className="mt-1.5 text-[12px] text-body">작성자 → 검토자 → 승인자 (역할 분리)</div>
            </button>
          </section>

          {/* 작성 단계 진행 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 text-[15px] font-semibold text-navy">작성 단계</div>
            <div className="flex items-center gap-1">
              {STEP_FLOW.map((s, i) => {
                const st = s.done(invStatus, checkSummary.warn);
                return (
                  <div key={s.name} className="flex flex-1 items-center gap-1">
                    <div
                      className={`flex h-8 flex-1 flex-col items-center justify-center rounded text-[11.5px] leading-tight font-medium ${
                        st === "완료" ? "bg-teal/12 text-teal" : st === "진행 중" ? "bg-accent text-white" : st === "검토 필요" ? "bg-review/15 text-review" : "bg-surface text-slate-400"
                      }`}
                    >
                      <span>{i + 1}. {s.name}</span>
                      <span className="text-[10px] opacity-80">{st}</span>
                    </div>
                    {i < STEP_FLOW.length - 1 && <span className="text-slate-300">›</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 연도별 추세 + 섹션 목록 */}
          <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="mb-1 text-[15px] font-semibold text-navy">연도별 Scope 1·2 배출량</div>
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={years} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#eaeff5" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => fmt(v)} />
                    <Tooltip
                      formatter={(v, name) => [`${fmt(Number(v ?? 0))} tCO₂eq`, name === "scope1" ? "Scope 1" : "Scope 2"]}
                      labelFormatter={(l) => `${l}년${l === "2026" ? " (상반기)" : ""}`}
                      contentStyle={{ fontSize: 12.5, borderRadius: 8, border: "1px solid #dce4ea" }}
                    />
                    <Legend formatter={(v) => (v === "scope1" ? "Scope 1" : "Scope 2")} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="scope1" stackId="s" fill="#d97706" fillOpacity={0.75} barSize={30} isAnimationActive={false} />
                    <Bar dataKey="scope2" stackId="s" fill="#159f9e" fillOpacity={0.75} radius={[3, 3, 0, 0]} barSize={30} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[11.5px] text-slate-400">2026년은 상반기 6개월 — 연간 대비 낮음 (데모)</div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="mb-2 text-[15px] font-semibold text-navy">보고서 섹션</div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-body">
                    <th className="py-2 font-medium">섹션</th>
                    <th className="py-2 font-medium">연결 상태</th>
                    <th className="py-2 font-medium">검토 상태</th>
                    <th className="py-2 font-medium">담당자</th>
                    <th className="py-2 text-right font-medium">최종 수정</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {sections.map((s) => (
                    <tr key={s.name} className="border-b border-line/50 last:border-0">
                      <td className="py-2 font-medium text-navy">{s.name}</td>
                      <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge(s.link)}`}>{s.link}</span></td>
                      <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge(s.review)}`}>{s.review}</span></td>
                      <td className="py-2 text-body">{s.owner}</td>
                      <td className="py-2 text-right text-body">{s.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ---------- ② 산정계획서 (별지 10) — 모니터링 방법의 사전 정의, 명세서와 자동 정합 ---------- */}
      {tab === "plan" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-navy">
                배출량 산정계획서 <span className="text-[12px] font-normal text-body">{planMeta.base}</span>
              </span>
              <span className="rounded bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal">정합 검증 통과</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] md:grid-cols-2">
              <div className="rounded-lg bg-surface/70 px-3.5 py-2.5 leading-relaxed text-body">
                <b className="text-navy">산정계획서(별지 10)</b>는 배출량을 <b className="text-navy">어떻게 측정·산정할지</b>를 사전에 정의·승인받는 문서이고,
                <b className="text-navy"> 명세서(별지 11)</b>는 그 계획대로 산정한 연간 실적 보고입니다.
                본 시스템은 계획서 항목(측정기기·산정등급·QA/QC)을 기준정보로 관리해 명세서와 자동으로 정합시킵니다.
              </div>
              <div className="tnum flex flex-col justify-center gap-1 text-[13px]">
                <div><span className="text-slate-400">계획서 버전 </span><span className="font-semibold text-navy">{planMeta.docNo}</span></div>
                <div><span className="text-slate-400">승인·변경 </span><span className="text-navy">{planMeta.approvedAt}</span></div>
                <div><span className="text-slate-400">정합 상태 </span><span className="font-medium text-teal">{planMeta.consistency}</span></div>
              </div>
            </div>
          </section>

          {/* 서식 4-1~4-3: 활동자료 모니터링·측정기기 (개선·신설계획 포함) */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                활동자료 모니터링·측정기기 <span className="text-[12px] font-normal text-body">(서식 4-1 개요 · 4-2 개선계획 · 4-3 신설계획)</span>
              </span>
              <span className="text-[12px] text-slate-400">기준정보(설비·센서)에서 자동 구성</span>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-body">
                  <th className="py-2 font-medium">측정기기</th>
                  <th className="py-2 font-medium">수집 유형</th>
                  <th className="py-2 font-medium">측정지점 / 시설</th>
                  <th className="py-2 font-medium">정확도</th>
                  <th className="py-2 font-medium">교정 유효</th>
                  <th className="py-2 pl-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {meterPlan.map((m) => (
                  <Fragment key={m.meter}>
                    <tr className="border-b border-line/50">
                      <td className="py-2 font-medium text-navy">{m.meter}</td>
                      <td className="py-2 text-body">{m.kind}</td>
                      <td className="py-2 text-body">{m.point} · {m.facility}</td>
                      <td className="py-2 text-body">{m.spec}</td>
                      <td className={`py-2 ${m.calibDue.includes("만료") ? "font-semibold text-review" : "text-body"}`}>{m.calibDue}</td>
                      <td className="py-2 pl-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                          m.state === "정상" ? "bg-teal/10 text-teal" : m.state === "개선계획" ? "bg-review/10 text-review" : "bg-accent/10 text-accent"
                        }`}>{m.state}</span>
                      </td>
                    </tr>
                    {m.plan && (
                      <tr className="border-b border-line/50 bg-surface/50">
                        <td colSpan={6} className="px-4 py-1.5 text-[12px] text-body">{m.plan}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>

          {/* 서식 5: 산정등급 적용계획 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 text-[15px] font-semibold text-navy">
              산정등급(Tier) 적용계획 <span className="text-[12px] font-normal text-body">(서식 5-1 산정방법론 · 5-2 매개변수)</span>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-body">
                  <th className="py-2 font-medium">배출활동 (코드)</th>
                  <th className="py-2 font-medium">매개변수</th>
                  <th className="py-2 font-medium">최소등급</th>
                  <th className="py-2 font-medium">적용등급</th>
                  <th className="py-2 font-medium">충족</th>
                  <th className="py-2 font-medium">타당성</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {tierPlan.map((t, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0">
                    <td className="py-2 font-medium text-navy">{t.activity}{t.activityCode !== "—" && <span className="text-[11.5px] text-slate-400"> ({t.activityCode})</span>}</td>
                    <td className="py-2 text-body">{t.param}</td>
                    <td className="py-2 text-body">{t.minTier}</td>
                    <td className="py-2 font-medium text-navy">{t.applyTier}</td>
                    <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.ok ? "bg-teal/10 text-teal" : "bg-risk/10 text-risk"}`}>{t.ok ? "충족" : "미충족"}</span></td>
                    <td className="max-w-72 py-2 text-body">{t.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 서식 8 + 10: QA/QC · 변경 내역 */}
          <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="mb-2 text-[15px] font-semibold text-navy">
                품질관리(QA/QC)·담당자 <span className="text-[12px] font-normal text-body">(서식 8-1·8-2)</span>
              </div>
              <div className="divide-y divide-line/40">
                {qaqcRoles.map(([who, role, desc]) => (
                  <div key={who} className="flex items-baseline gap-3 py-1.5 text-[13px]">
                    <span className="w-44 shrink-0 font-medium text-navy">{who}</span>
                    <span className="w-24 shrink-0 text-accent">{role}</span>
                    <span className="text-body">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[12px] text-body">{qaqcDocs}</div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="mb-2 text-[15px] font-semibold text-navy">
                산정계획서 변경 내역 <span className="text-[12px] font-normal text-body">(서식 10)</span>
              </div>
              <div className="divide-y divide-line/40">
                {planChanges.map(([date, type, desc, ver]) => (
                  <div key={date + type} className="py-1.5 text-[13px]">
                    <div className="tnum flex items-center gap-2">
                      <span className="text-slate-400">{date}</span>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">{type}</span>
                      <span className="ml-auto text-[11.5px] text-slate-400">{ver}</span>
                    </div>
                    <div className="mt-0.5 text-body">{desc}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[12px] text-body">
                시설·측정기기 변경 시 계획서 새 버전 생성 — 기존 버전은 보존 (변경관리 이력 연동)
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------- ③ 기본정보·보고범위 ---------- */}
      {tab === "basic" && (
        <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">업체·사업장 정보</span>
              <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-teal">자동 연결 · 시스템 관리</span>
            </div>
            <div className="tnum divide-y divide-line/40">
              {orgInfo.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
                  <span className="shrink-0 text-slate-400">{k}</span>
                  <span className="text-right font-medium text-navy">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="mb-2 text-[15px] font-semibold text-navy">보고범위 · 조직경계</div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {["원주공장 전체", "일부 공정", "선택 설비", "기타"].map((o) => (
                  <span
                    key={o}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] ${
                      o === boundary.scope ? "border-accent/50 bg-accent/8 font-semibold text-accent" : "border-line/60 text-slate-400"
                    }`}
                  >
                    {o}
                  </span>
                ))}
              </div>
              <div className="tnum divide-y divide-line/40 text-[13px]">
                {(
                  [
                    ["운영경계", boundary.operational],
                    ["포함 사업장", boundary.included],
                    ["제외 시설", boundary.excluded],
                    ["제외 사유", boundary.excludedReason],
                    ["경계 변경", boundary.changed],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                    <span className="shrink-0 text-slate-400">{k}</span>
                    <span className="text-right font-medium text-navy">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[15px] font-semibold text-navy">경계 증빙 첨부</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">{boundary.attachments}</p>
            </div>
          </div>
        </section>
      )}

      {/* ---------- ③ 배출량·에너지 ---------- */}
      {tab === "totals" && (
        <>
          <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            {(
              [
                ["Scope 1 배출량", `${fmt(inv.scope1)}`, "tCO₂eq", "고정연소 + 비산"],
                ["Scope 2 배출량", `${fmt(inv.scope2)}`, "tCO₂eq", "구매전력 (간접)"],
                ["총 배출량", `${fmt(inv.total)}`, "tCO₂eq", `전년 동기준 원단위 ${inv.intensity} (전년 ${inv.intensityPrev})`],
                ["총 에너지", `${fmt(inv.energyTJ, 1)}`, "TJ", `${fmt(inv.energyMWh)} MWh · 품질등급 ${inv.qualityGrade}`],
              ] as Array<[string, string, string, string]>
            ).map(([k, v, u, sub]) => (
              <div key={k} className="rounded-[10px] border border-line/60 bg-white p-4">
                <div className="text-[13px] font-medium text-body">{k}</div>
                <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">
                  {v} <span className="text-[13px] font-semibold">{u}</span>
                </div>
                <div className="tnum mt-1.5 truncate text-[12px] text-body" title={sub}>{sub}</div>
              </div>
            ))}
          </section>

          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">에너지원별 사용량 (원천 단위 → 보고 단위)</span>
              <span className="text-[12px] text-slate-400">값 옆 배지 = 데이터 출처</span>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-body">
                  <th className="py-2 font-medium">에너지원</th>
                  <th className="py-2 text-right font-medium">원천 단위</th>
                  <th className="py-2 text-right font-medium">MWh</th>
                  <th className="py-2 text-right font-medium">TJ</th>
                  <th className="py-2 pl-4 font-medium">출처</th>
                  <th className="py-2 font-medium">원천 시스템·태그</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {energyRows.map((r) => (
                  <tr key={r.name} className="border-b border-line/50 last:border-0" title={r.note ?? ""}>
                    <td className="py-2 font-medium text-navy">{r.name}</td>
                    <td className="py-2 text-right text-body">{r.raw}</td>
                    <td className="py-2 text-right text-navy">{r.mwh !== null ? fmt(r.mwh) : "—"}</td>
                    <td className="py-2 text-right text-navy">{r.tj !== null ? fmt(r.tj, 1) : "—"}</td>
                    <td className="py-2 pl-4"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SRC_BADGE[r.source]}`}>{r.source}</span></td>
                    <td className="max-w-64 truncate py-2 text-body">{r.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[12px] text-body">
              단위 변환: 전기 kWh→MWh→TJ(×0.0036) · LNG 천Nm³→TJ(×0.0394) — 자동 변환 · 계산 결과 직접 수정 불가(활동자료·계수 수정 후 재계산)
            </div>
          </section>
        </>
      )}

      {/* ---------- ④ 배출원 상세 ---------- */}
      {tab === "sources" && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">
              배출원 목록 <span className="tnum text-[12px] font-normal text-body">(설비군 → 법정 배출시설·활동 매핑 · 대표 3종 상세)</span>
            </span>
            <span className="text-[12px] text-slate-400">행 클릭 시 산정 상세 확장</span>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-2 font-medium">설비군 / 배출시설</th>
                <th className="py-2 font-medium">배출활동</th>
                <th className="py-2 font-medium">Scope</th>
                <th className="py-2 text-right font-medium">활동자료</th>
                <th className="py-2 text-right font-medium">배출량 (tCO₂eq)</th>
                <th className="py-2 pl-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {emissionSources.map((s: EmissionSource) => (
                <Fragment key={s.groupKey + s.activityCode}>
                  <tr
                    onClick={() => s.detail && setOpenSrc(openSrc === s.groupKey ? null : s.groupKey)}
                    className={`border-b border-line/50 transition-colors ${s.detail ? "cursor-pointer hover:bg-surface" : ""} ${openSrc === s.groupKey ? "bg-accent/4" : ""}`}
                  >
                    <td className="py-2">
                      <div className="font-medium text-navy">{s.groupName} {s.detail && <span className="text-[10px] font-bold text-accent">{openSrc === s.groupKey ? "▾" : "▸"} 상세</span>}</div>
                      <div className="text-[11.5px] text-slate-400">{s.facilityCode} · {s.facilityName}</div>
                    </td>
                    <td className="py-2 text-body">
                      <div>{s.activityName}</div>
                      <div className="text-[11.5px] text-slate-400">{s.activityCode} · {s.tier}</div>
                    </td>
                    <td className="py-2 text-body">{s.scope}</td>
                    <td className="py-2 text-right text-body">{s.activityData}</td>
                    <td className="py-2 text-right font-semibold text-navy">{s.tco2 !== null ? fmt(s.tco2, s.tco2 < 100 ? 2 : 0) : "—"}</td>
                    <td className="py-2 pl-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge(s.state)}`}>{s.state}</span></td>
                  </tr>
                  {s.detail && openSrc === s.groupKey && sourceDetails[s.groupKey] && (
                    <tr className="border-b border-line/50 bg-surface/50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12.5px] md:grid-cols-2">
                          <div><span className="text-slate-400">산정식 </span><span className="tnum font-medium text-navy">{sourceDetails[s.groupKey].formula}</span></div>
                          <div><span className="text-slate-400">적용 계수 </span><span className="font-medium text-navy">{sourceDetails[s.groupKey].factor}</span></div>
                          <div><span className="text-slate-400">계수 출처 </span><span className="text-body">{sourceDetails[s.groupKey].factorSrc}</span></div>
                          <div><span className="text-slate-400">원천 데이터 </span><span className="text-body">{sourceDetails[s.groupKey].origin}</span></div>
                          <div><span className="text-slate-400">비고 </span><span className="text-body">{sourceDetails[s.groupKey].monthlyNote}</span></div>
                          <div><span className="text-slate-400">수정 정책 </span><span className="text-body">{sourceDetails[s.groupKey].edit}</span></div>
                          <div><span className="text-slate-400">증빙 </span><span className="font-medium text-accent">{s.evidence}</span> <button onClick={(e) => { e.stopPropagation(); setMenu("verify"); }} className="text-accent hover:underline">증적 레지스트리 ›</button></div>
                          <div><span className="text-slate-400">계산 버전 </span><span className="tnum font-medium text-navy">{calc.version} · {ef.version}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[12px] text-body">
            전력 사용 설비군의 배분값은 참고 표기이며 Scope 2 합계에는 구매전력 1회만 산입 · MRV 설비군과 법정 배출활동 분류는 별도 매핑으로 관리
          </div>
        </section>
      )}

      {/* ---------- ⑤ 감축실적 ---------- */}
      {tab === "reduction" && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">배출시설별 감축실적 (MRV 연계 · 인벤토리와 별도 관리)</span>
            <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-teal">자동 연결 · MRV 엔진</span>
          </div>
          <div className="rounded-lg border border-line/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-navy">중앙 냉수플랜트 효율개선 (MVP-2026-01)</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge(verify.state)}`}>{verify.state}</span>
            </div>
            <div className="tnum mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] md:grid-cols-3">
              {(
                [
                  ["대상 설비", "냉동기 2대·펌프·냉각탑"],
                  ["시행일", "2026-01-01 (CH-01R 가동)"],
                  ["기준기간 / 보고기간", "2025년 / 2026 상반기"],
                  ["기준선 모델", "BL-v1.0 (냉방도일·생산량 OLS)"],
                  ["에너지 절감량", `${fmt(calc.kpi.saveMWh)} MWh (${pct(calc.kpi.savePct)})`],
                  ["온실가스 감축량", `${fmt(calc.kpi.co2, 1)} tCO₂eq`],
                  ["산정방법", "IPMVP Option B 후보 · 불확도 ±" + fmt(calc.kpi.uncertaintyPct * 100, 1) + "%"],
                  ["데이터 품질", "정상률 99.6% · 제외 12일"],
                  ["증빙자료", "증적 5건 (EV-2026-011~015)"],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k}><div className="text-[11.5px] text-slate-400">{k}</div><div className="font-medium text-navy">{v}</div></div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface/70 px-3 py-2 text-[13px]">
              <span className="text-slate-400">인벤토리 반영 여부</span>
              <span className="rounded-lg border border-accent/50 bg-accent/8 px-3 py-1 font-semibold text-accent">별도 관리 (기본값)</span>
              <span className="cursor-not-allowed rounded-lg border border-line/60 px-3 py-1 text-slate-400" title="감축량을 Scope 배출량에서 차감하지 않습니다 (데모 정책)">인벤토리 차감 — 미지원</span>
              <span className="text-[12px] text-body">감축실적은 Scope 1·2 배출량에서 자동 차감되지 않으며 별도 항목으로 보고</span>
            </div>
          </div>
          <div className="mt-2 text-[12px] text-body">
            보일러 폐열회수·압축공기 누설개선은 MRV 프로젝트 개시 후 이 목록에 추가됩니다 (향후 지원 예정)
          </div>
        </section>
      )}

      {/* ---------- ⑥ 검토·승인 (자동 검증 + 상태 흐름) ---------- */}
      {tab === "check" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                자동 검증 결과 <span className="tnum text-[12px] font-normal text-body">정상 {checkSummary.ok} · 확인 필요 {checkSummary.warn} · 생성 불가 {checkSummary.block}</span>
              </span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${checkSummary.block > 0 ? "bg-risk/10 text-risk" : checkSummary.warn > 0 ? "bg-review/10 text-review" : "bg-teal/10 text-teal"}`}>
                {checkSummary.block > 0 ? "보고서 생성 불가" : checkSummary.warn > 0 ? "확인 후 생성 가능" : "생성 가능"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {checks.filter((c) => c.status !== "정상").map((c) => (
                <div key={c.rule} className="rounded-lg bg-review/8 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge(c.status)}`}>{c.status}</span>
                    <span className="text-[13px] font-semibold text-navy">{c.rule}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-body">{c.detail}</div>
                  {c.action && <div className="mt-0.5 text-[12.5px] leading-relaxed text-navy">조치: {c.action}</div>}
                </div>
              ))}
              <details className="rounded-lg bg-surface/60 px-3.5 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-body">정상 {checkSummary.ok}건 규칙 보기</summary>
                <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                  {checks.filter((c) => c.status === "정상").map((c) => (
                    <div key={c.rule} className="text-[12.5px] text-body">
                      <span className="mr-1.5 rounded bg-teal/10 px-1 py-0.5 text-[10px] font-bold text-teal">정상</span>
                      <b className="text-navy">{c.rule}</b> — {c.detail}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </section>

          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">검토·승인 흐름</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${badge(invStatus)}`}>{invStatus}</span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-body">
              {["작성 중", "검토 요청", "검토 완료·승인 대기", "승인 완료"].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`rounded px-2 py-1 font-medium ${invStatus === s ? "bg-navy text-white" : invStatus === "수정 요청" && s === "작성 중" ? "bg-review/15 text-review" : "bg-surface text-slate-400"}`}>
                    {s}
                  </span>
                  {i < arr.length - 1 && <span className="text-slate-300">›</span>}
                </span>
              ))}
              <span className="ml-2 text-slate-400">(검토자 반려 시 '수정 요청' → 작성자 보완 후 재요청)</span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-64 flex-1 flex-col gap-1 text-[12px] text-body">
                처리 의견 (기록됨)
                <input value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="예: 추정데이터 사용 주석 확인함" className="rounded border border-line bg-white px-2 py-1.5 text-[13px] text-navy" />
              </label>
              <button
                disabled={!(invStatus === "작성 중" || invStatus === "수정 요청")}
                onClick={() => { invAction("request", opinion); setOpinion(""); }}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                검토 요청 (작성자)
              </button>
              <button
                disabled={!(role === "검토자" && invStatus === "검토 요청")}
                onClick={() => { invAction("reviewOk", opinion); setOpinion(""); }}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                검토 완료 (검토자)
              </button>
              <button
                disabled={!(role === "검토자" && invStatus === "검토 요청")}
                onClick={() => { invAction("fix", opinion); setOpinion(""); }}
                className="rounded-lg border border-review/50 px-3 py-1.5 text-[12.5px] font-semibold text-review hover:bg-review/8 disabled:cursor-not-allowed disabled:opacity-35"
              >
                수정 요청
              </button>
              <button
                disabled={!(role === "승인자" && invStatus === "검토 완료·승인 대기")}
                onClick={() => { invAction("approve", opinion); setOpinion(""); }}
                className="rounded-lg bg-teal px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                승인 (승인자)
              </button>
              <button onClick={() => invAction("reset")} className="text-[12px] text-slate-400 hover:text-navy">초기화</button>
            </div>
            <div className="mt-2 text-[12px] text-body">
              모든 처리(처리자·일시·의견·보고서/계산 버전)는 감사로그에 기록 · 승인 후 원천데이터가 변경되면 승인이 해제되고 '재검토 필요'로 전환(데모 정책)
            </div>
          </section>
        </>
      )}

      {/* ---------- ⑦ 보고서 미리보기 ---------- */}
      {tab === "preview" && (
        <>
          <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-body">
              A4 인쇄용 미리보기 — 별지 11 서식 12개 구획 요약본 (생략 서식은 12절에 명시) · {approved ? "승인 완료 버전" : `현재 ${invStatus} — 승인 전 초안`}
            </span>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
                PDF 인쇄·저장
              </button>
              <button onClick={csvExport} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-navy hover:border-accent/50">
                Excel용 데이터 (CSV)
              </button>
            </div>
          </div>

          <div className="print-root mx-auto w-full max-w-[800px] rounded-[10px] border border-line/60 bg-white p-10 text-[13px] leading-relaxed text-navy shadow-sm">
            {/* 표지 */}
            <div className="relative border-b-2 border-navy pb-6 text-center">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rotate-[-18deg] text-[38px] font-black tracking-widest text-review/10 select-none">DEMO · 합성데이터</span>
              </div>
              <div className="text-[12px] tracking-widest text-slate-400">별지 제11호 서식 참고 (데모 요약본)</div>
              <div className="mt-2 text-[24px] font-bold">온실가스 배출량 및 에너지 사용량 명세서</div>
              <div className="mt-1 text-[14px]">2026년 (상반기 데모) · 원주공장</div>
              <div className="tnum mt-3 text-[12px] text-body">
                보고서 번호 RPT-2026-DEMO · 계산버전 {calc.version} · 배출계수 {ef.version} · 상태 {invStatus}
              </div>
              <div className="mt-2 text-[11.5px] text-review">
                본 자료는 명세서 작성 지원 기능의 테스트 화면이며, 공식 제출 또는 제3자 검증 자료로 사용할 수 없습니다.
              </div>
            </div>

            {/* 1. 기본정보 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">1. 업체·사업장 일반정보 <span className="text-[11px] font-normal text-slate-400">서식 1-1 · 2-1</span></h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <tbody>
                {orgInfo.map(([k, v]) => (
                  <tr key={k} className="border-b border-line">
                    <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                    <td className="px-2.5 py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 2. 조직경계 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">2. 조직경계·보고범위 <span className="text-[11px] font-normal text-slate-400">서식 2-2</span></h3>
            <p>
              조직경계는 <b>{boundary.scope}</b>로 하며, 운영경계는 {boundary.operational}이다. 제외 시설: {boundary.excluded} ({boundary.excludedReason}). {boundary.changed}.
              경계 증빙(사진·시설배치도·공정도)은 데모에서 파일 미첨부(향후 지원 예정).
            </p>

            {/* 3. 배출시설 현황 (서식 3-1) */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">3. 배출시설 현황 <span className="text-[11px] font-normal text-slate-400">서식 3-1</span></h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-body">
                  <th className="px-2.5 py-1.5 text-left font-medium">시설코드</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">배출시설명</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">자체시설명</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">시설규모</th>
                  <th className="px-2.5 py-1.5 text-center font-medium">소규모</th>
                  <th className="px-2.5 py-1.5 text-center font-medium">할당대상</th>
                </tr>
              </thead>
              <tbody>
                {facilityList.map((f) => (
                  <tr key={f.facilityId} className="border-b border-line">
                    <td className="px-2.5 py-1.5">{f.code} · {f.facilityId}</td>
                    <td className="px-2.5 py-1.5">{f.name}</td>
                    <td className="px-2.5 py-1.5">{f.ownName}{f.change && <span className="text-[11px] text-review"> ({f.change})</span>}</td>
                    <td className="px-2.5 py-1.5">{f.scale}</td>
                    <td className="px-2.5 py-1.5 text-center">{f.small ? "Y" : "N"}</td>
                    <td className="px-2.5 py-1.5 text-center">{f.target ? "Y" : "N"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11.5px] text-body">주) 시설코드는 별지 제10호 참고2의 배출시설 코드(0055 일반 보일러시설, 0014 냉동·냉방용 냉매 사용 시설) 기준 · 규모는 데모 가정</p>

            {/* 4. 총괄 (서식 1-3·4-1) */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">4. 온실가스 배출량 및 에너지 사용량 총괄 <span className="text-[11px] font-normal text-slate-400">서식 1-3 · 4-1</span></h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-body">
                  <th className="px-2.5 py-1.5 text-left font-medium">구분</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Scope 1</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Scope 2</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">합계 (tCO₂eq)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">에너지 (TJ)</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className={`border-b border-line ${y.year === "2026" ? "font-semibold" : ""}`}>
                    <td className="px-2.5 py-1.5">{y.year}년{y.note ? ` (${y.note.split(" ")[0]})` : ""}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(y.scope1)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(y.scope2)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(y.scope1 + y.scope2)}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      {fmt(Math.round((y.gridMWh * 0.0036 + y.lngKNm3 * 0.0394) * 10) / 10, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11.5px] text-body">
              주1) 2026년은 상반기(1~6월) 데모 보고기간으로 연간 값과 직접 비교할 수 없음<br />
              주2) 산정제외 보고사항(서식 4-2): 바이오매스 사용 배출 — 해당 없음<br />
              주3) 배출시설 변동현황(서식 4-4): F-020 냉동기 CH-01 → CH-01R 교체(2026-01-01, 저GWP R-1233zd(E)) — 산정계획서 v1.0 반영
            </p>

            {/* 5. 에너지원별 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">5. 에너지원별 사용량 <span className="text-[11px] font-normal text-slate-400">총괄 보조 표</span></h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-body">
                  <th className="px-2.5 py-1.5 text-left font-medium">에너지원</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">원천 단위</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">TJ</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">데이터 출처</th>
                </tr>
              </thead>
              <tbody>
                {energyRows.map((r) => (
                  <tr key={r.name} className="border-b border-line">
                    <td className="px-2.5 py-1.5">{r.name}</td>
                    <td className="px-2.5 py-1.5 text-right">{r.raw}</td>
                    <td className="px-2.5 py-1.5 text-right">{r.tj !== null ? fmt(r.tj, 1) : "—"}</td>
                    <td className="px-2.5 py-1.5">{r.source}{r.note ? ` · ${r.note}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 6. 배출활동별 배출량 (서식 5) */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">6. 배출활동별 배출량 현황 <span className="text-[11px] font-normal text-slate-400">서식 5-1 고정연소 · 5-11 간접배출 · 5-13 ODS 대체물질</span></h3>
            {emissionSources.filter((s) => s.detail).map((s) => (
              <div key={s.groupKey} className="mb-3 border-b border-line pb-2">
                <div className="font-semibold">{s.facilityCode} {s.facilityName} — {s.activityName} ({s.scope})</div>
                <div className="tnum mt-0.5 text-[12.5px] text-body">
                  활동자료 {s.activityData} · {sourceDetails[s.groupKey]?.formula} · 배출량 <b className="text-navy">{s.tco2 !== null ? fmt(s.tco2, s.tco2 < 100 ? 2 : 0) : "—"} tCO₂eq</b>
                  <br />계수: {sourceDetails[s.groupKey]?.factor} · 산정등급: {s.tier} · 원천: {sourceDetails[s.groupKey]?.origin} · 증빙: {s.evidence}
                </div>
              </div>
            ))}
            <div className="mt-2 mb-1 text-[13px] font-semibold">월별 활동자료 및 배출량 (2026 상반기)</div>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-body">
                  <th className="px-2.5 py-1.5 text-left font-medium">월</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">전력 (MWh)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">간접배출 (tCO₂eq)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">LNG (천Nm³)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">고정연소 (tCO₂eq)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">월 합계 (tCO₂eq)</th>
                </tr>
              </thead>
              <tbody>
                {invMonthly.map((m) => (
                  <tr key={m.m} className="border-b border-line">
                    <td className="px-2.5 py-1.5">{Number(m.m.slice(5))}월</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.elecMWh)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.scope2, 1)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.lngKNm3)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.scope1, 1)}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium">{fmt(m.scope1 + m.scope2, 1)}</td>
                  </tr>
                ))}
                <tr className="border-b border-line font-semibold">
                  <td className="px-2.5 py-1.5">합계</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(invMonthly.reduce((s, m) => s + m.elecMWh, 0))}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(invMonthly.reduce((s, m) => s + m.scope2, 0), 1)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(invMonthly.reduce((s, m) => s + m.lngKNm3, 0))}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(invMonthly.reduce((s, m) => s + m.scope1, 0), 1)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(invMonthly.reduce((s, m) => s + m.scope1 + m.scope2, 0), 1)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11.5px] text-body">주) 냉매 비산배출(5-13) 12.87 tCO₂eq는 5월 정비 보충 1건으로 월별 표에 미포함(별도 산정) · 월별 합계와 연간 총괄의 차이는 반올림</p>

            {/* 7. 원단위 (서식 6) */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">7. 생산품 및 원단위 <span className="text-[11px] font-normal text-slate-400">서식 6</span></h3>
            <p>
              주요 생산품(면류·스낵, 데모)의 2026 상반기 생산량은 <b>4,580 t</b>이며, 에너지 원단위는 <b>{fmt(inv.energyTJ / 4580 * 1000, 2)} GJ/t</b>,
              온실가스 원단위는 <b>{inv.intensity} tCO₂eq/t</b>(전년 {inv.intensityPrev})이다.
            </p>

            {/* 8. 감축실적 (서식 8) */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">8. 배출시설별 온실가스 감축실적 <span className="text-[11px] font-normal text-slate-400">서식 8 · MRV 연계</span></h3>
            <p>
              중앙 냉수플랜트 효율개선(MVP-2026-01): 조정 기준선 대비 전력 <b>{fmt(calc.kpi.saveMWh)} MWh ({pct(calc.kpi.savePct)})</b> 절감,
              온실가스 <b>{fmt(calc.kpi.co2, 1)} tCO₂eq</b> 감축 (검증 상태: {verify.state}, 불확도 ±{fmt(calc.kpi.uncertaintyPct * 100, 1)}%).
              본 감축량은 Scope 1·2 배출량에서 차감하지 않고 별도 실적으로 관리한다.
            </p>

            {/* 9. 데이터 품질·검토 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">9. 데이터 품질 및 검토 결과</h3>
            <p>
              자동 검증 {checks.length}개 규칙 중 정상 {checkSummary.ok}건, 확인 필요 {checkSummary.warn}건, 생성 불가 {checkSummary.block}건.
              확인 필요 항목: {checks.filter((c) => c.status === "확인 필요").map((c) => c.rule).join(", ")}.
              추정데이터(2026-05-08 비례 추정)와 수기 입력(LNG 월별 보정·냉매 기록)은 출처 표시와 함께 보고에 포함.
            </p>

            {/* 10. 증빙 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">10. 증빙자료 목록</h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <tbody>
                {evidenceRegistry.map((e) => (
                  <tr key={e.id} className="border-b border-line">
                    <td className="w-28 px-2.5 py-1">{e.id}</td>
                    <td className="px-2.5 py-1">{e.type} — {e.target}</td>
                    <td className="w-32 px-2.5 py-1 text-right text-body">{e.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 11. 승인 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">11. 승인·버전 정보</h3>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <tbody>
                {(
                  [
                    ["보고서 버전", "RPT-2026-DEMO v1"],
                    ["계산 버전", calc.version],
                    ["배출계수 버전", `${ef.version} (${ef.value} tCO₂eq/MWh)`],
                    ["작성자", "작성자(데모)"],
                    ["검토자 / 승인자", "MRV 검토자(데모) / MRV 승인자(데모)"],
                    ["보고서 상태", invStatus],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <tr key={k} className="border-b border-line">
                    <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                    <td className="px-2.5 py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 12. 기타 — 생략 서식 명시 */}
            <h3 className="mt-6 mb-2 text-[15px] font-bold">12. 작성 관련 기타 참고사항 <span className="text-[11px] font-normal text-slate-400">서식 12</span></h3>
            <p className="text-[12px] text-body">
              본 데모 요약본에서 생략된 별지 11 서식: {omittedForms}. 산정계획서(별지 10)는 시스템의 산정계획서 탭에서 관리되며 본 명세서와 자동 정합된다.
            </p>

            <div className="mt-6 text-center text-[11.5px] text-review">
              DEMO · 합성데이터 — 본 자료는 명세서 작성 지원 기능의 테스트 출력물이며 공식 제출 또는 제3자 검증 자료로 사용할 수 없습니다.
            </div>
          </div>
        </>
      )}
    </>
  );
}
