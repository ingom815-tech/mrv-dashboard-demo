/* 수기 입력 필드 — 허용된 항목만 실무자가 직접 기입 (blur 시 저장·감사로그 기록) */
export default function ManualField({
  fieldKey,
  label,
  stored,
  disabled,
  multiline,
  placeholder,
  commit,
}: {
  fieldKey: string;
  label: string;
  stored: string;
  disabled: boolean;
  multiline?: boolean;
  placeholder?: string;
  commit: (key: string, label: string, value: string) => void;
}) {
  const cls =
    "w-full rounded border border-line bg-white px-2 py-1.5 text-[16px] text-navy focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-slate-400 md:text-[13px]";
  const onBlur = (v: string) => {
    if (v !== stored) commit(fieldKey, label, v);
  };
  return multiline ? (
    <textarea
      key={fieldKey + ":" + stored}
      defaultValue={stored}
      disabled={disabled}
      placeholder={placeholder}
      rows={2}
      aria-label={label}
      onBlur={(e) => onBlur(e.target.value)}
      className={cls}
    />
  ) : (
    <input
      key={fieldKey + ":" + stored}
      defaultValue={stored}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      onBlur={(e) => onBlur(e.target.value)}
      className={cls}
    />
  );
}
