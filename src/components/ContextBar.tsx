import { mrv } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, type Role } from "../store";

/* 화면 상단 1단: 역할 전환 + 검증 추적성 + 산정근거 — 각 화면 제목 행 우측에 배치 */
export function TopActions() {
  const { role, setRole, openEvidence, openTrace, openGuide } = useUI();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={openGuide}
        className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10"
      >
        ? 가이드
      </button>
      <div className="flex items-center gap-1 text-[12px] text-slate-400">
        역할
        {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded px-1.5 py-0.5 text-[12px] transition-colors ${
              role === r ? "bg-navy font-semibold text-white" : "text-body hover:text-navy"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <button
        onClick={openTrace}
        className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-navy transition-colors hover:border-accent/50"
      >
        검증 추적성
      </button>
      <button
        onClick={openEvidence}
        className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        산정근거
      </button>
    </div>
  );
}

/* 화면 상단 2단: 조회 컨텍스트 — 줄바꿈 허용, 가로 스크롤 금지 */
export default function ContextBar() {
  const calc = useCalc();
  const updatedAt = new Date(mrv.meta.generatedAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const Item = ({ label, value }: { label: string; value: string }) => (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="tnum text-[12.5px] font-semibold text-navy">{value}</span>
    </span>
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line/50 bg-white px-4 py-2">
      <Item label="사업장" value={mrv.meta.site} />
      <Item label="경계" value={mrv.meta.boundary} />
      <Item label="기준기간" value="2025.01–12" />
      <Item label="보고기간" value="2026.01–06" />
      <Item label="집계" value={mrv.meta.aggLabel} />
      <Item label="대상 설비" value={`${mrv.meta.equipCount}대`} />
      <Item label="계측 태그" value={`${mrv.meta.tagCount}점`} />
      <Item label="계산버전" value={calc.version} />
      <Item label="갱신" value={updatedAt} />
    </div>
  );
}
