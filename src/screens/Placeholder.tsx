export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-8">
      <h1 className="text-[26px] font-bold text-navy">{title}</h1>
      <div className="mt-4 rounded-2xl border border-line bg-white p-6 text-[13px] leading-relaxed text-slate-500 shadow-card">
        {desc}
      </div>
    </div>
  );
}
