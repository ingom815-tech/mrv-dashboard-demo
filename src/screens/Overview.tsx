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
} from "recharts";
import { mrv, EF, reviewItems, type MonthPoint, type EquipGroup } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

/* 월 클릭 시 해당 월의 데이터 이슈·제외일 연결 (지시문 §9) */
function monthIssues(month: string) {
  const issues = mrv.quality.issues.filter((i: { period: string }) => i.period.includes(month));
  const point = mrv.monthly.find((p) => p.month === month);
  return { excl: point?.nExcluded ?? 0, est: point?.estDays ?? 0, issues };
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
    <div className="rounded-lg border border-line bg-white px-3.5 py-3 text-[13px] shadow-sm">
      <div className="mb-1.5 font-semibold text-navy">2026년 {label}</div>
      <div className="tnum space-y-1 text-body">
        <div>
          조정 기준선 <span className="ml-1 font-semibold text-baseline">{fmt(p.baseMWh)} MWh</span>
        </div>
        <div>
          실제 사용량 <span className="ml-1 font-semibold text-navy">{fmt(p.actMWh)} MWh</span>
        </div>
        <div>
          절감량 <span className="ml-1 font-semibold text-teal">{fmt(p.saveMWh)} MWh</span>
        </div>
        <div className="pt-1">
          데이터 상태:{" "}
          {p.nExcluded > 0 || p.estDays > 0 ? (
            <span className="text-review">
              {p.nExcluded > 0 && `제외 ${p.nExcluded}일`}
              {p.nExcluded > 0 && p.estDays > 0 && " · "}
              {p.estDays > 0 && `추정 ${p.estDays}일`}
            </span>
          ) : (
            <span className="text-teal">정상</span>
          )}
        </div>
        <div className="pt-0.5 text-[11px] text-slate-400">클릭하면 산정근거·이슈를 확인</div>
      </div>
    </div>
  );
}

/* 선 끝 직접 라벨 (지시문 §5: 범례 최소화) */
const endLabel =
  (text: string, color: string, dy = 4) =>
  (props: { x?: number | string; y?: number | string; index?: number }) => {
    if (props.index !== mrv.monthly.length - 1) return null;
    return (
      <text
        x={Number(props.x) + 9}
        y={Number(props.y) + dy}
        fontSize={12}
        fontWeight={600}
        fill={color}
      >
        {text}
      </text>
    );
  };

/* 결측·제외·추정 월 이벤트 마커 (지시문 §5) */
function eventDot(props: {
  cx?: number;
  cy?: number;
  payload?: MonthPoint;
  index?: number;
}) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return <g key={`d${props.index}`} />;
  const flagged = payload.nExcluded > 0; // 제외 구간 포함 월만 마커 (추정은 툴팁으로)
  return (
    <g key={`d${props.index}`}>
      <circle cx={cx} cy={cy} r={3} fill="#102a43" />
      {flagged && (
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

const stateChip = {
  ok: "bg-teal/10 text-teal",
  warn: "bg-review/10 text-review",
  review: "bg-review/10 text-review",
} as const;

const GROUP_FILTERS: Array<{ key: EquipGroup | "all"; label: string }> = [
  { key: "all", label: "전체" },
  { key: "heat", label: "열원" },
  { key: "pump", label: "펌프" },
  { key: "air", label: "공기측" },
];

export default function Overview() {
  const { openEvidence, setMenu, selectedMonth, selectMonth, equipFilter, setEquipFilter, reviewStates } =
    useUI();
  const calc = useCalc();
  const verify = deriveVerify(reviewStates);
  const ck = calc.kpi;
  const k = mrv.kpi;
  const cov = mrv.coverage;
  const pendingItem = reviewItems.find((r) => reviewStates[r.id] === "검토 필요");
  const sel = selectedMonth ? monthIssues(selectedMonth) : null;
  const updatedAt = new Date(mrv.meta.generatedAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const equipList = mrv.equip.filter((e) => equipFilter === "all" || e.group === equipFilter);

  return (
    <div className="flex h-screen min-h-0 flex-col gap-3 px-6 py-4">
      {/* 헤더 — 지시문 §3.2: 정보 한 줄 + 주요 버튼 1개 */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="shrink-0 text-[20px] leading-tight font-bold text-navy">
            2026년 상반기 감축성과
          </h1>
          <span
            className="shrink-0 cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터로 산정한 가정값입니다. 공식 MRV 보고에 사용할 수 없습니다. (data_origin = SYNTHETIC)"
          >
            DEMO · 합성데이터
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="tnum hidden items-center gap-1.5 text-[12px] text-body xl:flex">
            <span className="font-semibold text-navy">{mrv.meta.site}</span>·
            <span>{mrv.meta.boundary}</span>·<span>보고기간 {mrv.meta.periodLabel}</span>·
            <span>{mrv.meta.aggLabel}</span>·
            <span>
              대상 설비 {mrv.meta.equipCount}대 · 계측 {mrv.meta.tagCount}점
            </span>
            ·<span>갱신 {updatedAt}</span>
          </div>
          <button
            onClick={openEvidence}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            산정근거 보기
          </button>
        </div>
      </header>

      {/* 핵심 KPI 4개 — 지시문 §4 */}
      <section className="grid shrink-0 grid-cols-4 gap-3" aria-label="핵심 성과">
        <button
          onClick={() => setMenu("equipment")}
          className="rounded-[10px] border border-line bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">에너지 절감</div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-teal">
            {fmt(ck.saveMWh)} <span className="text-[14px] font-semibold">MWh</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">
            기준선 대비 <span className="font-semibold text-teal">{pct(ck.savePct)}</span> · 산정{" "}
            {ck.nDays}일 · 제외 {ck.nExcluded}일
          </div>
        </button>
        <button
          onClick={() => setMenu("verify")}
          className="rounded-[10px] border border-line bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">탄소 감축</div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
            {fmt(ck.co2, 1)} <span className="text-[14px] font-semibold">tCO₂eq</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">
            배출계수 {EF.value} ({EF.baseYear}) · 냉매 배출 별도
          </div>
        </button>
        <button
          onClick={() => setMenu("verify")}
          className="rounded-[10px] border border-line bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-body">MRV 신뢰도</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                verify.state === "승인 완료" ? "bg-teal/10 text-teal" : "bg-review/10 text-review"
              }`}
            >
              {verify.state}
            </span>
          </div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
            {fmt(k.trustRate * 100, 1)}
            <span className="text-[14px] font-semibold">%</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">
            정상률 {pct(k.trustRate)} · 검토 필요{" "}
            <span className={`font-semibold ${verify.pending > 0 ? "text-review" : "text-teal"}`}>
              {verify.pending}건
            </span>
          </div>
        </button>
        <button
          onClick={() => setMenu("equipment")}
          className="rounded-[10px] border border-line bg-white p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="text-[13px] font-medium text-body">설비 커버리지</div>
          <div className="tnum mt-1.5 text-[28px] leading-none font-bold text-navy">
            {cov.collected} <span className="text-[14px] font-semibold">/ {cov.total}점</span>
          </div>
          <div className="tnum mt-2 text-[12px] text-body">
            정상 {cov.ok} · <span className="font-semibold text-review">주의 {cov.warn}</span> ·
            미수집 {cov.missing}
          </div>
        </button>
      </section>

      {/* 메인 차트 + MRV Assurance — 지시문 §5·§6 */}
      <section className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-3">
        <div className="relative flex min-h-0 flex-col rounded-[10px] border border-line bg-white p-4">
          <div className="flex shrink-0 items-center justify-between">
            <div className="text-[14px] font-semibold text-navy">조정 기준선 대비 실제 사용량</div>
            <div className="text-[12px] text-body">단위 MWh/월</div>
          </div>
          {/* 차트 내부 절감 성과 강조 (지시문 §5) */}
          <div className="pointer-events-none absolute top-12 left-16 z-10">
            <div className="tnum text-[22px] leading-none font-bold text-teal">
              {fmt(ck.saveMWh)} MWh 절감
            </div>
            <div className="tnum mt-1 text-[13px] text-body">기준선 대비 {pct(ck.savePct)}</div>
          </div>
          <div className="min-h-0 flex-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={calc.monthly}
                margin={{ top: 26, right: 86, bottom: 0, left: 0 }}
                onClick={(s) => {
                  const label = (s as { activeLabel?: string }).activeLabel;
                  const m = mrv.monthly.find((x) => x.label === label);
                  selectMonth(m ? (selectedMonth === m.month ? null : m.month) : null);
                }}
              >
                <CartesianGrid stroke="#dde4ec" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#667085" }}
                  axisLine={{ stroke: "#dde4ec" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#667085" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "#c3cdd9", strokeDasharray: "3 3" }}
                />
                {/* 실제 사용량 위에 절감량을 쌓아 기준선까지의 절감 구간을 면으로 표현 */}
                <Area
                  dataKey="actMWh"
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
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
                  stroke="#1e63c6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                >
                  <LabelList content={endLabel("조정 기준선", "#1e63c6", -2)} />
                </Line>
                <Line
                  dataKey="actMWh"
                  stroke="#102a43"
                  strokeWidth={2.5}
                  dot={eventDot}
                  isAnimationActive={false}
                >
                  <LabelList content={endLabel("실제 사용량", "#102a43", 12)} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 text-[12px]">
            <div className="min-w-0 truncate text-body">
              {sel ? (
                <span className="tnum">
                  <span className="font-semibold text-navy">
                    {Number(selectedMonth!.slice(5))}월
                  </span>{" "}
                  — 제외 {sel.excl}일 · 추정 {sel.est}일
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
              ) : (
                <span>
                  <span className="font-semibold text-review">!</span> 표시 월은 산정 제외 구간 포함
                  · 월 클릭 시 상세
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-4">
              <button
                onClick={() => setMenu("verify")}
                className="font-medium text-accent hover:underline"
              >
                데이터 이슈 ›
              </button>
              <button
                onClick={() => setMenu("equipment")}
                className="font-medium text-accent hover:underline"
              >
                설비 원인 ›
              </button>
            </div>
          </div>
        </div>

        {/* MRV Assurance 패널 — 지시문 §6 */}
        <div className="flex min-h-0 flex-col rounded-[10px] border border-line bg-white p-4">
          <div className="shrink-0 text-[14px] font-semibold text-navy">MRV Assurance</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {mrv.assurance
              .map((row) =>
                row.stage === "Verification"
                  ? {
                      ...row,
                      status: (verify.state === "승인 완료" ? "PASS" : "REVIEW") as typeof row.status,
                      evidence:
                        verify.pending > 0
                          ? `검토 필요 ${verify.pending}건 · 승인 전`
                          : `검토 항목 처리 완료 · ${verify.state}`,
                    }
                  : row,
              )
              .map((row) => (
              <div key={row.stage} className="rounded-lg border border-line px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-navy">
                    <span className="text-[10px] tracking-wide text-slate-400 uppercase">
                      {row.stage}
                    </span>
                    <span className="ml-1.5">{row.label}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      row.status === "PASS"
                        ? "bg-teal/10 text-teal"
                        : row.status === "REVIEW"
                          ? "bg-review/10 text-review"
                          : "bg-risk/10 text-risk"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="tnum mt-1 text-[12px] leading-relaxed text-body">{row.evidence}</div>
              </div>
            ))}
          </div>
          {verify.pending > 0 ? (
            <div className="mt-3 rounded-lg bg-review/8 px-3 py-2.5">
              <div className="text-[12px] font-semibold text-review">검토 필요 {verify.pending}건</div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-body">
                {pendingItem?.title}
                {verify.pending > 1 && ` 외 ${verify.pending - 1}건`}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-teal/8 px-3 py-2.5 text-[12px] font-medium text-teal">
              검토 항목 처리 완료 · {verify.state}
            </div>
          )}
          <button
            onClick={() => setMenu("verify")}
            className="mt-2.5 text-left text-[13px] font-medium text-accent hover:underline"
          >
            검증 상세 보기 ›
          </button>
        </div>
      </section>

      {/* Traceability Strip — 지시문 §7 */}
      <div className="tnum flex shrink-0 items-center gap-2 rounded-[10px] border border-line bg-white px-4 py-2 text-[12px] text-body">
        <span className="font-semibold text-navy">추적성</span>
        <span className="text-line">|</span>
        <span>
          기준선 모델 <b className="font-semibold text-navy">{mrv.baseline.version}</b>
        </span>
        ·
        <span>
          계산버전 <b className="font-semibold text-navy">{calc.version}</b>
        </span>
        ·
        <span>
          수집률 <b className="font-semibold text-navy">{pct(k.collectRate)}</b>
        </span>
        ·
        <span>
          검증 상태{" "}
          <b className={`font-semibold ${verify.state === "승인 완료" ? "text-teal" : "text-review"}`}>
            {verify.state}
          </b>
        </span>
        ·<span>최종 산정 {updatedAt}</span>·
        <span>담당 {verify.state === "승인 완료" ? "MRV 담당자(데모)" : "— (승인 전)"}</span>
        <button
          onClick={openEvidence}
          className="ml-auto font-medium text-accent hover:underline"
        >
          산정근거 ›
        </button>
      </div>

      {/* 설비군 대표 KPI — 지시문 §8 */}
      <section className="shrink-0" aria-label="설비별 성과">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-navy">설비별 성과</span>
            <div className="flex gap-1">
              {GROUP_FILTERS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setEquipFilter(g.key)}
                  className={`rounded px-2 py-0.5 text-[12px] transition-colors ${
                    equipFilter === g.key
                      ? "bg-navy font-semibold text-white"
                      : "bg-white text-body hover:text-navy"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setMenu("equipment")}
            className="text-[12px] font-medium text-accent hover:underline"
          >
            설비성과 상세 ›
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {equipList.map((e) => (
            <button
              key={e.key}
              onClick={() => setMenu("equipment")}
              className="rounded-[10px] border border-line bg-white p-3 text-left transition-colors hover:border-accent/50"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[12px] font-semibold text-navy">{e.name}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${stateChip[e.state]}`}
                >
                  {e.stateLabel}
                </span>
              </div>
              <div className="tnum mt-1.5 text-[19px] leading-none font-bold text-navy">
                {e.kpiValue} <span className="text-[11px] font-semibold text-body">{e.kpiLabel}</span>
              </div>
              <div className="tnum mt-1.5 text-[11px] text-body">
                {e.deltaLabel}{" "}
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
