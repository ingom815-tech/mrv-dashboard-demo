import { useUI, type MenuKey } from "./store";
import Overview from "./screens/Overview";
import EquipPerformance from "./screens/EquipPerformance";
import DataVerify from "./screens/DataVerify";
import Placeholder from "./screens/Placeholder";
import EvidencePanel from "./components/EvidencePanel";

const MENUS: Array<{ key: MenuKey; label: string }> = [
  { key: "overview", label: "종합성과" },
  { key: "equipment", label: "설비성과" },
  { key: "verify", label: "데이터·검증" },
  { key: "master", label: "기준정보" },
];

export default function App() {
  const { menu, setMenu, evidenceOpen } = useUI();
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
        {menu === "master" && (
          <Placeholder
            title="기준정보"
            desc="설비 계층·센서·태그·배출계수·냉매 GWP·가정단가·사용자 권한을 관리할 화면입니다. 종합성과 화면 확인 후 제작합니다."
          />
        )}
      </main>

      {evidenceOpen && <EvidencePanel />}
    </div>
  );
}
