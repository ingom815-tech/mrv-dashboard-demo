import { useState } from "react";
import { mrv, EF, reviewItems, type NonRoutine } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, type Role } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

type TagQ = {
  tag: string;
  asset: string;
  desc: string;
  n: number;
  collectRate: number;
  validRate: number;
  missRate: number;
  outlierRate: number;
  estRate: number;
  expired: boolean | string;
  meter: { type?: string; accuracy?: string; calib?: string; expiry?: string };
};
type Issue = {
  id: string;
  type: string;
  sev: string;
  title: string;
  period: string;
  tag: string;
  impact: string;
  action: string;
  state: string;
};

const TABS = [
  { key: "quality", label: "데이터 품질" },
  { key: "approve", label: "검토·승인" },
  { key: "report", label: "보고서·이력" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_CODES = ["VALID", "MISSING", "OUTLIER", "ESTIMATED", "MANUAL", "SYNTHETIC", "INVALID"];

const sevColor: Record<string, string> = {
  high: "bg-risk",
  mid: "bg-review",
  low: "bg-accent",
  info: "bg-teal",
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

const stateBadge = (s: string) =>
  s === "승인 완료"
    ? "bg-teal/10 text-teal"
    : s === "검토 완료"
      ? "bg-accent/10 text-accent"
      : s === "검토 필요"
        ? "bg-review/10 text-review"
        : "bg-line text-body";

const initialTab = (): TabKey => {
  const seg = window.location.hash.split("/")[2];
  return (TABS.find((t) => t.key === seg)?.key ?? "quality") as TabKey;
};

export default function DataVerify() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const { role, setRole, reviewStates, markReviewed, approve, audit, resetDemoStates, openEvidence } =
    useUI();
  const calc = useCalc();
  const q = mrv.quality;
  const verify = deriveVerify(reviewStates);

  const csvExport = () => {
    const head = "# DEMO · 합성데이터 — 공식 MRV 사용 불가\n월,조정기준선(MWh),실제(MWh),절감(MWh),절감률,제외일\n";
    const rows = calc.monthly
      .map(
        (m) =>
          `${m.month},${m.baseMWh.toFixed(1)},${m.actMWh.toFixed(1)},${m.saveMWh.toFixed(1)},${(
            (m.saveMWh / m.baseMWh) * 100
          ).toFixed(1)}%,${m.nExcluded}`,
      )
      .join("\n");
    download(`월별성과_${calc.version}_DEMO합성데이터.csv`, "﻿" + head + rows, "text/csv");
  };
  const jsonExport = () => {
    const body = {
      notice: "DEMO · 합성데이터 — 공식 MRV 사용 불가",
      data_origin: "SYNTHETIC",
      calcVersion: calc.version,
      baselineModel: mrv.baseline.version,
      emissionFactor: EF,
      verifyState: verify.state,
      kpi: calc.kpi,
      monthly: calc.monthly,
      refrigerant: mrv.refrigerant,
      nonRoutine: calc.nrApplied,
    };
    download(`MRV성과_${calc.version}_DEMO합성데이터.json`, JSON.stringify(body, null, 2), "application/json");
  };

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="shrink-0 text-[20px] leading-tight font-bold text-navy">
            데이터·검증 — 산정 신뢰성 관리
          </h1>
          <span
            className="shrink-0 cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다."
          >
            DEMO · 합성데이터
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-body">
            <span>역할</span>
            {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  role === r ? "bg-navy font-semibold text-white" : "bg-white text-body hover:text-navy"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={openEvidence}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-navy transition-colors hover:border-accent/50"
          >
            산정근거
          </button>
        </div>
      </header>

      {/* 탭 */}
      <div className="flex shrink-0 gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-[13px] transition-colors ${
              tab === t.key
                ? "border-accent font-semibold text-accent"
                : "border-transparent text-body hover:text-navy"
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

      {/* ---------- 탭 1: 데이터 품질 ---------- */}
      {tab === "quality" && (
        <>
          <section className="grid shrink-0 grid-cols-4 gap-3">
            {[
              { label: "수집률", v: q.totals.collectRate, good: true },
              { label: "정상률", v: q.totals.validRate, good: true },
              { label: "결측률", v: q.totals.missRate, good: false },
              { label: "추정률", v: q.totals.estRate, good: false },
            ].map((t) => (
              <div key={t.label} className="rounded-[10px] border border-line bg-white p-4">
                <div className="text-[13px] font-medium text-body">{t.label}</div>
                <div className="tnum mt-1.5 text-[24px] leading-none font-bold text-navy">
                  {pct(t.v, 2)}
                </div>
                <div className="mt-1.5 text-[11px] text-body">
                  보고기간 전체 태그 15분 레코드 기준
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">태그별 데이터 품질</span>
              <div className="flex items-center gap-2 text-[11px] text-body">
                상태코드 {STATUS_CODES.join(" · ")}
              </div>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">태그</th>
                  <th className="py-1.5 font-medium">설비</th>
                  <th className="py-1.5 font-medium">계측기</th>
                  <th className="py-1.5 font-medium">정확도</th>
                  <th className="py-1.5 text-right font-medium">수집률</th>
                  <th className="py-1.5 text-right font-medium">정상률</th>
                  <th className="py-1.5 text-right font-medium">결측</th>
                  <th className="py-1.5 text-right font-medium">이상</th>
                  <th className="py-1.5 text-right font-medium">추정</th>
                  <th className="py-1.5 pl-3 font-medium">교정 만료</th>
                </tr>
              </thead>
              <tbody>
                {(q.byTag as TagQ[]).map((t) => (
                  <tr key={t.tag} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 font-medium text-navy">{t.tag}</td>
                    <td className="py-1.5 text-body">{t.asset}</td>
                    <td className="py-1.5 text-body">{t.meter.type ?? "—"}</td>
                    <td className="py-1.5 text-body">{t.meter.accuracy ?? "—"}</td>
                    <td className="py-1.5 text-right text-body">{pct(t.collectRate, 1)}</td>
                    <td className="py-1.5 text-right text-body">{pct(t.validRate, 1)}</td>
                    <td className={`py-1.5 text-right ${t.missRate > 0 ? "font-semibold text-risk" : "text-body"}`}>
                      {pct(t.missRate, 2)}
                    </td>
                    <td className={`py-1.5 text-right ${t.outlierRate > 0 ? "font-semibold text-review" : "text-body"}`}>
                      {pct(t.outlierRate, 2)}
                    </td>
                    <td className={`py-1.5 text-right ${t.estRate > 0 ? "font-semibold text-review" : "text-body"}`}>
                      {pct(t.estRate, 2)}
                    </td>
                    <td className="py-1.5 pl-3">
                      {t.expired ? (
                        <span className="rounded bg-review/10 px-1.5 py-0.5 text-[10px] font-bold text-review">
                          만료 {t.meter.expiry}
                        </span>
                      ) : (
                        <span className="text-body">{t.meter.expiry ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-body">
              원천값(rows.v)은 수정하지 않으며, 정제·추정 결과는 산정 시점에 별도 적용 (R-01 결측
              10% 초과 일 제외 · R-02 물리범위 이상치 제외)
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">
              데이터 이슈와 산정 영향 <span className="tnum text-body">({(q.issues as Issue[]).length}건)</span>
            </div>
            <div className="flex flex-col gap-2">
              {(q.issues as Issue[]).map((i) => (
                <div key={i.id} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${sevColor[i.sev] ?? "bg-body"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-navy">
                        {i.id} · {i.title}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(i.state)}`}>
                        {i.state}
                      </span>
                    </div>
                    <div className="tnum mt-0.5 text-[12px] text-body">
                      {i.period} · 대상 {i.tag}
                    </div>
                    <div className="mt-0.5 text-[12px] text-body">
                      <span className="font-medium text-navy">산정 영향</span> {i.impact} ·{" "}
                      <span className="font-medium text-navy">조치</span> {i.action}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ---------- 탭 2: 검토·승인 ---------- */}
      {tab === "approve" && (
        <>
          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">
                검토 워크플로우 <span className="text-[12px] font-normal text-body">검토 필요 → 검토 완료(검토자) → 승인 완료(승인자) · 역할 분리</span>
              </span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${stateBadge(verify.state)}`}>
                전체 상태 {verify.state}
              </span>
            </div>
            {role === "일반" && (
              <div className="mb-2 rounded bg-surface px-3 py-2 text-[12px] text-body">
                일반 역할은 조회만 가능합니다. 우측 상단에서 검토자 또는 승인자 역할을 선택하면 처리
                버튼이 활성화됩니다. 승인 완료된 항목은 어떤 역할도 수정할 수 없습니다.
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {reviewItems.map((r) => {
                const st = reviewStates[r.id];
                return (
                  <div key={r.id} className="rounded-lg border border-line px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-navy">
                          {r.id} · {r.title}
                        </span>
                        <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium text-body">
                          {r.kind}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(st)}`}>
                          {st}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {st === "검토 필요" && (
                          <button
                            onClick={() => markReviewed(r.id)}
                            disabled={role !== "검토자"}
                            className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            검토 완료 처리
                          </button>
                        )}
                        {st === "검토 완료" && (
                          <button
                            onClick={() => approve(r.id)}
                            disabled={role !== "승인자"}
                            className="rounded-lg bg-teal px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            승인
                          </button>
                        )}
                        {st === "승인 완료" && (
                          <span className="text-[12px] font-medium text-teal">확정 — 수정 불가</span>
                        )}
                      </div>
                    </div>
                    <div className="tnum mt-1 text-[12px] text-body">{r.period}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-body">{r.detail}</div>
                    <div className="mt-1 text-[12px]">
                      <span className="font-medium text-navy">산정 영향</span>{" "}
                      <span className={r.affectsCalc ? "font-medium text-accent" : "text-body"}>
                        {r.impact}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {calc.version !== "CALC-2026H1-v1" && (
              <div className="tnum mt-3 rounded-lg bg-teal/8 px-4 py-2.5 text-[12px] text-navy">
                비일상적 조정 승인 반영 → 새 계산버전 <b>{calc.version}</b> 생성 · 절감량{" "}
                <b className="text-teal">{fmt(calc.kpi.saveMWh)} MWh ({pct(calc.kpi.savePct)})</b> ·
                탄소 감축 <b className="text-teal">{fmt(calc.kpi.co2, 1)} tCO₂eq</b> (기존 v1 확정본은
                보존됨 — 데모)
              </div>
            )}
          </section>

          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">비일상적 조정 목록</span>
              <button onClick={resetDemoStates} className="text-[12px] font-medium text-accent hover:underline">
                데모 상태 초기화
              </button>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">ID</th>
                  <th className="py-1.5 font-medium">내용</th>
                  <th className="py-1.5 font-medium">기간</th>
                  <th className="py-1.5 text-right font-medium">조정량</th>
                  <th className="py-1.5 pl-3 font-medium">상태</th>
                  <th className="py-1.5 font-medium">승인자</th>
                </tr>
              </thead>
              <tbody>
                {(calc.nrApplied as NonRoutine[]).map((n) => {
                  const st = reviewStates[n.id] ?? n.status;
                  return (
                    <tr key={n.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2 font-medium text-navy">{n.id}</td>
                      <td className="py-2 text-body">{n.title}</td>
                      <td className="py-2 text-body">
                        {n.start} ~ {n.end}
                      </td>
                      <td className="py-2 text-right text-body">
                        {n.kwhAdj !== 0 ? `${fmt(n.kwhAdj)} kWh` : "제외기간"}
                      </td>
                      <td className="py-2 pl-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(st)}`}>
                          {st}
                        </span>
                      </td>
                      <td className="py-2 text-body">
                        {st === "승인 완료" ? n.approver || "승인자(데모)" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* ---------- 탭 3: 보고서·이력 ---------- */}
      {tab === "report" && (
        <>
          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">월별 확정성과</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy hover:border-accent/50">
                  인쇄
                </button>
                <button onClick={csvExport} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy hover:border-accent/50">
                  CSV
                </button>
                <button onClick={jsonExport} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy hover:border-accent/50">
                  JSON
                </button>
              </div>
            </div>
            <div className="tnum mb-2 text-[12px] text-body">
              계산버전 <b className="text-navy">{calc.version}</b> · 기준선 모델{" "}
              <b className="text-navy">{mrv.baseline.version}</b> · 배출계수 {EF.version}{" "}
              {EF.value} {EF.unit} ({EF.baseYear}) · 검증 상태{" "}
              <b className={verify.state === "승인 완료" ? "text-teal" : "text-review"}>{verify.state}</b>{" "}
              · 모든 다운로드에 DEMO·합성데이터 표기 포함
            </div>
            <table className="tnum w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">월</th>
                  <th className="py-1.5 text-right font-medium">조정 기준선 (MWh)</th>
                  <th className="py-1.5 text-right font-medium">실제 (MWh)</th>
                  <th className="py-1.5 text-right font-medium">절감 (MWh)</th>
                  <th className="py-1.5 text-right font-medium">절감률</th>
                  <th className="py-1.5 text-right font-medium">제외일</th>
                </tr>
              </thead>
              <tbody>
                {calc.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-1.5 font-medium text-navy">{m.month}</td>
                    <td className="py-1.5 text-right text-body">{fmt(m.baseMWh, 1)}</td>
                    <td className="py-1.5 text-right text-body">{fmt(m.actMWh, 1)}</td>
                    <td className="py-1.5 text-right font-semibold text-teal">{fmt(m.saveMWh, 1)}</td>
                    <td className="py-1.5 text-right text-body">{pct(m.saveMWh / m.baseMWh)}</td>
                    <td className="py-1.5 text-right text-body">{m.nExcluded}</td>
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
          </section>

          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">
              냉매 비산배출 — 전력 감축량과 합산하지 않는 별도 항목
            </div>
            <table className="tnum w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">일자</th>
                  <th className="py-1.5 font-medium">설비</th>
                  <th className="py-1.5 font-medium">냉매</th>
                  <th className="py-1.5 text-right font-medium">GWP</th>
                  <th className="py-1.5 pl-5 font-medium">구분</th>
                  <th className="py-1.5 text-right font-medium">양 (kg)</th>
                  <th className="py-1.5 text-right font-medium">배출 (tCO₂eq)</th>
                </tr>
              </thead>
              <tbody>
                {(mrv.refrigerant.items as Array<{
                  date: string; asset: string; type: string; gwp: number; kind: string; kg: number; tco2: number; counted: boolean;
                }>).map((r) => (
                  <tr key={r.date + r.asset} className="border-b border-line/60">
                    <td className="py-1.5 text-body">{r.date}</td>
                    <td className="py-1.5 text-body">{r.asset}</td>
                    <td className="py-1.5 text-body">{r.type}</td>
                    <td className="py-1.5 text-right text-body">{fmt(r.gwp)}</td>
                    <td className="py-1.5 pl-5 text-body">{r.kind}{!r.counted && " (배출 아님)"}</td>
                    <td className="py-1.5 text-right text-body">{fmt(r.kg)}</td>
                    <td className="py-1.5 text-right font-medium text-navy">
                      {r.counted ? fmt(r.tco2, 2) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={6} className="py-2 text-navy">
                    보고기간 냉매 배출 합계 (전력 감축과 별도)
                  </td>
                  <td className="py-2 text-right text-navy">{fmt(mrv.refrigerant.total, 2)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">
              변경이력·감사로그 <span className="tnum text-[12px] font-normal text-body">({audit.length}건 · localStorage 보존)</span>
            </div>
            {audit.length === 0 ? (
              <div className="text-[12px] text-body">기록 없음 — 검토·승인 탭에서 처리 시 기록됩니다.</div>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
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
