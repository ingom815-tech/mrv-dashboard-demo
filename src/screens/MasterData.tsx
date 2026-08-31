import { useState } from "react";
import { mrv, TARIFF, assetPassports, tagKpiMap, type TagMeta, type MeterMeta } from "../lib/mrvData";
import { useCalc } from "../lib/useCalc";
import { useUI, activeEf, type Role } from "../store";
import ContextBar, { TopActions } from "../components/ContextBar";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

const TABS = [
  { key: "asset", label: "설비·센서" },
  { key: "factor", label: "배출계수·가정값" },
  { key: "user", label: "사용자·권한" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const initialTab = (): TabKey => {
  const seg = window.location.hash.split("/")[2];
  return (TABS.find((t) => t.key === seg)?.key ?? "asset") as TabKey;
};

/* 설비 계층 (합성 시나리오 고정 구성) */
const HIERARCHY: Array<{ name: string; assets: string[] }> = [
  { name: "열원", assets: ["CH-01 냉동기 1", "CH-02 냉동기 2"] },
  { name: "반송 (펌프)", assets: ["CHWP 냉수펌프", "CWP 냉각수펌프"] },
  { name: "방열", assets: ["CT-01 냉각탑", "냉각수"] },
  { name: "헤더·플랜트", assets: ["냉수 헤더", "냉수플랜트"] },
  { name: "보정변수", assets: ["외기", "생산"] },
];

const PERMS: Array<{ feature: string; roles: Record<Role, boolean> }> = [
  { feature: "성과·품질 조회", roles: { 일반: true, 검토자: true, 승인자: true } },
  { feature: "검토 완료 처리", roles: { 일반: false, 검토자: true, 승인자: false } },
  { feature: "승인 (확정)", roles: { 일반: false, 검토자: false, 승인자: true } },
  { feature: "배출계수 등록·단가 변경", roles: { 일반: false, 검토자: true, 승인자: true } },
  { feature: "승인 완료 결과 수정", roles: { 일반: false, 검토자: false, 승인자: false } },
];

/* 태그 상세 Drawer — Asset & Meter Registry */
function TagDrawer({ tag, onClose }: { tag: TagMeta; onClose: () => void }) {
  const m = mrv.meters.find((x) => x.tag === tag.id);
  const info = tagKpiMap[tag.id];
  const expired = m?.expiry && m.expiry !== "—" && m.expiry < mrv.cfg.reportEnd;
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px] text-slate-400">{k}</span>
      <span className="tnum text-right text-[12.5px] font-medium text-navy">{v}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="태그 상세">
      <div className="absolute inset-0 bg-navy/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[400px] flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-navy">{m?.meter ?? tag.id}</span>
              {expired ? (
                <span className="rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-bold text-review">교정 만료</span>
              ) : (
                <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[11px] font-bold text-teal">정상</span>
              )}
            </div>
            <div className="mt-0.5 text-[12px] text-slate-400">
              {tag.id} · {tag.desc}
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="rounded-lg px-2 py-1 text-[18px] leading-none text-slate-400 hover:bg-surface hover:text-navy">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 px-6 py-5">
          <section className="rounded-xl bg-surface px-4 py-2">
            <Row k="설비 연결" v={tag.asset} />
            <Row k="계측기 유형" v={m?.type ?? "—"} />
            <Row k="정확도" v={m?.accuracy ?? "—"} />
            <Row k="단위 · 주기" v={`${tag.unit} · ${m?.period ?? 15}분`} />
            <Row k="데이터 출처" v={m?.src ?? "—"} />
          </section>
          <section className="rounded-xl bg-surface px-4 py-2">
            <Row k="최근 교정일" v={m?.calib ?? "—"} />
            <Row k="교정 만료일" v={m?.expiry ?? "—"} />
            {expired && <Row k="검토 상태" v="영향평가 대기 (DQ-04)" />}
          </section>
          <section>
            <div className="mb-1.5 text-[13px] font-semibold text-navy">영향을 받는 계산 KPI</div>
            <div className="flex flex-wrap gap-1.5">
              {(info?.kpis ?? []).map((k) => (
                <span key={k} className="rounded bg-accent/8 px-2 py-0.5 text-[12px] font-medium text-navy">
                  {k}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-body">
              전력 절감량 산정 포함:{" "}
              <b className={info?.inCalc ? "text-teal" : "text-body"}>{info?.inCalc ? "포함" : "미포함 (참고 KPI)"}</b>
              {info?.note && <> · {info.note}</>}
            </div>
          </section>
          <section className="rounded-xl bg-surface px-4 py-3 text-[12px] leading-relaxed text-body">
            증적: 계측기 사양서·교정성적서 (데모 — 파일 미첨부) · 변경이력: 등록 2025-01-01, 이후 변경 없음 ·
            data_origin = SYNTHETIC
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function MasterData() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [assetFilter, setAssetFilter] = useState<string | null>(null);
  const [selTag, setSelTag] = useState<TagMeta | null>(null);
  const { role, efList, registerEf, tariffValue, setTariff } = useUI();
  const calc = useCalc();
  const ef = activeEf(efList);
  const [form, setForm] = useState({ value: "", source: "", baseYear: "2025", validFrom: "2026-07-01", validTo: "2027-06-30" });
  const [tariffInput, setTariffInput] = useState(String(tariffValue));

  const tags = mrv.tags.filter((t) => !assetFilter || t.asset === assetFilter);
  const meterOf = (tag: string): MeterMeta | undefined => mrv.meters.find((m) => m.tag === tag);
  const canEdit = role !== "일반";

  return (
    <div className="flex min-h-screen flex-col gap-3 px-6 py-4">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="shrink-0 text-[20px] leading-tight font-bold text-navy">
            기준정보 — 설비·계측·계수 관리
          </h1>
          <span
            className="shrink-0 cursor-help rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review"
            title="본 화면의 모든 값은 데모용 합성데이터 기준정보입니다. 공식 MRV 보고에 사용할 수 없습니다."
          >
            DEMO · 합성데이터
          </span>
        </div>
        <TopActions />
      </header>
      <ContextBar />

      <div className="flex shrink-0 gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-[13px] transition-colors ${
              tab === t.key
                ? "border-accent font-semibold text-accent"
                : "border-transparent text-body hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- 탭 1: 설비·센서 ---------- */}
      {tab === "asset" && (
        <section className="grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-3">
          <div className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">설비 계층</div>
            <div className="text-[12px] text-body">원주공장 › 중앙 냉수플랜트</div>
            <div className="mt-2 flex flex-col gap-2">
              <button
                onClick={() => setAssetFilter(null)}
                className={`rounded px-2 py-1 text-left text-[12px] ${
                  assetFilter === null ? "bg-accent/10 font-semibold text-accent" : "text-body hover:bg-surface"
                }`}
              >
                전체 태그 ({mrv.tags.length})
              </button>
              {HIERARCHY.map((g) => (
                <div key={g.name}>
                  <div className="px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    {g.name}
                  </div>
                  {g.assets.map((a) => {
                    const n = mrv.tags.filter((t) => t.asset === a).length;
                    if (n === 0) return null;
                    return (
                      <button
                        key={a}
                        onClick={() => setAssetFilter(assetFilter === a ? null : a)}
                        className={`tnum block w-full rounded px-2 py-1 text-left text-[12px] ${
                          assetFilter === a
                            ? "bg-accent/10 font-semibold text-accent"
                            : "text-body hover:bg-surface"
                        }`}
                      >
                        {a} ({n})
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {(() => {
            const passport = assetFilter ? assetPassports.find((p) => p.asset === assetFilter) : null;
            if (!passport) return null;
            const pTags = mrv.tags.filter((t) => t.asset === passport.asset);
            const pMeters = mrv.meters.filter((m) => pTags.some((t) => t.id === m.tag));
            const perfRow = mrv.perf.table.find((r) => passport.asset.includes(r.name.split(" ")[0]));
            return (
              <div className="flex flex-col gap-3">
                {/* Asset Passport 상단 — 설비 기본 정보 */}
                <div className="rounded-[10px] border border-line/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[17px] font-bold text-navy">{passport.asset}</span>
                      <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[11px] font-bold text-teal">{passport.status}</span>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent">MRV 산정 포함</span>
                      <span className="tnum rounded bg-line/60 px-1.5 py-0.5 text-[11px] font-medium text-body">데이터 준비도 {passport.readiness}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Asset Passport</span>
                  </div>
                  <div className="tnum mt-3 grid grid-cols-4 gap-x-6 gap-y-1.5 text-[13px]">
                    <div><span className="text-slate-400">설비 ID </span><span className="font-medium text-navy">{passport.id}</span></div>
                    <div><span className="text-slate-400">제조사 </span><span className="font-medium text-navy">{passport.maker}</span></div>
                    <div><span className="text-slate-400">모델 </span><span className="font-medium text-navy">{passport.model}</span></div>
                    <div><span className="text-slate-400">정격 </span><span className="font-medium text-navy">{passport.rating}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">설치 </span><span className="font-medium text-navy">{passport.installed}</span></div>
                    <div className="col-span-2">
                      <span className="text-slate-400">계산 KPI </span>
                      {passport.kpis.map((k) => (
                        <span key={k} className="mr-1 rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-navy">{k}</span>
                      ))}
                      {perfRow && (
                        <span className="ml-1 text-[12px] text-body">
                          현재 {perfRow.rep !== null ? perfRow.rep.toFixed(perfRow.digits) : "—"} {perfRow.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 데이터 계보: 계측기 → 태그 → KPI → 산정 */}
                <div className="rounded-[10px] border border-line/70 bg-white p-4">
                  <div className="mb-2 text-[14px] font-semibold text-navy">데이터 계보 (계측 → 산정)</div>
                  <div className="flex items-stretch gap-2 overflow-x-auto text-[12px]">
                    <div className="flex min-w-32 flex-col gap-1 rounded-lg bg-surface px-3 py-2">
                      <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">계측기</span>
                      {pMeters.map((m) => (
                        <span key={m.meter + m.tag} className="tnum font-medium text-navy">{m.meter}</span>
                      ))}
                    </div>
                    <span className="self-center text-[16px] text-slate-300">›</span>
                    <div className="flex min-w-32 flex-col gap-1 rounded-lg bg-surface px-3 py-2">
                      <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">태그</span>
                      {pTags.map((t) => (
                        <span key={t.id} className="tnum font-medium text-navy">{t.id}</span>
                      ))}
                    </div>
                    <span className="self-center text-[16px] text-slate-300">›</span>
                    <div className="flex min-w-32 flex-col gap-1 rounded-lg bg-surface px-3 py-2">
                      <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">설비 KPI</span>
                      {passport.kpis.map((k) => (
                        <span key={k} className="font-medium text-navy">{k}</span>
                      ))}
                    </div>
                    <span className="self-center text-[16px] text-slate-300">›</span>
                    <div className="flex min-w-36 flex-col justify-center gap-1 rounded-lg bg-navy px-3 py-2 text-white">
                      <span className="text-[10px] font-semibold tracking-wide text-white/60 uppercase">MRV 산정</span>
                      <span className="font-semibold">SYS_kW 합산 → 기준선 모델</span>
                      <span className="font-semibold">→ 검증 절감량</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-body">
                    이 설비의 센서가 어떤 태그·KPI를 거쳐 절감량 산정에 반영되는지의 추적 경로 · 상위 경계: 중앙 냉수플랜트
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 연결 계측기·교정 */}
                  <div className="rounded-[10px] border border-line/70 bg-white p-4">
                    <div className="mb-2 text-[14px] font-semibold text-navy">연결 계측기·교정</div>
                    <table className="tnum w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] text-body">
                          <th className="py-1 font-medium">계측기</th>
                          <th className="py-1 font-medium">태그</th>
                          <th className="py-1 font-medium">정확도</th>
                          <th className="py-1 font-medium">교정일</th>
                          <th className="py-1 font-medium">만료</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pMeters.map((m) => {
                          const expired = m.expiry && m.expiry !== "—" && m.expiry < mrv.cfg.reportEnd;
                          return (
                            <tr key={m.tag} className="border-b border-line/50 last:border-0">
                              <td className="py-1.5 font-medium text-navy">{m.meter}</td>
                              <td className="py-1.5 text-body">{m.tag}</td>
                              <td className="py-1.5 text-body">{m.accuracy}</td>
                              <td className="py-1.5 text-body">{m.calib}</td>
                              <td className="py-1.5">
                                {expired ? (
                                  <span className="rounded bg-review/10 px-1.5 py-0.5 text-[10px] font-bold text-review">만료</span>
                                ) : (
                                  <span className="text-body">{m.expiry}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* 이력 타임라인 */}
                  <div className="rounded-[10px] border border-line/70 bg-white p-4">
                    <div className="mb-2 text-[14px] font-semibold text-navy">설비·MRV 이력</div>
                    <div className="flex flex-col">
                      {passport.history.map((h, i) => (
                        <div key={i} className="relative flex gap-3 pb-3 last:pb-0">
                          <div className="flex flex-col items-center">
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                            {i < passport.history.length - 1 && <span className="w-px flex-1 bg-line" />}
                          </div>
                          <div>
                            <div className="tnum text-[11px] text-slate-400">{h.date}</div>
                            <div className="text-[12px] leading-snug text-navy">{h.what}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })() ?? null}
          <div className={`rounded-[10px] border border-line/70 bg-white p-4 ${assetFilter && assetPassports.some((p) => p.asset === assetFilter) ? "hidden" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">
                센서·태그 {assetFilter ? `— ${assetFilter}` : ""}
                <span className="tnum ml-1.5 text-[12px] font-normal text-body">({tags.length}개)</span>
              </span>
              <span className="text-[12px] text-body">행 클릭 시 계측기 상세 · 수집 주기 15분 (생산 60분)</span>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">태그</th>
                  <th className="py-1.5 font-medium">설명</th>
                  <th className="py-1.5 font-medium">설비</th>
                  <th className="py-1.5 font-medium">단위</th>
                  <th className="py-1.5 text-right font-medium">주기(분)</th>
                  <th className="py-1.5 pl-4 font-medium">계측기</th>
                  <th className="py-1.5 font-medium">정확도</th>
                  <th className="py-1.5 font-medium">교정일</th>
                  <th className="py-1.5 font-medium">교정 만료</th>
                  <th className="py-1.5 font-medium">출처</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t: TagMeta) => {
                  const m = meterOf(t.id);
                  const expired = m?.expiry && m.expiry !== "—" && m.expiry < mrv.cfg.reportEnd;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelTag(t)}
                      className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-surface"
                    >
                      <td className="py-1.5 font-medium text-navy">{t.id}</td>
                      <td className="py-1.5 text-body">{t.desc}</td>
                      <td className="py-1.5 text-body">{t.asset}</td>
                      <td className="py-1.5 text-body">{t.unit}</td>
                      <td className="py-1.5 text-right text-body">{m?.period ?? 15}</td>
                      <td className="py-1.5 pl-4 text-body">{m?.meter ?? "—"}</td>
                      <td className="py-1.5 text-body">{m?.accuracy ?? "—"}</td>
                      <td className="py-1.5 text-body">{m?.calib ?? "—"}</td>
                      <td className="py-1.5">
                        {expired ? (
                          <span className="rounded bg-review/10 px-1.5 py-0.5 text-[10px] font-bold text-review">
                            만료 {m!.expiry}
                          </span>
                        ) : (
                          <span className="text-body">{m?.expiry ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-body">{m?.src ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------- 탭 2: 배출계수·가정값 ---------- */}
      {tab === "factor" && (
        <>
          <section className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-navy">전력 배출계수 — 등록·적용·버전관리</span>
              <span className="tnum text-[12px] text-body">
                적용 중 <b className="text-navy">{ef.version}</b> → 계산버전{" "}
                <b className="text-navy">{calc.version}</b> · 탄소 감축{" "}
                <b className="text-teal">{fmt(calc.kpi.co2, 1)} tCO₂eq</b>
              </span>
            </div>
            <table className="tnum w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">버전</th>
                  <th className="py-1.5 text-right font-medium">값</th>
                  <th className="py-1.5 pl-4 font-medium">단위</th>
                  <th className="py-1.5 font-medium">출처</th>
                  <th className="py-1.5 text-right font-medium">기준연도</th>
                  <th className="py-1.5 pl-4 font-medium">유효기간</th>
                  <th className="py-1.5 font-medium">등록일</th>
                  <th className="py-1.5 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {efList.map((e) => (
                  <tr key={e.version} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 font-medium text-navy">{e.version}</td>
                    <td className="py-1.5 text-right text-body">{e.value}</td>
                    <td className="py-1.5 pl-4 text-body">{e.unit}</td>
                    <td className="py-1.5 text-body">{e.source}</td>
                    <td className="py-1.5 text-right text-body">{e.baseYear}</td>
                    <td className="py-1.5 pl-4 text-body">{e.validFrom} ~ {e.validTo}</td>
                    <td className="py-1.5 text-body">{e.registeredAt}</td>
                    <td className="py-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          e.status === "적용 중" ? "bg-teal/10 text-teal" : "bg-line text-body"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 rounded-lg bg-surface px-4 py-3">
              <div className="mb-2 text-[12px] font-semibold text-navy">
                신규 배출계수 등록 {!canEdit && <span className="font-normal text-review">— 검토자·승인자 역할만 가능</span>}
              </div>
              <div className="flex flex-wrap items-end gap-3 text-[12px]">
                <label className="flex flex-col gap-1 text-body">
                  값 (tCO₂eq/MWh)
                  <input
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="0.4XXX"
                    className="tnum w-28 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <label className="flex flex-col gap-1 text-body">
                  출처
                  <input
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    placeholder="데모 입력"
                    className="w-44 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <label className="flex flex-col gap-1 text-body">
                  기준연도
                  <input
                    value={form.baseYear}
                    onChange={(e) => setForm({ ...form, baseYear: e.target.value })}
                    className="tnum w-20 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <label className="flex flex-col gap-1 text-body">
                  유효 시작
                  <input
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="tnum w-28 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <label className="flex flex-col gap-1 text-body">
                  유효 종료
                  <input
                    value={form.validTo}
                    onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                    className="tnum w-28 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <button
                  disabled={!canEdit || !Number.isFinite(Number(form.value)) || Number(form.value) <= 0}
                  onClick={() =>
                    registerEf({
                      value: Number(form.value),
                      source: form.source,
                      baseYear: Number(form.baseYear) || 2025,
                      validFrom: form.validFrom,
                      validTo: form.validTo,
                    })
                  }
                  className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  등록·적용
                </button>
              </div>
              <div className="mt-2 text-[11px] text-body">
                등록 시 기존 버전은 이력으로 보존되고, 새 계수가 적용되어 <b className="text-navy">새 계산버전이 생성</b>됩니다.
                탄소 감축량이 재산정되며 감사로그에 기록됩니다.
              </div>
            </div>
          </section>

          <section className="grid shrink-0 grid-cols-3 gap-3">
            <div className="rounded-[10px] border border-line bg-white p-4">
              <div className="mb-2 text-[14px] font-semibold text-navy">냉매 GWP</div>
              <table className="tnum w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-body">
                    <th className="py-1.5 font-medium">냉매</th>
                    <th className="py-1.5 text-right font-medium">GWP (AR5)</th>
                  </tr>
                </thead>
                <tbody>
                  {mrv.gwpList.map((g) => (
                    <tr key={g.type} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 font-medium text-navy">{g.type}</td>
                      <td className="py-1.5 text-right text-body">{fmt(g.gwp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[11px] text-body">
                비산배출 = 보충량 kg × GWP ÷ 1000 · 초기 충전은 배출 아님 · 전력 감축과 합산하지 않음
              </div>
            </div>

            <div className="rounded-[10px] border border-line bg-white p-4">
              <div className="mb-2 text-[14px] font-semibold text-navy">가정단가</div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-[12px] text-body">
                  전력 단가 (원/kWh)
                  <input
                    value={tariffInput}
                    onChange={(e) => setTariffInput(e.target.value)}
                    className="tnum w-28 rounded border border-line bg-white px-2 py-1.5 text-navy"
                  />
                </label>
                <button
                  disabled={!canEdit || !Number.isFinite(Number(tariffInput)) || Number(tariffInput) <= 0}
                  onClick={() => setTariff(Number(tariffInput))}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  적용
                </button>
              </div>
              <div className="tnum mt-3 text-[12px] text-body">
                현재 적용 <b className="text-navy">{fmt(tariffValue)} 원/kWh</b> · 비용 절감{" "}
                <b className="text-teal">{fmt(calc.kpi.costKrw / 10000)} 만원</b>
              </div>
              <div className="mt-2 text-[11px] text-body">
                확정요금이 아닌 데모 가정값 — 실제 기대성과가 아님 (기본 {TARIFF.value} 원/kWh)
              </div>
            </div>

            <div className="rounded-[10px] border border-line bg-white p-4">
              <div className="mb-2 text-[14px] font-semibold text-navy">데모 개선 가정값 (고정)</div>
              <div className="tnum flex flex-col gap-1.5 text-[12px] text-body">
                <div>냉동기 1 신설 kW/RT <b className="text-navy">−{mrv.cfg.post.chillerImprovePct}%</b></div>
                <div>펌프 VFD <b className="text-navy">−{mrv.cfg.post.pumpVfdSavePct}%</b></div>
                <div>냉각탑 제어 <b className="text-navy">−{mrv.cfg.post.ctSavePct}%</b></div>
                <div>냉수 ΔT <b className="text-navy">3.6 → {mrv.cfg.post.deltaT.toFixed(1)}℃</b></div>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-body">
                기준기간 2025년 · 보고기간 2026-01~06 · 개선 가동 2026-01-01 (확정사항 — 변경 불가).
                seed 고정 결정론적 생성으로 항상 동일한 데이터가 재현됩니다.
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------- 탭 3: 사용자·권한 ---------- */}
      {tab === "user" && (
        <section className="grid shrink-0 grid-cols-2 gap-3">
          <div className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">역할별 권한</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">기능</th>
                  {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
                    <th key={r} className={`py-1.5 text-center font-medium ${role === r ? "text-accent" : ""}`}>
                      {r}
                      {role === r && " (현재)"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map((p) => (
                  <tr key={p.feature} className="border-b border-line/60 last:border-0">
                    <td className="py-2 text-body">{p.feature}</td>
                    {(["일반", "검토자", "승인자"] as Role[]).map((r) => (
                      <td key={r} className="py-2 text-center">
                        {p.roles[r] ? (
                          <span className="font-bold text-teal">O</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-body">
              검토와 승인은 서로 다른 역할이 수행 (역할 분리 원칙) · 승인 완료 결과는 모든 역할에서 수정 불가
            </div>
          </div>

          <div className="rounded-[10px] border border-line bg-white p-4">
            <div className="mb-2 text-[14px] font-semibold text-navy">사용자 (데모)</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-body">
                  <th className="py-1.5 font-medium">이름</th>
                  <th className="py-1.5 font-medium">역할</th>
                  <th className="py-1.5 font-medium">소속</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "현장 운영자 (데모)", role: "일반", org: "원주공장 시설팀" },
                  { name: "MRV 검토자 (데모)", role: "검토자", org: "에너지관리 담당" },
                  { name: "MRV 승인자 (데모)", role: "승인자", org: "MRV 책임자" },
                ].map((u) => (
                  <tr key={u.name} className="border-b border-line/60 last:border-0">
                    <td className="py-2 font-medium text-navy">{u.name}</td>
                    <td className="py-2 text-body">{u.role}</td>
                    <td className="py-2 text-body">{u.org}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-body">
              데모에서는 우측 상단 역할 전환으로 사용자를 대신합니다. 실서비스에서는 계정·인증으로 분리됩니다.
            </div>
          </div>
        </section>
      )}
      {selTag && <TagDrawer tag={selTag} onClose={() => setSelTag(null)} />}
    </div>
  );
}
