import { useUI, deriveVerify, type MenuKey, type ReviewState, type PlanStatus, type InvStatus, type SiteRec, type UserRec } from "../store";

/* ---------- 알림 파생 — 별도 저장 없이 현재 시스템 상태에서 계산 (처리되면 자동 소멸) ---------- */
export interface Notif {
  id: string; // 읽음 상태 추적용 안정 키
  sev: "처리" | "주의" | "안내";
  title: string;
  detail: string;
  menu: MenuKey;
  hash: string;
}

export function deriveNotifs(s: {
  reviewStates: Record<string, ReviewState>;
  planStatus: PlanStatus;
  invStatus: InvStatus;
  esgStatus: "작성 중" | "확정";
  sites: SiteRec[];
  users: UserRec[];
}): Notif[] {
  const out: Notif[] = [];
  const verify = deriveVerify(s.reviewStates);

  if (verify.pending > 0)
    out.push({
      id: "review-pending",
      sev: "처리",
      title: `검토 대기 ${verify.pending}건`,
      detail: "비일상적 조정·데이터 품질 항목 — 승인 시 절감량 재산정·새 계산버전 생성",
      menu: "report",
      hash: "#/report/approve",
    });
  if (s.planStatus !== "승인 완료")
    out.push({
      id: "plan-" + s.planStatus,
      sev: "처리",
      title: `M&V 계획서 ${s.planStatus}`,
      detail: s.planStatus === "승인 대기" ? "승인자 확인 필요 — 계획 사전 승인 전 결과보고서는 초안 취급" : "설정 확정 후 승인 요청 필요",
      menu: "report",
      hash: "#/report/plan",
    });
  if (s.invStatus === "검토 요청" || s.invStatus === "검토 완료·승인 대기" || s.invStatus === "수정 요청")
    out.push({
      id: "inv-" + s.invStatus,
      sev: "처리",
      title: `명세서 ${s.invStatus}`,
      detail: "에너지·배출 명세서 워크플로우 진행 중 — 역할별 처리 필요",
      menu: "report",
      hash: "#/report/inventory",
    });
  if (s.reviewStates["DQ-04"] !== "승인 완료")
    out.push({
      id: "dq04-calib",
      sev: "주의",
      title: "계측기 교정 만료 — CHW 유량계",
      detail: "교정성적서 갱신·영향평가 필요 (DQ-04) — 완료 전 데이터 신뢰도에 반영",
      menu: "verify",
      hash: "#/verify",
    });
  out.push({
    id: "pv02-soiling",
    sev: "주의",
    title: "태양광 오염 손실 검토 중 (PV-02)",
    detail: "손실 추정 28 MWh — 손실 분해로 분리 표시, 보고값 조정 없음 (검토 중)",
    menu: "verify",
    hash: "#/verify/pv",
  });
  s.sites
    .filter((x) => x.status === "온보딩 중")
    .forEach((x) =>
      out.push({
        id: "onboard-" + x.id,
        sev: "안내",
        title: `${x.name} 온보딩 진행 중 (${x.onboard ?? 1}/5)`,
        detail: "설비군 선택 → 연계 → 기준기간 → 개시 요청 순서로 진행",
        menu: "master",
        hash: "#/master/site",
      }),
    );
  const invited = s.users.filter((u) => u.status === "초대 대기").length;
  if (invited > 0)
    out.push({
      id: "invite-wait",
      sev: "안내",
      title: `사용자 초대 수락 대기 ${invited}명`,
      detail: "초대 메일 발송됨 (데모) — 수락 시 계정 활성화",
      menu: "master",
      hash: "#/master/user",
    });
  if (s.esgStatus === "작성 중")
    out.push({
      id: "esg-draft",
      sev: "안내",
      title: "ESG 공시 데이터 미확정",
      detail: "2030 목표 입력 후 확정하면 부록 문서·데이터 팩 기준으로 잠금",
      menu: "report",
      hash: "#/report/esg",
    });
  out.push({
    id: "round-2026h2",
    sev: "안내",
    title: "2026 하반기 회차 자동 개설 예정",
    detail: "보고 주기 종료(2027-01-01) 시 승인된 계획서를 이어받아 자동 개설",
    menu: "report",
    hash: "#/report",
  });
  return out;
}

/* 컴포넌트 공용: 현재 알림 + 미읽음 수 */
export function useNotifs() {
  const { reviewStates, planStatus, invStatus, esgStatus, sites, users, notifRead } = useUI();
  const notifs = deriveNotifs({ reviewStates, planStatus, invStatus, esgStatus, sites, users });
  const unread = notifs.filter((n) => !notifRead.includes(n.id)).length;
  return { notifs, unread };
}

const SEV_BADGE: Record<Notif["sev"], string> = {
  처리: "bg-review/10 text-review",
  주의: "bg-accent/10 text-accent",
  안내: "bg-line text-body",
};

/* ---------- 알림 센터 패널 — 상단 종 버튼으로 열림 (App 루트에서 렌더) ---------- */
export default function NotifCenter() {
  const { closeNotif, setMenu, notifRead, markNotifRead } = useUI();
  const { notifs, unread } = useNotifs();

  const go = (n: Notif) => {
    markNotifRead([n.id]);
    window.location.hash = n.hash;
    setMenu(n.menu);
    closeNotif();
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="알림 센터">
      <div className="absolute inset-0 bg-navy/20" onClick={closeNotif} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl bg-white shadow-2xl md:inset-x-auto md:top-14 md:right-4 md:bottom-auto md:max-h-[70vh] md:w-[400px] md:rounded-xl">
        <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-white px-4 py-3">
          <span className="text-[15px] font-bold text-navy">알림</span>
          <span className="tnum rounded-full bg-review/10 px-2 py-0.5 text-[11px] font-bold text-review">{unread}건 미읽음</span>
          <button
            onClick={() => markNotifRead(notifs.map((n) => n.id))}
            className="ml-auto text-[12px] font-medium text-accent hover:underline"
          >
            모두 읽음
          </button>
          <button onClick={closeNotif} aria-label="닫기" className="rounded px-1.5 text-[18px] leading-none text-slate-400 hover:bg-surface hover:text-navy">
            ×
          </button>
        </div>

        <div className="flex flex-col">
          {notifs.map((n) => {
            const read = notifRead.includes(n.id);
            return (
              <button
                key={n.id}
                onClick={() => go(n)}
                className={`flex items-start gap-2.5 border-b border-line/50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface ${read ? "opacity-60" : ""}`}
              >
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_BADGE[n.sev]}`}>{n.sev}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-navy">
                    {!read && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                    {n.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-body">{n.detail}</span>
                </span>
                <span className="mt-0.5 ml-auto shrink-0 text-[12px] text-slate-400">›</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-line bg-surface/50 px-4 py-2.5">
          <button
            onClick={() => { window.location.hash = "#/report/history"; setMenu("report"); closeNotif(); }}
            className="text-[12px] font-medium text-accent hover:underline"
          >
            전체 처리 이력 (감사로그) ›
          </button>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
            알림은 시스템 상태에서 자동 생성되며 항목이 처리되면 사라집니다 — 별도 발송(이메일·메신저)은 SaaS 확장 항목
          </div>
        </div>
      </div>
    </div>
  );
}
