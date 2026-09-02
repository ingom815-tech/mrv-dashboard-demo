import { mrv, mvPlan, baselineStats, evidenceRegistry, type NonRoutine } from "../lib/mrvData";
import { meterPlan, qaqcRoles } from "../lib/inventoryData";
import {
  TOE_PER_MWH,
  ipmvpMatrix,
  iso50006Matrix,
  matrixSummary,
  ecmList,
  mvRequirements,
  dataCollection,
  type ComplyRow,
} from "../lib/standardsData";
import { useCalc } from "../lib/useCalc";
import { useUI, deriveVerify, activeEf } from "../store";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${fmt(n * 100, d)}%`;

/* ---------- 공용 서브컴포넌트 ---------- */
function H({ n, t, form }: { n: string; t: string; form?: string }) {
  return (
    <h3 className="mt-6 mb-2 text-[15px] font-bold">
      {n}. {t} {form && <span className="text-[11px] font-normal text-slate-400">{form}</span>}
    </h3>
  );
}
function KV({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="tnum w-full border-t border-navy text-[12.5px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-line">
            <td className="w-44 bg-surface/70 px-2.5 py-1.5 text-body">{k}</td>
            <td className="px-2.5 py-1.5">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function T({ head, rows, right }: { head: string[]; rows: Array<Array<string | number>>; right?: number[] }) {
  return (
    <table className="tnum w-full border-t border-navy text-[12.5px]">
      <thead>
        <tr className="border-b border-line bg-surface/70 text-body">
          {head.map((h, i) => (
            <th key={h} className={`px-2.5 py-1.5 font-medium ${right?.includes(i) ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-line">
            {r.map((c, ci) => (
              <td key={ci} className={`px-2.5 py-1.5 ${right?.includes(ci) ? "text-right" : ""}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* 표준 정합성 매트릭스 패널 (화면 전용) */
function MatrixPanel({ title, rows }: { title: string; rows: ComplyRow[] }) {
  const s = matrixSummary(rows);
  return (
    <details className="no-print rounded-[10px] border border-line/60 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px] font-semibold text-navy">
        {title}
        <span className="tnum flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded bg-teal/10 px-1.5 py-0.5 text-teal">구현 {s.ok}</span>
          <span className="rounded bg-review/10 px-1.5 py-0.5 text-review">부분 {s.partial}</span>
          <span className="rounded bg-line px-1.5 py-0.5 text-body">향후 {s.todo}</span>
        </span>
        <span className="ml-auto text-[12px] font-normal text-slate-400">조항별 확인 ▾</span>
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
            {rows.map((r) => (
              <tr key={r.clause + r.title} className={`border-b border-line/40 last:border-0 ${r.status === "향후" ? "text-slate-400" : ""}`}>
                <td className="py-1.5 font-semibold whitespace-nowrap text-navy">{r.clause}</td>
                <td className="wrap max-w-56 py-1.5 font-medium">{r.title}</td>
                <td className="py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                    r.status === "구현" ? "bg-teal/10 text-teal" : r.status === "부분" ? "bg-review/10 text-review" : "bg-line text-body"
                  }`}>{r.status}</span>
                </td>
                <td className="wrap py-1.5">{r.impl}{r.note && <div className="text-[11.5px] text-slate-400">{r.note}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* M&V 계획서(14절)·결과보고서(10절) — ESCO 표준계약 M&V 양식 절 구조를 그대로 따르는 A4 문서.
   mode="plan"     — M&V 계획서: 산정 방법의 사전 정의 (베이스라인·조정·계측·품질보증)
   mode="report"   — M&V 결과보고서: 보고기간 실적 (월별 사용량·절감량(액)·정확도·검토의견)
   mode="template" — 보일러 프로젝트(개시 전): 동일 양식 재사용 확장 데모 */
export default function MrvReportPreview({ mode }: { mode: "plan" | "report" | "template" }) {
  const calc = useCalc();
  const ef = activeEf(useUI((s) => s.efList));
  const tariff = useUI((s) => s.tariffValue);
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const audit = useUI((s) => s.audit);
  const model = mrv.baseline.model as { a: number; b: number; c: number; n: number; r2: number; cvRmse: number; yMean: number } | null;

  const saveToe = calc.kpi.saveMWh * TOE_PER_MWH;
  const actMWh = calc.savings.sumAct / 1000;
  const annualBaseMWh = model ? (model.yMean * model.n) / 1000 : 0; // 기준기간(2025) 총 사용량 근사
  const contrib = (calc.savings.contrib ?? []) as Array<{ key: string; label: string; before: number; after: number }>;
  const lastOpinion = audit.find((a) => a.target === "명세서" || a.action.includes("검토") || a.action.includes("승인"));

  /* 문서 머리 정보 — 프로젝트별 */
  const isTpl = mode === "template";
  const docTitle = mode === "plan" ? "M&V 계획서" : "M&V 결과보고서";
  const P = isTpl
    ? { project: "보일러 폐열회수 개선", id: "MVP-2026-02 (계획)", state: "프로젝트 개시 전", ver: "개시 후 생성" }
    : { project: "중앙 냉수플랜트 효율개선", id: mvPlan.id, state: mode === "plan" ? mvPlan.status : verify.state, ver: mode === "plan" ? `${mvPlan.version} · 기준선 BL-v1.0` : `${calc.version} · BL-v1.0` };

  const na = <span className="text-slate-400">개시 후 자동 산정</span>;

  /* 공용 표 데이터 */
  const savingTable = (
    <T
      head={["구분", "에너지절감량", "에너지절감액 (천원)", "절감율 (%)", "비고"]}
      right={[1, 2, 3]}
      rows={[
        ["전기", `${fmt(saveToe, 1)} toe/년 (${fmt(calc.kpi.saveMWh)} MWh)`, fmt(calc.kpi.costKrw / 1000), pct(calc.kpi.savePct), "보고기간 6개월 실적"],
        ["열", "해당 없음", "—", "—", "외부 열 미사용"],
        ["합계", `${fmt(saveToe, 1)} toe`, fmt(calc.kpi.costKrw / 1000), pct(calc.kpi.savePct), `온실가스 ${fmt(calc.kpi.co2, 1)} tCO₂eq 별도`],
      ]}
    />
  );
  const facilityTable = (
    <T
      head={["번호", "설비명", `전력 사용량 (${mode === "plan" ? "기준기간 일평균" : "보고기간 일평균"} kWh)`, "toe/년 환산"]}
      right={[2, 3]}
      rows={contrib.map((c, i) => {
        const v = mode === "plan" ? c.before : c.after;
        return [i + 1, c.label, fmt(v), fmt((v * 365 * TOE_PER_MWH) / 1000, 1)];
      })}
    />
  );
  const meterTable = (
    <T
      head={["번호", "측정기기", "제조사(데모)", "활용 목적", "정밀도", "교정 유효"]}
      rows={meterPlan.filter((m) => m.kind !== "수기").map((m, i) => [i + 1, m.meter, "계측기 제조사(데모)", m.point, m.spec, m.calibDue])}
    />
  );
  const collectionTables = (
    <>
      <div className="mt-2 mb-1 text-[13px] font-semibold">데이터 수집·측정 방법</div>
      <T head={["주요인자", "자료 출처·수집", "측정·검증"]} rows={dataCollection.map((r) => [...r])} />
    </>
  );
  const regressionBlock = (
    <KV
      rows={[
        ["분석모형", "회귀분석 (OLS)"],
        ["회귀방정식", "y = a₀ + a₁x₁ + a₂x₂ (y: kWh/일, x₁: 냉방도일, x₂: 생산량)"],
        ["적합도", model ? `R² ${model.r2.toFixed(3)} (기준 ≥ 0.75) · CV(RMSE) ${pct(model.cvRmse)} (양식 기준 ≤ 20% · 데모 내부 기준 ≤ 25%) · NMBE ${pct(baselineStats.nmbe, 2)}` : "—"],
        ["산출식", "에너지절감량 = 조정 베이스라인 사용량 − 보고기간 사용량 ± 승인된 비일상 조정량"],
      ]}
    />
  );

  return (
    <>
      {/* 상단: 표준 정합성 (계획서 탭에서만) + 액션 */}
      {mode === "plan" && (
        <>
          <MatrixPanel title="IPMVP Core Concepts 2022 정합성 — 기능명세서 대비" rows={ipmvpMatrix} />
          <MatrixPanel title="ISO 50006:2023 정합성 — 에너지성과 산정 기능명세서 대비" rows={iso50006Matrix} />
        </>
      )}
      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-body">
          {isTpl
            ? "양식 미리보기 — 프로젝트 개시 후 동일 양식으로 자동 작성됩니다"
            : mode === "plan"
              ? "ESCO 표준계약 M&V 계획서 양식(14절) 기준 — 시스템 기준정보·산정 설정에서 자동 작성"
              : `ESCO 표준계약 M&V 결과보고서 양식(10절) 기준 · ${verify.state === "승인 완료" ? "승인 완료 버전" : `${verify.state} — 승인 전 초안`}`}
        </span>
        {!isTpl ? (
          <button onClick={() => window.print()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
            PDF 인쇄·저장
          </button>
        ) : (
          <span className="rounded bg-review/10 px-2 py-1 text-[11px] font-bold text-review">개시 전 — 출력 불가</span>
        )}
      </div>

      <div className={`${!isTpl ? "print-root" : ""} mx-auto w-full max-w-[800px] rounded-[10px] border border-line/60 bg-white p-10 text-[13px] leading-relaxed text-navy shadow-sm`}>
        {/* 표지 */}
        <div className="relative border-b-2 border-navy pb-6 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-18deg] text-[38px] font-black tracking-widest text-review/10 select-none">
              {isTpl ? "양식 미리보기" : "DEMO · 합성데이터"}
            </span>
          </div>
          <div className="text-[12px] tracking-widest text-slate-400">ESCO 표준계약 M&V 양식 준용 · IPMVP Core Concepts 2022 (데모 요약본)</div>
          <div className="mt-2 text-[24px] font-bold">{docTitle}</div>
          <div className="mt-1 text-[14px]">{P.project} · 원주공장</div>
          <div className="tnum mt-3 text-[12px] text-body">프로젝트 {P.id} · {P.ver} · 상태 {P.state}</div>
          <div className="mt-2 text-[11.5px] text-review">
            본 자료는 데모용 합성데이터로 작성된 테스트 출력물이며, 공식 M&V 보고 또는 제3자 검증 자료로 사용할 수 없습니다.
          </div>
        </div>

        {/* ============ M&V 계획서 (양식 14절) ============ */}
        {mode === "plan" && (
          <>
            <H n="1" t="개요" form="1.1 사업개요 · 1.2 시설 개요" />
            <p className="mb-2">
              본 사업은 원주공장 중앙 냉수플랜트의 에너지효율 개선(냉동기 교체·펌프 VFD·냉각탑 제어)에 따른
              에너지 절감성과를 계측 기반으로 산정·검증하는 것을 목적으로 한다 (공동진단 제안 기반 데모).
            </p>
            <div className="mb-1 text-[13px] font-semibold">제시 에너지절감량(액) — 연간 목표(데모 가정)</div>
            {savingTable}
            <div className="mt-2 mb-1 text-[13px] font-semibold">시설 현황 (기준기간 2025)</div>
            {facilityTable}
            <p className="mt-1 text-[11.5px] text-body">주) 기준기간 연간 총 사용량 근사 {fmt(annualBaseMWh)} MWh ({fmt(annualBaseMWh * TOE_PER_MWH, 1)} toe) · toe 환산 0.229 toe/MWh (데모)</p>

            <H n="2" t="에너지효율개선 기술 적용" form="2.1 ECM 개요 · 2.2 적용 범위" />
            <T head={["번호", "설비명", "ECM (에너지절약방법)", "절감 요소"]} rows={ecmList.map((e) => [e.no, e.asset, e.ecm, e.saveFactor])} />
            <p className="mt-1 text-[12.5px]">적용 범위: 중앙 냉수플랜트 전체 (냉동기 2대·냉수/냉각수 펌프·냉각탑) — 개념도는 설비·연계 관리의 시스템 경계 화면으로 갈음(데모).</p>

            <H n="3" t="M&V 옵션 및 측정경계" />
            <KV
              rows={[
                ["적용 옵션", mvPlan.option],
                ["측정경계", mvPlan.boundary],
                ["옵션 선택 이유", "경계 내 전 전력을 15분 주기로 직접 계측 가능, ECM이 복수 설비에 걸쳐 있어 개별 분리(A)보다 경계 전체 계측(B)이 적합"],
                ["상호작용 효과", "경계 외부 영향(공조 부하 변화 등)은 독립변수(냉방도일·생산량)로 통제 — 잔여 상호작용은 무시 가능 수준으로 판단(데모)"],
              ]}
            />

            <H n="4" t="베이스라인 설정" form="4.1 기간·사용량 · 4.2 주요인자 · 4.3 운용조건 · 4.4 측정·수집" />
            <KV
              rows={[
                ["베이스라인 기간", `${mvPlan.baselinePeriod} — 사용일 ${model?.n ?? "—"}일 (제외 ${baselineStats.nExclTrain}일)`],
                ["연간 에너지사용량", `전력 ${fmt(annualBaseMWh)} MWh (근사) · 월별 상세는 시스템 데이터 조회`],
                ["주요인자", `${mvPlan.independent} — 냉방도일 ${Number((baselineStats.cddRange as number[])[0]).toFixed(1)}~${Number((baselineStats.cddRange as number[])[1]).toFixed(1)} ℃·day · 생산량 ${Number((baselineStats.prodRange as number[])[0]).toFixed(0)}~${Number((baselineStats.prodRange as number[])[1]).toFixed(0)} ton/일`],
                ["운용조건", "냉수 공급 7℃ · 2대 운전 체계 · 주간 생산 중심 (기준기간 조건으로 기록·보존)"],
              ]}
            />
            {collectionTables}

            <H n="5" t="보고기간" form="5.1 설정 · 5.2 데이터 수집" />
            <KV
              rows={[
                ["보고기간", `${mvPlan.reportPeriod} (반기) · 보고서 제출: 반기 종료 후 10일 이내(데모 가정)`],
                ["데이터 수집", "베이스라인 기간과 동일한 계측·수집·품질 규칙 적용 (15분 자동수집·상태코드 7종)"],
              ]}
            />

            <H n="6" t="조정근거" form="6.1 조정 이유 · 6.2 조정방법" />
            <p className="mb-2">
              일상적 변동(기상·생산량)은 회귀모델로 자동 조정하고, 운용조건 변경(냉수 공급온도 조정 등)은
              비일상적 조정으로 등록해 승인된 건만 반영한다.
            </p>
            {regressionBlock}

            <H n="7" t="계산방법론 및 분석절차" form="7.1 절감량 계산 · 7.2 분석절차 (샘플링·불확도 포함)" />
            <KV
              rows={[
                ["산정 방식", "Avoided Energy Consumption — 조정 베이스라인 − 실제 (IPMVP 7.5.1)"],
                ["제외 규칙", mvPlan.exclusionRule],
                ["샘플링", "해당 없음 — 경계 내 전수 계측 (Option B)"],
                ["불확도", `${mvPlan.uncertainty}`],
              ]}
            />

            <H n="8" t="에너지가격" />
            <T head={["구분", "베이스라인", "보고기간", "비고"]} rows={[["전기 (원/kWh)", fmt(tariff), `${fmt(tariff)} (고정 가정)`, "가정단가 · 부가세 포함 가정(데모)"], ["열", "해당 없음", "—", "외부 열 미사용"]]} />

            <H n="9" t="측정기기 사양 및 데이터 관리" form="9.1 사양 · 9.2 데이터 관리" />
            {meterTable}
            <KV
              rows={[
                ["교정 관리", "교정성적서 증적 등록 (EV-2026-011) · 만료 시 자동 검증 이슈 생성 (DQ-04)"],
                ["데이터 소실 대처", "게이트웨이 Store & Forward · 일 결측 10% 초과 시 산정 제외(R-01) · 10% 이하 비례 추정(라벨 유지)"],
                ["데이터 이전·보존", "원본값 수정 없이 보존 (data_origin 기록) · 정제·계산값은 별도 관리 · 계산버전별 보존"],
              ]}
            />

            <H n="10" t="모니터링 책임" />
            <T head={["담당", "역할", "모니터링 대상·업무"]} rows={qaqcRoles.map(([a, b, c]) => [a, b, c])} />

            <H n="11" t="예상정확도" />
            <p>
              측정·수집·분석을 종합한 절감량 예상정확도는 90% 신뢰수준 ±5% 이내를 목표로 하며(계획),
              현재 산정 기준 ±{pct(calc.kpi.uncertaintyPct)} 수준이다 (기준선 모델오차·데이터 수 반영, 계측 합성 불확도 미포함).
            </p>

            <H n="12" t="예산" />
            <p className="text-[12.5px] text-slate-400">M&V 수행 예산 산정은 데모 범위 외 — 사후관리비용에 M&V 비용 포함(양식 주1) 원칙만 명시.</p>

            <H n="13" t="보고서 형식" />
            <p>보고기간(반기)별 M&V 결과보고서를 본 시스템이 동일 양식으로 자동 생성한다 — 보고·승인 › 결과보고서 양식.</p>

            <H n="14" t="품질보증" />
            <p>
              데이터 수집·계산·보고 전 과정에 자동 검증 규칙(상태코드 7종·물리범위·상호일관성)과
              검토자→승인자 역할 분리 승인 절차를 적용하고, 모든 처리를 감사로그로 보존한다.
            </p>
          </>
        )}

        {/* ============ M&V 결과보고서 (양식 10절) ============ */}
        {mode === "report" && (
          <>
            <H n="1" t="개요" form="1.1 사업개요·요구사항 · 1.2 시설 · 1.3 ECM · 1.4 적용 범위" />
            <p className="mb-2">
              본 보고서는 {mvPlan.baselinePeriod}를 베이스라인으로 하여 보고기간({mvPlan.reportPeriod}) 동안
              중앙 냉수플랜트 효율개선(ECM 3건)의 에너지 절감성과를 산정한 결과이다.
            </p>
            <div className="mb-1 text-[13px] font-semibold">요구사항</div>
            <T head={["구분", "요구사항"]} rows={mvRequirements.map(([who, reqs]) => [who, reqs.join(" · ")])} />
            <div className="mt-2 mb-1 text-[13px] font-semibold">시설 현황 (보고기간)</div>
            {facilityTable}
            <p className="mt-1 text-[11.5px] text-body">주) 보고기간 총 사용량 {fmt(actMWh, 1)} MWh ({fmt(actMWh * TOE_PER_MWH, 1)} toe 상당) · toe 환산 0.229 toe/MWh (데모)</p>
            <div className="mt-2 mb-1 text-[13px] font-semibold">에너지효율개선 기술 (ECM)</div>
            <T head={["번호", "설비명", "ECM 적용", "에너지절감요소"]} rows={ecmList.map((e) => [e.no, e.asset, e.ecm, e.saveFactor])} />

            <H n="2" t="M&V 옵션 및 측정경계" />
            <KV rows={[["적용 옵션", mvPlan.option], ["측정경계", mvPlan.boundary], ["계측", `경계 내 전력 13점 · ${mvPlan.interval} 주기`]]} />

            <H n="3" t="보고기간" form="3.1 기간·월별 사용량 · 3.2 주요인자 · 3.3 운용조건 · 3.4 측정·수집 · 3.5 조정유무" />
            <T
              head={["월", "조정 베이스라인 (MWh)", "실제 사용량 (MWh)", "제외일"]}
              right={[1, 2, 3]}
              rows={[
                ...calc.monthly.map((m) => [m.label, fmt(m.baseMWh, 1), fmt(m.actMWh, 1), m.nExcluded]),
                ["계", fmt(calc.kpi.saveMWh + actMWh, 1), fmt(actMWh, 1), calc.kpi.nExcluded],
              ]}
            />
            <div className="mt-2">
              <KV
                rows={[
                  ["주요인자", `${mvPlan.independent} (독립변수) · 설비 구성(정적인자)`],
                  ["운용조건 변경", "2026-05-01부터 냉수 공급온도 7→9℃ (NR-01, 비일상 조정 등록)"],
                  ["조정 유무", "조정함 — 일상 조정(회귀) + 승인된 비일상 조정 반영"],
                  ["샘플링", "해당 없음 (전수 계측)"],
                ]}
              />
            </div>
            {collectionTables}

            <H n="4" t="에너지절감량 계산" form="4.1 계산 · 4.2 조정 · 4.3 조정 방법" />
            {regressionBlock}
            <div className="mt-2 mb-1 text-[13px] font-semibold">비일상적 조정 내역</div>
            <T
              head={["ID · 내용", "기간", "조정량", "상태 · 승인자"]}
              right={[2]}
              rows={(calc.nrApplied as NonRoutine[]).map((n) => [
                `${n.id} ${n.title}`,
                `${n.start} ~ ${n.end}`,
                n.kwhAdj !== 0 ? `${fmt(n.kwhAdj)} ${n.unit}` : "산정 제외",
                `${n.status}${n.status === "승인 완료" ? ` · ${n.approver}` : ""}`,
              ])}
            />

            <H n="5" t="에너지가격" />
            <T head={["구분", "베이스라인", "보고기간", "비고"]} rows={[["전기 (원/kWh)", fmt(tariff), fmt(tariff), "가정단가 고정 · 부가세 포함 가정(데모)"]]} />

            <H n="6" t="에너지절감량(액)" />
            {savingTable}
            <p className="mt-1 text-[11.5px] text-body">
              주) 냉매 비산배출 {fmt(mrv.refrigerant.total, 2)} tCO₂eq는 절감량과 합산하지 않는 별도 항목 · 온실가스 감축 {fmt(calc.kpi.co2, 1)} tCO₂eq (배출계수 {ef.version})
            </p>

            <H n="7" t="측정기기 사양" />
            {meterTable}
            <p className="mt-1 text-[11.5px] text-body">주) 교정성적서는 증적 레지스트리 등록 (FM-CHW 만료 1건 — 열량 KPI 한정, 절감량 산정 영향 없음)</p>

            <H n="8" t="정확도" />
            <p>
              측정·데이터수집·분석을 종합한 절감량 정확도는 90% 신뢰수준에서 ±{pct(calc.kpi.uncertaintyPct)}이다
              (z=1.645 · 기준선 모델오차·보고기간 데이터 수 반영 · 계측기 합성 불확도 미포함, 데모 추정값).
            </p>

            <H n="9" t="에너지사용자 검토의견" />
            <KV
              rows={[
                ["검증 상태", `${verify.state} (검토 대기 ${verify.pending}건)`],
                ["최근 처리", lastOpinion ? `${lastOpinion.action} — ${lastOpinion.detail.slice(0, 60)}` : "처리 이력 없음"],
                ["검토 창구", "보고·승인 › 검토·승인 탭 — 역할 분리 워크플로우 · 전 처리 감사로그 기록"],
              ]}
            />

            <H n="10" t="M&V 수행 담당자" />
            <T head={["담당", "역할", "책임 범위"]} rows={qaqcRoles.map(([a, b, c]) => [a, b, c])} />

            <div className="mt-4 mb-1 text-[13px] font-semibold">부록 — 증빙자료 목록</div>
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
          </>
        )}

        {/* ============ 템플릿 (보일러 · 개시 전) ============ */}
        {isTpl && (
          <>
            <H n="1" t="개요" />
            <KV
              rows={[
                ["사업 목적", "보일러 배기가스 폐열회수(절탄기)로 LNG 사용량 절감 (계획)"],
                ["측정경계", "보일러·스팀 (LNG 사용량 경계)"],
                ["대상 설비", "보일러 1·2호기 · 절탄기 신설 예정"],
              ]}
            />
            <H n="2" t="에너지효율개선 기술 적용" />
            <p className="text-[12.5px]">배기가스 폐열회수 절탄기 설치 · 급수 예열 — 개시 후 ECM 표 자동 구성.</p>
            <H n="3" t="M&V 옵션 및 측정경계" />
            <p className="text-[12.5px]">IPMVP Option B 후보 (가스미터 3점 경계 계측) — GM-03 연계 완료 후 확정.</p>
            <H n="4" t="베이스라인 설정" />
            <p className="text-[12.5px]">기준기간 2025.07–2026.06 (계획) · 모델(안) Nm³/일 = a + b×난방도일 + c×스팀 생산량 — {na}</p>
            <H n="5·6·7" t="보고기간 · 조정 · 계산방법론" />
            <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-slate-400">
              보고기간 개시 후 월별 사용량·조정·절감량이 냉수플랜트와 동일한 양식·산정 파이프라인으로 자동 작성됩니다
            </div>
            <H n="8~14" t="가격 · 측정기기 · 책임 · 정확도 · 품질보증" />
            <p className="text-[12.5px] text-slate-400">
              가스미터 GM-01·02 연계 완료, GM-03 신설계획 등록 — 계측·책임·품질보증 절은 기준정보에서 자동 구성 예정.
            </p>
          </>
        )}

        <div className="mt-6 text-center text-[11.5px] text-review">
          DEMO · 합성데이터 — 본 문서는 ESCO 표준계약 M&V 양식을 준용한 테스트 출력물이며 공식 제출·제3자 검증 자료로 사용할 수 없습니다.
        </div>
      </div>
    </>
  );
}
