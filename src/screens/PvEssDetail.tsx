import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  PV_SPEC,
  ESS_SPEC,
  TOU,
  pvMonthly,
  pvH1,
  pvPrH1,
  lossWaterfall,
  essH1,
  essSavingKrw,
  dayProfile,
  pvGhg,
  pvMeters,
  iecMatrix,
  iecSummary,
  pvIssues,
  pvBiz,
  type PvMonth,
  type HourPoint,
} from "../lib/pvData";
import LegalBasis from "../components/LegalBasis";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 월별 툴팁 */
function MonthTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PvMonth }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">2026년 {p.label}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>경사면 일사량</span><span>{fmt(p.poaKwhM2)} kWh/m²</span></div>
        <div className="flex justify-between gap-6"><span>기대 발전 (PR 0.83)</span><span className="text-baseline">{fmt(p.expectMWh, 1)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>실측 발전</span><span className="font-semibold text-navy">{fmt(p.actMWh)} MWh</span></div>
        <div className="flex justify-between gap-6"><span>PR (성능비)</span><span className={`font-semibold ${p.pr >= 80 ? "text-teal" : "text-review"}`}>{p.pr}%</span></div>
        {p.event && <div className="border-t border-line/60 pt-1 text-review">{p.event}</div>}
      </div>
    </div>
  );
}

/* 24h 프로파일 툴팁 */
function DayTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HourPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] shadow-md">
      <div className="mb-1.5 font-semibold text-navy">{p.h} · {p.zone}</div>
      <div className="tnum space-y-1 text-body">
        <div className="flex justify-between gap-6"><span>태양광 발전</span><span className="text-teal">{fmt(p.pvKw)} kW</span></div>
        <div className="flex justify-between gap-6"><span>공장 부하</span><span className="text-navy">{fmt(p.loadKw)} kW</span></div>
        <div className="flex justify-between gap-6"><span>ESS</span><span className={p.essKw > 0 ? "font-semibold text-accent" : p.essKw < 0 ? "text-slate-500" : ""}>{p.essKw > 0 ? `방전 +${p.essKw}` : p.essKw < 0 ? `충전 ${p.essKw}` : "대기"} kW</span></div>
      </div>
    </div>
  );
}

/* 워터폴 데이터 (스택 트릭: 투명 base + 표시 value) */
const wfData = (() => {
  let cum = 0;
  return lossWaterfall.map((s, i) => {
    const isTotal = i === 0 || i === lossWaterfall.length - 1;
    const base = isTotal ? 0 : cum + s.mwh; // 손실(음수) 막대의 바닥
    if (i === 0) cum = s.mwh;
    else if (!isTotal) cum += s.mwh;
    return { name: s.name, base: Math.max(base, 0), value: Math.abs(s.mwh), isTotal, note: s.note, mwh: s.mwh };
  });
})();

/* 태양광·ESS 상세 — 냉동·냉장(대표 실증)과 동일한 깊이의 두 번째 상세 모듈.
   기준선이 회귀(과거 대비)가 아닌 "일사량 기반 기대 발전(PR)"인 점이 IPMVP형과의 차이 (IEC 61724-1). */
export default function PvEssDetail() {
  return (
    <>
      {/* KPI 6 */}
      <section className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(
          [
            ["상반기 발전량", `${fmt(pvH1.genMWh)} MWh`, `이용률 ${pvH1.capacityFactorPct}% · 전년 +5.2%`],
            ["성능비 PR", `${pvPrH1}%`, "IEC 61724-1 10장 · 기준 0.83 대비"],
            ["인버터 가동률", `${pvH1.availabilityPct}%`, "3월 정지 6일 반영"],
            ["자가소비", `${fmt(pvH1.selfMWh)} MWh`, `${((pvH1.selfMWh / pvH1.genMWh) * 100).toFixed(1)}% · 잉여 상계 ${pvH1.surplusMWh}`],
            ["ESS 왕복효율", `${essH1.roundTripPct}%`, `방전 ${essH1.dischargeMWh} / 충전 ${essH1.chargeMWh} MWh`],
            ["요금·탄소 효과", `${fmt(essSavingKrw / 1e6, 1)}백만원`, `ESS 차익(데모) · Scope 2 회피 ${pvGhg.avoided} t`],
          ] as Array<[string, string, string]>
        ).map(([k, v, sub]) => (
          <div key={k} className="rounded-[10px] border border-line/60 bg-white p-3.5">
            <div className="text-[12.5px] font-medium text-body">{k}</div>
            <div className="tnum mt-1 text-[22px] leading-none font-bold text-navy">{v}</div>
            <div className="tnum mt-1 truncate text-[11.5px] text-body" title={sub}>{sub}</div>
          </div>
        ))}
      </section>

      {/* 월별 기대 vs 실측 + PR */}
      <section className="rounded-[10px] border border-line/60 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-navy">월별 발전량 — 일사량 기반 기대치 vs 실측 (PR)</span>
          <span className="text-[12px] text-slate-400">기대 발전 = 설비용량 × 경사면 일사량 × PR 0.83 · ! = 이벤트</span>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pvMonthly} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eaeff5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#667085" }} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
              <YAxis yAxisId="mwh" tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} />
              <YAxis yAxisId="pr" orientation="right" domain={[60, 100]} tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={38} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<MonthTip />} />
              <Bar yAxisId="mwh" dataKey="actMWh" name="실측 발전" fill="#159f9e" fillOpacity={0.75} radius={[3, 3, 0, 0]} barSize={26} isAnimationActive={false} />
              <Line yAxisId="mwh" dataKey="expectMWh" name="기대 발전" stroke="#1e63c6" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="pr" dataKey="pr" name="PR" stroke="#102a43" strokeWidth={2} isAnimationActive={false}
                dot={(p: { cx?: number; cy?: number; payload?: PvMonth; index?: number }) => (
                  <g key={`d${p.index}`}>
                    <circle cx={p.cx} cy={p.cy} r={3} fill="#102a43" />
                    {p.payload?.event && <text x={p.cx} y={(p.cy ?? 0) - 9} fontSize={10} fontWeight={700} fill="#d97706" textAnchor="middle">!</text>}
                  </g>
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="tnum text-[12px] text-body">
          상반기 PR {pvPrH1}% — 3월(정지)·5월(오염) 하락 후 세척으로 회복 · MWh(좌) / PR %(우) · 데모 합성값
        </div>
      </section>

      {/* 손실 워터폴 + 품질 이슈 */}
      <section className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-1 text-[15px] font-semibold text-navy">발전 손실 분해 <span className="text-[12px] font-normal text-slate-400">IEC 61724-1 부속서 C 준용 (데모 분해)</span></div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={wfData} margin={{ top: 8, right: 8, bottom: 34, left: 0 }}>
                <CartesianGrid stroke="#eaeff5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "#667085" }} angle={-28} textAnchor="end" interval={0} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v, name, item) => {
                    const d = (item as { payload?: { mwh: number; note?: string } }).payload;
                    return name === "value" ? [`${d && d.mwh < 0 ? "−" : ""}${fmt(Number(v))} MWh${d?.note ? ` — ${d.note}` : ""}`, d && d.mwh < 0 ? "손실" : "발전량"] : [null as unknown as string, ""];
                  }}
                  contentStyle={{ fontSize: 12.5, borderRadius: 8, border: "1px solid #dce4ea", maxWidth: 280 }}
                />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]} barSize={30} isAnimationActive={false}>
                  {wfData.map((d, i) => (
                    <Cell key={i} fill={d.isTotal ? "#159f9e" : "#d97706"} fillOpacity={d.isTotal ? 0.8 : 0.65} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-2 text-[15px] font-semibold text-navy">품질·운영 이슈 <span className="text-[12px] font-normal text-slate-400">데이터 검증 체계와 동일 규칙</span></div>
          <div className="flex flex-col gap-2">
            {pvIssues.map((i) => (
              <div key={i.id} className="rounded-lg border border-line/60 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-navy">{i.id} · {i.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${i.state === "조치 완료" ? "bg-teal/10 text-teal" : "bg-accent/10 text-accent"}`}>{i.state}</span>
                </div>
                <div className="tnum mt-0.5 text-[12px] text-slate-400">{i.period}</div>
                <div className="mt-0.5 text-[12.5px] text-body">{i.impact}</div>
                <div className="text-[12.5px] text-navy">조치: {i.action}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESS 대표일 프로파일 */}
      <section className="rounded-[10px] border border-line/60 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-navy">ESS 운전 프로파일 — 하계 대표일 <span className="text-[12px] font-normal text-slate-400">배경 = 계시별(TOU) 요금 구간</span></span>
          <span className="tnum text-[12px] text-slate-400">{ESS_SPEC.battKwh} kWh / PCS {ESS_SPEC.pcsKw} kW · {ESS_SPEC.policy}</span>
        </div>
        <div className="h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dayProfile} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {/* TOU 배경: 최대부하 구간 강조 */}
              <ReferenceArea x1="11시" x2="12시" fill="#d97706" fillOpacity={0.08} />
              <ReferenceArea x1="13시" x2="17시" fill="#d97706" fillOpacity={0.08} />
              <ReferenceArea x1="0시" x2="9시" fill="#1e63c6" fillOpacity={0.05} />
              <CartesianGrid stroke="#eaeff5" vertical={false} />
              <XAxis dataKey="h" tick={{ fontSize: 10.5, fill: "#667085" }} interval={2} axisLine={{ stroke: "#eaeff5" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a94a6" }} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<DayTip />} />
              <Area dataKey="pvKw" name="태양광" fill="#159f9e" fillOpacity={0.25} stroke="#159f9e" strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="loadKw" name="공장 부하" stroke="#102a43" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Bar dataKey="essKw" name="ESS" barSize={9} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {dayProfile.map((d, i) => (
                  <Cell key={i} fill={d.essKw > 0 ? "#2f6bff" : "#8a94a6"} fillOpacity={0.8} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="tnum flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-body">
          <span>■ 파랑 막대 = 방전(최대부하) · 회색 = 충전(경부하)</span>
          <span>피크 기여 −{essH1.peakCutKw} kW</span>
          <span>사이클 {essH1.cycleCount}회 · SOH {essH1.sohPct}%</span>
          <span>상반기 차익 {fmt(essSavingKrw / 1e4)}만원 (TOU 데모 단가: 경부하 94 · 중간 146 · 최대 229원/kWh)</span>
        </div>
      </section>

      {/* 사업형태·REC·온실가스 연계 */}
      <section className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-1.5 text-[14px] font-semibold text-navy">사업 형태 — 자가용 (발전사업 아님)</div>
          <p className="text-[12.5px] leading-relaxed text-body">{pvBiz.type}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-body">{pvBiz.surplus}</p>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-1.5 text-[14px] font-semibold text-navy">REC — 발급 대상 아님 <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-body">RPS 지침</span></div>
          <p className="text-[12.5px] leading-relaxed text-body">{pvBiz.rec}</p>
        </div>
        <div className="rounded-[10px] border border-line/60 bg-white p-4">
          <div className="mb-1.5 text-[14px] font-semibold text-navy">온실가스 연계 — Scope 2 회피</div>
          <p className="tnum text-[12.5px] leading-relaxed text-body">
            자가소비 {fmt(pvH1.selfMWh)} MWh × 계수 {pvGhg.efCurrent} = <b className="text-teal">{pvGhg.avoided} tCO₂eq</b> 회피
            · 최신 계수({pvGhg.efLatest}, 2021~23 평균) 적용 시 {pvGhg.avoidedLatest} t — 기준정보의 배출계수 버전관리로 갱신
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{pvBiz.ghgNote}</p>
        </div>
      </section>

      {/* IEC 61724-1 정합성 + 계측 구성 */}
      <details className="rounded-[10px] border border-line/60 bg-white">
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <span className="text-[14px] font-semibold text-navy">KS C IEC 61724-1 정합성 — PV 모니터링 표준</span>
          <span className="tnum flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded bg-teal/10 px-1.5 py-0.5 text-teal">충족 {iecSummary.ok}</span>
            <span className="rounded bg-review/10 px-1.5 py-0.5 text-review">부분 {iecSummary.partial}</span>
          </span>
          <span className="ml-auto text-[12px] text-slate-400">{PV_SPEC.monitorClass} 선언 · 조항별 확인 ▾</span>
        </summary>
        <div className="border-t border-line/60 px-4 pt-2 pb-3">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-1.5 font-medium">조항</th>
                <th className="py-1.5 font-medium">요구사항</th>
                <th className="py-1.5 font-medium">상태</th>
                <th className="py-1.5 font-medium">시스템 구현</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {iecMatrix.map((r) => (
                <tr key={r.clause} className="border-b border-line/40 last:border-0">
                  <td className="py-1.5 font-semibold whitespace-nowrap text-navy">{r.clause}</td>
                  <td className="wrap max-w-56 py-1.5 font-medium">{r.title}</td>
                  <td className="py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${r.status === "충족" ? "bg-teal/10 text-teal" : "bg-review/10 text-review"}`}>{r.status}</span>
                  </td>
                  <td className="wrap py-1.5">{r.impl}{r.note && <div className="text-[11.5px] text-slate-400">{r.note}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 mb-1 text-[13px] font-semibold text-navy">계측 구성 (표 3 — Class B 필수 변수)</div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-body">
                <th className="py-1.5 font-medium">계측기</th>
                <th className="py-1.5 font-medium">측정 변수</th>
                <th className="py-1.5 font-medium">정확도</th>
                <th className="py-1.5 font-medium">주기</th>
                <th className="py-1.5 pl-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {pvMeters.map((m) => (
                <tr key={m.meter} className="border-b border-line/40 last:border-0">
                  <td className="py-1.5 font-medium text-navy">{m.meter}</td>
                  <td className="py-1.5 text-body">{m.variable}</td>
                  <td className="py-1.5 text-body">{m.spec}</td>
                  <td className="py-1.5 text-body">{m.cycle}</td>
                  <td className="py-1.5 pl-2"><span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-teal">{m.state}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tnum mt-2 text-[12px] text-body">
            설비: PV {PV_SPEC.arrayKwp} kWp (온도계수 {PV_SPEC.tempCoefPct}%/℃ · 연 열화 {PV_SPEC.degradePctYr}%) · {PV_SPEC.tilt} ·
            ESS {ESS_SPEC.battKwh} kWh / {ESS_SPEC.pcsKw} kW (왕복 {ESS_SPEC.roundTripPct}% · DoD {ESS_SPEC.dod}%) — 사양은 데모 가정
          </div>
        </div>
      </details>

      <LegalBasis
        items={[
          ["KS C IEC 61724-1", "태양광 시스템 성능 모니터링 표준 — Class B 선언, PR·손실·데이터 품질 규칙 준용 (해설서·체크리스트 기준)"],
          ["한전 기본공급약관·시행세칙", "계시별(TOU) 요금 체계 준용 — 단가는 데모 가정 (" + TOU.contract + ")"],
          ["신·재생에너지 공급의무화제도 관리·운영지침", "REC(=MWh×가중치) 발급 체계 — 자가용 설비로 발급 대상 아님을 판단 근거로 명시"],
          ["온실가스 배출권거래제 배출량 보고·인증 지침", "자가소비분은 구매전력 감소로 명세서에 자동 반영 (Scope 2) · 별도 감축 인증은 외부사업 지침 절차"],
        ]}
      />
    </>
  );
}
