import { useState } from "react";
import { useUI } from "../store";

const BASE = import.meta.env.BASE_URL;

/* 데모 로그인 — SaaS 전환 시의 진입 화면. 인증 서버 없이 세션 표시만 수행 (화면에 명시) */
export default function Login() {
  const loginAs = useUI((s) => s.loginAs);
  const [email, setEmail] = useState("demo@example.com");
  const [pw, setPw] = useState("demo1234");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAs(email);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* 브랜드 */}
        <div className="mb-6 text-center">
          <img src={`${BASE}logo.svg`} alt="infoSquare" className="mx-auto h-11" />
          <div className="mt-3 text-[20px] font-bold text-navy">디지털 MRV 플랫폼</div>
          <div className="mt-1 text-[13px] text-body">공장 에너지·온실가스 통합 측정·보고·검증</div>
          <span className="mt-2 inline-block rounded bg-review/10 px-2 py-0.5 text-[11px] font-semibold text-review">
            DEMO · 합성데이터
          </span>
        </div>

        {/* 로그인 카드 */}
        <form onSubmit={submit} className="rounded-[10px] border border-line/60 bg-white p-6 shadow-sm">
          <label className="mb-3 flex flex-col gap-1 text-[12.5px] text-body">
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-[16px] text-navy focus:border-accent focus:outline-none md:text-[14px]"
            />
          </label>
          <label className="mb-4 flex flex-col gap-1 text-[12.5px] text-body">
            비밀번호
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              className="min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-[16px] text-navy focus:border-accent focus:outline-none md:text-[14px]"
            />
          </label>
          <button type="submit" className="min-h-11 w-full rounded-lg bg-accent text-[14px] font-semibold text-white transition-opacity hover:opacity-90">
            로그인
          </button>

          <div className="my-4 flex items-center gap-3 text-[11.5px] text-slate-400">
            <span className="h-px flex-1 bg-line" />간편 로그인<span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-2">
            {["Google 계정으로 로그인", "Microsoft 계정으로 로그인 (SSO)"].map((s) => (
              <button
                key={s}
                type="button"
                disabled
                title="SaaS 전환 시 지원 예정 (데모 미지원)"
                className="min-h-11 w-full cursor-not-allowed rounded-lg border border-line/60 bg-surface/60 text-[13px] text-slate-400"
              >
                {s} — SaaS 지원 예정
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-surface/70 px-3 py-2 text-[11.5px] leading-relaxed text-body">
            데모 계정이 미리 입력되어 있습니다 — 그대로 로그인하세요. 인증 서버 없이 세션 표시만 수행하며,
            실제 SaaS에서는 조직별 계정·SSO·권한(작성자/검토자/승인자)이 서버에서 관리됩니다.
          </div>
        </form>

        <div className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          원주공장 공동진단 데모 · 합성데이터 — 공식 MRV 사용 불가
          <br />IPMVP 2022 · ISO 50006 · 배출권거래제 지침 · K-ESG v2.0 준거
        </div>
      </div>
    </div>
  );
}
