import type { ReactNode } from "react";
import { Pencil } from "lucide-react";

/* 공통 인터랙션 컴포넌트 — 2026-09 단순화 개편.
   원칙: 조작 가능한 요소는 정적 텍스트와 한눈에 구분(세그먼트·스위치·채움 버튼·연필 아이콘),
   모든 요소는 hover·active·disabled 3상태를 가짐. */

/* ---------- 버튼: 주(강조 채움) / 보조(회색 배경). 텍스트 링크형 금지 ---------- */
export function Btn({
  kind = "primary",
  children,
  onClick,
  disabled,
  small,
}: {
  kind?: "primary" | "secondary" | "danger";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const size = small ? "min-h-8 px-3 text-[12.5px]" : "min-h-10 px-4 text-[13.5px]";
  const tone =
    kind === "primary"
      ? "bg-brand text-white hover:bg-[#0d6a63] active:bg-[#0b5d57]"
      : kind === "danger"
        ? "bg-risk/10 text-risk hover:bg-risk/15 active:bg-risk/20"
        : "bg-[#f2f4f6] text-ink hover:bg-[#e8ebee] active:bg-[#dfe3e7]";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${size} ${tone}`}>
      {children}
    </button>
  );
}

/* ---------- 세그먼트 컨트롤 (토스식 pill 탭) — "고를 수 있는 것"을 형태로 드러냄 ---------- */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-[12px] bg-[#e9edf1] p-1">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-9 rounded-[9px] px-3.5 text-[13.5px] whitespace-nowrap transition-colors ${
            value === o.key
              ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "font-medium text-sub hover:text-ink active:bg-white/50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 밑줄형 탭 (문서 내부 보조 탭) — 선택: 강조 밑줄 2px + 600 ---------- */
export function UnderTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 border-b border-[#e5e8eb]">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] whitespace-nowrap transition-colors ${
            value === o.key
              ? "border-brand font-semibold text-ink"
              : "border-transparent font-normal text-sub hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 토스식 스위치 — 브라우저 기본형 금지 ---------- */
export function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-brand hover:bg-[#0d6a63]" : "bg-[#d1d6db] hover:bg-[#c2c8ce]"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left] ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

/* ---------- 입력란 — 배경 회색, 포커스 강조 테두리, placeholder 예시 필수 ---------- */
export function Input({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = "text",
  disabled,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string; // 입력 예시를 반드시 표기
  ariaLabel: string;
  type?: string;
  disabled?: boolean;
  width?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`tk-input min-h-10 px-3 text-[14px] ${width ?? "w-full"}`}
    />
  );
}

/* ---------- 카드 — radius 16 · 그림자 · 우상단 설정 버튼 슬롯 ---------- */
export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode; // 커스텀 가능한 카드의 "설정" 버튼 등
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tk-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <div className="tk-card-title">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- 편집 가능한 값 — 연필 아이콘 상시 노출, hover 하이라이트 ---------- */
export function Editable({
  children,
  onEdit,
  label,
}: {
  children: ReactNode;
  onEdit: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onEdit}
      aria-label={`${label} 편집`}
      className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-[#f2f4f6] active:bg-[#e8ebee]"
    >
      {children}
      <Pencil size={16} className="shrink-0 text-sub transition-colors group-hover:text-brand" />
    </button>
  );
}
