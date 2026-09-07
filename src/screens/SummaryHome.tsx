import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCalc } from "../lib/useCalc";
import { mrv } from "../lib/mrvData";
import { useUI, activeEf, deriveVerify } from "../store";
import { useEquip, requiredOk } from "../config/equipmentStore";
import { Btn, Card, Input } from "../components/ui";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 감축 성과 요약 — 기본 모드 첫 화면 (의사결정자용).
   "MRV로 무엇을 얻는가"를 KPI 4장과 추이 1개로 보여줌. 용어: 기준선→도입 전 사용량, 배출계수→환산 기준. */
export default function SummaryHome() {
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const { equipment, settings, setSettings } = useEquip();
  const [editTarget, setEditTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(settings.targetCo2H1));

  const activeEquip = equipment.filter(requiredOk);
  const monthly = calc.monthly.map((m) => ({ ...m, co2: m.saveMWh * ef.value }));
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const momDiff = last && prev ? last.co2 - prev.co2 : 0;
  const achievePct = settings.targetCo2H1 > 0 ? (calc.kpi.co2 / settings.targetCo2H1) * 100 : 0;

  const saveTarget = () => {
    const v = Number(targetDraft);
    if (Number.isFinite(v) && v > 0) setSettings({ targetCo2H1: Math.round(v * 10) / 10 });
    setEditTarget(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      {/* 헤더 — 제목·기간 선택·갱신 시각 3요소만 */}
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
          <p className="tk-label mt-2">전기요금 기준으로 환산한 금액입니다 (데모 단가)</p>
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

      {/* 월별 감축 추이 — 전폭 그래프 1개 */}
      <Card
        title={
          <span>
            월별 감축 추이 <span className="tk-label">tCO₂e · 도입 전 사용량과의 차이를 환산 기준({ef.value} tCO₂/MWh)으로 환산</span>
          </span>
        }
        action={
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${verify.state === "승인 완료" ? "bg-brand/10 text-brand" : "bg-[#f2f4f6] text-sub"}`}>
            {verify.state === "승인 완료" ? "검증 완료" : `검증 진행 중`}
          </span>
        }
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#6b7684" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7684" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "rgba(15,118,110,0.06)" }}
                formatter={(v) => [`${fmt(Number(v ?? 0), 1)} tCO₂e`, "감축량"]}
                labelStyle={{ fontWeight: 600, color: "#191f28" }}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", fontSize: 13, padding: "10px 14px" }}
              />
              <Bar dataKey="co2" fill="#0f766e" radius={[6, 6, 0, 0]} barSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="tk-label mt-1">
          산정 대상 설비 {activeEquip.length}개 · 계산버전 {calc.version} · 모든 수치는 데모용 합성데이터입니다
        </p>
      </Card>
    </div>
  );
}
