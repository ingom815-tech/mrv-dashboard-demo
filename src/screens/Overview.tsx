import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";
import { mrv, reviewItems, type MonthPoint, type EquipGroup } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6">
          <span>조정 기준선</span>
          <span className="font-semibold text-baseline">{fmt(p.baseMWh, 1)} MWh</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>실제 사용량</span>
          <span className="font-semibold text-navy">{fmt(p.actMWh, 1)} MWh</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>검증 절감량</span>
          <span className="font-semibold text-teal">{fmt(p.saveMWh, 1)} MWh</span>
        </div>
        {p.nrAdjMWh !== 0 && (
          <div className="flex justify-between gap-6">
            <span>비일상 조정</span>
            <span className="font-semibold text-accent">
              {p.nrAdjMWh > 0 ? "+" : ""}
              {fmt(p.nrAdjMWh, 1)} MWh
            </span>
          </div>
        )}
        <div className="flex justify-between gap-6">
          <span>기준선 신뢰구간</span>
          <span>±{fmt(p.bandMWh, 1)} MWh</span>
        </div>
        {p.events.length > 0 ? (
          <div className="border-t border-line/60 pt-1 text-review">{p.events.join(" · ")}</div>
        ) : (
          <div className="border-t border-line/60 pt-1 text-teal">데이터 정상</div>
        )}
      </div>
    </div>
  );
}

/* 절감량 라벨 — 최대 절감 월 1곳만 상시 표기, 나머지는 툴팁 (정보 위계) */
const saveLabel = (props: { x?: number | string; y?: number | string; index?: number }, data: MonthPoint[]) => {
  const i = props.index ?? 0;
  const p = data[i];
  if (!p) return null;
  const maxI = data.reduce((m, x, j) => (x.saveMWh > data[m].saveMWh ? j : m), 0);
  if (i !== maxI) return null;
  return (
    <text x={Number(props.x)} y={Number(props.y) + 17} fontSize={12.5} fontWeight={700} fill="#159f9e" textAnchor="middle">
      ▼{Math.round(p.saveMWh)} MWh
    </text>
  );
};

function eventDot(props: { cx?: number; cy?: number; payload?: MonthPoint; index?: number }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return <g key={`d${props.index}`} />;
  return (
    <g key={`d${props.index}`}>
      <circle cx={cx} cy={cy} r={3} fill="#102a43" />
      {payload.nExcluded > 0 && (
        <>
          <circle cx={cx} cy={cy} r={6.5} fill="none" stroke="#d97706" strokeWidth={1.5} />
          <text x={cx} y={cy - 11} fontSize={10} fontWeight={700} fill="#d97706" textAnchor="middle">
            !
          </text>
        </>
      )}
    </g>
  );
}

const GROUP_FILTERS: Array<{ key: EquipGroup | "all"; label: string }> = [
  { key: "all", label: "전체" },
  { key: "heat", label: "열원" },
  { key: "pump", label: "펌프" },
  { key: "air", label: "공기측" },
];

export default function Overview({ embedded = false }: { embedded?: boolean }) {
  const { setMenu, selectedMonth, selectMonth, equipFilter, setEquipFilter, reviewStates } = useUI();
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(reviewStates);
  const ck = calc.kpi;
  const k = mrv.kpi;
  const [cumView, setCumView] = useState(false);
  const selPoint = selectedMonth ? calc.monthly.find((p) => p.month === selectedMonth) : null;
  const approved = verify.state === "승인 완료";
  const approvedAt = useUI((s) => s.audit).find((a) => a.action === "승인 완료")?.ts;
  const approvedDate = approvedAt ? approvedAt.slice(0, 10) : "";
  // 처리할 일 — 검토 대기 항목 + 보고서 진행 (실무자가 지금 해야 할 것만)
  const todos = [
    ...reviewItems
      .filter((r) => reviewStates[r.id] === "검토 필요")
      .map((r) => ({
        title: r.title,
        meta: `${r.kind} · ${r.id}`,
        go: () => setMenu("report"),
      })),
    ...(!approved
      ? [{ title: "보고서 초안 검토 후 승인 진행", meta: "보고·승인 · 설명문 초안 준비됨", go: () => setMenu("report") }]
      : []),
  ];

  return (
    <div className={embedded ? "flex flex-col gap-3" : "flex min-h-screen flex-col gap-3 px-6 py-4 xl:h-screen xl:min-h-0"}>
      {!embedded && (
        <>
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="text-[21px] leading-tight font-bold text-navy">2026년 상반기 감축성과</h1>
              <span
                className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
                title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다. (data_origin = SYNTHETIC)"
              >
                DEMO · 합성데이터
              </span>
              <span className="hidden truncate text-[13px] text-slate-400 lg:inline">
                — 얼마나 아꼈고, 그 숫자를 믿을 수 있는가
              </span>
            </div>
            <TopActions />
          </header>
          <ContextBar />
        </>
      )}

      {/* 핵심 KPI 4개 */}
      <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4" aria-label="핵심 성과">
        <button onClick={() => setMenu("equipment")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
          <div className="text-[13.5px] font-medium text-body">
            {approved ? "검증 완료 절감량" : "잠정 산정 절감량"}
          </div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-teal">
            {fmt(ck.saveMWh)} <span className="text-[15px] font-semibold">MWh</span>
          </div>
          <div className="tnum mt-2 text-[13px] text-body">
            기준선 대비 <span className="font-semibold text-teal">{pct(ck.savePct)}</span> ·{" "}
            {approved ? `승인일 ${approvedDate}` : `검증 대기 ${verify.pending}건`}
          </div>
        </button>
        <button onClick={() => setMenu("verify")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium text-body">
              {approved ? "승인 탄소감축량" : "잠정 탄소감축량"}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${approved ? "bg-teal/10 text-teal" : "bg-review/10 text-review"}`}
            >
              {approved ? "승인" : verify.pending > 0 ? "검토 중" : "잠정"}
            </span>
          </div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
            {fmt(ck.co2, 1)} <span className="text-[15px] font-semibold">tCO₂eq</span>
          </div>
          <div className="tnum mt-2 text-[13px] text-body">
            배출계수 {ef.version} · {ef.value} <span className="text-slate-400">(소비단·데모)</span>
          </div>
        </button>
        <button onClick={() => setMenu("verify")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
          <div className="text-[13px] font-medium text-body">데이터 완성도</div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
            {fmt(k.trustRate * 100, 1)}<span className="text-[15px] font-semibold">%</span>
          </div>
          <div className="tnum mt-2 text-[13px] text-body">
            수집률 {pct(k.collectRate)} · 결측 {pct(k.missRate, 2)} · 데이터 검증 ›
          </div>
        </button>
        <button onClick={() => setMenu("report")} className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50">
          <div className="text-[13px] font-medium text-body">보고 진행상태</div>
          <div className={`tnum mt-1.5 text-[28px] leading-none font-bold ${approved ? "text-teal" : "text-review"}`}>
            {verify.state}
          </div>
          <div className="tnum mt-2 text-[13px] text-body">
            확인 필요{" "}
            <span className={`font-semibold ${verify.pending > 0 ? "text-review" : "text-teal"}`}>{verify.pending}건</span>{" "}
            · 보고·승인 ›
          </div>
        </button>
      </section>

      {/* 메인 차트 + MRV Assurance 사이드 패널 */}
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="relative flex min-h-0 flex-col rounded-[10px] border border-line/60 bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <div className="text-[15px] font-semibold text-navy">
              {cumView ? "누적 검증 절감량" : "조정 기준선 대비 실제 사용량"}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-slate-400">단위 MWh/월</span>
              <div className="flex overflow-hidden rounded-md border border-line text-[12px]">
                <button onClick={() => setCumView(false)} className={`px-2.5 py-1 ${!cumView ? "bg-navy font-semibold text-white" : "text-body"}`}>
                  월별
                </button>
                <button onClick={() => setCumView(true)} className={`px-2.5 py-1 ${cumView ? "bg-navy font-semibold text-white" : "text-body"}`}>
                  누적
                </button>
              </div>
            </div>
          </div>
          {!cumView && (
            <div className="pointer-events-none absolute top-14 left-16 z-10">
              <div className="tnum text-[23px] leading-none font-bold text-teal">{fmt(ck.saveMWh)} MWh 절감</div>
              <div className="tnum mt-1 text-[13px] text-body">
                기준선 대비 {pct(ck.savePct)} · 불확도 ±{fmt(ck.uncertaintyPct * 100, 1)}%
              </div>
            </div>
          )}
          <div className={embedded ? "h-[380px] flex-none pt-2" : "min-h-0 flex-1 pt-2 max-xl:h-[380px] max-xl:flex-none"}>
            <ResponsiveContainer width="100%" height="100%">
              {cumView ? (
                <ComposedChart data={calc.monthly} margin={{ top: 22, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eaeff5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                  <Area dataKey="cumSaveMWh" stroke="#159f9e" strokeWidth={2.5} fill="#159f9e" fillOpacity={0.12} isAnimationActive={false}>
                    <LabelList
                      content={(p: { x?: number | string; y?: number | string; index?: number }) => (
                        <text x={Number(p.x)} y={Number(p.y) - 8} fontSize={11.5} fontWeight={700} fill="#159f9e" textAnchor="middle">
                          {Math.round(calc.monthly[p.index ?? 0]?.cumSaveMWh ?? 0)}
                        </text>
                      )}
                    />
                  </Area>
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={calc.monthly}
                  margin={{ top: 26, right: 86, bottom: 0, left: 0 }}
                  onClick={(s) => {
                    const label = (s as { activeLabel?: string }).activeLabel;
                    const m = calc.monthly.find((x) => x.label === label);
                    selectMonth(m ? (selectedMonth === m.month ? null : m.month) : null);
                  }}
                >
                  <CartesianGrid stroke="#eaeff5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                  {/* 절감 구간 음영 (실제 → 기준선) */}
                  <Area dataKey="actMWh" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area dataKey="saveMWh" stackId="band" stroke="none" fill="#159f9e" fillOpacity={0.09} isAnimationActive={false} />
                  {/* 조정 기준선 90% 신뢰구간 밴드 */}
                  <Area dataKey="bandLowMWh" stackId="ci" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area dataKey="bandWidthMWh" stackId="ci" stroke="none" fill="#1e63c6" fillOpacity={0.16} isAnimationActive={false} />
                  <ReferenceLine x="1월" stroke="#159f9e" strokeDasharray="5 3" label={{ value: "개선 설비 가동", position: "insideBottomLeft", fontSize: 11, fill: "#159f9e" }} />
                  <Line dataKey="baseMWh" stroke="#1e63c6" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false}>
                    <LabelList
                      content={(p: { x?: number | string; y?: number | string; index?: number }) =>
                        p.index === calc.monthly.length - 1 ? (
                          <text x={Number(p.x) + 9} y={Number(p.y) - 2} fontSize={12} fontWeight={600} fill="#1e63c6">
                            조정 기준선
                          </text>
                        ) : (
                          saveLabel(p, calc.monthly)
                        )
                      }
                    />
                  </Line>
                  <Line dataKey="actMWh" stroke="#102a43" strokeWidth={2.5} dot={eventDot} isAnimationActive={false}>
                    <LabelList
                      content={(p: { x?: number | string; y?: number | string; index?: number }) =>
                        p.index === calc.monthly.length - 1 ? (
                          <text x={Number(p.x) + 9} y={Number(p.y) + 12} fontSize={12} fontWeight={600} fill="#102a43">
                            실제 사용량
                          </text>
                        ) : null
                      }
                    />
                  </Line>
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 text-[12px]">
            <div className="min-w-0 truncate text-body">
              {selPoint ? (
                <span className="tnum">
                  <span className="font-semibold text-navy">{selPoint.label}</span> — 절감{" "}
                  <b className="text-teal">{fmt(selPoint.saveMWh, 1)} MWh</b> · 기준선 ±{fmt(selPoint.bandMWh, 1)} ·{" "}
                  {selPoint.events.length ? selPoint.events.join(" · ") : "데이터 정상"}
                </span>
              ) : (
                <span>
                  <span className="text-baseline">▨</span> 기준선 신뢰구간(90%) ·{" "}
                  <span className="font-semibold text-review">!</span> 산정 제외 월 · 월 클릭 시 상세
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-4">
              <button onClick={() => setMenu("verify")} className="font-medium text-accent hover:underline">
                데이터 이슈 ›
              </button>
              <button onClick={() => setMenu("equipment")} className="font-medium text-accent hover:underline">
                설비 원인 ›
              </button>
            </div>
          </div>
        </div>

        {/* 처리할 일 사이드 패널 — 지금 해야 할 것만 */}
        <div className="flex min-h-0 flex-col rounded-[10px] border border-line/60 bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">처리할 일</span>
            <span
              className={`tnum rounded px-1.5 py-0.5 text-[11px] font-bold ${todos.length > 0 ? "bg-review/10 text-review" : "bg-teal/10 text-teal"}`}
            >
              {todos.length}건
            </span>
          </div>

          {/* 월 클릭 시 해당 월 요약이 이 패널에 표시 */}
          {selPoint && (
            <div className="mt-2 rounded-lg bg-accent/6 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-navy">2026년 {selPoint.label}</span>
                <button onClick={() => selectMonth(null)} className="text-[13px] leading-none text-slate-400 hover:text-navy" aria-label="닫기">
                  ×
                </button>
              </div>
              <div className="tnum mt-0.5 text-[12.5px] text-body">
                절감 <b className="text-teal">{fmt(selPoint.saveMWh, 1)} MWh</b> · 기준선 ±{fmt(selPoint.bandMWh, 1)}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-body">
                {selPoint.events.length ? selPoint.events.join(" · ") : "데이터 정상"}
              </div>
              <button onClick={() => setMenu("verify")} className="mt-1 text-[12px] font-medium text-accent hover:underline">
                해당 월 데이터 검증 ›
              </button>
            </div>
          )}

          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
            {todos.length > 0 ? (
              todos.map((t) => (
                <button
                  key={t.title}
                  onClick={t.go}
                  className="rounded-lg bg-surface/70 px-3 py-2 text-left transition-colors hover:bg-surface"
                >
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
                모든 항목 처리 완료 — 보고서가 승인되었습니다.
                <button onClick={() => setMenu("report")} className="mt-1 block font-semibold hover:underline">
                  승인된 보고서 보기 ›
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 flex shrink-0 justify-between border-t border-line/50 pt-2 text-[12px]">
            <button onClick={() => setMenu("verify")} className="font-medium text-accent hover:underline">
              데이터 검증 ›
            </button>
            <button onClick={() => setMenu("report")} className="font-medium text-accent hover:underline">
              보고·승인 ›
            </button>
          </div>
        </div>
      </section>

      {/* 설비군 대표 KPI */}
      <section className="shrink-0" aria-label="설비별 성과">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-navy">설비별 성과</span>
            <div className="flex gap-1">
              {GROUP_FILTERS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setEquipFilter(g.key)}
                  className={`rounded px-2 py-0.5 text-[12px] transition-colors ${
                    equipFilter === g.key ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setMenu("equipment")} className="text-[12px] font-medium text-accent hover:underline">
            설비성과 상세 ›
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {mrv.equip
            .filter((e) => equipFilter === "all" || e.group === equipFilter)
            .map((e) => (
              <button key={e.key} onClick={() => setMenu("equipment")} className="rounded-[10px] border border-line/60 bg-white p-3 text-left transition-colors hover:border-accent/50">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold text-navy">{e.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${e.state === "ok" ? "bg-teal/10 text-teal" : "bg-review/10 text-review"}`}>
                    {e.stateLabel}
                  </span>
                </div>
                <div className="tnum mt-1.5 text-[20px] leading-none font-bold text-navy">
                  {e.kpiValue} <span className="text-[11px] font-semibold text-body">{e.kpiLabel}</span>
                </div>
                <div className="tnum mt-1.5 text-[12px] text-body">
                  <span className={`font-semibold ${e.deltaPct < 0 ? "text-teal" : "text-review"}`}>
                    {e.deltaPct > 0 ? "+" : ""}
                    {pct(e.deltaPct)}
                  </span>{" "}
                  · {e.shareText}
                </div>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
