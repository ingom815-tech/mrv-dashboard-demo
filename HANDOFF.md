# 클로드 코드 인계 안내

## 사용법
1. 새 프로젝트 폴더를 만들고 이 패키지 내용을 그대로 넣음 (`CLAUDE.md`가 루트에 있어야 함)
2. 폴더에서 클로드 코드를 실행하고 아래 "첫 지시" 를 그대로 붙여 넣음
3. 화면은 하나씩 확인하면서 진행. 산정 로직은 `engine/`을 그대로 쓰고, 고칠 일이 생기면 `node test/engine.test.mjs`를 통과시키게 함

## 폴더 구성
```
CLAUDE.md                          프로젝트 지시문 (목표·결정사항·스택·디자인 규칙·완료 기준)
HANDOFF.md                         이 문서
docs/디지털_MRV_대시보드_설계_지시서_v1_0.docx   원본 설계 지시서
docs/대시보드_설계_지시서_v1_0.md            같은 문서의 마크다운 변환본 (클로드 코드가 읽기 편함)
engine/synth.js                    합성데이터 생성기 (ESM)
engine/mrv.js                      MRV 산정 엔진 (ESM)
test/engine.test.mjs               엔진 회귀 테스트 — node test/engine.test.mjs
reference/v1-screens/*.png         이전 시도(v1) 화면 6장 — 참고용, 재현 대상 아님
```

## 첫 지시 (복사해서 사용)
```
CLAUDE.md와 docs/대시보드_설계_지시서_v1_0.md를 읽고 시작해.
Vite + React + TypeScript + Tailwind로 프로젝트를 초기화하고, engine/synth.js와 engine/mrv.js를 src/engine/으로 옮겨 그대로 사용해 (수정하지 말고, 필요하면 타입 선언만 추가).
node test/engine.test.mjs 가 통과하는지 먼저 확인해.
그다음 화면은 "종합 성과" 하나만 먼저 만들어. 지시서 3장(메인 대시보드 설계 지시)과 CLAUDE.md의 디자인 규칙을 따르고, 1440px 스크린샷을 찍어서 보여줘. 내가 확인한 뒤 다음 화면으로 간다.
reference/v1-screens/ 는 이전 시도인데 밀도와 위계가 나빴으니 그 모양을 따라가지 마.
```

## 엔진 API 요약
```js
import { generate } from "./engine/synth.js";
import * as MRV from "./engine/mrv.js";

const data  = generate({ post: { chillerImprovePct: 18, pumpVfdSavePct: 25, ctSavePct: 15, deltaT: 5.0 } });
// data.rows[]  : { t, date, hour, post, v:{태그:값}, s:{태그:상태코드}, excl }  — 15분 레코드 52,416건
// data.tags, data.meters, data.refrigerant, data.nonRoutine, data.meta.events, data.meta.assumptions

const cfg   = { ...data.meta.assumptions, reportStart: "2026-01-01", reportEnd: "2026-06-30" }; // 보고기간 필터
const daily = MRV.aggregateDaily(data);                     // 일별: kwhDay, cdd, prod, usable, estimated, copDay, sysKwRT, ch1KwRT, ch2KwRT, dT, approach ...
const bl    = MRV.fitBaseline(daily, cfg);                  // { model:{a,b,c,r2,cvRmse,rmse,n,resid[]}, pass, excludedDays[], version, form, criteria }
const sv    = MRV.computeSavings(daily, bl, cfg, nonRoutine, { value: 0.4594 }, { value: 145 });
// sv: { daily[] (adjBase, nrAdj, adjBaseNR, saving), sumBase, sumAct, sumSave, savePct, estShare, co2, cost, nDays, nExcluded, contrib[] }
const q     = MRV.quality(data, [cfg.reportStart, cfg.reportEnd]);   // { byTag[], totals, issues[] }
const rf    = MRV.refrigerantEmissions(data.refrigerant, [start, end]); // { items[], total }  — 냉매 별도
const mon   = MRV.monthly(sv.daily, { sum: ["adjBaseNR", "kwhDay", "saving"], avg: ["sysKwRT"] });
```

## 상태코드·업무상태 (지시서 5.2 / 5.3)
- 데이터: VALID · MISSING · OUTLIER · ESTIMATED · MANUAL · SYNTHETIC · INVALID
- MRV 업무: 산정 중 → 검토 필요 → 검토 완료 → 승인 완료 / 재산정 필요(기준 변경 시, 기존 확정본 보존)

## 합성 시나리오 요약
- 중앙 냉수플랜트: 냉동기 2대(1,400 kW_th) · 냉수펌프 · 냉각수펌프 · 냉각탑. 기준기간 2025년, 보고기간 2026-01~06, 개선 설비 가동 2026-01-01
- 개선 가정값(변경 가능): 냉동기 1 신설 kW/RT −18%, 펌프 VFD −25%, 냉각탑 −15%, ΔT 3.6 → 5.0℃. 냉동기 2는 기존 유지
- 품질 이벤트: 통신장애 3건(2025-03-14~15 / 2026-02-20 11h / 2026-05-08 2h), 환수온도 센서 고정값(2025-08-02~05), 냉동기 1 스파이크 30건, 유량계 교정 만료(2026-04-30), 냉동기 2 효율저하(2025-09~11)
- 비일상적 조정: NR-01 냉수 공급온도 7→9℃(2026-05-01~, 검토 필요, −6,200 kWh), NR-02 냉동기 2 정비 제외기간(2026-03-10~20, 승인 완료)
- 배출계수 초기값 0.4594 tCO₂eq/MWh는 데모 입력값. 냉매 GWP: R-134a 1430, R-1233zd(E) 1
