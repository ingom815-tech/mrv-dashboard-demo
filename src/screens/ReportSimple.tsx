import { useState } from "react";
import { useUI, deriveVerify } from "../store";
import { formCoverageSummary } from "../lib/inventoryData";
import { esgMapSummary } from "../lib/esgData";
import MrvReportPreview from "./MrvReportPreview";
import PvReportDoc from "./PvReportDoc";
import { Btn, Card, Segment } from "../components/ui";

type DocKey = "mvreport" | "plan" | "iso" | "pvgen" | "inventory" | "esg";
const DOCS: Array<{ key: DocKey; label: string; frame: string }> = [
  { key: "mvreport", label: "M&V 결과보고서", frame: "ESCO·IPMVP" },
  { key: "plan", label: "M&V 계획서", frame: "ESCO·IPMVP" },
  { key: "iso", label: "에너지성과", frame: "ISO 50006" },
  { key: "pvgen", label: "발전 성과", frame: "IEC 61724-1" },
  { key: "inventory", label: "배출 명세서", frame: "별지 10·11" },
  { key: "esg", label: "ESG 공시", frame: "K-ESG" },
];

/* 보고서 — 기본 모드. 시스템이 만드는 보고서 전 종류를 선택해서 미리보고 인쇄.
   검증 절차 자체는 상태 배지로 요약하고, 승인 워크플로우·수기 입력은 관리자 모드 보고·승인에 있음. */
export default function ReportSimple() {
  const verify = deriveVerify(useUI((s) => s.reviewStates));
  const { setMenu, invStatus, esgStatus, planStatus } = useUI();
  const [doc, setDoc] = useState<DocKey>("mvreport");
  const done = verify.state === "승인 완료";
  const openAdmin = (hash: string) => {
    window.location.hash = hash;
    setMenu("report");
  };

  const docState =
    doc === "plan" ? `계획서 ${planStatus}` :
    doc === "inventory" ? `명세서 ${invStatus}` :
    doc === "esg" ? `ESG ${esgStatus}` :
    doc === "pvgen" ? "검토 중" :
    done ? "검증 완료" : "검증 진행 중";
  const stateGood = /승인 완료|확정|검증 완료/.test(docState);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tk-title">보고서</h1>
          <p className="tk-label mt-1">산정 결과가 공식 규정·표준 서식의 보고서 6종으로 자동 작성됩니다. 재입력은 없습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${stateGood ? "bg-brand/10 text-brand" : "bg-[#e9edf1] text-sub"}`}>
            {docState}
          </span>
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
        </div>
      </header>

      {/* 문서 선택 — 좁은 화면에서는 좌우로 스크롤 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="max-w-full overflow-x-auto pb-1">
          <Segment
            ariaLabel="보고서 종류 선택"
            options={DOCS.map((d) => ({ key: d.key, label: d.label }))}
            value={doc}
            onChange={setDoc}
          />
        </div>
        <span className="tk-label">준거: {DOCS.find((d) => d.key === doc)?.frame}</span>
      </div>

      {/* MRV 계열 4종 — 문서 미리보기 직접 렌더 (인쇄 버튼 포함) */}
      {doc === "mvreport" && <MrvReportPreview mode="report" showSettings={false} />}
      {doc === "plan" && <MrvReportPreview mode="plan" showSettings={false} />}
      {doc === "iso" && <MrvReportPreview mode="iso" showSettings={false} />}
      {doc === "pvgen" && <PvReportDoc />}

      {/* 명세서 — 요약 + 관리자 화면 열기 (7탭 작성·승인 워크플로우가 있는 문서) */}
      {doc === "inventory" && (
        <Card
          title="에너지·온실가스 배출 명세서 (별지 10·11 서식)"
          action={<Btn small onClick={() => openAdmin("#/report/inventory")}>명세서 열기</Btn>}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(
              [
                ["자동 작성 서식", `${formCoverageSummary.auto}종`],
                ["부분 작성", `${formCoverageSummary.partial}종`],
                ["해당 없음", `${formCoverageSummary.na}종`],
                ["작성 상태", invStatus],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <div key={k}>
                <div className="tk-label">{k}</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>
          <p className="tk-label mt-3 leading-relaxed">
            배출권거래제 지침 별지 서식 {formCoverageSummary.total}종 기준으로 시스템 데이터가 자동 반영되고,
            담당자 연락처·소명 등 일부만 수기로 입력합니다. 12서식 미리보기·수기 입력·검토→승인 워크플로우는
            명세서 화면에서 진행합니다.
          </p>
        </Card>
      )}

      {/* ESG — 요약 + 열기 */}
      {doc === "esg" && (
        <Card
          title="ESG 공시 데이터 팩 (K-ESG 가이드라인 v2.0 분류 참고)"
          action={<Btn small onClick={() => openAdmin("#/report/esg")}>ESG 데이터 열기</Btn>}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(
              [
                ["자동 제공 항목", `${esgMapSummary.auto}개`],
                ["부분 제공", `${esgMapSummary.partial}개`],
                ["범위 외", `${esgMapSummary.out}개`],
                ["확정 상태", esgStatus],
              ] as Array<[string, string]>
            ).map(([k, v]) => (
              <div key={k}>
                <div className="tk-label">{k}</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>
          <p className="tk-label mt-3 leading-relaxed">
            지속가능경영보고서 부록에 쓰는 4개년 정량 표와 K-ESG 진단항목 매핑, 2030 목표를 담습니다.
            데이터 내려받기(CSV·Markdown)와 목표 입력·확정은 ESG 화면에서 진행합니다.
          </p>
        </Card>
      )}

      {/* 검증 안내 — MRV 계열 문서에서만 */}
      {(doc === "mvreport" || doc === "iso") && !done && (
        <Card>
          <p className="text-[13.5px] leading-relaxed text-sub">
            검토·승인이 끝나면 상단 배지가 <b className="text-brand">검증 완료</b>로 바뀌고 보고서가 확정본이 됩니다.
            승인 절차·이력 관리는 관리자 모드의 보고·승인 화면에 있습니다.
          </p>
          <div className="mt-3">
            <Btn kind="secondary" small onClick={() => openAdmin("#/report/approve")}>승인 절차 열기</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
