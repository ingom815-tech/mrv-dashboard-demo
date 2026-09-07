import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useCalc } from "../lib/useCalc";
import { mrv, perfCurve, type EquipCard } from "../lib/mrvData";
import { equipGroups } from "../lib/factoryData";
import { useUI } from "../store";
import { useEquip, requiredOk, typeOf } from "../config/equipmentStore";
import { Btn, Card, Segment } from "../components/ui";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

type View = "contrib" | "perf" | "groups";

/* 설비별 성과 — 기본 모드. 보기 선택 3종:
   ① 감축 기여(등록 설비 동적) ② 성능 지표(COP·kW/RT 등) ③ 전체 설비군(공장 10개 요약).
   데모 연동 설비는 엔진 산정에 매핑, 신규 설비는 수집 대기/산정 제외로 정직 표기. */
export default function EquipPerfSimple() {
  const calc = useCalc();
  const { setMenu, setEquipGroup } = useUI();
  const { equipment } = useEquip();
  const [view, setView] = useState<View>("contrib");
  const contrib = (calc.savings.contrib ?? []) as Array<{ key: string; label: string; before: number; after: number }>;

  const rows = equipment.map((e) => {
    const ok = requiredOk(e);
    const cKey = e.engineTag ? e.engineTag.toLowerCase().replace("_kw", "") : null;
    const c = cKey ? contrib.find((x) => x.key === cKey) : null;
    const cutMWh = c ? Math.max(0, c.before - c.after) / 1000 : 0;
    const state = !ok ? "산정 제외" : e.demo ? "산정 반영" : "수집 대기";
    return { id: e.id, name: e.name, type: typeOf(e.type).name, phase: e.phase, ok, cutMWh, state, cKey };
  });
  const chartRows = rows.filter((r) => r.state === "산정 반영");
  const totalCut = chartRows.reduce((s, r) => s + r.cutMWh, 0);
  const perfRows = mrv.equip as EquipCard[];
  const goDetail = (groupKey: string) => {
    setEquipGroup(groupKey);
    window.location.hash = `#/equipment/${groupKey}`;
    setMenu("equipment");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tk-title">설비별 성과</h1>
          <p className="tk-label mt-1">등록된 설비 {equipment.length}개 중 {chartRows.length}개가 산정에 반영되어 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
          <Btn kind="secondary" small onClick={() => goDetail("chiller")}>상세 보기</Btn>
        </div>
      </header>

      {/* 보기 선택 */}
      <Segment
        ariaLabel="설비 성과 보기 선택"
        options={[
          { key: "contrib" as View, label: "감축 기여" },
          { key: "perf" as View, label: "성능 지표" },
          { key: "groups" as View, label: "전체 설비군" },
        ]}
        value={view}
        onChange={setView}
      />

      {/* ① 감축 기여 — 등록 설비 기반 */}
      {view === "contrib" && (
        <>
          <Card title={<span>설비 단위 감축 기여 <span className="tk-label">MWh · 도입 전 사용량과의 차이</span></span>}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#eef1f4" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7684" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12.5, fill: "#191f28" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(15,118,110,0.06)" }}
                    formatter={(v) => [`${fmt(Number(v ?? 0), 1)} MWh`, "감축 기여"]}
                    labelStyle={{ fontWeight: 600, color: "#191f28" }}
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", fontSize: 13, padding: "10px 14px" }}
                  />
                  <Bar dataKey="cutMWh" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false}>
                    {chartRows.map((r) => (
                      <Cell key={r.id} fill="#0f766e" fillOpacity={r.phase === "도입 후" ? 0.9 : 0.45} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="tk-label mt-1">
              진한 막대는 개선(도입 후) 설비입니다. 합계 {fmt(totalCut, 1)} MWh를 감축했습니다.
              냉동기는 신설기로 부하가 이동해 개별 수치가 왜곡될 수 있어 성능 지표를 함께 봅니다.
            </p>
          </Card>

          <Card
            title="등록 설비 상태"
            action={<Btn kind="secondary" small onClick={() => setMenu("equipconfig")}>설정</Btn>}
          >
            <div className="flex flex-col">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#f0f2f4] py-2.5 last:border-0">
                  <span className="min-w-44 text-[14px] font-medium text-ink">{r.name}</span>
                  <span className="tk-label">{r.type} · {r.phase}</span>
                  <span className="tnum ml-auto text-[13.5px] font-semibold text-ink">
                    {r.state === "산정 반영" ? `${fmt(r.cutMWh, 1)} MWh` : "—"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      r.state === "산정 반영" ? "bg-brand/10 text-brand" : r.state === "산정 제외" ? "bg-warn/10 text-warn" : "bg-[#f2f4f6] text-sub"
                    }`}
                  >
                    {r.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="tk-label mt-2">
              필수 계측이 연결되지 않은 설비는 산정에서 제외됩니다. 새로 등록한 설비는 데이터 수집이 시작되면 반영됩니다 (데모는 합성데이터 없음).
            </p>
          </Card>
        </>
      )}

      {/* ② 성능 지표 — COP·kW/RT 등 */}
      {view === "perf" && (
        <Card
          title={<span>설비 성능 지표 <span className="tk-label">같은 냉방부하 조건에서 효율이 평균 {fmt(perfCurve.sameLoadImprovePct * 100, 1)}% 개선되었습니다</span></span>}
          action={<Btn kind="secondary" small onClick={() => goDetail("chiller")}>성능곡선 상세</Btn>}
        >
          <div className="flex flex-col">
            {perfRows.map((e) => (
              <div key={e.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#f0f2f4] py-3 last:border-0">
                <span className="min-w-40 text-[14px] font-medium text-ink">{e.name}</span>
                <span className="tnum text-[15px] font-semibold text-ink">{e.kpiValue} <span className="tk-label">{e.kpiLabel}</span></span>
                <span className={`tnum text-[13px] font-medium ${e.deltaPct <= 0 ? "text-brand" : "text-warn"}`}>
                  {e.deltaPct <= 0 ? "▼" : "▲"} {fmt(Math.abs(e.deltaPct) * 100, 1)}% <span className="tk-label font-normal">{e.deltaLabel}</span>
                </span>
                <span className="tk-label ml-auto hidden md:inline">{e.shareText}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${e.state === "ok" ? "bg-brand/10 text-brand" : "bg-warn/10 text-warn"}`}>
                  {e.stateLabel}
                </span>
              </div>
            ))}
          </div>
          <p className="tk-label mt-2">
            ▼는 도입 전 대비 효율 개선(소비 감소)입니다. COP·부하율-효율 곡선·ΔT 등 전체 성능 분석은 상세 보기에 있습니다.
          </p>
        </Card>
      )}

      {/* ③ 전체 설비군 — 공장 10개 설비군 요약 */}
      {view === "groups" && (
        <Card title={<span>공장 전체 설비군 <span className="tk-label">보고기간 6개월 사용량·상태 — 행을 누르면 상세로 이동합니다</span></span>}>
          <div className="flex flex-col">
            {equipGroups.map((g) => (
              <button
                key={g.key}
                onClick={() => goDetail(g.key)}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#f0f2f4] py-2.5 text-left transition-colors last:border-0 hover:bg-[#f8f9fa]"
              >
                <span className="min-w-36 text-[14px] font-medium text-ink">{g.name}</span>
                <span className="tnum text-[13.5px] font-semibold text-ink">{fmt(g.usage)} <span className="tk-label font-normal">{g.unit}</span></span>
                <span className={`tnum text-[12.5px] ${g.deltaPct <= 0 ? "text-brand" : "text-sub"}`}>
                  {g.deltaPct <= 0 ? "▼" : "▲"} {fmt(Math.abs(g.deltaPct) * 100, 1)}% <span className="tk-label">{g.deltaBase}</span>
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    g.state === "정상" ? "bg-brand/10 text-brand" : g.state === "MRV 검증 중" ? "bg-[#e7f0ff] text-accent" : "bg-warn/10 text-warn"
                  }`}>
                    {g.state}
                  </span>
                  <span className="text-sub">›</span>
                </span>
                <span className="tk-label w-full md:hidden">{g.note}</span>
              </button>
            ))}
          </div>
          <p className="tk-label mt-2">
            냉동·냉장(MRV 상세 실증)·태양광·ESS(IEC 61724-1)는 상세 분석이 구현되어 있고, 나머지 설비군은 요약 데이터입니다.
          </p>
        </Card>
      )}
    </div>
  );
}
