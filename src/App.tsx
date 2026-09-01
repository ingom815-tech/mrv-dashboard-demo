import { useEffect, useState } from "react";
import { useUI, deriveVerify, type MenuKey } from "./store";
import FactoryOverview from "./screens/FactoryOverview";
import EquipGroups from "./screens/EquipGroups";
import DataVerify from "./screens/DataVerify";
import Reporting from "./screens/Reporting";
import MasterData from "./screens/MasterData";
import EvidencePanel from "./components/EvidencePanel";
import TraceabilityPanel from "./components/TraceabilityPanel";
import GuideModal from "./components/GuideModal";

// 업무 흐름 순서: 공장 전체 → 설비군 → 검증 → 보고 → 관리 (구조 고정)
const MENUS: Array<{ key: MenuKey; label: string }> = [
  { key: "overview", label: "공장 종합현황" },
  { key: "equipment", label: "설비군 분석" },
  { key: "verify", label: "데이터 검증" },
  { key: "report", label: "보고·승인" },
  { key: "master", label: "설비·연계 관리" },
];

export default function App() {
  const { menu, setMenu, evidenceOpen, traceOpen, guideOpen, reviewStates } = useUI();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pending = deriveVerify(reviewStates).pending;

  // 드로어 열림 시 본문 스크롤 잠금 (모바일 지시문 §12)
  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [drawerOpen]);

  const go = (k: MenuKey) => {
    setMenu(k);
    setDrawerOpen(false); // 메뉴 선택 후 드로어 자동 닫힘 (§3.1)
  };

  return (
    <div className="flex h-full min-h-screen flex-col xl:flex-row">
      {/* 모바일 상단바 — 높이 56px 이내, 화면 상단 고정 (§3.1) */}
      <header className="no-print sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-navy px-3 xl:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[20px] text-white active:bg-white/10"
        >
          ☰
        </button>
        <span className="text-[15px] font-bold text-white">디지털 MRV</span>
        <span className="rounded bg-white/10 px-2 py-0.5 text-[12px] text-slate-300">원주공장</span>
        <button
          onClick={() => go("verify")}
          aria-label="처리할 일"
          className="tnum relative ml-auto flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-[17px] active:bg-white/10"
        >
          🔔
          {pending > 0 && (
            <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-review px-1 text-[10px] font-bold text-white">
              {pending}
            </span>
          )}
        </button>
      </header>

      {/* 모바일 드로어 메뉴 (§3.1: 너비 80~85%, 배경 탭·닫기 버튼으로 닫힘) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-label="주 메뉴">
          <div className="absolute inset-0 bg-black/45" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col bg-navy shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div>
                <div className="text-[16px] leading-tight font-bold text-white">디지털 MRV</div>
                <div className="mt-0.5 text-[11.5px] text-slate-400">원주공장 · 냉열원 성과관리</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="메뉴 닫기"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[18px] text-slate-300 active:bg-white/10"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3" aria-label="주 메뉴">
              {MENUS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => go(m.key)}
                  aria-current={menu === m.key ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-4 text-left text-[15px] transition-colors ${
                    menu === m.key
                      ? "bg-accent font-semibold text-white"
                      : "text-slate-300 active:bg-white/10"
                  }`}
                >
                  {m.label}
                  {m.key === "verify" && pending > 0 && (
                    <span className="tnum ml-auto rounded-full bg-review px-1.5 py-0.5 text-[11px] font-bold text-white">{pending}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-auto px-5 pb-5 text-[11px] leading-relaxed text-slate-500">
              DEMO · 합성데이터
              <br />공식 MRV 사용 불가
            </div>
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 — 1200px 이상에서만 상시 노출 (§2·§3.1) */}
      <aside className="no-print hidden w-40 shrink-0 flex-col bg-navy xl:flex">
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
        {menu === "overview" && <FactoryOverview />}
        {menu === "equipment" && <EquipGroups />}
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
