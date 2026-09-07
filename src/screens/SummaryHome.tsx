import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCalc } from "../lib/useCalc";
import { mrv } from "../lib/mrvData";
import { useUI, activeEf, deriveVerify } from "../store";
import { useEquip, requiredOk } from "../config/equipmentStore";
import { Btn, Card, Input, Segment } from "../components/ui";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

type Metric = "co2" | "mwh" | "krw";
const METRIC_META: Record<Metric, { label: string; unit: string; d: number }> = {
  co2: { label: "탄소 감축량", unit: "tCO₂e", d: 1 },
  mwh: { label: "에너지 절감량", unit: "MWh", d: 1 },
  krw: { label: "절감 금액", unit: "만원", d: 0 },
};

/* 감축 성과 요약 — 기본 모드 첫 화면 (의사결정자용).
   KPI 4장 + 지표를 선택해 보는 월별 추이 + "이 숫자가 어떻게 나왔는지" 산정 기준 카드.
   용어: 기준선→도입 전 사용량, 배출계수→환산 기준. */
export default function SummaryHome() {
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const tariff = useUI((s) => s.tariffValue);
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const openEvidence = useUI((s) => s.openEvidence);
  const { equipment, settings, setSettings } = useEquip();
  const [editTarget, setEditTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(settings.targetCo2H1));
  const [metric, setMetric] = useState<Metric>("co2");

  const activeEquip = equipment.filter(requiredOk);
  const monthly = calc.monthly.map((m) => ({
    ...m,
    co2: m.saveMWh * ef.value,
    mwh: m.saveMWh,
    krw: (m.saveMWh * 1000 * tariff) / 1e4,
  }));
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const momDiff = last && prev ? last.co2 - prev.co2 : 0;
  const achievePct = settings.targetCo2H1 > 0 ? (calc.kpi.co2 / settings.targetCo2H1) * 100 : 0;
  const mm = METRIC_META[metric];

  const saveTarget = () => {
    const v = Number(targetDraft);
    if (Number.isFinite(v) && v > 0) setSettings({ targetCo2H1: Math.round(v * 10) / 10 });
    setEditTarget(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      {/* 헤더 — 제목·기간 선택·갱신 시각 */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="tk-title">감축 성과</h1>
        <div className="flex items-center gap-3">
          <select
            aria-label="기간 선택"
            className="tk-input min-h-10 px-3 text-[13.5px] font-medium"
            defaultValue="2026H1"
          >
            <option value="2026H1">2026년 상반기</option>
            <option value="2026H2" disabled>2026년 하반기 (예정)</option>
          </select>
          <span className="tk-label hidden md:inline">2026-07-02 06:00 갱신</span>
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
        </div>
      </header>

      {/* KPI 4장 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="이번 달 감축량">
          <div className="tk-kpi">{fmt(last?.co2 ?? 0, 1)} <span className="text-[17px] font-medium text-sub">tCO₂e</span></div>
          <p className="tk-label mt-2">
            전월 대비 {momDiff >= 0 ? `${fmt(momDiff, 1)} tCO₂e 더 감축했습니다` : `${fmt(-momDiff, 1)} tCO₂e 줄었습니다`}
          </p>
        </Card>

        <Card title="누적 감축량">
          <div className="tk-kpi">{fmt(calc.kpi.co2, 1)} <span className="text-[17px] font-medium text-sub">tCO₂e</span></div>
          <p className="tk-label mt-2">도입 전 사용량과 비교해 {fmt(calc.kpi.saveMWh)} MWh를 아낀 결과입니다</p>
          {/* 냉매 별도 산정 — 기본 접힘 */}
          <details className="mt-2.5 border-t border-[#f0f2f4] pt-2">
            <summary className="tk-label cursor-pointer select-none">냉매 배출은 따로 계산합니다 ▾</summary>
            <p className="tk-label mt-1.5 leading-relaxed">
              냉매 보충으로 인한 배출 {fmt(mrv.refrigerant.total, 2)} tCO₂e는 위 감축량과 합산하지 않고
              별도 항목으로 보고합니다. 초기 충전은 배출로 계산하지 않습니다.
            </p>
          </details>
        </Card>

        <Card title="절감 금액">
          <div className="tk-kpi">{fmt(calc.kpi.costKrw / 1e4)} <span className="text-[17px] font-medium text-sub">만원</span></div>
          <p className="tk-label mt-2">전기요금 단가 {fmt(tariff)}원/kWh 기준으로 환산한 금액입니다 (데모 단가)</p>
        </Card>

        <Card
          title="목표 대비 달성률"
          action={
            !editTarget && (
              <Btn kind="secondary" small onClick={() => { setTargetDraft(String(settings.targetCo2H1)); setEditTarget(true); }}>
                설정
              </Btn>
            )
          }
        >
          <div className="tk-kpi">{fmt(achievePct, 0)}<span className="text-[17px] font-medium text-sub">%</span></div>
          {editTarget ? (
            <div className="mt-2 flex items-center gap-2">
              <Input value={targetDraft} onChange={setTargetDraft} type="number" placeholder="예: 220" ariaLabel="반기 목표 감축량" width="w-24" />
              <span className="tk-label">tCO₂e</span>
              <Btn small onClick={saveTarget}>저장</Btn>
            </div>
          ) : (
            <p className="tk-label mt-2">반기 목표 {fmt(settings.targetCo2H1)} tCO₂e 기준입니다 (데모 가정값)</p>
          )}
        </Card>
      </div>

      {/* 월별 추이 — 지표를 선택해서 봄 */}
      <Card
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] font-medium text-sub">월별 추이</span>
            <Segment
              ariaLabel="추이 지표 선택"
              options={[
                { key: "co2" as Metric, label: "탄소 (tCO₂e)" },
                { key: "mwh" as Metric, label: "에너지 (MWh)" },
                { key: "krw" as Metric, label: "금액 (만원)" },
              ]}
              value={metric}
              onChange={setMetric}
            />
          </div>
        }
        action={
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${verify.state === "승인 완료" ? "bg-brand/10 text-brand" : "bg-[#f2f4f6] text-sub"}`}>
            {verify.state === "승인 완료" ? "검증 완료" : "검증 진행 중"}
          </span>
        }
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#6b7684" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7684" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                cursor={{ fill: "rgba(15,118,110,0.06)" }}
                formatter={(v) => [`${fmt(Number(v ?? 0), mm.d)} ${mm.unit}`, mm.label]}
                labelStyle={{ fontWeight: 600, color: "#191f28" }}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", fontSize: 13, padding: "10px 14px" }}
              />
              <Bar dataKey={metric} fill="#0f766e" radius={[6, 6, 0, 0]} barSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="tk-label mt-1">
          산정 대상 설비 {activeEquip.length}개 · 모든 수치는 데모용 합성데이터입니다
        </p>
      </Card>

      {/* 산정 기준 — 이 숫자가 어떤 지표·기준으로 나왔는지 */}
      <Card
        title="이 숫자는 이렇게 계산했습니다"
        action={<Btn kind="secondary" small onClick={openEvidence}>산정 근거 보기</Btn>}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
          {(
            [
              ["산정 방식", "도입 전(2025년) 사용량을 그해 날씨(냉방도일)·생산량 조건으로 보정해, 올해 실제 사용량과 같은 조건에서 비교합니다 (IPMVP Option B 준용)"],
              ["도입 전 사용량", `보정 후 ${fmt(calc.kpi.saveMWh + calc.savings.sumAct / 1000)} MWh — 실제 ${fmt(calc.savings.sumAct / 1000)} MWh와의 차이가 절감량입니다`],
              ["환산 기준 (탄소)", `${ef.value} tCO₂/MWh (${ef.version}) — 전력 배출계수, 관리자 모드 기준정보에서 버전 관리`],
              ["환산 기준 (금액)", `전기요금 단가 ${fmt(tariff)}원/kWh (데모 가정 단가)`],
              ["산정 신뢰도", `불확도 ±${fmt(calc.kpi.uncertaintyPct * 100, 1)}% (90% 신뢰수준, 데모 추정) · 산정 사용일 ${calc.kpi.nDays}일 / 제외 ${calc.kpi.nExcluded}일`],
              ["계산버전 · 검증", `${calc.version} · ${verify.state} — 검토자·승인자 승인을 거쳐 확정됩니다`],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-[#f0f2f4] pb-2.5 last:border-0 md:[&:nth-last-child(2)]:border-0">
              <span className="text-[12.5px] font-semibold text-ink">{k}</span>
              <span className="tk-label leading-relaxed">{v}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
