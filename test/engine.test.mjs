// node test/engine.test.mjs — 산정 엔진 회귀 테스트(합성데이터 기준 기대범위)
import { generate } from "../engine/synth.js";
import * as MRV from "../engine/mrv.js";
const data = generate();
const cfg = data.meta.assumptions;
const daily = MRV.aggregateDaily(data);
const bl = MRV.fitBaseline(daily, cfg);
const sv = MRV.computeSavings(daily, bl, cfg, data.nonRoutine, { value: 0.4594 }, { value: 145 });
const q = MRV.quality(data, [cfg.reportStart, cfg.reportEnd]);
const rf = MRV.refrigerantEmissions(data.refrigerant, [cfg.reportStart, cfg.reportEnd]);
const ok = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };
ok(data.rows.length === 52416, `rows 15분×546일 = ${data.rows.length}`);
ok(daily.length === 546, `daily ${daily.length}`);
ok(bl.model && bl.model.r2 > 0.95 && bl.model.cvRmse < 0.1, `baseline R² ${bl.model.r2.toFixed(3)} CV(RMSE) ${(bl.model.cvRmse*100).toFixed(1)}%`);
ok(bl.excludedDays.length === 2, `기준기간 결측 제외일 ${bl.excludedDays.join(",")}`);
ok(sv.nExcluded === 12, `보고기간 제외일 ${sv.nExcluded} (정비 11일 + 통신장애 1일)`);
ok(sv.savePct > 0.2 && sv.savePct < 0.4, `절감률 ${(sv.savePct*100).toFixed(1)}% (데모 가정값 범위)`);
ok(Math.abs(sv.co2 - sv.sumSave/1000*0.4594) < 1e-6, `감축량 = 절감 MWh × EF`);
ok(rf.total > 0 && rf.items.some(i => !i.counted), `냉매 별도 산정 ${rf.total.toFixed(2)} tCO₂eq, 초기충전 제외`);
ok(q.byTag.filter(t => t.expired).length === 1 && q.byTag.find(t => t.tag === "CHW_flow").expired, `교정만료 1건 = CHW_flow`);
ok(q.issues.map(i => i.id).join(",") === "DQ-05,DQ-06,DQ-03,DQ-04,NR-02", `보고기간 이슈 ${q.issues.map(i=>i.id).join(",")}`);
ok(data.rows.every(r => r.s.SYS_kW !== undefined), "모든 레코드에 상태코드");

// ---------- 확장 테스트: 버전관리·조정·정제 규칙·정합성 ----------
// 배출계수 변경 시 탄소량 재계산 (절감 kWh는 불변)
const sv2 = MRV.computeSavings(daily, bl, cfg, data.nonRoutine, { value: 0.5 }, { value: 145 });
ok(Math.abs(sv2.co2 - sv2.sumSave / 1000 * 0.5) < 1e-6 && Math.abs(sv2.sumSave - sv.sumSave) < 1e-6,
  "배출계수 변경 → 탄소량만 재계산, 절감 kWh 불변");

// 비일상적 조정(NR-01) 승인 전·후: 조정 기준선 -6,200 kWh 반영 → 절감량 동일 폭 감소
const nrApproved = data.nonRoutine.map(n => n.id === "NR-01" ? { ...n, status: "승인 완료" } : n);
const sv3 = MRV.computeSavings(daily, bl, cfg, nrApproved, { value: 0.4594 }, { value: 145 });
ok(Math.abs((sv.sumSave - sv3.sumSave) - 6200) < 1.0,
  `NR-01 승인 전후 절감량 차이 = 조정량 6,200 kWh (실측 ${(sv.sumSave - sv3.sumSave).toFixed(1)})`);
ok(sv3.daily.filter(x => x.nrAdj !== 0).length === 61, "NR-01 조정이 기간(5~6월 61일)에 일할 배분");

// 정제 규칙 R-01 경계: 결측 46% 일은 제외, 8% 일은 비례 추정 후 사용
const d0220 = daily.find(x => x.date === "2026-02-20");
const d0508 = daily.find(x => x.date === "2026-05-08");
ok(d0220 && d0220.usable === false, "결측 10% 초과 일(2026-02-20) 산정 제외");
ok(d0508 && d0508.usable === true && d0508.estimated === true, "결측 10% 이하 일(2026-05-08) 비례 추정 사용");

// 기준선 부적합 경로: 공선형 입력이면 OLS가 null (부적합 처리 가능)
ok(MRV.ols([[1, 1, 2], [2, 2, 3], [3, 3, 4], [4, 4, 5]]) === null, "공선형 입력 OLS null (부적합 검출)");

// 월별 집계 정합성: 월 합계 절감량 = 총 절감량 (CSV·보고서 출력 일치)
const mon2 = MRV.monthly(sv.daily, { sum: ["saving", "adjBaseNR", "kwhDay"] });
const monSave = mon2.reduce((s, m) => s + (m.sums.saving || 0), 0);
ok(Math.abs(monSave - sv.sumSave) < 1e-6, "월별 절감 합계 = 총 절감량 (출력 정합성)");
const monBase = mon2.reduce((s, m) => s + (m.sums.adjBaseNR || 0), 0);
ok(Math.abs(monBase - sv.sumBase) < 1e-6, "월별 기준선 합계 = 총 조정 기준선");

// 품질 통계 정합성: 수집률 = 1 - 결측률
ok(Math.abs(q.totals.collectRate - (1 - q.totals.missRate)) < 1e-9, "수집률 = 1 − 결측률");

// 냉매: 초기 충전은 배출 미산입, 보충만 산입
ok(rf.items.filter(i => i.counted).every(i => !i.kind.startsWith("충전")), "냉매 산입 항목은 보충뿐");

// 원천값 불변: 정제·조정 결과가 rows.v를 수정하지 않음 (재생성 대조)
const data2 = generate();
ok(data2.rows[1000].v.SYS_kW === data.rows[1000].v.SYS_kW, "seed 고정 재현 — 원천값 결정론 일치");
