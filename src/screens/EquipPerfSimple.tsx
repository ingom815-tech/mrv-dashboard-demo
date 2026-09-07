import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useCalc } from "../lib/useCalc";
import { useUI } from "../store";
import { useEquip, requiredOk, typeOf } from "../config/equipmentStore";
import { Btn, Card } from "../components/ui";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* 설비별 성과 — 기본 모드. 설비 설정(equipmentStore)에 등록된 설비를 읽어 동적으로 구성.
   데모 연동 설비는 엔진 산정의 설비별 기여에 매핑, 신규 설비는 수집 대기/산정 제외로 정직 표기. */
export default function EquipPerfSimple() {
  const calc = useCalc();
  const setMenu = useUI((s) => s.setMenu);
  const { equipment } = useEquip();
  const contrib = (calc.savings.contrib ?? []) as Array<{ key: string; label: string; before: number; after: number }>;

  const rows = equipment.map((e) => {
    const ok = requiredOk(e);
    const cKey = e.engineTag ? e.engineTag.toLowerCase().replace("_kw", "") : null;
    const c = cKey ? contrib.find((x) => x.key === cKey) : null;
    const cutMWh = c ? Math.max(0, c.before - c.after) / 1000 : 0;
    const state = !ok ? "산정 제외" : e.demo ? "산정 반영" : "수집 대기";
    return { id: e.id, name: e.name, type: typeOf(e.type).name, phase: e.phase, ok, cutMWh, state };
  });
  const chartRows = rows.filter((r) => r.state === "산정 반영");
  const totalCut = chartRows.reduce((s, r) => s + r.cutMWh, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tk-title">설비별 성과</h1>
          <p className="tk-label mt-1">등록된 설비 {equipment.length}개 중 {chartRows.length}개가 산정에 반영되어 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">DEMO · 합성데이터</span>
          <Btn kind="secondary" small onClick={() => setMenu("equipment")}>상세 보기</Btn>
        </div>
      </header>

      {/* 설비 단위 감축 기여 막대 1개 */}
      <Card title={<span>설비 단위 감축 기여 <span className="tk-label">MWh · 도입 전 사용량과의 차이</span></span>}>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#eef1f4" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7684" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12.5, fill: "#191f28" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(15,118,110,0.06)" }}
                formatter={(v) => [`${fmt(Number(v ?? 0), 1)} MWh`, "감축 기여"]}
                labelStyle={{ fontWeight: 600, color: "#191f28" }}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", fontSize: 13, padding: "10px 14px" }}
              />
              <Bar dataKey="cutMWh" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false}>
                {chartRows.map((r) => (
                  <Cell key={r.id} fill="#0f766e" fillOpacity={r.phase === "도입 후" ? 0.9 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="tk-label mt-1">
          진한 막대는 개선(도입 후) 설비입니다. 합계 {fmt(totalCut, 1)} MWh를 감축했습니다.
          COP 등 성능 지표는 상세 보기에서 확인합니다.
        </p>
      </Card>

      {/* 등록 설비 상태 — 설정을 그대로 반영 */}
      <Card
        title="등록 설비 상태"
        action={<Btn kind="secondary" small onClick={() => setMenu("equipconfig")}>설정</Btn>}
      >
        <div className="flex flex-col">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#f0f2f4] py-2.5 last:border-0">
              <span className="min-w-44 text-[14px] font-medium text-ink">{r.name}</span>
              <span className="tk-label">{r.type} · {r.phase}</span>
              <span className="tnum ml-auto text-[13.5px] font-semibold text-ink">
                {r.state === "산정 반영" ? `${fmt(r.cutMWh, 1)} MWh` : "—"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  r.state === "산정 반영" ? "bg-brand/10 text-brand" : r.state === "산정 제외" ? "bg-warn/10 text-warn" : "bg-[#f2f4f6] text-sub"
                }`}
              >
                {r.state}
              </span>
            </div>
          ))}
        </div>
        <p className="tk-label mt-2">
          필수 계측이 연결되지 않은 설비는 산정에서 제외됩니다. 새로 등록한 설비는 데이터 수집이 시작되면 반영됩니다 (데모는 합성데이터 없음).
        </p>
      </Card>
    </div>
  );
}
