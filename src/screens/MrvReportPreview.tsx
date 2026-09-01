import { mrv, mvPlan, baselineStats, evidenceRegistry, type NonRoutine } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

/* MRV 성과보고서 A4 양식.
   mode="live"     — 중앙 냉수플랜트: 산정 엔진 결과로 전 항목 자동 작성
   mode="template" — 보일러 폐열회수(개시 전): 동일 양식에 계획값만 채워 확장성을 보여줌 */
export default function MrvReportPreview({ mode }: { mode: "live" | "template" }) {
  const live = mode === "live";
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const tariff = useUI((s) => s.tariffValue);
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const model = mrv.baseline.model as { a: number; b: number; c: number; n: number; r2: number; cvRmse: number } | null;

  /* 프로젝트별로 달라지는 값 — 양식(섹션 구조)은 동일 */
  const P = live
    ? {
        docNo: "MRV-RPT-2026H1-01",
        project: "중앙 냉수플랜트 효율개선 성과검증",
        projectId: "MVP-2026-01",
        period: "2026.01.01 – 2026.06.30 (6개월)",
        version: `${calc.version} · 기준선 BL-v1.0`,
        state: verify.state,
        boundary: mvPlan.boundary,
        equipment: mvPlan.equipment,
        measure: "냉동기 1 고효율 교체(CH-01→CH-01R) · 냉수펌프 VFD · 냉각탑 제어 최적화",
        startDate: "2026-01-01",
        option: mvPlan.option,
        basePeriod: mvPlan.baselinePeriod,
        dependent: mvPlan.dependent,
        independent: mvPlan.independent,
        modelForm: mvPlan.modelForm,
      }
    : {
        docNo: "MRV-RPT-(개시 후 부여)",
        project: "보일러 폐열회수 개선 성과검증",
        projectId: "MVP-2026-02 (계획)",
        period: "개시 후 12개월 (예정)",
        version: "계산버전 — 개시 후 생성",
        state: "프로젝트 개시 전",
        boundary: "보일러·스팀 (LNG 사용량 경계)",
        equipment: "보일러 1·2호기 · 절탄기(폐열회수) 신설 예정",
        measure: "배기가스 폐열회수 절탄기 설치 · 급수 예열로 LNG 사용량 절감",
        startDate: "미정 (데이터 연계 보완 후)",
        option: "IPMVP Option B 후보 (가스미터 3점 경계 계측)",
        basePeriod: "2025.07 – 2026.06 (12개월, 계획)",
        dependent: "일 LNG 사용량 (Nm³/일)",
        independent: "난방도일(기준 18℃) · 스팀 생산량(ton/일)",
        modelForm: "Nm³/일 = a + b × 난방도일 + c × 스팀 생산량 (OLS, 계획)",
      };

  const na = <span className="text-slate-400">개시 후 자동 산정</span>;

  return (
    <>
      {/* 상단 액션 (인쇄 시 숨김) */}
      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-body">
          {live
            ? `A4 인쇄용 M&V 성과보고서 · ${verify.state === "승인 완료" ? "승인 완료 버전" : `현재 ${verify.state} — 승인 전 초안`}`
            : "양식 미리보기 — 프로젝트 개시 후 동일 양식으로 자동 작성됩니다 (값은 계획 정보만 표시)"}
        </span>
        {live ? (
          <button onClick={() => window.print()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
            PDF 인쇄·저장
          </button>
        ) : (
          <span className="rounded bg-review/10 px-2 py-1 text-[11px] font-bold text-review">개시 전 — 출력 불가</span>
        )}
      </div>

      <div className={`${live ? "print-root" : ""} mx-auto w-full max-w-[800px] rounded-[10px] border border-line/60 bg-white p-10 text-[13px] leading-relaxed text-navy shadow-sm`}>
        {/* 표지 */}
        <div className="relative border-b-2 border-navy pb-6 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-18deg] text-[38px] font-black tracking-widest text-review/10 select-none">
              {live ? "DEMO · 합성데이터" : "양식 미리보기"}
            </span>
          </div>
          <div className="text-[12px] tracking-widest text-slate-400">IPMVP 기반 M&V 보고서 (데모 요약본)</div>
          <div className="mt-2 text-[24px] font-bold">에너지 절감성과 검증(M&V) 보고서</div>
          <div className="mt-1 text-[14px]">{P.project} · 원주공장</div>
          <div className="tnum mt-3 text-[12px] text-body">
            문서번호 {P.docNo} · 프로젝트 {P.projectId} · {P.version} · 상태 {P.state}
          </div>
          <div className="mt-2 text-[11.5px] text-review">
            본 자료는 데모용 합성데이터로 작성된 테스트 출력물이며, 공식 MRV 보고 또는 제3자 검증 자료로 사용할 수 없습니다.
          </div>
        </div>

        {/* 1. 사업 개요 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">1. 사업 개요</h3>
        <table className="tnum w-full border-t border-navy text-[12.5px]">
          <tbody>
            {(
              [
                ["사업장 / 측정경계", `원주공장 / ${P.boundary}`],
                ["대상 설비", P.equipment],
                ["개선 내용", P.measure],
                ["개선 설비 가동일", P.startDate],
                ["보고기간", P.period],
                ["M&V 방식", P.option],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <tr key={k} className="border-b border-line">
                <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                <td className="px-2.5 py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 2. 기준선 모델 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">2. 기준선 모델 및 조정 방법</h3>
        <table className="tnum w-full border-t border-navy text-[12.5px]">
          <tbody>
            {(
              [
                ["기준기간", P.basePeriod],
                ["종속변수", P.dependent],
                ["독립변수 (일상적 조정)", P.independent],
                ["모델식", P.modelForm],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <tr key={k} className="border-b border-line">
                <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                <td className="px-2.5 py-1.5">{v}</td>
              </tr>
            ))}
            <tr className="border-b border-line">
              <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">모델 적합도</td>
              <td className="px-2.5 py-1.5">
                {live && model ? (
                  <>R² {model.r2.toFixed(3)} · CV(RMSE) {pct(model.cvRmse)} · NMBE {pct(baselineStats.nmbe, 2)} · 학습 {model.n}일 — 내부 기준(R² ≥ 0.75 · CV ≤ 25%) 충족</>
                ) : na}
              </td>
            </tr>
            <tr className="border-b border-line">
              <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">비일상적 조정</td>
              <td className="px-2.5 py-1.5">{live ? "사유·기간·조정량 등록 후 승인된 건만 반영 (4절)" : "동일 규칙 적용 예정"}</td>
            </tr>
          </tbody>
        </table>

        {/* 3. 월별 성과 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">3. 월별 절감성과</h3>
        {live ? (
          <>
            <table className="tnum w-full border-t border-navy text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-body">
                  <th className="px-2.5 py-1.5 text-left font-medium">월</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">조정 기준선 (MWh)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">실제 (MWh)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">절감 (MWh)</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">절감률</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">제외일</th>
                </tr>
              </thead>
              <tbody>
                {calc.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-line">
                    <td className="px-2.5 py-1.5">{m.label}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.baseMWh, 1)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(m.actMWh, 1)}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold text-teal">{fmt(m.saveMWh, 1)}</td>
                    <td className="px-2.5 py-1.5 text-right">{pct(m.saveMWh / m.baseMWh)}</td>
                    <td className="px-2.5 py-1.5 text-right">{m.nExcluded}</td>
                  </tr>
                ))}
                <tr className="border-b border-line font-semibold">
                  <td className="px-2.5 py-1.5">합계</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(calc.kpi.saveMWh + calc.savings.sumAct / 1000, 1)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(calc.savings.sumAct / 1000, 1)}</td>
                  <td className="px-2.5 py-1.5 text-right text-teal">{fmt(calc.kpi.saveMWh, 1)}</td>
                  <td className="px-2.5 py-1.5 text-right">{pct(calc.kpi.savePct)}</td>
                  <td className="px-2.5 py-1.5 text-right">{calc.kpi.nExcluded}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11.5px] text-body">
              주) 사용일 {calc.kpi.nDays}일 · 제외 {calc.kpi.nExcluded}일(정비 11일·통신장애 1일, 규칙 R-01) · 절감량 불확도 90% 신뢰수준 ±{pct(calc.kpi.uncertaintyPct)}
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-slate-400">
            보고기간 개시 후 월별 조정 기준선 · 실제 · 절감량이 이 표에 자동 집계됩니다
            <br />(냉수플랜트 보고서와 동일한 산정 파이프라인 재사용)
          </div>
        )}

        {/* 4. 비일상적 조정·제외 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">4. 비일상적 조정 및 제외 내역</h3>
        {live ? (
          <table className="tnum w-full border-t border-navy text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-body">
                <th className="px-2.5 py-1.5 text-left font-medium">ID · 내용</th>
                <th className="px-2.5 py-1.5 text-left font-medium">기간</th>
                <th className="px-2.5 py-1.5 text-right font-medium">조정량</th>
                <th className="px-2.5 py-1.5 text-left font-medium">상태 · 승인자</th>
              </tr>
            </thead>
            <tbody>
              {(calc.nrApplied as NonRoutine[]).map((n) => (
                <tr key={n.id} className="border-b border-line">
                  <td className="px-2.5 py-1.5">{n.id} {n.title}</td>
                  <td className="px-2.5 py-1.5">{n.start} ~ {n.end}</td>
                  <td className="px-2.5 py-1.5 text-right">{n.kwhAdj !== 0 ? `${fmt(n.kwhAdj)} ${n.unit}` : "산정 제외"}</td>
                  <td className="px-2.5 py-1.5">{n.status}{n.status === "승인 완료" ? ` · ${n.approver}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[12.5px] text-slate-400">개시 후 등록·승인된 조정 건이 이 표에 자동 반영됩니다.</p>
        )}

        {/* 5. 온실가스·비용 환산 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">5. 온실가스 감축량 및 비용 절감</h3>
        {live ? (
          <p>
            전력 절감량 <b>{fmt(calc.kpi.saveMWh)} MWh</b>에 배출계수 {ef.version}({ef.value} tCO₂eq/MWh, 기준연도 {ef.baseYear})을 적용한
            온실가스 감축량은 <b>{fmt(calc.kpi.co2, 1)} tCO₂eq</b>이며, 가정단가 {fmt(tariff)} 원/kWh 기준 비용 절감은{" "}
            <b>{fmt(calc.kpi.costKrw / 1e6, 1)} 백만원</b>이다. 배출계수·단가 변경 시 새 계산버전으로 재산정된다.
          </p>
        ) : (
          <p className="text-[12.5px]">
            LNG 절감량(Nm³)에 연료 배출계수를 적용해 감축량을 산정할 예정 — {na}
          </p>
        )}

        {/* 6. 냉매 별도 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">6. 냉매 비산배출 (절감량과 미합산 · 별도 표기)</h3>
        {live ? (
          <p>
            보고기간 냉매 보충 기반 비산배출은 <b>{fmt(mrv.refrigerant.total, 2)} tCO₂eq</b>(R-134a 보충 9 kg × GWP 1,430)로,
            전력 감축성과와 합산하지 않고 별도 항목으로 보고한다. CH-01R 초기 충전(R-1233zd(E))은 배출로 산정하지 않는다.
          </p>
        ) : (
          <p className="text-[12.5px] text-slate-400">해당 없음 (연소설비) — 양식 항목은 프로젝트 특성에 따라 자동 구성됩니다.</p>
        )}

        {/* 7. 데이터 품질 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">7. 데이터 품질</h3>
        {live ? (
          <p>
            수집률 {pct(mrv.kpi.collectRate)} · 정상률 {pct(mrv.kpi.trustRate)} · 결측률 {pct(mrv.kpi.missRate)} · 추정률 {pct(mrv.kpi.estRate, 2)}.
            추정 구간은 ESTIMATED 라벨로 구분되며 원천값은 수정 없이 보존된다. 유량계(FM-CHW) 교정 만료 1건은 열량 KPI에 한정되고
            전력 절감량 산정에는 영향이 없다.
          </p>
        ) : (
          <p className="text-[12.5px]">
            가스미터 GM-01·02 연계 완료, GM-03 연계 진행 중 — 3점 연계 완료 시 15분 자동수집으로 동일 품질 규칙(상태코드 7종)이 적용됩니다.
          </p>
        )}

        {/* 8. 증빙 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">8. 증빙자료 목록</h3>
        {live ? (
          <table className="tnum w-full border-t border-navy text-[12.5px]">
            <tbody>
              {evidenceRegistry.map((e) => (
                <tr key={e.id} className="border-b border-line">
                  <td className="w-28 px-2.5 py-1">{e.id}</td>
                  <td className="px-2.5 py-1">{e.type} — {e.target}</td>
                  <td className="w-32 px-2.5 py-1 text-right text-body">{e.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[12.5px] text-slate-400">M&V 계획서·교정성적서·정비기록이 증적 레지스트리에 등록되는 대로 자동 연결됩니다.</p>
        )}

        {/* 9. 승인 */}
        <h3 className="mt-6 mb-2 text-[15px] font-bold">9. 검증·승인 정보</h3>
        <table className="tnum w-full border-t border-navy text-[12.5px]">
          <tbody>
            {(
              [
                ["계산 버전", live ? calc.version : "개시 후 생성"],
                ["배출계수", live ? `${ef.version} (${ef.value} ${ef.unit})` : "적용 계수 확정 전"],
                ["검증 상태", P.state],
                ["검토자 / 승인자", "MRV 검토자(데모) / MRV 승인자(데모)"],
                ["M&V 계획", live ? `${mvPlan.id} ${mvPlan.version}` : "MVP-2026-02 초안 작성 예정"],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <tr key={k} className="border-b border-line">
                <td className="w-40 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
                <td className="px-2.5 py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 text-center text-[11.5px] text-review">
          DEMO · 합성데이터 — 본 보고서는 테스트 출력물이며 공식 MRV 보고 또는 제3자 검증 자료로 사용할 수 없습니다.
        </div>
      </div>
    </>
  );
}
