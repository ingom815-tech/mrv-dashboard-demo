import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { mrv, type MonthPoint } from "../lib/mrvData";
import { useUI } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 월 클릭 시 해당 월의 데이터 이슈·제외일 연결 (v2.1 §4.1) */
function monthIssues(month: string) {
  const excl = mrv.savings.daily.filter(
    (x: { date: string; saving: number | null }) => x.date.slice(0, 7) === month && x.saving === null,
  ).length;
  const issues = mrv.quality.issues.filter((i: { period: string }) => i.period.includes(month));
  return { excl, issues };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] shadow-card">
      <div className="mb-1.5 font-semibold text-navy">2026년 {label}</div>
      <div className="space-y-1 text-slate-500">
        <div>
          조정 기준선 <span className="ml-1 font-semibold text-baseline">{fmt(p.baseMWh)} MWh</span>
        </div>
        <div>
          실제 사용량 <span className="ml-1 font-semibold text-navy">{fmt(p.actMWh)} MWh</span>
        </div>
        <div>
          절감량 <span className="ml-1 font-semibold text-teal">{fmt(p.saveMWh)} MWh</span>
        </div>
        {p.nExcluded > 0 && <div className="pt-1 text-review">산정 제외 {p.nExcluded}일 포함</div>}
        <div className="pt-1 text-[12px] text-slate-400">클릭하면 이슈·제외 내역을 아래에 표시</div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { openEvidence, setMenu, selectedMonth, selectMonth } = useUI();
  const k = mrv.kpi;
  const sel = selectedMonth ? monthIssues(selectedMonth) : null;
  const topReview = mrv.reviewIssues[0];

  return (
    <div className="flex h-screen min-h-0 flex-col gap-4 px-7 py-5">
      {/* 상단: 제목·DEMO 배지·필터 한 줄 + 우측 버튼 1개 (v2.1 §2.6) */}
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] leading-tight font-bold text-navy">2026년 상반기 감축성과</h1>
            <span
              className="cursor-help rounded-md bg-review/15 px-2 py-0.5 text-[11px] font-semibold text-review"
              title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다. (data_origin = SYNTHETIC)"
            >
              DEMO · 합성데이터
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            기준선 대비 에너지를{" "}
            <span className="font-semibold text-teal">
              {fmt(k.saveMWh)} MWh · {fmt(k.savePct * 100, 1)}%
            </span>{" "}
            절감했습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] text-slate-500">
            <span className="font-medium text-navy">{mrv.meta.site}</span>·
            <span>{mrv.meta.boundary}</span>·<span>보고기간 {mrv.meta.periodLabel}</span>·
            <span>{mrv.meta.aggLabel}</span>
          </div>
          <button
            onClick={openEvidence}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            산정근거 보기
          </button>
        </div>
      </header>

      {/* 핵심 KPI 3개 — 클릭 시 상세 화면 이동 (v2.1 §3.2·§4.1) */}
      <section className="grid shrink-0 grid-cols-3 gap-4" aria-label="핵심 성과">
        <button
          onClick={() => setMenu("analysis")}
          className="rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-colors hover:border-accent/40"
        >
          <div className="text-[13px] font-medium text-slate-500">에너지 절감</div>
          <div className="mt-1.5 text-[32px] leading-none font-bold text-teal">
            {fmt(k.saveMWh)} <span className="text-[15px] font-semibold">MWh</span>
          </div>
          <div className="mt-2 text-[13px] text-slate-500">
            기준선 대비 <span className="font-semibold text-teal">{fmt(k.savePct * 100, 1)}%</span> ·
            산정일 {k.nDays}일
          </div>
        </button>
        <button
          onClick={() => setMenu("analysis")}
          className="rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-colors hover:border-accent/40"
        >
          <div className="text-[13px] font-medium text-slate-500">탄소 감축</div>
          <div className="mt-1.5 text-[32px] leading-none font-bold text-navy">
            {fmt(k.co2, 1)} <span className="text-[15px] font-semibold">tCO₂eq</span>
          </div>
          <div className="mt-2 text-[13px] text-slate-500">전력 절감분 환산 · 냉매 배출은 별도 관리</div>
        </button>
        <button
          onClick={() => setMenu("verify")}
          className="rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-500">성과 신뢰도</span>
            <span className="rounded-md bg-review/15 px-2 py-0.5 text-[11px] font-semibold text-review">
              {k.verifyState}
            </span>
          </div>
          <div className="mt-1.5 text-[32px] leading-none font-bold text-navy">
            {fmt(k.trustRate * 100, 1)}
            <span className="text-[15px] font-semibold">%</span>
          </div>
          <div className="mt-2 text-[13px] text-slate-500">
            검토 필요 <span className="font-semibold text-review">{k.reviewCount}건</span> · 승인 전
            단계
          </div>
        </button>
      </section>

      {/* 중심 차트 + 신뢰도 요약 (v2.1 §2.1) */}
      <section className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-4">
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex shrink-0 items-center justify-between">
            <div className="text-[14px] font-semibold text-navy">조정 기준선 대비 실제 사용량</div>
            <div className="flex items-center gap-4 text-[13px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke="#1e63c6" strokeWidth="2" strokeDasharray="5 3" />
                </svg>
                조정 기준선
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke="#122b4d" strokeWidth="2.5" />
                </svg>
                실제 사용량
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-teal/15" aria-hidden />
                절감량
              </span>
              <span className="text-slate-500">단위 MWh/월</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={mrv.monthly}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                onClick={(s) => {
                  const label = (s as { activeLabel?: string }).activeLabel;
                  const m = mrv.monthly.find((x) => x.label === label);
                  selectMonth(m ? (selectedMonth === m.month ? null : m.month) : null);
                }}
              >
                <CartesianGrid stroke="#e6eaf0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 13, fill: "#475569" }}
                  axisLine={{ stroke: "#e6eaf0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
                {/* 실제 사용량 위에 절감량을 쌓아 기준선까지의 절감 구간을 면으로 표현 */}
                <Area dataKey="actMWh" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area
                  dataKey="saveMWh"
                  stackId="band"
                  stroke="none"
                  fill="#159f9e"
                  fillOpacity={0.1}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="baseMWh"
                  name="조정 기준선"
                  stroke="#1e63c6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="actMWh"
                  name="실제 사용량"
                  stroke="#122b4d"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#122b4d", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 pt-2 text-[13px]">
            <div className="min-w-0 truncate text-slate-500">
              {sel && (
                <span>
                  <span className="font-semibold text-navy">{Number(selectedMonth!.slice(5))}월</span>{" "}
                  — 산정 제외 {sel.excl}일
                  {sel.issues.length > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      {sel.issues
                        .map((i: { id: string; title: string }) => `${i.id} ${i.title}`)
                        .join(" · ")}
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-4">
              <button onClick={() => setMenu("verify")} className="font-medium text-accent hover:underline">
                데이터 이슈 ›
              </button>
              <button onClick={() => setMenu("analysis")} className="font-medium text-accent hover:underline">
                설비 원인 ›
              </button>
            </div>
          </div>
        </div>

        {/* 신뢰도 요약 — 상태 2줄 + 검토 필요 박스 + 상세 링크 (v2.1 §2.1) */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="shrink-0 text-[14px] font-semibold text-navy">신뢰도 요약</div>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-teal" aria-hidden />
              <div>
                <div className="text-[13px] font-semibold text-navy">데이터 정상</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                  수집률 {fmt(k.collectRate * 100, 1)}% · 추정 {fmt(k.estRate * 100, 1)}%
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-teal" aria-hidden />
              <div>
                <div className="text-[13px] font-semibold text-navy">기준선 적합</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                  적합도 기준 충족 · 상세는 산정근거
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-review/10 px-4 py-3">
              <div className="text-[13px] font-semibold text-review">검토 필요 {k.reviewCount}건</div>
              {topReview && (
                <div className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  {topReview.title} 외 {k.reviewCount - 1}건
                </div>
              )}
              <div className="mt-1 text-[12px] leading-relaxed text-slate-500">
                검증 결과에 미치는 영향 확인 필요
              </div>
            </div>
            <button
              onClick={() => setMenu("verify")}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              검증 상세 보기 ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
