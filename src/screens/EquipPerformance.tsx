import {
  ComposedChart,
  Line,
  Bar,
  Cell,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";
import { mrv, perfCurve, waterfall } from "../lib/mrvData";
import { useUI } from "../store";
import ContextBar from "../components/ContextBar";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

const W = mrv.perf.weekly;
const EV = mrv.perf.events;

const monthTicks = W.filter((p) => Number(p.key.slice(8, 10)) <= 7)
  .filter((_, i) => i % 2 === 0)
  .map((p) => p.key);
const tickLabel = (k: string) => `${k.slice(2, 4)}.${k.slice(5, 7)}`;
const weekOf = (date: string) => {
  const d = date.slice(0, 10);
  let found = W[0].key;
  for (const p of W) if (p.key <= d) found = p.key;
  return found;
};
const installWeek = weekOf(EV.install);

/* Waterfall 데이터: 투명 받침 + 표시 막대 스택 */
let acc = 0;
const wfData = waterfall.map((w) => {
  if (w.kind === "total") return { label: w.label, base: 0, val: w.value, kind: w.kind };
  const base = w.value >= 0 ? acc : acc + w.value;
  acc += w.value;
  return { label: w.label, base, val: Math.abs(w.value), kind: w.kind, raw: w.value };
});
const wfColor = (kind: string) => (kind === "total" ? "#102a43" : kind === "residual" ? "#9aa5b1" : "#159f9e");

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { loadPct: number; kwRT: number; period?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tnum rounded-lg border border-line bg-white px-3 py-2 text-[12px] text-body shadow-sm">
      <div>부하율 {fmt(p.loadPct, 0)}%</div>
      <div>
        효율 <b className="text-navy">{p.kwRT.toFixed(2)} kW/RT</b>
        {p.period && <span className="ml-1 text-slate-400">({p.period === "base" ? "기준기간" : "보고기간"})</span>}
      </div>
    </div>
  );
}

function WeekTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length || payload[0].value === undefined) return null;
  return (
    <div className="tnum rounded-lg border border-line bg-white px-3 py-2 text-[12px] text-body shadow-sm">
      <div className="font-semibold text-navy">{label} 주</div>
      <div>{fmt(Number(payload[0].value))} kWh/일</div>
    </div>
  );
}

export default function EquipPerformance() {
  const { selectedEquip, setSelectedEquip, setMenu } = useUI();
  const row = mrv.perf.table.find((r) => r.key === selectedEquip) ?? mrv.perf.table[0];
  const equipBase =
    selectedEquip === "ch1" || selectedEquip === "ch2"
      ? null
      : (mrv.perf.table.find((r) => r.key === selectedEquip)?.base ?? null);

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      <header className="flex shrink-0 items-center gap-2.5">
        <h1 className="text-[21px] leading-tight font-bold text-navy">설비성과 — 효율 개선 원인 분석</h1>
        <span
          className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
          title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다."
        >
          DEMO · 합성데이터
        </span>
      </header>
      <ContextBar />

      {/* 성능 KPI 4개 */}
      <section className="grid shrink-0 grid-cols-4 gap-3" aria-label="시스템 성능 지표">
        {mrv.perf.kpis.map((k) => {
          const improved = k.betterLow ? k.deltaPct < 0 : k.deltaPct > 0;
          return (
            <div key={k.key} className="rounded-[10px] border border-line/70 bg-white p-4">
              <div className="text-[13px] font-medium text-body">{k.label}</div>
              <div className="tnum mt-1.5 text-[27px] leading-none font-bold text-navy">
                {k.rep !== null ? fmt(k.rep, k.digits) : "—"}{" "}
                <span className="text-[13px] font-semibold text-body">{k.unit}</span>
              </div>
              <div className="tnum mt-2 text-[13px] text-body">
                기준기간 {k.base !== null ? fmt(k.base, k.digits) : "—"} ·{" "}
                <span className={`font-semibold ${improved ? "text-teal" : "text-review"}`}>
                  {k.deltaPct > 0 ? "+" : ""}
                  {pct(k.deltaPct)}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 부하율–효율 성능곡선 + 절감 기여도 Waterfall */}
      <section className="grid shrink-0 grid-cols-[1.35fr_1fr] gap-3">
        <div className="rounded-[10px] border border-line/70 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold text-navy">부하율–효율 성능곡선</div>
            <div className="flex items-center gap-3 text-[12px] text-body">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-slate-400/50" /> 기준기간 일별</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-teal/70" /> 보고기간 일별</span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#102a43" strokeWidth="2" /></svg>
                기준 곡선
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#159f9e" strokeWidth="2" strokeDasharray="4 3" /></svg>
                개선 후
              </span>
            </div>
          </div>
          <div className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#eaeff5" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="loadPct"
                  domain={[0, 90]}
                  tick={{ fontSize: 12, fill: "#8a94a6" }}
                  axisLine={{ stroke: "#eaeff5" }}
                  tickLine={false}
                  label={{ value: "냉동부하율 (%)", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "#8a94a6" }}
                />
                <YAxis
                  type="number"
                  dataKey="kwRT"
                  domain={[0.4, 2.0]}
                  tick={{ fontSize: 12, fill: "#8a94a6" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  label={{ value: "kW/RT", position: "insideTopLeft", offset: 8, fontSize: 11, fill: "#8a94a6" }}
                />
                <ZAxis range={[14, 14]} />
                <Tooltip content={<CurveTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#c3cdd9" }} />
                <Scatter data={perfCurve.points.filter((p) => p.period === "base")} fill="#9aa5b1" fillOpacity={0.3} isAnimationActive={false} />
                <Scatter data={perfCurve.points.filter((p) => p.period === "rep")} fill="#159f9e" fillOpacity={0.45} isAnimationActive={false} />
                <Line data={perfCurve.baseCurve} dataKey="kwRT" stroke="#102a43" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line data={perfCurve.repCurve} dataKey="kwRT" stroke="#159f9e" strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] text-body">
            동일 부하 구간에서 개선 후 곡선이 아래에 위치 — 부하 변동이 아닌 <b className="text-navy">설비 효율 개선</b>이 절감 원인임을 보여줌
          </div>
        </div>

        <div className="rounded-[10px] border border-line/70 bg-white p-4">
          <div className="text-[15px] font-semibold text-navy">절감 기여도 분해</div>
          <div className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={wfData} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eaeff5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => fmt(v)} />
                <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="val" stackId="wf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {wfData.map((w) => (
                    <Cell key={w.label} fill={wfColor(w.kind)} />
                  ))}
                  <LabelList
                    content={(p: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
                      const w = wfData[p.index ?? 0];
                      if (!w) return null;
                      const v = w.kind === "total" ? w.val : (w as { raw?: number }).raw ?? w.val;
                      return (
                        <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 6} fontSize={11.5} fontWeight={700} fill={wfColor(w.kind)} textAnchor="middle">
                          {v >= 0 && w.kind !== "total" ? "+" : ""}
                          {fmt(v)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] text-body">
            일평균 사용량 변화 기준 분해 (MWh) · 잔차는 냉방도일·생산량 보정에 따른 차이
          </div>
        </div>
      </section>

      {/* 설비군 KPI 표 + 선택 설비 추세 */}
      <section className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-3">
        <div className="rounded-[10px] border border-line/70 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">설비군별 KPI</span>
            <span className="text-[12px] text-slate-400">행 선택 시 우측에 추세 표시</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-1.5 font-medium">설비</th>
                <th className="py-1.5 text-right font-medium">대표 KPI</th>
                <th className="py-1.5 text-right font-medium">기준기간</th>
                <th className="py-1.5 text-right font-medium">보고기간</th>
                <th className="py-1.5 text-right font-medium">변화</th>
                <th className="py-1.5 pl-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {mrv.perf.table.map((r) => (
                <tr
                  key={r.key}
                  onClick={() => setSelectedEquip(r.key)}
                  className={`cursor-pointer border-b border-line/50 transition-colors last:border-0 ${
                    selectedEquip === r.key ? "bg-accent/5" : "hover:bg-surface"
                  }`}
                >
                  <td className="py-2 font-medium text-navy">{r.name}</td>
                  <td className="py-2 text-right text-body">{r.kpiLabel}</td>
                  <td className="py-2 text-right text-body">{r.base !== null ? fmt(r.base, r.digits) : "—"}</td>
                  <td className="py-2 text-right font-semibold text-navy">{r.rep !== null ? fmt(r.rep, r.digits) : "—"}</td>
                  <td className={`py-2 text-right font-semibold ${r.deltaPct < 0 ? "text-teal" : "text-review"}`}>
                    {r.deltaPct > 0 ? "+" : ""}
                    {pct(r.deltaPct)}
                  </td>
                  <td className="py-2 pl-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.state === "ok" ? "bg-teal/10 text-teal" : "bg-review/10 text-review"}`}>
                      {r.stateLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[12px] leading-relaxed text-body">
            {row.shareText} · 냉동기 기준 대비는 부하 이동 왜곡을 피해 효율(kW/RT)로 비교 ·{" "}
            <button onClick={() => setMenu("verify")} className="font-medium text-accent hover:underline">
              데이터 이슈 ›
            </button>
          </div>
        </div>

        <div className="flex flex-col rounded-[10px] border border-line/70 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">{row.name} 주별 전력</span>
            <span className="text-[12px] text-slate-400">kWh/일 평균</span>
          </div>
          <div className="min-h-[180px] flex-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={W} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eaeff5" vertical={false} />
                <XAxis dataKey="key" ticks={monthTicks} tickFormatter={tickLabel} tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip content={<WeekTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                <ReferenceLine x={installWeek} stroke="#159f9e" strokeDasharray="5 3" />
                {equipBase !== null && (
                  <ReferenceLine y={equipBase} stroke="#8a94a6" strokeDasharray="4 3" label={{ value: "기준기간 평균", position: "insideTopRight", fontSize: 11, fill: "#8a94a6" }} />
                )}
                <Line dataKey={selectedEquip} stroke="#159f9e" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
