import { mrv, baselineStats } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[12px] text-slate-400">{label}</span>
      <span className="text-right text-[12px] font-medium text-navy">{value}</span>
    </div>
  );
}

/* 산정근거 슬라이드 패널 (v2.1 §4.1) — 기술 통계·모델식은 여기서만 노출 */
export default function EvidencePanel() {
  const { closeEvidence, setMenu, reviewStates } = useUI();
  const calc = useCalc();
  const EF = activeEf(useUI((s) => s.efList));
  const verify = deriveVerify(reviewStates);
  const m = mrv.baseline.model;
  if (!m) return null; // OLS 실패 시(합성데이터에서는 발생하지 않음) 패널 미표시
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="산정근거">
      <div className="absolute inset-0 bg-navy/30" onClick={closeEvidence} />
      <aside className="absolute inset-y-0 right-0 flex w-[420px] flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="text-[16px] font-bold text-navy">산정근거</div>
            <div className="mt-0.5 text-[11px] text-slate-400">DEMO · 합성데이터 — 공식 MRV 사용 불가</div>
          </div>
          <button
            onClick={closeEvidence}
            aria-label="닫기"
            className="rounded-lg px-2 py-1 text-[18px] leading-none text-slate-400 hover:bg-surface hover:text-navy"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-navy">기준선 모델</h3>
            <div className="rounded-xl bg-surface px-4 py-3">
              <div className="text-[12px] leading-relaxed text-slate-500">{mrv.baseline.form}</div>
              <div className="mt-2 border-t border-line pt-2">
                <Row label="모델 버전" value={mrv.baseline.version} />
                <Row
                  label="기준기간"
                  value={`${mrv.cfg.baselineStart} ~ ${mrv.cfg.baselineEnd}`}
                />
                <Row label="학습 일수" value={`${mrv.baseline.nDays}일 (제외 ${mrv.baseline.excludedDays.length}일)`} />
                <Row label="R²" value={fmt(m.r2, 3)} />
                <Row label="CV(RMSE)" value={`${fmt(m.cvRmse * 100, 1)}%`} />
                <Row label="NMBE (잔차 편향)" value={`${fmt(baselineStats.nmbe * 100, 2)}% (편향 없음)`} />
                <Row
                  label="학습/제외 데이터"
                  value={`${baselineStats.nTrain}일 / ${baselineStats.nExclTrain}일`}
                />
                <Row
                  label="모델 적용범위"
                  value={`냉방도일 ${fmt(baselineStats.cddRange[0], 1)}~${fmt(baselineStats.cddRange[1], 1)} · 생산 ${fmt(baselineStats.prodRange[0])}~${fmt(baselineStats.prodRange[1])} ton`}
                />
                <Row
                  label="보고기간 범위 이탈"
                  value={baselineStats.outOfRangeDays === 0 ? "없음 (외삽 미사용)" : `${baselineStats.outOfRangeDays}일 (외삽 주의)`}
                />
                <Row label="판정" value={mrv.baseline.pass ? "기준 충족" : "기준 미충족"} />
                <div className="mt-1 text-[11px] leading-relaxed text-slate-400">{mrv.baseline.criteria}</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-navy">보고기간 산정</h3>
            <div className="rounded-xl bg-surface px-4 py-3">
              <Row label="보고기간" value={`${mrv.cfg.reportStart} ~ ${mrv.cfg.reportEnd}`} />
              <Row label="산정 일수" value={`${mrv.kpi.nDays}일`} />
              <Row label="제외 일수" value={`${calc.kpi.nExcluded}일 (정비·통신장애)`} />
              <Row label="추정 적용 비율" value={`${fmt(mrv.savings.estShare * 100, 1)}%`} />
              <Row
                label="비일상적 조정"
                value={calc.nrApplied
                  .map((n) => `${n.id} ${reviewStates[n.id] ?? n.status}`)
                  .join(" · ")}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-navy">배출계수</h3>
            <div className="rounded-xl bg-surface px-4 py-3">
              <Row label="값" value={`${EF.value} ${EF.unit}`} />
              <Row label="버전 · 상태" value={`${EF.version} · ${EF.status}`} />
              <Row label="기준연도" value={String(EF.baseYear)} />
              <Row label="출처" value={EF.source} />
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-navy">계산버전 · 승인</h3>
            <div className="rounded-xl bg-surface px-4 py-3">
              <Row label="계산버전" value={calc.version} />
              <Row label="검증 상태" value={verify.state} />
              <Row label="승인자" value={verify.state === "승인 완료" ? "MRV 담당자(데모)" : "— (승인 전)"} />
              <Row label="데이터 출처" value="SYNTHETIC (합성)" />
              <Row label="생성 seed" value={String(mrv.meta.seed)} />
            </div>
          </section>
        </div>

        <div className="border-t border-line px-6 py-4">
          <button
            onClick={() => {
              setMenu("verify");
              closeEvidence();
            }}
            className="w-full rounded-lg bg-accent py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            전체 상세로 이동 (데이터·검증)
          </button>
        </div>
      </aside>
    </div>
  );
}
