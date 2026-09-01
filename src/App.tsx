import { useUI, type MenuKey } from "./store";
import Overview from "./screens/Overview";
import EquipPerformance from "./screens/EquipPerformance";
import DataVerify from "./screens/DataVerify";
import Reporting from "./screens/Reporting";
import MasterData from "./screens/MasterData";
import EvidencePanel from "./components/EvidencePanel";
import TraceabilityPanel from "./components/TraceabilityPanel";
import GuideModal from "./components/GuideModal";

// 업무 흐름 순서: 결과 이해 → 원인 파악 → 문제 처리 → 문서화 → 설정
const MENUS: Array<{ key: MenuKey; label: string }> = [
  { key: "overview", label: "성과 현황" },
  { key: "equipment", label: "설비 분석" },
  { key: "verify", label: "데이터 검증" },
  { key: "report", label: "보고·승인" },
  { key: "master", label: "시스템 관리" },
];

export default function App() {
  const { menu, setMenu, evidenceOpen, traceOpen, guideOpen } = useUI();
  return (
    <div className="flex h-full min-h-screen">
      {/* 사이드바 — 지시문 §3.1: 짙은 네이비, 160px, 메뉴 4개, 선택만 강조 */}
      <aside className="flex w-40 shrink-0 flex-col bg-navy">
        <div className="px-5 pt-6 pb-5">
          <div className="text-[15px] leading-tight font-bold text-white">디지털 MRV</div>
          <div className="mt-0.5 text-[11px] text-slate-400">냉열원 성과관리</div>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label="주 메뉴">
          {MENUS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMenu(m.key)}
              aria-current={menu === m.key ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                menu === m.key
                  ? "bg-accent font-semibold text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* 메인 영역 */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {menu === "overview" && <Overview />}
        {menu === "equipment" && <EquipPerformance />}
        {menu === "verify" && <DataVerify />}
        {menu === "report" && <Reporting />}
        {menu === "master" && <MasterData />}
      </main>

      {evidenceOpen && <EvidencePanel />}
      {traceOpen && <TraceabilityPanel />}
      {guideOpen && <GuideModal />}
    </div>
  );
}
