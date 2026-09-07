import { useUI, deriveVerify } from "../store";
import MrvReportPreview from "./MrvReportPreview";
import { Btn, Card } from "../components/ui";

/* 보고서 — 기본 모드. 문서 미리보기 + 다운로드(PDF 인쇄)만 남기고,
   검증 절차는 상태 배지 하나로 대체. 승인 워크플로우·명세서·ESG 등 전체 기능은 관리자 모드 보고·승인에 있음. */
export default function ReportSimple() {
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const setMenu = useUI((s) => s.setMenu);
  const done = verify.state === "승인 완료";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tk-title">보고서</h1>
          <p className="tk-label mt-1">산정 결과가 표준 양식의 보고서로 자동 작성됩니다. 아래에서 바로 인쇄·저장할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${done ? "bg-brand/10 text-brand" : "bg-[#e9edf1] text-sub"}`}>
            {done ? "검증 완료" : "검증 진행 중"}
          </span>
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
        </div>
      </header>

      {!done && (
        <Card>
          <p className="text-[13.5px] leading-relaxed text-sub">
            검토·승인이 끝나면 이 배지가 <b className="text-brand">검증 완료</b>로 바뀌고 보고서가 확정본이 됩니다.
            승인 절차와 명세서·ESG 자료 등 전체 보고 기능은 관리자 모드의 보고·승인 화면에 있습니다.
          </p>
          <div className="mt-3">
            <Btn kind="secondary" small onClick={() => { window.location.hash = "#/report/approve"; setMenu("report"); }}>
              승인 절차 열기
            </Btn>
          </div>
        </Card>
      )}

      {/* 문서 미리보기 — ESCO M&V 결과보고서 양식 (10절) · 인쇄 버튼 포함 */}
      <MrvReportPreview mode="report" showSettings={false} />
    </div>
  );
}
