/* 합성데이터 생성기 — 테스트 화면 전용. 모든 레코드 data_origin = SYNTHETIC.
   물리 관계: Q(kW_th) = ρ·cp·V̇·ΔT, 냉동기 kW = Q / COP, COP = f(부분부하율, 냉각수 입구온도) */
// ESM 모듈 — 브라우저·Node 공용


  // ---------- 결정론적 난수 (mulberry32) ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { // Box–Muller
    let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- 기본 시나리오(데모 가정값) ----------
  const DEFAULTS = {
    baselineStart: "2025-01-01", baselineEnd: "2025-12-31",
    reportStart: "2026-01-01", reportEnd: "2026-06-30",
    installDate: "2026-01-01",              // 개선 설비 가동 시작(가정)
    stepMin: 15,
    chillerCapacityKw: 1400,                // 냉동기 1대 냉각능력 (kW_th)
    // 개선 전 (기존 설비)
    pre: { kwPerRT: 0.72, partLoadPenalty: 0.35, deltaT: 3.6, chwpKw: 110, cwpKw: 95, ctKw: 60 },
    // 개선 후 (데모 가정값 — 실제 기대성과가 아님)
    post: { chillerImprovePct: 18, pumpVfdSavePct: 25, deltaT: 5.0, ctSavePct: 15 },
    seed: 20260831,
  };

  const RHO_CP = 4.19 * 1000 / 3600; // kW per (m³/h · K)  (ρ=1000 kg/m³, cp=4.19 kJ/kgK)
  const RT_KW = 3.517;

  const TAGS = [
    { id: "CH1_kW", asset: "CH-01 냉동기 1", unit: "kW", kind: "power", desc: "냉동기 1 소비전력" },
    { id: "CH2_kW", asset: "CH-02 냉동기 2", unit: "kW", kind: "power", desc: "냉동기 2 소비전력" },
    { id: "CHWP_kW", asset: "CHWP 냉수펌프", unit: "kW", kind: "power", desc: "냉수 1차펌프 소비전력" },
    { id: "CWP_kW", asset: "CWP 냉각수펌프", unit: "kW", kind: "power", desc: "냉각수펌프 소비전력" },
    { id: "CT_kW", asset: "CT-01 냉각탑", unit: "kW", kind: "power", desc: "냉각탑 팬 소비전력" },
    { id: "SYS_kW", asset: "냉수플랜트", unit: "kW", kind: "power", desc: "플랜트 합계 전력(계산)" },
    { id: "CHW_flow", asset: "냉수 헤더", unit: "m³/h", kind: "flow", desc: "냉수 체적유량" },
    { id: "CHW_sT", asset: "냉수 헤더", unit: "℃", kind: "temp", desc: "냉수 공급온도" },
    { id: "CHW_rT", asset: "냉수 헤더", unit: "℃", kind: "temp", desc: "냉수 환수온도" },
    { id: "Q_th", asset: "냉수플랜트", unit: "kW", kind: "thermal", desc: "냉열 출력(계산)" },
    { id: "CW_inT", asset: "냉각수", unit: "℃", kind: "temp", desc: "냉각수 입구(냉각탑 출구) 온도" },
    { id: "OAT", asset: "외기", unit: "℃", kind: "weather", desc: "외기 건구온도" },
    { id: "WBT", asset: "외기", unit: "℃", kind: "weather", desc: "외기 습구온도" },
    { id: "PROD", asset: "생산", unit: "ton/h", kind: "production", desc: "생산량(라인 합계)" },
    { id: "CH_n", asset: "냉수플랜트", unit: "대", kind: "status", desc: "냉동기 운전대수" },
  ];

  const STATUS = { VALID: "VALID", MISSING: "MISSING", OUTLIER: "OUTLIER", ESTIMATED: "ESTIMATED", MANUAL: "MANUAL", SYNTHETIC: "SYNTHETIC", INVALID: "INVALID" };

  function d(s) { return new Date(s + "T00:00:00"); }
  function dayOfYear(dt) { const s = new Date(dt.getFullYear(), 0, 0); return Math.floor((dt - s) / 86400000); }
  // 로컬 기준 날짜 문자열 — toISOString()은 UTC라 UTC+9 환경에서 자정~09시 레코드가 전날로 밀림
  function ymd(dt) { const p = (n) => String(n).padStart(2, "0"); return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`; }

  // 공장 휴무(설·추석 가정, 데모)
  const HOLIDAYS = ["2025-01-28", "2025-01-29", "2025-01-30", "2025-10-05", "2025-10-06", "2025-10-07", "2026-02-16", "2026-02-17", "2026-02-18"];

  function generate(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    o.pre = Object.assign({}, DEFAULTS.pre, (opts && opts.pre) || {});
    o.post = Object.assign({}, DEFAULTS.post, (opts && opts.post) || {});
    const r = rng(o.seed);
    const start = d(o.baselineStart), end = d(o.reportEnd);
    const install = d(o.installDate);
    const stepMs = o.stepMin * 60000;
    const rows = [];

    // 품질 이벤트 정의(의도적 삽입)
    const events = {
      commOutage: [d("2025-03-14").getTime() + 6 * 3600000, d("2025-03-15").getTime() + 18 * 3600000],
      commOutage2: [d("2026-02-20").getTime() + 3 * 3600000, d("2026-02-20").getTime() + 14 * 3600000],   // 11시간 → 일 제외
      commOutage3: [d("2026-05-08").getTime() + 1 * 3600000, d("2026-05-08").getTime() + 3 * 3600000],    // 2시간 → 비례 추정
      stuckSensor: [d("2025-08-02").getTime(), d("2025-08-05").getTime()],           // CHW_rT 고정값
      maintenance: [d("2026-03-10").getTime(), d("2026-03-20").getTime() + 12 * 3600000], // 냉동기 1대 정지(제외기간)
      foulingStart: d("2025-09-01").getTime(), foulingEnd: d("2025-11-30").getTime(),    // CH2 효율저하
      setpointChange: d("2026-05-01").getTime(),                                          // 냉수 공급온도 7→9℃ (비일상적 조정)
      calibExpiry: { tag: "CHW_flow", date: "2026-04-30" },
    };

    // 이상치 삽입 시각 (CH1_kW 30건)
    const outlierSet = new Set();
    const total = Math.floor((end.getTime() + 86400000 - start.getTime()) / stepMs);
    for (let i = 0; i < 30; i++) outlierSet.add(Math.floor(r() * total));

    let idx = 0;
    let stuckValue = null;
    for (let t = start.getTime(); t < end.getTime() + 86400000; t += stepMs, idx++) {
      const dt = new Date(t);
      const hour = dt.getHours() + dt.getMinutes() / 60;
      const dow = dt.getDay();
      const doy = dayOfYear(dt);
      const dateStr = ymd(dt);
      const post = t >= install.getTime();

      // 외기 (원주 근사): 연평균 12℃, 진폭 13.5℃, 일교차 ±4.5℃
      const seasonal = 12 + 13.5 * Math.sin(2 * Math.PI * (doy - 110) / 365);
      const diurnal = 4.5 * Math.sin(2 * Math.PI * (hour - 15) / 24);
      const dayNoise = 2.2 * Math.sin(doy * 1.7) + 1.3 * Math.cos(doy * 0.61); // 일별 기상 변동(결정론)
      const OAT = seasonal + diurnal + dayNoise + 0.6 * gauss(r);
      const depression = Math.max(1.5, 7.5 - 0.15 * Math.max(0, OAT - 10) + 0.8 * gauss(r));
      const WBT = OAT - depression;

      // 생산 (2교대 주간 100%, 야간 40%, 주말 축소, 휴무 0)
      let prodF = (hour >= 6 && hour < 22) ? 1.0 : 0.4;
      if (dow === 6) prodF *= 0.55; if (dow === 0) prodF *= 0.2;
      if (HOLIDAYS.includes(dateStr)) prodF = 0;
      if (post && t >= d("2026-04-01").getTime()) prodF *= 1.12; // 생산 증가(일상적 조정 변수로 흡수)
      const PROD = Math.max(0, 18 * prodF * (1 + 0.08 * gauss(r)));

      // 냉방부하 (kW_th): 공정냉수 + 냉장 기저 + 공조(외기 의존)
      const Qload = 42 * PROD + 350 + Math.max(0, OAT - 16) * 62 * (0.85 + 0.15 * prodF) + 25 * gauss(r);
      const capacity = o.chillerCapacityKw;
      let inMaint = t >= events.maintenance[0] && t <= events.maintenance[1];
      let nCh = Qload > capacity * 0.92 ? 2 : 1;
      if (inMaint) nCh = 1;
      const Q = Math.min(Qload, nCh * capacity);
      const PLR = Q / (nCh * capacity);

      // 냉각수 입구온도 = 습구 + 접근온도
      const approach = post ? 3.5 : 4.5;
      const CW_inT = Math.max(12, WBT + approach + 0.3 * gauss(r));

      // 냉동기 효율 (kW/RT)
      const condF = 1 + 0.012 * (CW_inT - 27);
      const kwRT_old = o.pre.kwPerRT * (1 + o.pre.partLoadPenalty * Math.pow(1 - PLR, 2)) * condF;              // 기존 설비(CH2, 개선 전 CH1)
      const kwRT_new = o.pre.kwPerRT * (1 - o.post.chillerImprovePct / 100) * (1 + 0.15 * Math.pow(1 - PLR, 2)) * condF; // 신설 CH1(가정)
      const kwRT_ch1 = post ? kwRT_new : kwRT_old;
      let foul = 1;
      if (t >= events.foulingStart && t <= events.foulingEnd) foul = 1 + 0.10 * (t - events.foulingStart) / (events.foulingEnd - events.foulingStart);
      // 운전 순서: 개선 전 교대운전, 개선 후 신설 CH1 우선. 정비(NR-02)는 CH2 정지 → CH1 단독
      let CH1 = 0, CH2 = 0;
      if (nCh === 2) { CH1 = (Q / 2) / RT_KW * kwRT_ch1; CH2 = (Q / 2) / RT_KW * kwRT_old * foul; }
      else { const useCh2 = !post && (doy % 2 === 1) && !inMaint; if (useCh2) CH2 = Q / RT_KW * kwRT_old * foul; else CH1 = Q / RT_KW * kwRT_ch1; }
      CH1 *= 1 + 0.02 * gauss(r); CH2 *= 1 + 0.02 * gauss(r);

      // 냉수 유량·ΔT
      const dT = (post ? o.post.deltaT : o.pre.deltaT) + 0.15 * gauss(r);
      const flow = Q / (RHO_CP * dT);          // m³/h
      const CHW_sT = (post && t >= events.setpointChange ? 9.0 : 7.0) + 0.1 * gauss(r);
      let CHW_rT = CHW_sT + dT;

      // 보조동력
      const designFlow = 2 * capacity / (RHO_CP * 5.0);
      let CHWP, CWP, CT;
      if (!post) { CHWP = o.pre.chwpKw * (nCh === 2 ? 1 : 0.6); CWP = o.pre.cwpKw * (nCh === 2 ? 1 : 0.6); CT = o.pre.ctKw * (0.5 + 0.5 * PLR); }
      else {
        const vf = 1 - o.post.pumpVfdSavePct / 100;
        CHWP = (o.pre.chwpKw * Math.pow(flow / designFlow, 2) + 12) * vf * (nCh === 2 ? 1 : 0.7) / 0.7;
        CWP = o.pre.cwpKw * vf * (nCh === 2 ? 1 : 0.6);
        CT = o.pre.ctKw * (0.5 + 0.5 * PLR) * (1 - o.post.ctSavePct / 100);
      }
      CHWP *= 1 + 0.03 * gauss(r); CWP *= 1 + 0.03 * gauss(r); CT *= 1 + 0.04 * gauss(r);
      const SYS = CH1 + CH2 + CHWP + CWP + CT;

      // ---------- 상태코드 ----------
      const status = {};
      TAGS.forEach(tg => { status[tg.id] = STATUS.VALID; });
      const values = { CH1_kW: CH1, CH2_kW: CH2, CHWP_kW: CHWP, CWP_kW: CWP, CT_kW: CT, SYS_kW: SYS, CHW_flow: flow, CHW_sT, CHW_rT, Q_th: Q, CW_inT, OAT, WBT, PROD, CH_n: nCh };

      if ((t >= events.commOutage[0] && t <= events.commOutage[1]) || (t >= events.commOutage2[0] && t <= events.commOutage2[1]) || (t >= events.commOutage3[0] && t <= events.commOutage3[1])) {
        Object.keys(values).forEach(k => { if (!["OAT", "WBT", "PROD"].includes(k)) { values[k] = null; status[k] = STATUS.MISSING; } });
      }
      if (t >= events.stuckSensor[0] && t <= events.stuckSensor[1]) {
        if (stuckValue === null) stuckValue = CHW_rT;
        values.CHW_rT = stuckValue; status.CHW_rT = STATUS.OUTLIER; // 고정값 → 물리관계 이탈로 검출
      } else stuckValue = null;
      if (outlierSet.has(idx) && values.CH1_kW !== null) { values.CH1_kW = values.CH1_kW * (3 + r()); status.CH1_kW = STATUS.OUTLIER; }
      // 통신 지연으로 일부 구간 보간 추정값 (월 1회 2시간)
      if (dt.getDate() === 17 && hour >= 2 && hour < 4) { status.CT_kW = STATUS.ESTIMATED; }

      // ---------- 개별 센서 이벤트 (태그별 품질 패턴 다양화 — 전력 합산·기준선 산정에는 영향 없음) ----------
      // 습구온도 센서 결측 5시간 — 접근온도 KPI만 영향 (WBT는 게이트 조건으로만 사용)
      if (dateStr === "2026-01-17" && hour >= 3 && hour < 8) { values.WBT = null; status.WBT = STATUS.MISSING; }
      // 냉수 공급온도 센서 드리프트 의심 2일 — 값 유지, 이상 플래그만
      if (dateStr >= "2026-03-27" && dateStr <= "2026-03-28") status.CHW_sT = STATUS.OUTLIER;
      // MES 점검으로 생산량 수기 입력 2일
      if (dateStr >= "2026-04-02" && dateStr <= "2026-04-03") status.PROD = STATUS.MANUAL;
      // 냉각수 입구온도 순간 이상 3시간 — 값 유지
      if (dateStr === "2026-06-11" && hour >= 10 && hour < 13) status.CW_inT = STATUS.OUTLIER;

      rows.push({ t, date: dateStr, hour, post, v: values, s: status, excl: inMaint });
    }

    // 냉매 기록 (kg) — 별도 산정 항목
    const refrigerant = [
      { date: "2025-04-10", asset: "CH-01 냉동기 1", type: "R-134a", gwp: 1430, kind: "보충", kg: 18, note: "누설 점검 후 보충" },
      { date: "2025-09-22", asset: "CH-02 냉동기 2", type: "R-134a", gwp: 1430, kind: "보충", kg: 26, note: "응축기 오염 정비 시 보충" },
      { date: "2026-01-05", asset: "CH-01 냉동기 1 (신설)", type: "R-1233zd(E)", gwp: 1, kind: "충전(초기)", kg: 420, note: "신설 설비 초기 충전 — 배출 아님" },
      { date: "2026-05-14", asset: "CH-02 냉동기 2", type: "R-134a", gwp: 1430, kind: "보충", kg: 9, note: "정기점검 보충" },
    ];

    // 계측기 메타 (교정)
    const meters = [
      { tag: "CH1_kW", meter: "PM-CH1", type: "전력량계", accuracy: "0.5급", calib: "2025-06-12", expiry: "2027-06-11", src: "독립 계측기", period: 15 },
      { tag: "CH2_kW", meter: "PM-CH2", type: "전력량계", accuracy: "0.5급", calib: "2025-06-12", expiry: "2027-06-11", src: "독립 계측기", period: 15 },
      { tag: "CHWP_kW", meter: "PM-CHWP", type: "전력량계", accuracy: "1.0급", calib: "2025-06-12", expiry: "2027-06-11", src: "독립 계측기", period: 15 },
      { tag: "CWP_kW", meter: "PM-CWP", type: "전력량계", accuracy: "1.0급", calib: "2025-06-12", expiry: "2027-06-11", src: "독립 계측기", period: 15 },
      { tag: "CT_kW", meter: "PM-CT", type: "전력량계", accuracy: "1.0급", calib: "2025-06-12", expiry: "2027-06-11", src: "BMS", period: 15 },
      { tag: "CHW_flow", meter: "FM-CHW", type: "전자유량계", accuracy: "±0.5%", calib: "2025-04-30", expiry: events.calibExpiry.date, src: "독립 계측기", period: 15 },
      { tag: "CHW_sT", meter: "TT-CHW-S", type: "RTD Pt100", accuracy: "±0.1℃", calib: "2025-04-30", expiry: "2026-10-30", src: "독립 계측기", period: 15 },
      { tag: "CHW_rT", meter: "TT-CHW-R", type: "RTD Pt100", accuracy: "±0.1℃", calib: "2025-04-30", expiry: "2026-10-30", src: "독립 계측기", period: 15 },
      { tag: "CW_inT", meter: "TT-CW-IN", type: "RTD Pt100", accuracy: "±0.2℃", calib: "2025-04-30", expiry: "2026-10-30", src: "BMS", period: 15 },
      { tag: "OAT", meter: "WS-01", type: "기상 센서", accuracy: "±0.3℃", calib: "2025-05-15", expiry: "2027-05-14", src: "기상 센서", period: 15 },
      { tag: "WBT", meter: "WS-01", type: "기상 센서(계산)", accuracy: "—", calib: "2025-05-15", expiry: "2027-05-14", src: "기상 센서", period: 15 },
      { tag: "PROD", meter: "MES", type: "MES 연계", accuracy: "—", calib: "—", expiry: "—", src: "MES", period: 60 },
      { tag: "CH_n", meter: "PLC", type: "운전상태", accuracy: "—", calib: "—", expiry: "—", src: "PLC", period: 15 },
      { tag: "SYS_kW", meter: "계산", type: "계산값", accuracy: "—", calib: "—", expiry: "—", src: "계산", period: 15 },
      { tag: "Q_th", meter: "계산", type: "계산값", accuracy: "—", calib: "—", expiry: "—", src: "계산", period: 15 },
    ];

    // 비일상적 조정 후보 (데모)
    const nonRoutine = [
      { id: "NR-01", title: "냉수 공급온도 설정 변경 7℃ → 9℃", start: "2026-05-01", end: o.reportEnd, type: "설정값 변경", kwhAdj: -6200, unit: "kWh (기준선 차감)", reason: "공조 서비스수준 검토 후 설정 완화. 기준선 조건과 상이하므로 절감량에서 분리 필요", status: "검토 필요", approver: "", approvedAt: "" },
      { id: "NR-02", title: "냉동기 2 정지 대규모 정비(응축기 세관)", start: "2026-03-10", end: "2026-03-20", type: "대규모 정비", kwhAdj: 0, unit: "제외기간", reason: "정비기간 운전조건 비정상 — 산정 제외 처리", status: "승인 완료", approver: "MRV 담당자(데모)", approvedAt: "2026-03-25 10:20" },
    ];

    return {
      meta: { generatedAt: new Date().toISOString(), version: "synth-v1.2", seed: o.seed, stepMin: o.stepMin, origin: "SYNTHETIC", assumptions: o, events: {
        commOutage: ["2025-03-14 06:00", "2025-03-15 18:00"], commOutage2: ["2026-02-20 03:00", "2026-02-20 14:00"], commOutage3: ["2026-05-08 01:00", "2026-05-08 03:00"], stuckSensor: ["2025-08-02", "2025-08-05"], maintenance: ["2026-03-10", "2026-03-20"], fouling: ["2025-09-01", "2025-11-30"], setpointChange: "2026-05-01", calibExpiry: events.calibExpiry } },
      tags: TAGS, rows, refrigerant, meters, nonRoutine, STATUS,
    };
  }

  export { generate, DEFAULTS, TAGS, STATUS, RHO_CP, RT_KW };
  export default { generate, DEFAULTS, TAGS, STATUS, RHO_CP, RT_KW };

