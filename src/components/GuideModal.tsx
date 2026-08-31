import { useUI } from "../store";

/* 데모 가이드 — 처음 보는 사람에게 시스템이 무엇을 하는지 쉬운 말로 설명 */
export default function GuideModal() {
  const { closeGuide, setMenu } = useUI();
  const go = (m: Parameters<typeof setMenu>[0], hash: string) => {
    window.location.hash = hash;
    setMenu(m);
    closeGuide();
  };

  const steps: Array<{ n: string; title: string; desc: string; menu: Parameters<typeof setMenu>[0]; hash: string }> = [
    {
      n: "1",
      title: "얼마나 아꼈는지 본다",
      desc: "종합성과 — 6개월간 420 MWh(28.6%) 절감, 탄소 193 tCO₂eq. 아직 '잠정'이라는 표시까지 확인",
      menu: "overview",
      hash: "#/overview",
    },
    {
      n: "2",
      title: "왜 아껴졌는지 본다",
      desc: "설비성과 — 같은 부하에서 효율이 30% 좋아진 성능곡선과, 어떤 설비가 얼마나 기여했는지 분해",
      menu: "equipment",
      hash: "#/equipment",
    },
    {
      n: "3",
      title: "데이터를 믿을 수 있는지 본다",
      desc: "데이터·검증 — 품질 히트맵에서 결측·이상 구간과 그 처리 규칙 확인",
      menu: "verify",
      hash: "#/verify",
    },
    {
      n: "4",
      title: "검토하고 승인해 본다 (하이라이트)",
      desc: "검토·승인 탭 — 역할을 검토자→승인자로 바꿔 2건을 승인하면 절감량이 재계산되고 새 계산버전(v2)이 생김",
      menu: "verify",
      hash: "#/verify/approve",
    },
    {
      n: "5",
      title: "근거를 추적한다",
      desc: "증적 문서(교정성적서 등)와 '검증 추적성' 버튼으로 숫자의 출처를 끝까지 따라가 봄",
      menu: "verify",
      hash: "#/verify/evidence",
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/50" onClick={closeGuide} />
      <div className="relative max-h-[88vh] w-[680px] overflow-y-auto rounded-xl bg-white p-8 shadow-2xl">
        <button
          onClick={closeGuide}
          aria-label="닫기"
          className="absolute top-4 right-5 rounded px-2 py-0.5 text-[20px] leading-none text-slate-400 hover:bg-surface hover:text-navy"
        >
          ×
        </button>

        <div className="text-[22px] font-bold text-navy">이 시스템은 무엇을 하나요?</div>
        <p className="mt-2 text-[15px] leading-relaxed text-navy">
          공장의 냉방설비를 개선한 뒤 <b className="text-teal">전기를 얼마나 아꼈는지 계산</b>하고, 그
          숫자를 <b className="text-accent">제3자가 믿을 수 있도록 검증·승인</b>하는 화면입니다.
          <span className="ml-1 rounded bg-review/10 px-1.5 py-0.5 text-[12px] font-semibold text-review">
            모든 숫자는 데모용 합성데이터
          </span>
        </p>

        {/* 3단계 스토리 */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["① 측정", "센서 13개가 15분마다 전기 사용량과 운전 데이터를 기록합니다."],
            ["② 계산", "작년(개선 전)과 올해를 날씨·생산량으로 보정해 비교합니다. 그 차이가 절감량입니다."],
            ["③ 검증", "데이터 품질을 확인하고, 검토자·승인자가 승인해야 숫자가 확정됩니다."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg bg-surface px-3.5 py-3">
              <div className="text-[14px] font-bold text-navy">{t}</div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-body">{d}</div>
            </div>
          ))}
        </div>

        {/* 메뉴 지도 */}
        <div className="mt-5">
          <div className="text-[14px] font-semibold text-navy">왼쪽 메뉴 4개</div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            <div><b className="text-navy">종합성과</b> <span className="text-body">— 결론: 얼마나 아꼈고 믿을 수 있는가</span></div>
            <div><b className="text-navy">설비성과</b> <span className="text-body">— 원인: 어떤 설비가 왜 아꼈는가</span></div>
            <div><b className="text-navy">데이터·검증</b> <span className="text-body">— 근거: 데이터 품질과 검토·승인·증적</span></div>
            <div><b className="text-navy">기준정보</b> <span className="text-body">— 약속: 계산 기준(M&V 계획)과 설비·계측 정보</span></div>
          </div>
        </div>

        {/* 시연 순서 */}
        <div className="mt-5">
          <div className="text-[14px] font-semibold text-navy">추천 시연 순서 (약 5분)</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {steps.map((s) => (
              <button
                key={s.n}
                onClick={() => go(s.menu, s.hash)}
                className="flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="text-[13.5px] font-semibold text-navy">{s.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-body">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[12px] text-slate-400">
            우측 상단 <b>가이드</b> 버튼으로 언제든 다시 열 수 있습니다
          </span>
          <button
            onClick={closeGuide}
            className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
