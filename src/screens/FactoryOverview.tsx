import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  factory,
  factoryMonthly,
  factoryTodos,
  equipGroups,
  ZONES,
  SCOPE_METRICS,
  GROUP_EVENTS,
  WATER_USE,
  LINE_PROD,
  groupSummary,
  type FactoryMonth,
  type EquipGroupInfo,
} from "../lib/factoryData";
import { reviewItems, type MonthPoint } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

/* ---------- 공장 전체 툴팁 ---------- */
function FactoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FactoryMonth }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const delta = (p.actMWh - p.baseMWh) / p.baseMWh;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>기준기간</span><span className="font-semibold text-slate-500">{fmt(p.baseMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>보고기간</span><span className="font-semibold text-navy">{fmt(p.actMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>목표 (기준 −5%)</span><span className="text-accent">{fmt(p.targetMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>기준 대비</span><span className={`font-semibold ${delta < 0 ? "text-teal" : "text-review"}`}>{delta > 0 ? "+" : ""}{pct(delta)}</span></div>
        {p.event && <div className="border-t border-line/60 pt-1 text-review">{p.event}</div>}
      </div>
    </div>
  );
}

/* ---------- 냉수플랜트 MRV 툴팁 ---------- */
function MrvTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>조정 기준선</span><span className="font-semibold text-baseline">{fmt(p.baseMWh, 1)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>실제 사용량</span><span className="font-semibold text-navy">{fmt(p.actMWh, 1)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>검증 절감량</span><span className="font-semibold text-teal">{fmt(p.saveMWh, 1)} MWh ({pct(p.saveMWh / p.baseMWh)})</span></div>
        <div className="flex justify-between gap-6"><span>제외 / 추정</span><span>{p.nExcluded}일 / {p.estDays}일</span></div>
        {p.events.length > 0 ? (
          <div className="border-t border-line/60 pt-1 text-review">{p.events.join(" · ")}</div>
        ) : (
          <div className="border-t border-line/60 pt-1 text-teal">데이터 정상</div>
        )}
      </div>
    </div>
  );
}

/* ---------- 설비군 공통 시계열 ---------- */
interface SeriesPoint {
  label: string;
  base: number;
  act: number;
  target: number;
  extra?: number; // 태양광 자가소비 등
  event?: string;
}
function GroupTooltip({ active, payload, unit, baseLabel }: { active?: boolean; payload?: Array<{ payload: SeriesPoint }>; unit: string; baseLabel: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const delta = p.base > 0 ? (p.act - p.base) / p.base : 0;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>{baseLabel}</span><span className="font-semibold text-slate-500">{fmt(p.base, 1)} {unit}</span></div>
        <div className="flex justify-between gap-6"><span>보고기간</span><span className="font-semibold text-navy">{fmt(p.act, 1)} {unit}</span></div>
        <div className="flex justify-between gap-6"><span>목표</span><span className="text-accent">{fmt(p.target, 1)} {unit}</span></div>
        <div className="flex justify-between gap-6"><span>기준 대비</span><span className={`font-semibold ${delta < 0 ? "text-teal" : "text-review"}`}>{delta > 0 ? "+" : ""}{pct(delta)}</span></div>
        {p.extra !== undefined && <div className="flex justify-between gap-6"><span>자가소비</span><span className="text-teal">{fmt(p.extra, 1)} {unit}</span></div>}
        {p.event && <div className="border-t border-line/60 pt-1 text-review">{p.event}</div>}
      </div>
    </div>
  );
}

const eventDot = (color = "#102a43") =>
  function EventDot(p: { cx?: number; cy?: number; payload?: { event?: string }; index?: number }) {
    return (
      <g key={`e${p.index}`}>
        <circle cx={p.cx} cy={p.cy} r={3} fill={color} />
        {p.payload?.event && (
          <>
            <circle cx={p.cx} cy={p.cy} r={6.5} fill="none" stroke="#d97706" strokeWidth={1.5} />
            <text x={p.cx} y={(p.cy ?? 0) - 11} fontSize={10} fontWeight={700} fill="#d97706" textAnchor="middle">!</text>
          </>
        )}
      </g>
    );
  };

/* 선택 범위의 시계열 구성 (지표별) */
function buildSeries(g: EquipGroupInfo, metric: string): { data: SeriesPoint[]; unit: string; title: string; baseLabel: string; kind: "bar" | "line" } | null {
  const ev = GROUP_EVENTS[g.key] ?? [];
  const wrap = (act: number[], base: number[], unit: string, title: string, extra?: number[]): { data: SeriesPoint[]; unit: string; title: string; baseLabel: string; kind: "bar" | "line" } => ({
    data: act.map((v, i) => ({
      label: `${i + 1}월`,
      act: Math.round(v * 10) / 10,
      base: Math.round(base[i] * 10) / 10,
      target: Math.round(base[i] * 0.97 * 10) / 10,
      extra: extra ? Math.round(extra[i] * 10) / 10 : undefined,
      event: ev[i],
    })),
    unit,
    title,
    baseLabel: "전년 동월",
    kind: "bar",
  });
  const defaultKey = SCOPE_METRICS[g.key]?.[0]?.key;
  if (metric === defaultKey || metric === "electricity" || metric === "fuelEnergy" || metric === "energy") {
    if (g.key === "water") return wrap(WATER_USE.act, WATER_USE.base, "천t", "용수·폐수 월별 용수 사용량");
    if (g.key === "line" && metric === "energyIntensity") {
      const act = g.monthly.map((v, i) => v / LINE_PROD.act[i]);
      const base = g.baseMonthly.map((v, i) => v / LINE_PROD.base[i]);
      return wrap(act, base, "MWh/t", "생산라인 월별 에너지 원단위");
    }
    if (g.key === "pv") {
      return { ...wrap(g.monthly, g.monthly.map((v) => v * 0.95), "MWh", "태양광·ESS 월별 발전량", g.monthly.map((v) => v * 0.912)), baseLabel: "목표 대비" };
    }
    if (g.key === "fuel") return { ...wrap(g.monthly, g.baseMonthly, "tCO₂eq", "연료·직접배출 월별 Scope 1 배출량"), baseLabel: "기준기간" };
    if (g.key === "refrig") return { ...wrap(g.monthly, g.baseMonthly, "tCO₂eq", "냉매 월별 비산배출량"), baseLabel: "전년 평균" };
    const title = `${g.name} 월별 ${g.key === "boiler" ? "에너지 사용량 (연료 환산)" : "전력사용량"}`;
    return wrap(g.monthly, g.baseMonthly, "MWh", title);
  }
  if (g.key === "line" && metric === "energy") return wrap(g.monthly, g.baseMonthly, "MWh", "생산라인 월별 에너지 사용량");
  if (g.key === "water" && metric === "treatPower") return wrap(g.monthly, g.baseMonthly, "MWh", "용수·폐수 월별 처리 전력");
  return null; // 시계열 없는 지표 → 요약 뷰
}

export default function FactoryOverview() {
  const { setMenu, setEquipGroup, reviewStates, analysisScope, analysisMetric, setAnalysisScope, setAnalysisMetric } = useUI();
  const calc = useCalc();
  const verify = deriveVerify(reviewStates);
  const scope = analysisScope;
  const group = equipGroups.find((g) => g.key === scope) ?? null;
  const metrics = SCOPE_METRICS[scope] ?? SCOPE_METRICS.factory;
  const metricLabel = metrics.find((m) => m.key === analysisMetric)?.label ?? metrics[0].label;

  /* 처리할 일 — 범위 필터링 */
  const chillerTodos = [
    ...reviewItems
      .filter((r) => reviewStates[r.id] === "검토 필요")
      .map((r) => ({ title: r.title, meta: `냉동·냉장 MRV · ${r.id}`, target: "report" as const, group: "chiller" })),
    ...(verify.state !== "승인 완료"
      ? [{ title: "MRV 보고서 승인 대기", meta: "보고·승인 · 초안 준비됨", target: "report" as const, group: "chiller" }]
      : []),
  ];
  const allTodos = [...chillerTodos, ...factoryTodos];
  const todos = scope === "factory" ? allTodos : allTodos.filter((t) => t.group === scope);

  const series = group ? buildSeries(group, analysisMetric) : null;
  const chartTitle =
    scope === "factory"
      ? "원주공장 월별 에너지 사용량"
      : scope === "chiller"
        ? "중앙 냉수플랜트 조정 기준선 대비 실제 사용량"
        : (series?.title ?? `${group?.name} — ${metricLabel}`);

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[24px] leading-tight font-bold text-navy">원주공장 종합현황</h1>
          <span
            className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터입니다. 냉동·냉장 설비군만 MRV 엔진 실산정값이며 나머지 설비군은 합성 요약값입니다."
          >
            DEMO · 합성데이터
          </span>
          <span className="hidden truncate text-[13px] text-slate-400 lg:inline">— 공장 전체 에너지·배출·MRV 성과</span>
        </div>
        <TopActions />
      </header>
      <ContextBar />

      {/* 공장 KPI 5 — 분석 범위와 무관하게 공장 전체 값 유지 */}
      <section className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="공장 핵심 지표">
        <div
          className="rounded-[10px] border border-line/60 bg-white p-4"
          title="총 에너지 사용량은 구매전력 및 연료환산 사용량 기준이며, 태양광 발전량(840 MWh)은 별도 성과로 관리합니다."
        >
          <div className="text-[13px] font-medium text-body">총 에너지 사용량 ⓘ</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">
            {fmt(factory.totalEnergyMWh)} <span className="text-[13px] font-semibold">MWh</span>
          </div>
          <div className="mt-2 text-[12px] text-body">전력 + 연료 환산 · 보고기간 6개월</div>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">온실가스 배출량</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">
            {fmt(factory.totalEmission)} <span className="text-[13px] font-semibold">tCO₂eq</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">Scope 1 {fmt(factory.scope1)} · Scope 2 {fmt(factory.scope2)}</div>
        </div>
        <button
          onClick={() => setAnalysisScope("chiller")}
          className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">검증 절감량 (MRV)</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-teal">
            {fmt(factory.verifiedSaveMWh)} <span className="text-[13px] font-semibold">MWh</span>
          </div>
          <div className="mt-2 text-[12px] text-body">냉동·냉장 실증 · {verify.state}</div>
        </button>
        <button
          onClick={() => setMenu("report")}
          className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">검증 감축량 (MRV)</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-teal">
            {fmt(factory.verifiedCo2, 1)} <span className="text-[13px] font-semibold">tCO₂eq</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">확인 필요 {verify.pending}건 · 보고·승인 ›</div>
        </button>
        <button
          onClick={() => setMenu("master")}
          className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">데이터 연계율</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">{pct(factory.linkRate)}</div>
          <div className="tnum mt-2 text-[12px] text-body">계측 {factory.metersConnected}/{factory.metersTotal}점 · 설비·연계 관리 ›</div>
        </button>
      </section>

      {/* 선택형 메인 차트 + 처리할 일 */}
      <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col rounded-[10px] border border-line/60 bg-white p-4">
          {/* 분석 범위·지표 선택 */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex items-center gap-1.5 text-[12.5px] text-slate-400">
              분석 범위
              <select
                value={scope}
                onChange={(e) => setAnalysisScope(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] font-semibold text-navy"
              >
                <optgroup label="공장">
                  <option value="factory">원주공장 전체</option>
                </optgroup>
                {ZONES.map((z) => (
                  <optgroup key={z.key} label={z.name}>
                    {equipGroups.filter((g) => g.zone === z.key).map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.name}{g.detail === "full" ? " (MRV)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-slate-400">
              분석 지표
              <select
                value={analysisMetric}
                onChange={(e) => setAnalysisMetric(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] font-medium text-navy"
              >
                {metrics.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-[12px] text-slate-400">
              {scope === "chiller" ? "MWh/월 · 엔진 실산정" : scope === "factory" ? "MWh/월" : `${series?.unit ?? ""}/월 · 합성 요약`}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[15px] font-semibold text-navy">{chartTitle}</span>
            {/* 범례 */}
            {scope === "factory" && (
              <div className="flex items-center gap-3 text-[12px] text-body">
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#8a94a6" strokeWidth="2" strokeDasharray="5 3" /></svg>기준기간</span>
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#102a43" strokeWidth="2.5" /></svg>보고기간</span>
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#2f6bff" strokeWidth="1.5" strokeDasharray="2 3" /></svg>목표</span>
              </div>
            )}
            {scope === "chiller" && (
              <div className="flex items-center gap-3 text-[12px] text-body">
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#1e63c6" strokeWidth="2" strokeDasharray="5 3" /></svg>조정 기준선</span>
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#102a43" strokeWidth="2.5" /></svg>실제 사용량</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-teal/20" />검증 절감</span>
              </div>
            )}
            {group && scope !== "chiller" && series && (
              <div className="flex items-center gap-3 text-[12px] text-body">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-teal/60" />보고기간</span>
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#8a94a6" strokeWidth="2" strokeDasharray="5 3" /></svg>{series.baseLabel}</span>
                <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#2f6bff" strokeWidth="1.5" strokeDasharray="2 3" /></svg>목표</span>
              </div>
            )}
          </div>

          {/* 선택 범위 보조 KPI (텍스트형, 낮은 강조) */}
          {group && (
            <div className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-body">
              {scope === "chiller" ? (
                <>
                  <span>잠정 절감 <b className="text-teal">{fmt(calc.kpi.saveMWh)} MWh</b></span>
                  <span>잠정 감축 <b className="text-teal">{fmt(calc.kpi.co2, 1)} tCO₂eq</b></span>
                  <span>데이터 완성도 <b className="text-navy">99.6%</b></span>
                  <span>검토 필요 <b className={verify.pending > 0 ? "text-review" : "text-teal"}>{verify.pending}건</b></span>
                </>
              ) : (
                group.kpis.map((k) => (
                  <span key={k.label}>{k.label} <b className="text-navy">{k.value}</b></span>
                ))
              )}
            </div>
          )}

          {/* ---------- 차트 영역 ---------- */}
          <div className="mt-1 h-[275px]">
            {scope === "factory" && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={factoryMonthly} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eaeff5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={50} domain={[2400, 3200]} ticks={[2400, 2600, 2800, 3000, 3200]} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip content={<FactoryTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                  <Line dataKey="baseMWh" stroke="#8a94a6" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                  <Line dataKey="targetMWh" stroke="#2f6bff" strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="actMWh" stroke="#102a43" strokeWidth={2.5} isAnimationActive={false} dot={eventDot()} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {scope === "chiller" && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={calc.monthly} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eaeff5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip content={<MrvTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                  <Area dataKey="actMWh" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area dataKey="saveMWh" stackId="b" stroke="none" fill="#159f9e" fillOpacity={0.12} isAnimationActive={false} />
                  <Area dataKey="bandLowMWh" stackId="ci" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area dataKey="bandWidthMWh" stackId="ci" stroke="none" fill="#1e63c6" fillOpacity={0.14} isAnimationActive={false} />
                  <Line dataKey="baseMWh" stroke="#1e63c6" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                  <Line
                    dataKey="actMWh"
                    stroke="#102a43"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    dot={(p: { cx?: number; cy?: number; payload?: MonthPoint; index?: number }) => (
                      <g key={`m${p.index}`}>
                        <circle cx={p.cx} cy={p.cy} r={3} fill="#102a43" />
                        {(p.payload?.nExcluded ?? 0) > 0 && (
                          <>
                            <circle cx={p.cx} cy={p.cy} r={6.5} fill="none" stroke="#d97706" strokeWidth={1.5} />
                            <text x={p.cx} y={(p.cy ?? 0) - 11} fontSize={10} fontWeight={700} fill="#d97706" textAnchor="middle">!</text>
                          </>
                        )}
                      </g>
                    )}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {group && scope !== "chiller" && series && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series.data} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eaeff5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip content={<GroupTooltip unit={series.unit} baseLabel={series.baseLabel} />} cursor={{ fill: "#159f9e", fillOpacity: 0.05 }} />
                  <Bar dataKey="act" fill="#159f9e" fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={26} isAnimationActive={false} />
                  <Line dataKey="base" stroke="#8a94a6" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="target" stroke="#2f6bff" strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
                  {series.data.some((d) => d.extra !== undefined) && (
                    <Line dataKey="extra" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
                  )}
                  {/* 이벤트 마커 */}
                  {series.data.map((d) => d.event && <ReferenceLine key={d.label} x={d.label} stroke="#d97706" strokeDasharray="3 3" label={{ value: "!", position: "top", fontSize: 11, fill: "#d97706" }} />)}
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {group && scope !== "chiller" && !series && (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-surface/60">
                <div className="tnum flex flex-wrap justify-center gap-x-6 gap-y-2 px-6 text-[14px] text-body">
                  {group.kpis.map((k) => (
                    <span key={k.label}>{k.label} <b className="text-[16px] text-navy">{k.value}</b></span>
                  ))}
                </div>
                <div className="px-6 text-center text-[12.5px] text-slate-400">
                  '{metricLabel}' 월별 시계열은 데이터 연계 확장 후 제공됩니다 — 현재는 요약값(합성)만 제공
                </div>
              </div>
            )}
          </div>

          {/* 차트 하단 안내 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1 text-[12px] text-body">
            {scope === "factory" ? (
              <>
                <span>검증된 MRV 프로젝트 1건 · 중앙 냉수플랜트 <b className="text-teal">420 MWh 잠정 절감</b> · ! = 주요 운영 이벤트</span>
                <button onClick={() => setAnalysisScope("chiller")} className="font-medium text-accent hover:underline">
                  중앙 냉수플랜트 상세 MRV ›
                </button>
              </>
            ) : scope === "chiller" ? (
              <>
                <span><span className="text-baseline">▨</span> 기준선 신뢰구간(90%) · ! = 산정 제외 월 · 엔진 실산정 ({calc.version})</span>
                <button onClick={() => { setEquipGroup("chiller"); setMenu("equipment"); }} className="font-medium text-accent hover:underline">
                  성능곡선·기여도 분석 ›
                </button>
              </>
            ) : (
              <>
                <span>{group?.note} · 합성 요약데이터{group?.detail !== "full" && " — 검증 절감량 미적용(MRV 확장 대상)"}</span>
                <button onClick={() => { setEquipGroup(scope); setMenu("equipment"); }} className="font-medium text-accent hover:underline">
                  {group?.name} 상세 ›
                </button>
              </>
            )}
          </div>
        </div>

        {/* 처리할 일 — 범위 필터링 */}
        <div className="flex flex-col rounded-[10px] border border-line/60 bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">
              처리할 일{scope !== "factory" && group && <span className="ml-1 text-[12px] font-normal text-slate-400">· {group.name}</span>}
            </span>
            <span className={`tnum rounded px-1.5 py-0.5 text-[11px] font-bold ${todos.length > 0 ? "bg-review/10 text-review" : "bg-teal/10 text-teal"}`}>
              {todos.length}건
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {todos.length > 0 ? (
              todos.map((t) => (
                <button key={t.title} onClick={() => setMenu(t.target)} className="rounded-lg bg-surface/70 px-3 py-2 text-left transition-colors hover:bg-surface">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-review" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-navy">{t.title}</div>
                      <div className="mt-0.5 truncate text-[12px] text-body">{t.meta} · 처리하기 ›</div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg bg-teal/8 px-3 py-3 text-[13px] leading-relaxed text-teal">
                현재 확인이 필요한 항목이 없습니다.
                <br />
                데이터 수집 및 운영 상태가 정상입니다.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 설비군 상태 한 줄 요약 */}
      <div className="tnum flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[13px] text-body">
        <span>
          설비군 <b className="text-navy">{groupSummary.total}개</b> · 연결 완료 <b className="text-teal">{groupSummary.full}</b> · 일부 연결{" "}
          <b className="text-review">{groupSummary.partial}</b> · 수기 입력 <b className="text-review">{groupSummary.manual}</b> · 검토 필요{" "}
          <b className="text-review">{groupSummary.review}건</b>
        </span>
        <button
          onClick={() => { setEquipGroup("all"); setMenu("equipment"); }}
          className="font-medium text-accent hover:underline"
        >
          설비군 전체 보기 →
        </button>
      </div>
    </div>
  );
}
