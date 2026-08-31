/* MRV 산정 엔진 (테스트용)
   - 일별 집계 → 기준선 모델(OLS) → 조정 기준선 → 에너지 절감량 → 온실가스 감축량(전력) + 냉매 별도
   - 원천값(rows.v)은 수정하지 않는다. 정제·계산 결과는 별도 객체로 만든다. */
// ESM 모듈 — 브라우저·Node 공용

  const RT_KW = 3.517;

  // ---------- 일별 집계 ----------
  function aggregateDaily(data) {
    const step = data.meta.stepMin / 60; // h
    const days = new Map();
    for (const r of data.rows) {
      let dRec = days.get(r.date);
      if (!dRec) {
        dRec = { date: r.date, post: r.post, n: 0, kwh: 0, kwhValid: 0, nValid: 0, nMissing: 0, nOutlier: 0, nEst: 0, cdd: 0, prod: 0, qth: 0, excl: false,
          ch1: 0, ch2: 0, chwp: 0, cwp: 0, ct: 0, chKwh: 0, qthKwh: 0, flowSum: 0, dTSum: 0, dTn: 0, approachSum: 0, approachN: 0, ch1Kwh: 0, ch2Kwh: 0, ch1Q: 0, ch2Q: 0, nCh2: 0, tagStatus: {} };
        days.set(r.date, dRec);
      }
      dRec.n++;
      if (r.excl) dRec.excl = true;
      const sysOk = r.s.SYS_kW === "VALID" || r.s.SYS_kW === "ESTIMATED";
      if (r.s.SYS_kW === "MISSING") dRec.nMissing++; else if (r.s.SYS_kW === "VALID") dRec.nValid++;
      if (r.s.CH1_kW === "OUTLIER" || r.s.CHW_rT === "OUTLIER") dRec.nOutlier++;
      if (r.s.CT_kW === "ESTIMATED") dRec.nEst++;
      dRec.cdd += Math.max(0, r.v.OAT - 18) / (24 / step) ; // 일 냉방도일(℃·day) 근사: 15분 평균의 합/96
      dRec.prod += r.v.PROD * step;                       // ton/일
      if (sysOk && r.v.SYS_kW !== null) {
        // 이상치는 산정에서 제외하고 해당 구간은 결측으로 취급(정제 규칙 R-02)
        const ch1 = r.s.CH1_kW === "OUTLIER" ? null : r.v.CH1_kW;
        if (ch1 === null) { dRec.nMissing++; continue; }
        const sys = ch1 + r.v.CH2_kW + r.v.CHWP_kW + r.v.CWP_kW + r.v.CT_kW;
        dRec.kwh += sys * step;
        dRec.ch1 += ch1 * step; dRec.ch2 += r.v.CH2_kW * step; dRec.chwp += r.v.CHWP_kW * step; dRec.cwp += r.v.CWP_kW * step; dRec.ct += r.v.CT_kW * step;
        dRec.chKwh += (ch1 + r.v.CH2_kW) * step;
        dRec.qthKwh += r.v.Q_th * step;
        if (r.v.CH1_kW > 5) { dRec.ch1Kwh += ch1 * step; dRec.ch1Q += (r.v.CH_n === 2 ? r.v.Q_th / 2 : (r.v.CH2_kW > 5 ? 0 : r.v.Q_th)) * step; }
        if (r.v.CH2_kW > 5) { dRec.ch2Kwh += r.v.CH2_kW * step; dRec.ch2Q += (r.v.CH_n === 2 ? r.v.Q_th / 2 : (r.v.CH1_kW > 5 ? 0 : r.v.Q_th)) * step; }
        if (r.s.CHW_rT !== "OUTLIER") { dRec.dTSum += r.v.CHW_rT - r.v.CHW_sT; dRec.dTn++; }
        dRec.flowSum += r.v.CHW_flow;
        if (r.v.WBT >= 8) { dRec.approachSum += r.v.CW_inT - r.v.WBT; dRec.approachN++; } // 냉방기(습구 ≥ 8℃)만 접근온도 산정
      }
    }
    const out = [...days.values()].map(x => {
      const validShare = x.nValid / x.n;
      // 결측 보정: 결측 비율이 10% 미만이면 유효값 기준으로 일 사용량을 비례 추정(ESTIMATED), 이상은 제외
      let kwhAdj = x.kwh, est = false, usable = true;
      const missShare = x.nMissing / x.n;
      if (missShare > 0 && missShare <= 0.10) { kwhAdj = x.kwh / (1 - missShare); est = true; }
      if (missShare > 0.10) usable = false;
      if (x.excl) usable = false;
      return Object.assign(x, { validShare, missShare, kwhDay: kwhAdj, estimated: est, usable,
        copDay: x.chKwh > 0 ? x.qthKwh / x.chKwh : null,
        sysKwRT: x.qthKwh > 0 ? x.kwh / (x.qthKwh / RT_KW) : null,
        chKwRT: x.qthKwh > 0 ? x.chKwh / (x.qthKwh / RT_KW) : null,
        ch1KwRT: x.ch1Q > 0 ? x.ch1Kwh / (x.ch1Q / RT_KW) : null,
        ch2KwRT: x.ch2Q > 0 ? x.ch2Kwh / (x.ch2Q / RT_KW) : null,
        dT: x.dTn ? x.dTSum / x.dTn : null, approach: x.approachN ? x.approachSum / x.approachN : null,
      });
    });
    out.sort((a, b) => a.date < b.date ? -1 : 1);
    return out;
  }

  // ---------- OLS: y = a + b·x1 + c·x2 ----------
  function ols(rowsXY) {
    const n = rowsXY.length;
    // 정규방정식 X'X β = X'y (3×3)
    let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], T = [0, 0, 0];
    for (const [x1, x2, y] of rowsXY) {
      const x = [1, x1, x2];
      for (let i = 0; i < 3; i++) { T[i] += x[i] * y; for (let j = 0; j < 3; j++) S[i][j] += x[i] * x[j]; }
    }
    const beta = solve3(S, T);
    if (!beta) return null;
    const yMean = T[0] / n;
    let ssRes = 0, ssTot = 0;
    const resid = rowsXY.map(([x1, x2, y]) => { const yh = beta[0] + beta[1] * x1 + beta[2] * x2; ssRes += (y - yh) ** 2; ssTot += (y - yMean) ** 2; return { y, yh, r: y - yh, x1, x2 }; });
    const r2 = 1 - ssRes / ssTot;
    const rmse = Math.sqrt(ssRes / (n - 3));
    const cvRmse = rmse / yMean;
    return { a: beta[0], b: beta[1], c: beta[2], n, r2, rmse, cvRmse, yMean, resid };
  }
  function solve3(A, b) {
    const M = A.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < 3; i++) {
      let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      if (Math.abs(M[p][i]) < 1e-12) return null;
      [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < 3; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }

  // ---------- 기준선 모델 ----------
  function fitBaseline(daily, cfg) {
    const base = daily.filter(x => x.date >= cfg.baselineStart && x.date <= cfg.baselineEnd && x.usable && x.validShare >= 0.9);
    const fit = ols(base.map(x => [x.cdd, x.prod, x.kwhDay]));
    const excluded = daily.filter(x => x.date >= cfg.baselineStart && x.date <= cfg.baselineEnd && !(x.usable && x.validShare >= 0.9));
    // 적합도 판정 기준(ASHRAE Guideline 14, 일별): CV(RMSE) ≤ 25%, R² ≥ 0.75 — 테스트 표시용
    const pass = fit && fit.cvRmse <= 0.25 && fit.r2 >= 0.75;
    return { model: fit, form: "kWh/일 = a + b × 냉방도일(℃·day, 기준 18℃) + c × 생산량(ton/일)", nDays: base.length, excludedDays: excluded.map(x => x.date), pass,
      criteria: "CV(RMSE) ≤ 25%, R² ≥ 0.75 (ASHRAE Guideline 14, 일별 모델)", version: "BL-v1.0", trainRange: [cfg.baselineStart, cfg.baselineEnd] };
  }

  // ---------- 성과 산정 ----------
  function computeSavings(daily, bl, cfg, nonRoutine, ef, tariff) {
    const rep = daily.filter(x => x.date >= cfg.reportStart && x.date <= cfg.reportEnd);
    const m = bl.model;
    const approvedNR = (nonRoutine || []).filter(n => n.status === "승인 완료" && n.kwhAdj !== 0);
    const out = rep.map(x => {
      const adjBase = m ? m.a + m.b * x.cdd + m.c * x.prod : null;
      // 승인된 비일상적 조정: 기간 내 일할 배분
      let nr = 0;
      for (const n of approvedNR) {
        if (x.date >= n.start && x.date <= n.end) { const days = daysBetween(n.start, n.end) + 1; nr += n.kwhAdj / days; }
      }
      const adjBaseNR = adjBase !== null ? adjBase + nr : null;
      const saving = (x.usable && adjBaseNR !== null) ? adjBaseNR - x.kwhDay : null;
      return Object.assign({}, x, { adjBase, nrAdj: nr, adjBaseNR, saving });
    });
    const used = out.filter(x => x.saving !== null);
    const sumBase = used.reduce((s, x) => s + x.adjBaseNR, 0);
    const sumAct = used.reduce((s, x) => s + x.kwhDay, 0);
    const sumSave = sumBase - sumAct;
    const estShare = used.length ? used.filter(x => x.estimated).length / used.length : 0;
    const co2 = sumSave / 1000 * ef.value; // kWh→MWh × tCO2/MWh
    const cost = sumSave * tariff.value;
    // 설비별 기여도: 기준기간 일평균 대비 보고기간 일평균 (참고 지표)
    const baseDays = daily.filter(x => x.date >= cfg.baselineStart && x.date <= cfg.baselineEnd && x.usable);
    const avg = (arr, k) => arr.length ? arr.reduce((s, x) => s + x[k], 0) / arr.length : 0;
    const contrib = ["ch1", "ch2", "chwp", "cwp", "ct"].map(k => ({ key: k, label: { ch1: "냉동기 1", ch2: "냉동기 2", chwp: "냉수펌프", cwp: "냉각수펌프", ct: "냉각탑" }[k], before: avg(baseDays, k), after: avg(used, k) }));
    return { daily: out, used, sumBase, sumAct, sumSave, savePct: sumBase ? sumSave / sumBase : 0, estShare, co2, cost, nDays: used.length, nExcluded: out.length - used.length, contrib };
  }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  // ---------- 냉매 별도 산정 ----------
  function refrigerantEmissions(records, range) {
    const inRange = records.filter(r => r.date >= range[0] && r.date <= range[1]);
    const items = inRange.map(r => ({ ...r, tco2: r.kind.startsWith("충전") ? 0 : r.kg * r.gwp / 1000, counted: !r.kind.startsWith("충전") }));
    return { items, total: items.reduce((s, x) => s + x.tco2, 0) };
  }

  // ---------- 데이터 품질 ----------
  function quality(data, range) {
    const rows = data.rows.filter(r => r.date >= range[0] && r.date <= range[1]);
    const byTag = data.tags.map(tg => {
      const c = { VALID: 0, MISSING: 0, OUTLIER: 0, ESTIMATED: 0, MANUAL: 0, INVALID: 0 };
      for (const r of rows) c[r.s[tg.id]]++;
      const n = rows.length;
      const meter = data.meters.find(m => m.tag === tg.id) || {};
      const expired = meter.expiry && meter.expiry !== "—" && meter.expiry < range[1];
      return { tag: tg.id, asset: tg.asset, unit: tg.unit, desc: tg.desc, n, ...c, collectRate: (n - c.MISSING) / n, validRate: c.VALID / n, missRate: c.MISSING / n, outlierRate: c.OUTLIER / n, estRate: c.ESTIMATED / n, meter, expired };
    });
    const n = rows.length * data.tags.length;
    const tot = byTag.reduce((s, t) => ({ VALID: s.VALID + t.VALID, MISSING: s.MISSING + t.MISSING, OUTLIER: s.OUTLIER + t.OUTLIER, ESTIMATED: s.ESTIMATED + t.ESTIMATED }), { VALID: 0, MISSING: 0, OUTLIER: 0, ESTIMATED: 0 });
    const issues = [];
    const ev = data.meta.events;
    if (ev.commOutage[0].slice(0, 10) <= range[1] && ev.commOutage[1].slice(0, 10) >= range[0]) issues.push({ id: "DQ-01", type: "MISSING", sev: "high", title: "통신장애로 전 태그 결측", period: `${ev.commOutage[0]} ~ ${ev.commOutage[1]}`, tag: "전 태그(기상·생산 제외)", impact: "해당 2일 산정 제외(결측 10% 초과)", action: "게이트웨이 Store & Forward 이력 확인", state: "조치 완료" });
    if (ev.commOutage2[0].slice(0, 10) <= range[1] && ev.commOutage2[0].slice(0, 10) >= range[0]) issues.push({ id: "DQ-05", type: "MISSING", sev: "high", title: "통신장애 11시간 — 전 태그 결측", period: `${ev.commOutage2[0]} ~ ${ev.commOutage2[1]}`, tag: "전 태그(기상·생산 제외)", impact: "2026-02-20 결측 46% → 해당 일 산정 제외(R-01)", action: "게이트웨이 재기동, 미수신 구간 Store & Forward 복구 불가 확인", state: "조치 완료" });
    if (ev.commOutage3[0].slice(0, 10) <= range[1] && ev.commOutage3[0].slice(0, 10) >= range[0]) issues.push({ id: "DQ-06", type: "ESTIMATED", sev: "low", title: "통신장애 2시간 — 결측 8%, 비례 추정 적용", period: `${ev.commOutage3[0]} ~ ${ev.commOutage3[1]}`, tag: "전 태그(기상·생산 제외)", impact: "2026-05-08 일 사용량 유효값 기준 비례 추정(ESTIMATED)", action: "추정 구간 라벨 유지, 승인 시 추정률 확인", state: "규칙 적용" });
    if (ev.stuckSensor[0] <= range[1] && ev.stuckSensor[1] >= range[0]) issues.push({ id: "DQ-02", type: "OUTLIER", sev: "mid", title: "냉수 환수온도 센서 고정값", period: `${ev.stuckSensor[0]} ~ ${ev.stuckSensor[1]}`, tag: "CHW_rT", impact: "ΔT·냉열량 KPI 3일 제외, 전력 산정 영향 없음", action: "센서 교체 및 재교정", state: "조치 완료" });
    issues.push({ id: "DQ-03", type: "OUTLIER", sev: "low", title: "냉동기 1 전력 급격 이상치(스파이크)", period: `${range[0]} ~ ${range[1]} 산발`, tag: "CH1_kW", impact: "해당 15분 구간 제외, 일 사용량 비례 추정", action: "물리범위 규칙(정격 1.5배) 자동 제외", state: "규칙 적용" });
    if (ev.fouling[0] <= range[1] && ev.fouling[1] >= range[0]) issues.push({ id: "EQ-01", type: "PERF", sev: "mid", title: "냉동기 2 효율저하 추세(kW/RT +10%)", period: `${ev.fouling[0]} ~ ${ev.fouling[1]}`, tag: "CH2_kW", impact: "기준기간 성능저하 — 기준선에 포함(보수적)", action: "응축기 세관 정비 이력 확인", state: "검토 필요" });
    if (ev.calibExpiry.date <= range[1]) issues.push({ id: "DQ-04", type: "CALIB", sev: "mid", title: "냉수 유량계 교정 만료", period: `${ev.calibExpiry.date} 이후`, tag: ev.calibExpiry.tag, impact: "냉열량·COP KPI 신뢰도 하향(전력 산정 영향 없음)", action: "재교정 일정 등록", state: "검토 필요" });
    if (ev.maintenance[0] <= range[1] && ev.maintenance[1] >= range[0]) issues.push({ id: "NR-02", type: "EXCL", sev: "info", title: "대규모 정비 제외기간", period: `${ev.maintenance[0]} ~ ${ev.maintenance[1]}`, tag: "냉수플랜트", impact: "11일 산정 제외(승인 완료)", action: "—", state: "승인 완료" });
    return { byTag, totals: { n, ...tot, collectRate: (n - tot.MISSING) / n, validRate: tot.VALID / n, missRate: tot.MISSING / n, estRate: tot.ESTIMATED / n }, issues };
  }

  // ---------- 월별 집계 ----------
  function monthly(dailyList, fields) {
    const m = new Map();
    for (const x of dailyList) {
      const k = x.date.slice(0, 7);
      if (!m.has(k)) m.set(k, { month: k, n: 0, nUsed: 0, sums: {} , avgs: {}, cnt: {} });
      const rec = m.get(k); rec.n++;
      if (x.saving !== null && x.saving !== undefined) rec.nUsed++;
      for (const f of fields.sum || []) { if (x[f] !== null && x[f] !== undefined && (x.usable !== false)) rec.sums[f] = (rec.sums[f] || 0) + x[f]; }
      for (const f of fields.avg || []) { if (x[f] !== null && x[f] !== undefined) { rec.avgs[f] = (rec.avgs[f] || 0) + x[f]; rec.cnt[f] = (rec.cnt[f] || 0) + 1; } }
    }
    return [...m.values()].map(r => { for (const f in r.avgs) r.avgs[f] = r.avgs[f] / r.cnt[f]; return r; });
  }

  // ---------- 주별 집계 ----------
  function weekly(dailyList, field) {
    const m = new Map();
    for (const x of dailyList) {
      const dt = new Date(x.date); const wk = new Date(dt); wk.setDate(dt.getDate() - dt.getDay());
      const k = wk.toISOString().slice(0, 10);
      if (!m.has(k)) m.set(k, { week: k, v: 0, n: 0 });
      if (x[field] !== null && x[field] !== undefined) { m.get(k).v += x[field]; m.get(k).n++; }
    }
    return [...m.values()];
  }

  export { aggregateDaily, fitBaseline, computeSavings, refrigerantEmissions, quality, monthly, weekly, ols };
  export default { aggregateDaily, fitBaseline, computeSavings, refrigerantEmissions, quality, monthly, weekly, ols };

