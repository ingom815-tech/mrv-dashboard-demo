import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { factory, factoryMonthly, factoryTodos, equipGroups, ZONES, type FactoryMonth } from "../lib/factoryData";
import { reviewItems } from "../lib/mrvData";
import { useUI, deriveVerify } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

function FactoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FactoryMonth }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>기준기간 사용량</span><span className="font-semibold text-slate-500">{fmt(p.baseMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>보고기간 사용량</span><span className="font-semibold text-navy">{fmt(p.actMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>검증 절감 (냉동·냉장)</span><span className="font-semibold text-teal">{fmt(p.verifiedSaveMWh, 1)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>목표 (기준 −5%)</span><span className="text-accent">{fmt(p.targetMWh)} MWh</span></div>
        {p.event && <div className="border-t border-line/60 pt-1 text-review">{p.event}</div>}
      </div>
    </div>
  );
}

const STATE_BADGE: Record<string, string> = {
  정상: "bg-teal/10 text-teal",
  "MRV 검증 중": "bg-accent/10 text-accent",
  "검토 필요": "bg-review/10 text-review",
  "보완 필요": "bg-review/10 text-review",
};

export default function FactoryOverview() {
  const { setMenu, setEquipGroup, reviewStates } = useUI();
  const verify = deriveVerify(reviewStates);
  const pendingChiller = reviewItems.filter((r) => reviewStates[r.id] === "검토 필요").length;
  const todos = [
    ...reviewItems
      .filter((r) => reviewStates[r.id] === "검토 필요")
      .map((r) => ({ title: r.title, meta: `냉동·냉장 MRV · ${r.id}`, target: "report" as const })),
    ...factoryTodos,
  ];

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[21px] leading-tight font-bold text-navy">원주공장 종합현황</h1>
          <span
            className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터입니다. 냉동·냉장 설비군만 MRV 엔진 실산정값이며 나머지 설비군은 합성 요약값입니다."
          >
            DEMO · 합성데이터
          </span>
          <span className="hidden truncate text-[13px] text-slate-400 lg:inline">
            — 공장 전체 에너지·배출·MRV 성과
          </span>
        </div>
        <TopActions />
      </header>
      <ContextBar />

      {/* 공장 KPI 5 — 사용·배출(현황)과 MRV 절감·감축(성과)은 분리 */}
      <section className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="공장 핵심 지표">
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="text-[13px] font-medium text-body">총 에너지 사용량</div>
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
          <div className="tnum mt-2 text-[12px] text-body">
            Scope 1 {fmt(factory.scope1)} · Scope 2 {fmt(factory.scope2)}
          </div>
        </div>
        <button
          onClick={() => { setEquipGroup("chiller"); setMenu("equipment"); }}
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
          <div className="tnum mt-2 text-[12px] text-body">확인 필요 {pendingChiller}건 · 보고·승인 ›</div>
        </button>
        <button
          onClick={() => setMenu("master")}
          className="rounded-[10px] border border-line/60 bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">데이터 연계율</div>
          <div className="tnum mt-1.5 text-[26px] leading-none font-bold text-navy">
            {pct(factory.linkRate)}
          </div>
          <div className="tnum mt-2 text-[12px] text-body">
            계측 {factory.metersConnected}/{factory.metersTotal}점 · 설비·연계 관리 ›
          </div>
        </button>
      </section>

      {/* 공장 에너지 추이 + 처리할 일 */}
      <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col rounded-[10px] border border-line/60 bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">공장 에너지 사용량 · 기준 대비 추이</span>
            <div className="flex items-center gap-3 text-[12px] text-body">
              <span className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#8a94a6" strokeWidth="2" strokeDasharray="5 3" /></svg>
                기준기간
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#102a43" strokeWidth="2.5" /></svg>
                보고기간
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-teal/25" aria-hidden /> 검증 절감
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#2f6bff" strokeWidth="1.5" strokeDasharray="2 3" /></svg>
                목표
              </span>
              <span className="text-slate-400">MWh/월</span>
            </div>
          </div>
          <div className="h-[280px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={factoryMonthly} margin={{ top: 10, right: 14, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eaeff5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#8a94a6" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  domain={[0, 3600]}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip content={<FactoryTooltip />} cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }} />
                <Bar dataKey="verifiedSaveMWh" fill="#159f9e" fillOpacity={0.65} barSize={22} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line dataKey="baseMWh" stroke="#8a94a6" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                <Line dataKey="targetMWh" stroke="#2f6bff" strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
                <Line
                  dataKey="actMWh"
                  stroke="#102a43"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: FactoryMonth; index?: number }) => (
                    <g key={`fd${p.index}`}>
                      <circle cx={p.cx} cy={p.cy} r={3} fill="#102a43" />
                      {p.payload?.event && (
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
          </div>
          <div className="flex shrink-0 items-center justify-between text-[12px] text-body">
            <span>
              검증 절감 면적은 <b className="text-navy">MRV로 검증된 냉동·냉장 실증분</b>만 표시 · ! = 주요 운영 이벤트
            </span>
            <button
              onClick={() => { setEquipGroup("chiller"); setMenu("equipment"); }}
              className="font-medium text-accent hover:underline"
            >
              냉수플랜트 상세 MRV ›
            </button>
          </div>
        </div>

        {/* 처리할 일 */}
        <div className="flex flex-col rounded-[10px] border border-line/60 bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">처리할 일</span>
            <span className={`tnum rounded px-1.5 py-0.5 text-[11px] font-bold ${todos.length > 0 ? "bg-review/10 text-review" : "bg-teal/10 text-teal"}`}>
              {todos.length}건
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {todos.map((t) => (
              <button
                key={t.title}
                onClick={() => setMenu(t.target)}
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
            ))}
            {todos.length === 0 && (
              <div className="rounded-lg bg-teal/8 px-3 py-3 text-[13px] text-teal">모든 항목 처리 완료</div>
            )}
          </div>
        </div>
      </section>

      {/* 설비군 10개 — 3개 영역 */}
      {ZONES.map((zone) => {
        const groups = equipGroups.filter((g) => g.zone === zone.key);
        return (
          <section key={zone.key} className="shrink-0">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-[14px] font-semibold text-navy">{zone.name}</span>
              <span className="tnum text-[12px] text-slate-400">{groups.length}개 설비군</span>
            </div>
            <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${groups.length > 3 ? "xl:grid-cols-6" : "xl:grid-cols-3"}`}>
              {groups.map((g) => (
                <button
                  key={g.key}
                  onClick={() => { setEquipGroup(g.key); setMenu("equipment"); }}
                  className={`rounded-[10px] border bg-white p-3 text-left transition-colors hover:border-accent/50 ${
                    g.detail === "full" ? "border-teal/40" : "border-line/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[12.5px] font-semibold text-navy">{g.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATE_BADGE[g.state]}`}>
                      {g.state}
                    </span>
                  </div>
                  <div className="tnum mt-1.5 text-[18px] leading-none font-bold text-navy">
                    {fmt(g.usage)} <span className="text-[10.5px] font-semibold text-body">{g.unit}</span>
                  </div>
                  <div className="tnum mt-1.5 truncate text-[11.5px] text-body">
                    <span className={`font-semibold ${g.deltaPct < 0 ? "text-teal" : "text-review"}`}>
                      {g.deltaPct > 0 ? "+" : ""}{pct(g.deltaPct)}
                    </span>{" "}
                    {g.deltaBase}
                  </div>
                  <div className="tnum mt-0.5 truncate text-[11.5px] text-slate-400">
                    계측 {g.meters[0]}/{g.meters[1]} · {g.linkState} · 상세 ›
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
