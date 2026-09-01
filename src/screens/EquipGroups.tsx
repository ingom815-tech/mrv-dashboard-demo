import { useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { equipGroups, ZONES, type EquipGroupInfo } from "../lib/factoryData";
import { useUI } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";
import Overview from "./Overview";
import EquipPerformance from "./EquipPerformance";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

const STATE_BADGE: Record<string, string> = {
  정상: "bg-teal/10 text-teal",
  "MRV 검증 중": "bg-accent/10 text-accent",
  "검토 필요": "bg-review/10 text-review",
  "보완 필요": "bg-review/10 text-review",
};

/* 설비군 월별 사용량 미니 차트 (기준 vs 보고) */
function GroupChart({ g, tall = false }: { g: EquipGroupInfo; tall?: boolean }) {
  const data = g.monthly.map((v, i) => ({
    label: `${i + 1}월`,
    act: Math.round(v * 10) / 10,
    base: Math.round(g.baseMonthly[i] * 10) / 10,
  }));
  return (
    <div className={tall ? "h-[260px]" : "h-[200px]"}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#eaeff5" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8a94a6" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v, name) => [`${fmt(Number(v ?? 0), 1)} ${g.unit}`, name === "act" ? "보고기간" : "기준기간"]}
            labelStyle={{ fontWeight: 600 }}
            contentStyle={{ fontSize: 12.5, borderRadius: 8, border: "1px solid #dce4ea" }}
          />
          <Bar dataKey="act" fill="#159f9e" fillOpacity={0.75} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line dataKey="base" stroke="#8a94a6" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EquipGroups() {
  const { equipGroup, setEquipGroup, setMenu } = useUI();
  const [chillerTab, setChillerTab] = useState<"mrv" | "perf">("mrv");
  const sel = equipGroups.find((g) => g.key === equipGroup) ?? null;

  return (
    <div className="flex min-h-screen flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[20px] leading-tight font-bold text-navy md:text-[24px]">설비군 분석</h1>
          <span
            className="cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="냉동·냉장 설비군만 MRV 엔진 실산정값이며, 나머지 설비군은 합성 요약데이터입니다."
          >
            DEMO · 합성데이터
          </span>
        </div>
        <TopActions />
      </header>
      <ContextBar />

      {/* 설비군 선택기 */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button
          onClick={() => setEquipGroup("all")}
          className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
            equipGroup === "all" ? "bg-navy font-semibold text-white" : "border border-line/60 bg-white text-body hover:text-navy"
          }`}
        >
          전체
        </button>
        {equipGroups.map((g) => (
          <button
            key={g.key}
            onClick={() => setEquipGroup(g.key)}
            className={`rounded-lg px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
              equipGroup === g.key
                ? "bg-navy font-semibold text-white"
                : `border bg-white text-body hover:text-navy ${g.detail === "full" ? "border-teal/40" : "border-line/60"}`
            }`}
          >
            {g.name.replace(" 설비", "")}
            {g.detail === "full" && equipGroup !== g.key && <span className="ml-1 text-[10px] font-bold text-teal">MRV</span>}
          </button>
        ))}
      </div>

      {/* ---------- 전체: 설비군 비교 ---------- */}
      {equipGroup === "all" && (
        <section className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-navy">설비군 비교 (보고기간 6개월)</span>
            <span className="text-[12px] text-slate-400">행 클릭 시 설비군 상세</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-2 font-medium">설비군</th>
                <th className="py-2 font-medium">영역</th>
                <th className="py-2 text-right font-medium">사용·배출량</th>
                <th className="py-2 text-right font-medium">기준 대비</th>
                <th className="py-2 text-right font-medium">계측 연계</th>
                <th className="py-2 pl-4 font-medium">대표 KPI</th>
                <th className="py-2 pl-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {equipGroups.map((g) => (
                <tr
                  key={g.key}
                  onClick={() => setEquipGroup(g.key)}
                  className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-surface"
                >
                  <td className="py-2 font-medium text-navy">
                    {g.name}
                    {g.detail === "full" && <span className="ml-1.5 rounded bg-teal/10 px-1 py-0.5 text-[10px] font-bold text-teal">상세 MRV</span>}
                  </td>
                  <td className="py-2 text-body">{ZONES.find((z) => z.key === g.zone)?.name}</td>
                  <td className="py-2 text-right text-navy">{fmt(g.usage)} <span className="text-[11px] text-body">{g.unit}</span></td>
                  <td className={`py-2 text-right font-semibold ${g.deltaPct < 0 ? "text-teal" : "text-review"}`}>
                    {g.deltaPct > 0 ? "+" : ""}{pct(g.deltaPct)}
                  </td>
                  <td className="py-2 text-right text-body">{g.meters[0]}/{g.meters[1]}</td>
                  <td className="py-2 pl-4 text-body">{g.kpis[0].label} {g.kpis[0].value}</td>
                  <td className="py-2 pl-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATE_BADGE[g.state]}`}>{g.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[12px] text-body">
            냉동·냉장은 상세 MRV 실증 모듈(엔진 실산정) · 나머지 설비군은 합성 요약데이터 — 확장 시 동일 구조로 상세화
          </div>
        </section>
      )}

      {/* ---------- 냉동·냉장: 상세 MRV 실증 모듈 ---------- */}
      {sel?.key === "chiller" && (
        <>
          <div className="flex shrink-0 items-center justify-between">
            <div className="flex gap-1 rounded-lg border border-line/60 bg-white p-1">
              {(
                [
                  ["mrv", "MRV 성과 (중앙 냉수플랜트)"],
                  ["perf", "설비 성능 분석"],
                ] as Array<["mrv" | "perf", string]>
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setChillerTab(k)}
                  className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    chillerTab === k ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="rounded bg-teal/10 px-2 py-1 text-[11.5px] font-semibold text-teal">
              공장 내 대표 MRV 실증 모듈 — 엔진 실산정
            </span>
          </div>
          {chillerTab === "mrv" ? <Overview embedded /> : <EquipPerformance embedded />}
        </>
      )}

      {/* ---------- 보일러·스팀: 두 번째 대표 화면 ---------- */}
      {sel && sel.key === "boiler" && (
        <>
          <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            {sel.kpis.map((k) => (
              <div key={k.label} className="rounded-[10px] border border-line/60 bg-white p-4">
                <div className="text-[13px] font-medium text-body">{k.label}</div>
                <div className="tnum mt-1.5 text-[24px] leading-none font-bold text-navy">{k.value}</div>
              </div>
            ))}
          </section>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-navy">월별 에너지 사용량 (연료 환산 MWh)</span>
              <span className="tnum text-[12px] text-body">
                {fmt(sel.usage)} {sel.unit} · <b className={sel.deltaPct > 0 ? "text-review" : "text-teal"}>{sel.deltaPct > 0 ? "+" : ""}{pct(sel.deltaPct)}</b> {sel.deltaBase}
              </span>
            </div>
            <GroupChart g={sel} tall />
            <div className="mt-1 text-[12px] text-body">막대 = 보고기간 · 점선 = 기준기간 동월 · 겨울철 스팀 수요로 1~2월 집중</div>
          </section>
          <section className="grid shrink-0 grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-review/30 bg-white p-4">
              <div className="text-[14px] font-semibold text-review">데이터 보완 필요</div>
              <ul className="mt-2 space-y-1.5 text-[13px] text-body">
                <li>· 가스미터 2점(세척기·직화라인) 연계 대기 — 현재 월별 수기 입력</li>
                <li>· 증기유량계 1점 교정 이력 미등록</li>
              </ul>
              <button onClick={() => setMenu("master")} className="mt-2 text-[12.5px] font-medium text-accent hover:underline">
                설비·연계 관리에서 연결 진행 ›
              </button>
            </div>
            <div className="rounded-[10px] border border-line/60 bg-white p-4">
              <div className="text-[14px] font-semibold text-navy">MRV 확장 후보</div>
              <p className="mt-2 text-[13px] leading-relaxed text-body">
                보일러 효율 개선(절탄기·배가스 회수) 사업 적용 시, 냉수플랜트와 동일한 기준선 모델
                (연료 = f(난방도일, 생산량)) 구조로 상세 MRV를 구성할 수 있습니다. 데이터 연계 보완이 선행 조건입니다.
              </p>
            </div>
          </section>
        </>
      )}

      {/* ---------- 나머지: 공통 템플릿 ---------- */}
      {sel && sel.detail === "template" && (
        <>
          <div className="flex shrink-0 items-center justify-between rounded-[10px] border border-line/60 bg-white px-4 py-2.5">
            <div className="tnum flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="font-semibold text-navy">{sel.name}</span>
              <span className="text-body">
                {fmt(sel.usage)} {sel.unit} · <b className={sel.deltaPct < 0 ? "text-teal" : "text-review"}>{sel.deltaPct > 0 ? "+" : ""}{pct(sel.deltaPct)}</b> {sel.deltaBase}
              </span>
              <span className="text-body">계측 {sel.meters[0]}/{sel.meters[1]} · {sel.linkState}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATE_BADGE[sel.state]}`}>{sel.state}</span>
            </div>
            <span className="rounded bg-line/60 px-2 py-0.5 text-[11px] font-medium text-body">합성 요약데이터 · 상세 MRV 확장 대상</span>
          </div>
          <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
            {sel.kpis.map((k) => (
              <div key={k.label} className="rounded-[10px] border border-line/60 bg-white p-4">
                <div className="text-[13px] font-medium text-body">{k.label}</div>
                <div className="tnum mt-1.5 text-[24px] leading-none font-bold text-navy">{k.value}</div>
              </div>
            ))}
          </section>
          <section className="rounded-[10px] border border-line/60 bg-white p-4">
            <div className="mb-1 text-[15px] font-semibold text-navy">월별 추이</div>
            <GroupChart g={sel} />
            <div className="mt-1 text-[12px] text-body">{sel.note}</div>
          </section>
          <div className="text-[12px] text-slate-400">
            이 설비군은 공장 종합 집계와 데이터 연계 상태까지 제공하며, 상세 MRV(기준선·검증·증적)는 확장 단계에서 냉동·냉장과 동일한 구조로 구현됩니다.
          </div>
        </>
      )}
    </div>
  );
}
