import { mrv, snapshotHash } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 검증 추적성 Drawer — 숫자가 어디서 왔고 어떤 단계로 확정되는지의 경로 */
export default function TraceabilityPanel() {
  const { closeTrace, setMenu, reviewStates } = useUI();
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(reviewStates);
  const q = mrv.quality;

  const steps: Array<{ name: string; detail: string; extra?: string; go?: () => void }> = [
    {
      name: "① 원본 계측데이터",
      detail: `15분 × 15태그 = ${fmt(q.totals.n)}건 · data_origin SYNTHETIC · 스냅샷 #${snapshotHash.slice(0, 6)}`,
      extra: "원천값(rows.v)은 수정하지 않음",
      go: () => setMenu("master"),
    },
    {
      name: "② 품질검증",
      detail: `자동검증 통과 ${(q.totals.validRate * 100).toFixed(2)}% · 결측 ${(q.totals.missRate * 100).toFixed(2)}% · 이슈 5건`,
      extra: "R-01 결측 10% 초과 일 제외 · R-02 물리범위 이상치 제외",
      go: () => setMenu("verify"),
    },
    {
      name: "③ 기준선 모델",
      detail: `${mrv.baseline.version} · CV(RMSE) ${(mrv.baseline.model!.cvRmse * 100).toFixed(1)}% · R² ${mrv.baseline.model!.r2.toFixed(3)}`,
      extra: mrv.baseline.form,
    },
    {
      name: "④ 조정 (비일상적)",
      detail: calc.nrApplied
        .map((n) => `${n.id} ${reviewStates[n.id] ?? n.status}`)
        .join(" · "),
      extra: "승인된 조정만 조정 기준선에 반영",
      go: () => setMenu("verify"),
    },
    {
      name: "⑤ 절감량 계산",
      detail: `${fmt(calc.kpi.saveMWh)} MWh (${(calc.kpi.savePct * 100).toFixed(1)}%) · 불확도 ±${(calc.kpi.uncertaintyPct * 100).toFixed(1)}%`,
      extra: `계산버전 ${calc.version} · 산정 ${calc.kpi.nDays}일 · 제외 ${calc.kpi.nExcluded}일`,
    },
    {
      name: "⑥ 탄소환산",
      detail: `${fmt(calc.kpi.co2, 1)} tCO₂eq = 절감 MWh × ${ef.value} (${ef.version})`,
      extra: "냉매 비산배출은 합산하지 않는 별도 항목",
      go: () => setMenu("master"),
    },
    {
      name: "⑦ 검토·승인",
      detail: `상태 ${verify.state} · 대기 ${verify.pending}건 · 역할 분리(검토자→승인자)`,
      extra: "승인 완료 결과는 수정 불가, 변경 시 새 계산버전",
      go: () => setMenu("verify"),
    },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="검증 추적성">
      <div className="absolute inset-0 bg-navy/30" onClick={closeTrace} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="text-[16px] font-bold text-navy">검증 추적성</div>
            <div className="mt-0.5 text-[12px] text-slate-400">
              원본 계측 → 품질검증 → 기준선 → 조정 → 절감량 → 탄소환산 → 승인
            </div>
          </div>
          <button
            onClick={closeTrace}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-[18px] leading-none text-slate-400 hover:bg-surface hover:text-navy"
          >
            ×
          </button>
        </div>
        <div className="flex-1 px-6 py-5">
          {steps.map((s, i) => (
            <div key={s.name} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
                {i < steps.length - 1 && <span className="w-px flex-1 bg-line" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-navy">{s.name}</span>
                  {s.go && (
                    <button
                      onClick={() => {
                        s.go!();
                        closeTrace();
                      }}
                      className="shrink-0 text-[12px] font-medium text-accent hover:underline"
                    >
                      이동 ›
                    </button>
                  )}
                </div>
                <div className="tnum mt-0.5 text-[12.5px] leading-relaxed text-navy">{s.detail}</div>
                {s.extra && <div className="mt-0.5 text-[11.5px] leading-relaxed text-body">{s.extra}</div>}
              </div>
            </div>
          ))}
          <div className="mt-2 rounded-lg bg-review/8 px-3 py-2 text-[11.5px] leading-relaxed text-body">
            DEMO · 합성데이터 — 본 추적 경로는 데모 산정 체계이며 공식 MRV 보고에 사용할 수 없습니다.
          </div>
        </div>
      </aside>
    </div>
  );
}
