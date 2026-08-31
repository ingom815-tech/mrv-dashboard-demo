import { useUI, type MenuKey } from "./store";
import Overview from "./screens/Overview";
import Placeholder from "./screens/Placeholder";
import EvidencePanel from "./components/EvidencePanel";

const MENUS: Array<{ key: MenuKey; label: string }> = [
  { key: "overview", label: "종합성과" },
  { key: "analysis", label: "성과분석" },
  { key: "verify", label: "데이터·검증" },
  { key: "settings", label: "설정" },
];

export default function App() {
  const { menu, setMenu, evidenceOpen } = useUI();
  return (
    <div className="flex h-full min-h-screen">
      {/* 사이드바 — v2.1 §2.5: 176px, 메뉴 4개, 선택 항목 라운드 배경 */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-line bg-white">
        <div className="px-5 pt-6 pb-4">
          <div className="text-[15px] leading-tight font-bold text-navy">디지털 MRV</div>
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
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-slate-500 hover:bg-surface hover:text-navy"
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
        {menu === "analysis" && (
          <Placeholder
            title="성과분석"
            desc="기준선 추세·보정조건·설비 기여(설비 원인)를 보여줄 화면입니다. 종합성과 화면 확인 후 제작합니다."
          />
        )}
        {menu === "verify" && (
          <Placeholder
            title="데이터·검증"
            desc="데이터 품질·검토 항목·산정근거·승인·증적·보고서를 보여줄 화면입니다. 종합성과 화면 확인 후 제작합니다."
          />
        )}
        {menu === "settings" && (
          <Placeholder
            title="설정"
            desc="설비·태그·배출계수·냉매 GWP·가정단가·사용자 권한을 관리할 화면입니다. 종합성과 화면 확인 후 제작합니다."
          />
        )}
      </main>

      {evidenceOpen && <EvidencePanel />}
    </div>
  );
}
