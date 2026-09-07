import { useState } from "react";
import { useUI, type SiteRec } from "../store";
import { equipGroups } from "../lib/factoryData";

/* 신규 사업장 온보딩 마법사 — 등록된 사업장을 단계별 입력으로 개시 준비까지 진행.
   실제 SaaS에서는 각 단계가 서버 설정을 생성하며, 데모에서는 입력 요약·감사로그로 흐름을 시연한다. */

const STEPS = ["사업장 등록", "설비 계층 구성", "계측·데이터 연계", "기준기간 설정", "MRV·보고 개시"];

const SOURCES = ["전력계 (Modbus RTU)", "가스미터 (펄스·Modbus)", "MES (DB/CSV)", "BMS (REST API)", "기상 센서"];

export default function SiteOnboarding({ site }: { site: SiteRec }) {
  const { role, sites, setCurrentSite, setMenu, siteOnboardNext } = useUI();
  const done = site.onboard ?? 1;
  const data = site.onboardData ?? {};
  const demoSite = sites.find((s) => s.demo);
  const locked = role === "일반";

  /* 단계별 로컬 입력 */
  const [selGroups, setSelGroups] = useState<string[]>(["보일러·스팀", "공조기·환기", "조명·일반전력"]);
  const [selSources, setSelSources] = useState<string[]>([SOURCES[0]]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [basePeriod, setBasePeriod] = useState("직전 12개월 (권장)");
  const [selVars, setSelVars] = useState<string[]>(["냉방도일", "생산량"]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={locked}
      className={`min-h-9 rounded-lg border px-3 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-accent/50 bg-accent/8 font-semibold text-accent" : "border-line/60 bg-white text-body hover:border-accent/40"
      }`}
    >
      {on ? "✓ " : ""}{label}
    </button>
  );

  const NextBtn = ({ label, stepLabel, patch, disabled }: { label: string; stepLabel: string; patch: Record<string, string>; disabled?: boolean }) => (
    <button
      onClick={() => siteOnboardNext(site.id, stepLabel, patch)}
      disabled={locked || disabled}
      className="min-h-11 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-[20px] font-bold text-navy md:text-[24px]">{site.name} — 온보딩 {done >= 5 ? "완료" : "진행 중"}</h1>
        <p className="mt-1 text-[13.5px] text-body">
          {site.region} · {site.id} · 단계를 마치면 {demoSite?.name}과 동일한 화면·산정·보고 체계가 자동 적용됩니다 (SaaS 확장 구조)
        </p>
      </div>

      {/* 진행 바 */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const st = i < done ? "완료" : i === done ? "진행 중" : "대기";
          return (
            <div key={s} className="flex shrink-0 items-center gap-1 md:min-w-0 md:flex-1">
              <div className={`flex min-h-11 min-w-[104px] flex-col items-center justify-center rounded px-2 py-1.5 text-[11.5px] leading-tight font-medium whitespace-nowrap md:w-full ${
                st === "완료" ? "bg-teal/12 text-teal" : st === "진행 중" ? "bg-accent text-white" : "bg-surface text-slate-400"
              }`}>
                <span>{i + 1}. {s}</span>
                <span className="mt-0.5 text-[10px] opacity-80">{st}</span>
              </div>
              {i < STEPS.length - 1 && <span className="shrink-0 text-slate-300">›</span>}
            </div>
          );
        })}
      </div>

      {locked && (
        <div className="rounded-lg bg-surface px-3.5 py-2 text-[12.5px] text-body">
          일반 역할은 조회만 가능합니다 — 우측 상단에서 검토자·승인자 역할로 전환하면 온보딩을 진행할 수 있습니다.
        </div>
      )}

      {/* ---------- 현재 단계 폼 ---------- */}
      {done === 1 && (
        <section className="rounded-[10px] border border-accent/40 bg-white p-4 md:p-5">
          <div className="mb-1 text-[15px] font-semibold text-navy">2단계 — 설비 계층 구성</div>
          <p className="mb-3 text-[12.5px] text-body">이 사업장에서 관리할 설비군을 선택하세요. 선택한 설비군별로 설비·계측 트리가 생성됩니다 (데모: 구성만 기록).</p>
          <div className="flex flex-wrap gap-2">
            {equipGroups.map((g) => (
              <Chip key={g.key} on={selGroups.includes(g.name)} label={g.name} onClick={() => toggle(selGroups, setSelGroups, g.name)} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <NextBtn label="설비 구성 저장 → 다음" stepLabel="설비 계층 구성" patch={{ 설비군: selGroups.join(" · ") || "미선택" }} disabled={selGroups.length === 0} />
            <span className="tnum text-[12px] text-slate-400">{selGroups.length}개 설비군 선택됨</span>
          </div>
        </section>
      )}

      {done === 2 && (
        <section className="rounded-[10px] border border-accent/40 bg-white p-4 md:p-5">
          <div className="mb-1 text-[15px] font-semibold text-navy">3단계 — 계측·데이터 연계</div>
          <p className="mb-3 text-[12.5px] text-body">연결할 데이터 소스를 선택하고 게이트웨이 연계 키를 발급하세요 (Read Only · 원본 보존 원칙).</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <Chip key={s} on={selSources.includes(s)} label={s} onClick={() => toggle(selSources, setSelSources, s)} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setApiKey(`MRV-${site.id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}
              disabled={locked || !!apiKey}
              className="min-h-9 rounded-lg border border-accent/40 px-3 py-1.5 text-[12.5px] font-medium text-accent hover:bg-accent/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
              연계 키 발급
            </button>
            {apiKey && <code className="tnum rounded bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-navy">{apiKey}</code>}
            {apiKey && <span className="text-[11.5px] text-review">키는 게이트웨이 설정에 1회만 표시됩니다 (데모)</span>}
          </div>
          <div className="mt-4">
            <NextBtn
              label="연계 설정 저장 → 다음"
              stepLabel="계측·데이터 연계"
              patch={{ 데이터소스: selSources.join(" · ") || "미선택", 연계키: apiKey ?? "미발급" }}
              disabled={selSources.length === 0 || !apiKey}
            />
          </div>
        </section>
      )}

      {done === 3 && (
        <section className="rounded-[10px] border border-accent/40 bg-white p-4 md:p-5">
          <div className="mb-1 text-[15px] font-semibold text-navy">4단계 — 기준기간·독립변수 설정</div>
          <p className="mb-3 text-[12.5px] text-body">기준선(EnB) 수립에 사용할 기간과 보정 변수 후보를 정하세요. 모델 적합도(R²·CV)는 데이터 축적 후 자동 검증됩니다.</p>
          <label className="mb-3 flex max-w-72 flex-col gap-1 text-[12px] text-body">
            기준기간
            <select value={basePeriod} onChange={(e) => setBasePeriod(e.target.value)} disabled={locked} aria-label="기준기간 선택" className="min-h-9 rounded border border-line bg-white px-2 py-1.5 text-[13px] font-medium text-navy">
              {["직전 12개월 (권장)", "직전 24개월", "지정 기간 (수동)"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {["냉방도일", "난방도일", "생산량", "가동시간"].map((v) => (
              <Chip key={v} on={selVars.includes(v)} label={v} onClick={() => toggle(selVars, setSelVars, v)} />
            ))}
          </div>
          <div className="mt-4">
            <NextBtn label="기준기간 저장 → 다음" stepLabel="기준기간 설정" patch={{ 기준기간: basePeriod, 독립변수: selVars.join(" · ") || "미선택" }} disabled={selVars.length === 0} />
          </div>
        </section>
      )}

      {done === 4 && (
        <section className="rounded-[10px] border border-accent/40 bg-white p-4 md:p-5">
          <div className="mb-1 text-[15px] font-semibold text-navy">5단계 — MRV·보고 개시 요청</div>
          <p className="mb-3 text-[12.5px] text-body">설정을 확인하고 개시를 요청하세요. 개시 후 계측 수집이 시작되고 기준기간 데이터가 차면 보고 회차가 자동 개설됩니다.</p>
          <div className="tnum mb-4 divide-y divide-line/40 rounded-lg bg-surface/60 px-4 py-1 text-[13px]">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="shrink-0 text-slate-400">{k}</span>
                <span className="text-right font-medium text-navy">{v}</span>
              </div>
            ))}
          </div>
          <NextBtn label="개시 요청 (감사로그 기록)" stepLabel="MRV·보고 개시 요청" patch={{ 개시요청일: new Date().toISOString().slice(0, 10) }} />
        </section>
      )}

      {done >= 5 && (
        <section className="rounded-[10px] border border-teal/40 bg-white p-4 md:p-5">
          <div className="mb-1 text-[15px] font-semibold text-teal">✓ 온보딩 완료 — 계측 데이터 수집 대기</div>
          <p className="mb-3 text-[13px] leading-relaxed text-body">
            실제 SaaS에서는 이 시점부터 게이트웨이가 15분 주기 수집을 시작하고, 기준기간 데이터가 확보되면
            기준선 수립 → 보고 회차 자동 개설로 이어집니다. 본 데모는 합성데이터를 {demoSite?.name}에만 생성하므로
            이 사업장의 화면은 수집 대기 상태로 유지됩니다.
          </p>
          <div className="tnum divide-y divide-line/40 rounded-lg bg-surface/60 px-4 py-1 text-[13px]">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="shrink-0 text-slate-400">{k}</span>
                <span className="text-right font-medium text-navy">{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCurrentSite(demoSite?.id ?? "SITE-01")}
          className="min-h-11 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-navy hover:border-accent/50"
        >
          {demoSite?.name}(데모 데이터)으로 전환
        </button>
        <button
          onClick={() => { setCurrentSite(demoSite?.id ?? "SITE-01"); setMenu("master"); window.location.hash = "#/master/site"; }}
          className="min-h-11 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-navy hover:border-accent/50"
        >
          사업장 관리로 이동
        </button>
      </div>
      <div className="text-[12px] text-slate-400">
        단계 완료마다 감사로그 기록 · 실제 SaaS에서는 각 단계가 서버 설정(설비 트리·연계 채널·기준선 정책)을 생성합니다
      </div>
    </div>
  );
}
