import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { mrv, type WeekPoint } from "../lib/mrvData";
import { useUI } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

const W = mrv.perf.weekly;
const EV = mrv.perf.events;

/* 매월 온전히 시작하는 첫 주만 X축 눈금으로 사용 (18개월 → 격월) */
const monthTicks = W.filter((p) => Number(p.key.slice(8, 10)) <= 7)
  .filter((_, i) => i % 2 === 0)
  .map((p) => p.key);
const tickLabel = (k: string) => `${k.slice(2, 4)}.${k.slice(5, 7)}`;

/* 특정 날짜가 속한 주의 키 (카테고리 축에서 ReferenceLine·Area 위치용) */
const weekOf = (date: string) => {
  const d = date.slice(0, 10);
  let found = W[0].key;
  for (const p of W) if (p.key <= d) found = p.key;
  return found;
};
const foulingR: [string, string] = [weekOf(EV.fouling[0]), weekOf(EV.fouling[1])];
const maintR: [string, string] = [weekOf(EV.maintenance[0]), weekOf(EV.maintenance[1])];
const installWeek = weekOf(EV.install);

function SysTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeekPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tnum rounded-lg border border-line bg-white px-3.5 py-2.5 text-[12px] text-body shadow-sm">
      <div className="mb-1 font-semibold text-navy">{label} 주</div>
      <div>시스템 효율 <b className="text-navy">{p.sysKwRT?.toFixed(2) ?? "—"} kW/RT</b></div>
      <div>플랜트 COP <b className="text-navy">{p.cop?.toFixed(2) ?? "—"}</b></div>
      <div>냉수 ΔT <b className="text-navy">{p.dT?.toFixed(1) ?? "—"} ℃</b></div>
      {p.usableN === 0 && <div className="pt-0.5 text-review">전체 제외 주 (정비·결측)</div>}
    </div>
  );
}

function EquipTooltip({
  active,
  payload,
  label,
  unitLabel,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
  unitLabel: string;
}) {
  if (!active || !payload?.length || payload[0].value === undefined) return null;
  return (
    <div className="tnum rounded-lg border border-line bg-white px-3 py-2 text-[12px] text-body shadow-sm">
      <div className="font-semibold text-navy">{label} 주</div>
      <div>
        {fmt(Number(payload[0].value))} {unitLabel}
      </div>
    </div>
  );
}

export default function EquipPerformance() {
  const { selectedEquip, setSelectedEquip, setMenu, openEvidence } = useUI();
  const row = mrv.perf.table.find((r) => r.key === selectedEquip) ?? mrv.perf.table[0];
  const equipBase =
    selectedEquip === "ch1" || selectedEquip === "ch2"
      ? null // 냉동기는 신설 교체로 기준기간 kWh 비교가 무의미 (부하 이동)
      : (mrv.perf.table.find((r) => r.key === selectedEquip)?.base ?? null);

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      {/* 헤더 */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="shrink-0 text-[20px] leading-tight font-bold text-navy">
            설비성과 — 효율 개선 원인
          </h1>
          <span
            className="shrink-0 cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다."
          >
            DEMO · 합성데이터
          </span>
        </div>
        <div className="tnum flex items-center gap-3 text-[12px] text-body">
          <span>
            {mrv.meta.site} · {mrv.meta.boundary} · 보고기간 {mrv.meta.periodLabel} (기준기간 2025년)
          </span>
          <button
            onClick={openEvidence}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-navy transition-colors hover:border-accent/50"
          >
            산정근거
          </button>
        </div>
      </header>

      {/* 성능 KPI 4개 — 보고기간 평균 vs 기준기간 평균 */}
      <section className="grid shrink-0 grid-cols-4 gap-3" aria-label="시스템 성능 지표">
        {mrv.perf.kpis.map((k) => {
          const improved = k.betterLow ? k.deltaPct < 0 : k.deltaPct > 0;
          return (
            <div key={k.key} className="rounded-[10px] border border-line bg-white p-4">
              <div className="text-[13px] font-medium text-body">{k.label}</div>
              <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">
                {k.rep !== null ? fmt(k.rep, k.digits) : "—"}{" "}
                <span className="text-[13px] font-semibold text-body">{k.unit}</span>
              </div>
              <div className="tnum mt-2 text-[12px] text-body">
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

      {/* 주별 시스템 효율 추세 — 효율저하·정비·개선 가동 구간 표시 */}
      <section className="shrink-0 rounded-[10px] border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold text-navy">주별 시스템 효율 추세</div>
          <div className="text-[12px] text-body">kW/RT · 낮을수록 효율 우수 · 빈 구간 = 산정 제외</div>
        </div>
        <div className="h-[250px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={W} margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#dde4ec" vertical={false} />
              <XAxis
                dataKey="key"
                ticks={monthTicks}
                tickFormatter={tickLabel}
                tick={{ fontSize: 11, fill: "#667085" }}
                axisLine={{ stroke: "#dde4ec" }}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#667085" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip content={<SysTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
              <ReferenceArea
                x1={foulingR[0]}
                x2={foulingR[1]}
                fill="#d97706"
                fillOpacity={0.07}
                label={{ value: "냉동기 2 효율저하", position: "insideTop", fontSize: 11, fill: "#d97706" }}
              />
              <ReferenceArea
                x1={maintR[0]}
                x2={maintR[1]}
                fill="#667085"
                fillOpacity={0.1}
                label={{ value: "정비 제외", position: "insideTop", fontSize: 11, fill: "#667085" }}
              />
              <ReferenceLine
                x={installWeek}
                stroke="#159f9e"
                strokeDasharray="5 3"
                label={{ value: "개선 설비 가동", position: "insideTopLeft", fontSize: 11, fill: "#159f9e" }}
              />
              <Line
                dataKey="sysKwRT"
                stroke="#102a43"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 설비군 KPI 표 + 선택 설비 추세 */}
      <section className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-3">
        <div className="rounded-[10px] border border-line bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[14px] font-semibold text-navy">설비군별 KPI</span>
            <span className="text-[12px] text-body">행 선택 시 우측에 추세 표시</span>
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
                  className={`cursor-pointer border-b border-line/60 transition-colors last:border-0 ${
                    selectedEquip === r.key ? "bg-accent/5" : "hover:bg-surface"
                  }`}
                >
                  <td className="py-2 font-medium text-navy">{r.name}</td>
                  <td className="py-2 text-right text-body">{r.kpiLabel}</td>
                  <td className="py-2 text-right text-body">
                    {r.base !== null ? fmt(r.base, r.digits) : "—"}
                  </td>
                  <td className="py-2 text-right font-semibold text-navy">
                    {r.rep !== null ? fmt(r.rep, r.digits) : "—"}
                  </td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      r.deltaPct < 0 ? "text-teal" : "text-review"
                    }`}
                  >
                    {r.deltaPct > 0 ? "+" : ""}
                    {pct(r.deltaPct)}
                  </td>
                  <td className="py-2 pl-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        r.state === "ok" ? "bg-teal/10 text-teal" : "bg-review/10 text-review"
                      }`}
                    >
                      {r.stateLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[11px] leading-relaxed text-body">
            {row.shareText} · 냉동기 기준 대비는 부하 이동 왜곡을 피해 효율(kW/RT)로 비교 ·{" "}
            <button onClick={() => setMenu("verify")} className="font-medium text-accent hover:underline">
              데이터 이슈 ›
            </button>
          </div>
        </div>

        <div className="flex flex-col rounded-[10px] border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-navy">{row.name} 주별 전력</span>
            <span className="text-[12px] text-body">kWh/일 평균</span>
          </div>
          <div className="min-h-0 flex-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={W} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#dde4ec" vertical={false} />
                <XAxis
                  dataKey="key"
                  ticks={monthTicks}
                  tickFormatter={tickLabel}
                  tick={{ fontSize: 11, fill: "#667085" }}
                  axisLine={{ stroke: "#dde4ec" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#667085" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip
                  content={<EquipTooltip unitLabel="kWh/일" />}
                  cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }}
                />
                <ReferenceLine x={installWeek} stroke="#159f9e" strokeDasharray="5 3" />
                {equipBase !== null && (
                  <ReferenceLine
                    y={equipBase}
                    stroke="#667085"
                    strokeDasharray="4 3"
                    label={{ value: "기준기간 평균", position: "insideTopRight", fontSize: 11, fill: "#667085" }}
                  />
                )}
                <Line
                  dataKey={selectedEquip}
                  stroke="#159f9e"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
