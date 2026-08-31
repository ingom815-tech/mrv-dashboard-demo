import { useMemo, useState } from "react";
import {
  mrv,
  reviewItems,
  issueQueue,
  qualityHeatmap,
  evidenceRegistry,
  type EvidenceItem,
  type NonRoutine,
  type HeatStatus,
} from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";

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
const TABS = [
  { key: "quality", label: "데이터 품질" },
  { key: "tags", label: "태그 상세" },
  { key: "approve", label: "검토·승인" },
  { key: "evidence", label: "증적" },
  { key: "report", label: "보고서·이력" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_CODES = ["VALID", "MISSING", "OUTLIER", "ESTIMATED", "MANUAL", "SYNTHETIC", "INVALID"];

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
  s === "승인 완료" || s === "조치 완료"
    ? "bg-teal/10 text-teal"
    : s === "검토 완료" || s === "신규" || s === "조사 중"
      ? "bg-accent/10 text-accent"
      : s === "검토 필요" || s === "처리 대기" || s === "승인 대기"
        ? "bg-review/10 text-review"
        : "bg-line text-body";

const initialTab = (): TabKey => {
  const seg = window.location.hash.split("/")[2];
  return (TABS.find((t) => t.key === seg)?.key ?? "quality") as TabKey;
};

const HEAT_COLOR: Record<HeatStatus, string> = {
  ok: "bg-teal/25",
  est: "bg-review/70",
  bad: "bg-risk/80",
  excl: "bg-slate-300",
};
const SEV_BADGE: Record<string, string> = {
  High: "bg-risk/10 text-risk",
  Medium: "bg-review/10 text-review",
  Low: "bg-accent/10 text-accent",
};

/* 히트맵 셀 상세 — 상태별 검증 규칙·산정 영향·처리 근거 */
const HEAT_DETAIL: Record<
  HeatStatus,
  { label: string; rule: string; raw: string; impact: string; action: string; actor: string }
> = {
  ok: {
    label: "정상",
    rule: "물리범위·변화율·상호일관성 자동검증 통과",
    raw: "원본값 유지",
    impact: "산정에 그대로 사용",
    action: "—",
    actor: "자동 규칙",
  },
  est: {
    label: "추정·이상",
    rule: "R-02 물리범위/고착 검출 또는 승인된 비례 추정",
    raw: "원본값 보존 · 정제값 별도",
    impact: "해당 구간 제외 후 유효값 기준 추정(ESTIMATED)",
    action: "라벨 유지, 승인 시 추정률 확인",
    actor: "자동 규칙 · 계측팀(데모)",
  },
  bad: {
    label: "결측",
    rule: "R-01 결측 평가 (일 10% 초과 시 산정 제외)",
    raw: "원본값 NULL",
    impact: "결측률에 따라 일 제외 또는 비례 추정",
    action: "게이트웨이·센서 점검, 복구 불가 확인",
    actor: "계측팀(데모)",
  },
  excl: {
    label: "산정 제외",
    rule: "승인된 비일상적 조정 (NR-02 정비 제외기간)",
    raw: "원본값 유지 (산정 미사용)",
    impact: "해당 일 절감량 산정 제외",
    action: "제외기간 승인 완료",
    actor: "MRV 승인자(데모)",
  },
};

function HeatDetail({
  cell,
  onClose,
}: {
  cell: { tag: string; date: string; status: HeatStatus };
  onClose: () => void;
}) {
  const d = HEAT_DETAIL[cell.status];
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="py-1">
      <div className="text-[11px] text-slate-400">{k}</div>
      <div className="text-[12.5px] leading-snug text-navy">{v}</div>
    </div>
  );
  return (
    <div className="rounded-lg border border-line/70 bg-surface/50 p-3.5">
      <div className="flex items-center justify-between">
        <span className="tnum text-[13px] font-semibold text-navy">
          {cell.date} · {cell.tag}
        </span>
        <button onClick={onClose} className="text-[15px] leading-none text-slate-400 hover:text-navy" aria-label="닫기">
          ×
        </button>
      </div>
      <span
        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
          cell.status === "ok" ? "bg-teal/10 text-teal" : cell.status === "excl" ? "bg-line text-body" : "bg-review/10 text-review"
        }`}
      >
        {d.label}
      </span>
      <div className="mt-1 divide-y divide-line/50">
        <Row k="검증 규칙" v={d.rule} />
        <Row k="원본값" v={d.raw} />
        <Row k="산정 영향" v={d.impact} />
        <Row k="처리" v={d.action} />
        <Row k="처리자" v={d.actor} />
      </div>
    </div>
  );
}

/* 샘플 증적 문서 뷰어 — 공문서 양식의 인앱 미리보기 */
function EvidenceDoc({ item, onClose }: { item: EvidenceItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div className="relative max-h-[86vh] w-[620px] overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <span className="tnum text-[12px] text-body">
            {item.id} · {item.version} · SHA-256 {item.hash}…
          </span>
          <button onClick={onClose} aria-label="닫기" className="rounded px-2 py-0.5 text-[17px] leading-none text-slate-400 hover:bg-surface hover:text-navy">
            ×
          </button>
        </div>
        <div className="relative px-10 py-8">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-24deg] text-[44px] font-black tracking-widest text-review/10 select-none">
              DEMO · 합성데이터
            </span>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold tracking-wide text-navy">{item.doc.title}</div>
            <div className="mt-1 text-[12px] text-body">{item.doc.org}</div>
          </div>
          <table className="tnum mt-6 w-full border-t-2 border-navy text-[13px]">
            <tbody>
              {item.doc.fields.map(([k, v]) => (
                <tr key={k} className="border-b border-line">
                  <td className="w-36 bg-surface/70 px-3 py-2 font-medium text-body">{k}</td>
                  <td className="px-3 py-2 text-navy">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-[13px] leading-relaxed text-navy">{item.doc.body}</p>
          <div className="mt-8 flex items-end justify-between">
            <div className="tnum text-[12px] text-body">
              발행일 {item.issued}
              {item.validTo !== "—" && <> · 유효기간 {item.validTo}</>}
              <br />
              연결 계산버전 {item.calcVersion}
            </div>
            <div className="text-right text-[13px] text-navy">
              {item.doc.org}
              <span className="ml-2 inline-block rounded-full border-2 border-risk/40 px-2 py-1 text-[11px] font-bold text-risk/60">
                (인)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DataVerify() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [heatMonth, setHeatMonth] = useState("2026-02");
  const [selCell, setSelCell] = useState<{ tag: string; date: string; status: HeatStatus } | null>(null);
  const [selEvidence, setSelEvidence] = useState<EvidenceItem | null>(null);
  const { role, reviewStates, markReviewed, approve, audit, resetDemoStates } = useUI();
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const q = mrv.quality;
  const verify = deriveVerify(reviewStates);
  const heat = useMemo(() => qualityHeatmap(heatMonth), [heatMonth]);
  const affectsCount = issueQueue.filter((i) => i.affects).length;

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
      emissionFactor: ef,
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
        <TopActions />
      </header>
      <ContextBar />

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

      {/* ---------- 탭 1: 데이터 품질 (검증 큐 중심) ---------- */}
      {tab === "quality" && (
        <>
          <section className="grid shrink-0 grid-cols-4 gap-3">
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">검증 대상 레코드</div>
              <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
                {fmt(q.totals.n)} <span className="text-[13px] font-semibold text-body">건</span>
              </div>
              <div className="mt-1.5 text-[12px] text-body">보고기간 15분 레코드 × 태그 15점</div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">자동검증 통과</div>
              <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-teal">
                {pct(q.totals.validRate, 2)}
              </div>
              <div className="tnum mt-1.5 text-[12px] text-body">
                결측 {pct(q.totals.missRate, 2)} · 추정 {pct(q.totals.estRate, 2)}
              </div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">처리 대기 이슈</div>
              <div className={`tnum mt-1.5 text-[28px] leading-none font-bold ${verify.pending > 0 ? "text-review" : "text-teal"}`}>
                {verify.pending} <span className="text-[13px] font-semibold text-body">건</span>
              </div>
              <div className="mt-1.5 text-[12px] text-body">검토·승인 탭에서 처리</div>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[13px] font-medium text-body">산정 영향 이슈</div>
              <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
                {affectsCount} <span className="text-[13px] font-semibold text-body">건</span>
              </div>
              <div className="mt-1.5 text-[12px] text-body">제외·추정 규칙이 적용된 이슈</div>
            </div>
          </section>

          {/* 태그 × 일 품질 히트맵 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">데이터 품질 히트맵 (태그 × 일)</span>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setHeatMonth(m)}
                      className={`tnum rounded px-2 py-0.5 text-[12px] transition-colors ${
                        heatMonth === m ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
                      }`}
                    >
                      {Number(m.slice(5))}월
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-body">
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-teal/25" /> 정상</span>
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-review/70" /> 추정·이상</span>
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-risk/80" /> 결측</span>
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-slate-300" /> 산정 제외</span>
                </div>
              </div>
            </div>
            <div className={`grid gap-4 ${selCell ? "grid-cols-[1fr_280px]" : "grid-cols-1"}`}>
              <div className="flex flex-col gap-[3px]">
                {heat.map((row) => (
                  <div key={row.tag} className="flex items-center gap-2">
                    <span className="tnum w-20 shrink-0 text-right text-[11.5px] text-body">{row.tag}</span>
                    <div className="flex flex-1 gap-[3px]">
                      {row.cells.map((c) => (
                        <button
                          key={c.date}
                          onClick={() =>
                            setSelCell(
                              selCell?.tag === row.tag && selCell?.date === c.date
                                ? null
                                : { tag: row.tag, date: c.date, status: c.status },
                            )
                          }
                          title={`${c.date} · ${row.tag}`}
                          className={`h-[14px] flex-1 rounded-[2px] transition-transform hover:scale-y-125 ${HEAT_COLOR[c.status]} ${
                            selCell?.tag === row.tag && selCell?.date === c.date ? "ring-2 ring-navy" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="w-20 shrink-0" />
                  <div className="tnum flex flex-1 justify-between text-[10px] text-slate-400">
                    <span>{heatMonth}-01</span>
                    <span>{heatMonth}-{String(heat[0]?.cells.length ?? 30).padStart(2, "0")}</span>
                  </div>
                </div>
              </div>
              {selCell && <HeatDetail cell={selCell} onClose={() => setSelCell(null)} />}
            </div>
          </section>

          {/* Issue Queue — 심각도순 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
                Issue Queue <span className="tnum text-[12px] font-normal text-body">({issueQueue.length}건 · 심각도순)</span>
              </span>
              <button onClick={() => setTab("tags")} className="text-[12px] font-medium text-accent hover:underline">
                정상 태그 전체 보기 ›
              </button>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-body">
                  <th className="py-2 font-medium">심각도</th>
                  <th className="py-2 font-medium">발생</th>
                  <th className="py-2 font-medium">대상</th>
                  <th className="py-2 font-medium">검증 규칙·이슈</th>
                  <th className="py-2 font-medium">산정 영향</th>
                  <th className="py-2 font-medium">담당자</th>
                  <th className="py-2 pl-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {issueQueue.map((i) => (
                  <tr key={i.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2">
                      <span className={`inline-block w-16 rounded px-1.5 py-0.5 text-center text-[11px] font-bold ${SEV_BADGE[i.sev]}`}>
                        {i.sev}
                      </span>
                    </td>
                    <td className="py-2 text-body">{i.when}</td>
                    <td className="py-2 font-medium text-navy">{i.tag}</td>
                    <td className="py-2 text-body">
                      <span className="font-medium text-navy">{i.id}</span> · {i.rule}
                    </td>
                    <td className="py-2">
                      <span className={i.affects ? "font-semibold text-review" : "text-body"}>
                        {i.affects ? "영향 있음" : "잠재 영향"}
                      </span>
                    </td>
                    <td className="py-2 text-body">{i.owner}</td>
                    <td className="py-2 pl-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadge(i.state)}`}>{i.state}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[12px] text-body">
              산정 영향 상세는 각 이슈의 정제 규칙(R-01 결측 10% 초과 일 제외 · R-02 물리범위 이상치 제외)을 따름
            </div>
          </section>
        </>
      )}

      {/* ---------- 탭 2: 태그 상세 ---------- */}
      {tab === "tags" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">태그별 데이터 품질</span>
              <div className="flex items-center gap-2 text-[11px] text-body">
                상태코드 {STATUS_CODES.join(" · ")}
              </div>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-2 font-medium">태그</th>
                  <th className="py-2 font-medium">설비</th>
                  <th className="py-2 font-medium">계측기</th>
                  <th className="py-2 font-medium">정확도</th>
                  <th className="py-2 text-right font-medium">수집률</th>
                  <th className="py-2 text-right font-medium">정상률</th>
                  <th className="py-2 text-right font-medium">결측</th>
                  <th className="py-2 text-right font-medium">이상</th>
                  <th className="py-2 text-right font-medium">추정</th>
                  <th className="py-2 pl-3 font-medium">교정 만료</th>
                </tr>
              </thead>
              <tbody>
                {(q.byTag as TagQ[]).map((t) => (
                  <tr key={t.tag} className="border-b border-line/60 last:border-0">
                    <td className="py-2 font-medium text-navy">{t.tag}</td>
                    <td className="py-2 text-body">{t.asset}</td>
                    <td className="py-2 text-body">{t.meter.type ?? "—"}</td>
                    <td className="py-2 text-body">{t.meter.accuracy ?? "—"}</td>
                    <td className="py-2 text-right text-body">{pct(t.collectRate, 1)}</td>
                    <td className="py-2 text-right text-body">{pct(t.validRate, 1)}</td>
                    <td className={`py-1.5 text-right ${t.missRate > 0 ? "font-semibold text-risk" : "text-body"}`}>
                      {pct(t.missRate, 2)}
                    </td>
                    <td className={`py-1.5 text-right ${t.outlierRate > 0 ? "font-semibold text-review" : "text-body"}`}>
                      {pct(t.outlierRate, 2)}
                    </td>
                    <td className={`py-1.5 text-right ${t.estRate > 0 ? "font-semibold text-review" : "text-body"}`}>
                      {pct(t.estRate, 2)}
                    </td>
                    <td className="py-2 pl-3">
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
        </>
      )}

      {/* ---------- 탭 2: 검토·승인 ---------- */}
      {tab === "approve" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">
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

      {/* ---------- 탭: 증적 레지스트리 ---------- */}
      {tab === "evidence" && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">
              증적 레지스트리{" "}
              <span className="tnum text-[12px] font-normal text-body">({evidenceRegistry.length}건 · 행 클릭 시 문서 미리보기)</span>
            </span>
            <span className="text-[12px] text-slate-400">모든 문서는 데모용 샘플 · 파일 해시로 위변조 확인(개념)</span>
          </div>
          <table className="tnum w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-2 font-medium">증적번호</th>
                <th className="py-2 font-medium">문서유형</th>
                <th className="py-2 font-medium">연결 대상</th>
                <th className="py-2 font-medium">발행일</th>
                <th className="py-2 font-medium">유효기간</th>
                <th className="py-2 font-medium">연결 계산버전</th>
                <th className="py-2 font-medium">파일 해시</th>
                <th className="py-2 pl-3 font-medium">검토 상태</th>
              </tr>
            </thead>
            <tbody>
              {evidenceRegistry.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelEvidence(e)}
                  className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-surface"
                >
                  <td className="py-2.5 font-medium text-accent">{e.id}</td>
                  <td className="py-2.5 text-navy">{e.type}</td>
                  <td className="py-2.5 text-body">{e.target}</td>
                  <td className="py-2.5 text-body">{e.issued}</td>
                  <td className="py-2.5 text-body">{e.validTo}</td>
                  <td className="py-2.5 text-body">{e.calcVersion}</td>
                  <td className="py-2.5 text-slate-400">{e.hash}…</td>
                  <td className="py-2.5 pl-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        e.state.includes("만료") ? "bg-review/10 text-review" : "bg-teal/10 text-teal"
                      }`}
                    >
                      {e.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[12px] text-body">
            증적은 계산버전과 연결되어 보존되며, 산정근거·Assurance 각 단계의 증적 건수가 이 레지스트리를 참조합니다.
          </div>
        </section>
      )}

      {/* ---------- 탭 3: 보고서·이력 ---------- */}
      {tab === "report" && (
        <>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">월별 확정성과</span>
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
              <b className="text-navy">{mrv.baseline.version}</b> · 배출계수 {ef.version}{" "}
              {ef.value} {ef.unit} ({ef.baseYear}) · 검증 상태{" "}
              <b className={verify.state === "승인 완료" ? "text-teal" : "text-review"}>{verify.state}</b>{" "}
              · 모든 다운로드에 DEMO·합성데이터 표기 포함
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
          </section>

          {/* 계산버전 비교 — 버전관리·감사추적 증명 */}
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">계산버전 비교</span>
              <span className="tnum text-[12px] text-body">
                CALC-2026H1-v1 (확정본 보존) vs 현재 {calc.version}
              </span>
            </div>
            {calc.version === "CALC-2026H1-v1" ? (
              <div className="text-[12.5px] text-body">
                현재 버전이 v1입니다 — 비일상적 조정 승인 또는 배출계수 등록 시 새 버전이 생성되고 여기서
                v1과의 차이를 비교합니다.
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
                            ({v2 - v1 > 0 ? "+" : ""}
                            {fmt(v2 - v1, d)})
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
              냉매 비산배출 — 전력 감축량과 합산하지 않는 별도 항목
            </div>
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
                {(mrv.refrigerant.items as Array<{
                  date: string; asset: string; type: string; gwp: number; kind: string; kg: number; tco2: number; counted: boolean;
                }>).map((r) => (
                  <tr key={r.date + r.asset} className="border-b border-line/60">
                    <td className="py-2 text-body">{r.date}</td>
                    <td className="py-2 text-body">{r.asset}</td>
                    <td className="py-2 text-body">{r.type}</td>
                    <td className="py-2 text-right text-body">{fmt(r.gwp)}</td>
                    <td className="py-2 pl-5 text-body">{r.kind}{!r.counted && " (배출 아님)"}</td>
                    <td className="py-2 text-right text-body">{fmt(r.kg)}</td>
                    <td className="py-2 text-right font-medium text-navy">
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

          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-2 text-[15px] font-semibold text-navy">
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
      {selEvidence && <EvidenceDoc item={selEvidence} onClose={() => setSelEvidence(null)} />}
    </div>
  );
}
