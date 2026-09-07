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
  pvGhg,
  pvMeters,
  iecSummary,
  pvTagQuality,
  pvRecon,
  pvExceptions,
  pvBiz,
  pvSiteConfig,
} from "../lib/pvData";
import LegalBasis from "../components/LegalBasis";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 문서용 절 이동 대상 — 이 절 데이터를 관리하는 화면 */
export type PvDocNav = "equipment" | "verify" | "master";

/* ---------- 문서 서브컴포넌트 (MrvReportPreview와 동일 스타일) ---------- */
function H({ n, t, form, src, onNav }: {
  n: string;
  t: string;
  form?: string;
  src?: { go: PvDocNav; label: string };
  onNav?: (go: PvDocNav) => void;
}) {
  return (
    <h3 id={`pvsec-${n}`} className="mt-6 mb-2 flex flex-wrap items-baseline gap-x-2 scroll-mt-20 text-[15px] font-bold">
      <span>
        {n}. {t} {form && <span className="text-[11px] font-normal text-slate-400">{form}</span>}
      </span>
      {src && onNav && (
        <button
          onClick={() => onNav(src.go)}
          className="no-print ml-auto text-[11px] font-normal whitespace-nowrap text-slate-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
          title="이 절의 데이터를 관리하는 화면으로 이동"
        >
          원천: {src.label} ›
        </button>
      )}
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

/* 발전 성과보고서 — KS C IEC 61724-1(태양광 성능 모니터링) 기반 A4 문서.
   냉동·냉장 M&V 보고서(회귀 기준선)와 산정 패러다임이 다름: 일사량 기반 기대치(PR) 비교 + 계량기 대사 확정.
   인쇄용 보고서 문서에는 로고를 넣지 않음 (CLAUDE.md 브랜딩 규칙). */
export default function PvReportDoc({ onNav }: { onNav?: (go: PvDocNav) => void }) {
  return (
    <>
      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-body">
          KS C IEC 61724-1(PV 성능 모니터링) 기반 발전 성과보고서 — 검토 중 · 승인 전 초안
        </span>
        <button onClick={() => window.print()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90">
          PDF 인쇄·저장
        </button>
      </div>

      <div className="print-root mx-auto w-full max-w-[800px] rounded-[10px] border border-line/60 bg-white p-10 text-[13px] leading-relaxed text-navy shadow-sm">
        {/* 표지 */}
        <div className="relative border-b-2 border-navy pb-6 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-18deg] text-[38px] font-black tracking-widest text-review/10 select-none">
              DEMO · 합성데이터
            </span>
          </div>
          <div className="text-[12px] tracking-widest text-slate-400">KS C IEC 61724-1 성능 모니터링 체계 준용 (데모 요약본)</div>
          <div className="mt-2 text-[24px] font-bold">발전 성과보고서</div>
          <div className="mt-1 text-[14px]">태양광·ESS 발전 성과 · 제1공장</div>
          <div className="tnum mt-3 text-[12px] text-body">프로젝트 GEN-2026-01 · CALC-2026H1-v1 · 보고기간 2026.01–06 · 상태 검토 중</div>
          <div className="mt-2 text-[11.5px] text-review">
            본 자료는 데모용 합성데이터로 작성된 테스트 출력물이며, 공식 성과 보고 또는 제3자 검증 자료로 사용할 수 없습니다.
          </div>
        </div>

        <LegalBasis
          items={[
            ["KS C IEC 61724-1", "태양광 시스템 성능 모니터링 국제표준 — Class B 선언 · PR 산정(10장)·데이터 품질(8장)·손실 분해(부속서 C) 준용"],
            ["한전 기본공급약관·시행세칙", "계시별(TOU) 요금·잉여 상계 처리 준거 — 단가는 데모 가정"],
            ["신·재생에너지 공급의무화제도 관리·운영지침", "REC 발급 체계 — 자가용 설비로 발급 대상 아님을 판단 근거로 명시"],
            ["온실가스 배출권거래제 배출량 보고·인증 지침", "자가소비분의 Scope 2 반영(구매전력 감소) 및 외부사업 별도 절차 준거"],
          ]}
        />

        <H n="1" t="개요" form="사업장·설비·보고기간·사업 형태" src={{ go: "master", label: "설비·연계 관리" }} onNav={onNav} />
        <KV
          rows={[
            ["사업장", "제1공장 (유틸리티 영역)"],
            ["대상 설비", `태양광 ${fmt(PV_SPEC.arrayKwp)} kWp (인버터 ${PV_SPEC.inverters}대) + ESS ${fmt(ESS_SPEC.battKwh)} kWh / PCS ${ESS_SPEC.pcsKw} kW`],
            ["보고기간", "2026-01-01 ~ 2026-06-30 (상반기)"],
            ["사업 형태", pvBiz.type],
            ["산정 방식", "일사량 기반 기대 발전(PR 0.83) 비교 + 정산 계량기 대사 확정 — 회귀 기준선(IPMVP형) 아님"],
            ["적용 구성", `${pvSiteConfig.template} + ${pvSiteConfig.custom} (사업장별 설정)`],
            ["계산버전 · 검증상태", "CALC-2026H1-v1 · 검토 중"],
          ]}
        />

        <H n="2" t="계측 구성" form="IEC 61724-1 표 3 — Class B 필수 변수" src={{ go: "master", label: "계측기 대장" }} onNav={onNav} />
        <T
          head={["계측기", "측정 변수", "정확도", "주기", "상태"]}
          rows={pvMeters.map((m) => [m.meter, m.variable, m.spec, m.cycle, m.state])}
        />
        <p className="mt-1.5 text-[12px] text-body">
          모니터링 등급 {PV_SPEC.monitorClass} 선언 — 등급별 요구 정밀도·필수 변수를 적용. 설비 사양(온도계수 {PV_SPEC.tempCoefPct}%/℃ ·
          연 열화 {PV_SPEC.degradePctYr}%)은 데모 가정.
        </p>

        <H n="3" t="데이터 품질" form="IEC 61724-1 8장 — 필터·판독 제거·누락 처리" src={{ go: "verify", label: "데이터 검증" }} onNav={onNav} />
        <T
          head={["태그", "변수", "수집률", "정상률", "추정률", "비고"]}
          right={[2, 3, 4]}
          rows={pvTagQuality.map((t) => [t.tag, t.desc, `${t.collectPct}%`, `${t.validPct}%`, t.estPct > 0 ? `${t.estPct}%` : "—", t.note])}
        />
        <p className="mt-1.5 text-[12px] text-body">
          IEC 8장 품질 규칙 3종(일광 시간 필터·잘못된 판독값 제거·누락 데이터 처리)을 기존 상태코드 체계(VALID·OUTLIER·ESTIMATED)에
          매핑해 적용 — 원본값은 수정 없이 보존하고 정제·보정값은 라벨로 구분.
        </p>

        <H n="4" t="발전 성과" form="PR = E_AC / (P0 × H_POA) · IEC 61724-1 10장" src={{ go: "equipment", label: "태양광·ESS 상세" }} onNav={onNav} />
        <T
          head={["월", "경사면 일사량 (kWh/m²)", "기대 발전 (MWh)", "실측 발전 (MWh)", "PR (%)", "비고"]}
          right={[1, 2, 3, 4]}
          rows={[
            ...pvMonthly.map((m) => [m.label, fmt(m.poaKwhM2), fmt(m.expectMWh, 1), fmt(m.actMWh), m.pr, m.event ?? "—"]),
            ["합계", fmt(pvH1.poaSum), fmt(pvMonthly.reduce((s, m) => s + m.expectMWh, 0), 1), fmt(pvH1.genMWh), `${pvPrH1} (기간)`, `이용률 ${pvH1.capacityFactorPct}%`],
          ]}
        />
        <p className="mt-1.5 text-[12px] text-body">
          기간 성능비(PR) {pvPrH1}% — 기준 0.83 대비. 3월(인버터 정지)·5월(패널 오염) 하락 후 세척으로 회복. PR은 성능 보조지표이며
          보고값은 실측 발전량(5절 재구성)임.
        </p>

        <H n="5" t="측정값에서 보고값까지 — 재구성" form="확정 발전량·자가소비·회피량의 유도" src={{ go: "equipment", label: "태양광·ESS 상세" }} onNav={onNav} />
        <T
          head={["단계", "처리 단계", "값", "처리 내용"]}
          right={[2]}
          rows={pvRecon.map((r) => [r.kind, r.step, r.value, r.note])}
        />
        <p className="mt-1.5 text-[12px] text-body">
          정비 정지·오염은 발전 손실(6절)이며 데이터 제외가 아님 — 실측 발전량은 그대로 보고 대상. 확정 발전량은 정산 계량기 기준으로
          채택하고 인버터 적산과 월별 대사(차이 0.4% 이내)로 검증함.
        </p>

        <H n="6" t="손실 분석" form="IEC 61724-1 부속서 C 준용 (데모 분해)" src={{ go: "equipment", label: "태양광·ESS 상세" }} onNav={onNav} />
        <T
          head={["구분", "MWh", "내용"]}
          right={[1]}
          rows={lossWaterfall.map((s) => [s.name, s.mwh < 0 ? `−${fmt(-s.mwh)}` : fmt(s.mwh), s.note ?? "—"])}
        />

        <H n="7" t="ESS 운전 성과" form="TOU 차익·피크 기여 (한전 약관 체계 준용)" src={{ go: "equipment", label: "태양광·ESS 상세" }} onNav={onNav} />
        <KV
          rows={[
            ["운전 정책", ESS_SPEC.policy],
            ["충전 / 방전", `${fmt(essH1.chargeMWh)} MWh / ${fmt(essH1.dischargeMWh)} MWh · 왕복효율 ${essH1.roundTripPct}%`],
            ["피크 기여 · 사이클", `−${fmt(essH1.peakCutKw)} kW (하계) · ${essH1.cycleCount}회 · SOH ${essH1.sohPct}%`],
            ["요금 차익 (데모)", `${fmt(essSavingKrw / 1e4)}만원 — 계시별 단가 데모 가정 (${TOU.contract})`],
          ]}
        />

        <H n="8" t="온실가스·제도 연계" form="Scope 2 회피 (참고치) · REC 판단" src={{ go: "master", label: "배출계수 관리" }} onNav={onNav} />
        <KV
          rows={[
            ["Scope 2 회피량", `자가소비 ${fmt(pvH1.selfMWh)} MWh × ${pvGhg.efCurrent} = ${pvGhg.avoided} tCO₂eq (참고치)`],
            ["명세서 반영", "구매전력 감소로 자동 반영 — 회피량을 확정 배출량과 합산하지 않음"],
            ["배출계수", `EF-v1.0 · ${pvGhg.efCurrent} tCO₂/MWh — 최신 계수(${pvGhg.efLatest}) 갱신 시 ${pvGhg.avoidedLatest} t (버전관리)`],
            ["REC", "발급 대상 아님 — 자가용 설비 (RPS 지침 기준) · 잉여 74 MWh는 상계 처리"],
            ["별도 감축 인증", "외부사업(KOC) 지침 절차 필요 — 본 보고서는 인증 신청 자료가 아님"],
          ]}
        />

        <H n="9" t="예외·조치 및 검증 상태" form="사건별 보고 데이터 반영 · IEC 정합 요약" src={{ go: "verify", label: "데이터 검증" }} onNav={onNav} />
        <T
          head={["구분", "항목", "영향", "보고 데이터 반영", "승인상태"]}
          rows={pvExceptions.map((e) => [e.type, e.item, e.impact, e.handling, e.approval])}
        />
        <p className="mt-1.5 text-[12px] text-body">
          KS C IEC 61724-1 정합: 충족 {iecSummary.ok} · 부분 충족 {iecSummary.partial} · 미충족 0 — 인증 결과가 아니라 계측·데이터
          체계의 표준 요구조건 충족 여부를 확인하는 검증 상태임. 본 보고서는 검토자 확인 → 승인자 확정(역할 분리) 후 확정본으로 잠금됨.
        </p>

        <div className="mt-8 border-t border-navy pt-3 text-center text-[11.5px] text-review">
          DEMO · 합성데이터 — 본 문서는 KS C IEC 61724-1 성능 모니터링 체계를 준용한 테스트 출력물이며 공식 제출·제3자 검증 자료로 사용할 수 없습니다.
        </div>
      </div>
    </>
  );
}
