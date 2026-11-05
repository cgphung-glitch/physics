/* ============================================================
   Moment of Inertia on an Incline — PHY 1510 Experiment 10a
   Simulation, stopwatch analysis, plots and exports
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- constants ---------------- */

  var G_ACC = 9.81;               // accepted free-fall acceleration, m/s²
  var DISK_MASS = 0.350;          // m₀: mass of the rotating disk, kg
  var DISK_RADIUS = 0.060;        // r₀: disk radius (rolling radius), m
  var BALL_MASS = 0.050;          // m_b: mass of one steel ball, kg
  var BALL_RADIUS = 0.010;        // drawn radius of a steel ball, m
  var R_OUTER = 0.055;            // r₁: outer placeholder radius, m
  var R_INNER = 0.025;            // r₂: inner placeholder radius, m
  var INCLINE_H = 0.045;          // h: height of the raised end, m
  var TRAVEL_D = 0.600;           // d: marked travel distance along the board, m
  var MAX_TRIALS = 3;
  var STOPWATCH_SIGMA = 0.012;    // random reaction scatter of the stopwatch, s
  var STOPWATCH_BIAS = 0.004;     // reaction lag, fraction of the run time
  var SAMPLE_RATE = 30;           // motion samples logged per second, Hz
  var MAX_SAMPLES = 3000;
  var FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /* ---------------- ball arrangements ---------------- */

  var CONFIGS = [
    {
      id: 'disk', label: 'Disk only', short: 'disk', name: 'Disk alone',
      hint: 'no steel balls', balls: []
    },
    {
      id: 'outer', label: '4 outer', short: '4 outer', name: 'Case 1 · four balls on the outer rim',
      hint: 'r₁ = 5.5 cm', balls: [[0, 'outer'], [90, 'outer'], [180, 'outer'], [270, 'outer']]
    },
    {
      id: 'inner', label: '4 inner', short: '4 inner', name: 'Case 2 · four balls on the inner rim',
      hint: 'r₂ = 2.5 cm', balls: [[0, 'inner'], [90, 'inner'], [180, 'inner'], [270, 'inner']]
    },
    {
      id: 'inline', label: 'Inline 2+2', short: 'inline', name: 'Case 3 · two inner and two outer balls in line',
      hint: 'one diameter', balls: [[0, 'inner'], [0, 'outer'], [180, 'inner'], [180, 'outer']]
    },
    {
      id: 'alternating', label: 'Alternating', short: 'alt.', name: 'Case 4 · two inner and two outer balls, alternating',
      hint: '90° apart', balls: [[0, 'outer'], [90, 'inner'], [180, 'outer'], [270, 'inner']]
    }
  ];

  /* ---------------- helpers ---------------- */

  function $(id) { return document.getElementById(id); }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function mean(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function stdev(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(s / (arr.length - 1));
  }

  function randn() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

  function sup(n) {
    return String(n).split('').map(function (ch) { return SUP[ch] || ch; }).join('');
  }

  function sci(v, digits) {
    if (v == null || !isFinite(v)) return '—';
    if (v === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(v)));
    var m = v / Math.pow(10, e);
    if (Math.abs(m) >= 9.995) { m /= 10; e += 1; }
    return m.toFixed(digits == null ? 2 : digits) + ' × 10' + sup(e);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function rr(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      roundRectPath(ctx, x, y, w, h, r);
    }
  }

  /* ---------------- configuration geometry ---------------- */

  function ballRadius(where) { return where === 'outer' ? R_OUTER : R_INNER; }

  function configById(id) {
    for (var i = 0; i < CONFIGS.length; i++) if (CONFIGS[i].id === id) return CONFIGS[i];
    return CONFIGS[0];
  }

  function meanBallRadius(cfg) {
    if (!cfg || !cfg.balls.length) return 0;
    var s = 0;
    for (var i = 0; i < cfg.balls.length; i++) s += ballRadius(cfg.balls[i][1]);
    return s / cfg.balls.length;
  }

  /**
   * Everything the run needs for one arrangement: the geometry, the total
   * moment of inertia about the axis, and the resulting acceleration and time.
   * A body rolling without slipping has a = g sin θ · m r₀² / (m r₀² + I).
   */
  function setupFor(id) {
    var cfg = configById(id);
    var sin = INCLINE_H / TRAVEL_D;
    var theta = Math.asin(clamp(sin, 0, 1));

    var iDisk = 0.5 * DISK_MASS * DISK_RADIUS * DISK_RADIUS;
    var iBalls = 0;
    for (var i = 0; i < cfg.balls.length; i++) {
      var r = ballRadius(cfg.balls[i][1]);
      iBalls += BALL_MASS * r * r;          // balls are clamped in place, so no spin term
    }

    var nBalls = cfg.balls.length;
    var mass = DISK_MASS + nBalls * BALL_MASS;
    var mrr = mass * DISK_RADIUS * DISK_RADIUS;
    var iTotal = iDisk + iBalls;
    var accel = G_ACC * sin * mrr / (mrr + iTotal);
    var tTrue = Math.sqrt(2 * TRAVEL_D / accel);

    return {
      id: cfg.id,
      cfg: cfg,
      h: INCLINE_H,
      d: TRAVEL_D,
      sin: sin,
      thetaDeg: theta * 180 / Math.PI,
      nBalls: nBalls,
      mass: mass,
      iDisk: iDisk,
      iBalls: iBalls,
      iTotal: iTotal,
      accel: accel,
      tTrue: tTrue,
      vEnd: accel * tTrue,
      omegaEnd: accel * tTrue / DISK_RADIUS
    };
  }

  /* ---------------- state ---------------- */

  var state = {
    caseId: 'disk',
    speed: 1,
    trials: {},
    lastRun: null,
    auto: false
  };
  CONFIGS.forEach(function (cfg) { state.trials[cfg.id] = []; });

  var sim = {
    running: false,
    t: 0,
    s: 0,
    v: 0,
    phi: 0,
    setup: setupFor('disk'),
    duration: 0,
    speed: 1,
    samples: [],
    nextIndex: 0,
    pendingId: 'disk',
    resolve: null
  };

  /* ---------------- dom ---------------- */

  var themeToggle = $('themeToggle');
  var canvasWrap = $('canvasWrap');
  var sceneCanvas = $('scene');
  var caseOptions = $('caseOptions');
  var runBtn = $('runBtn');
  var runBtnLabel = $('runBtnLabel');
  var autoBtn = $('autoBtn');
  var clearBtn = $('clearBtn');
  var statusLine = $('statusLine');
  var trialPill = $('trialPill');
  var resultPill = $('resultPill');
  var dataBody = $('dataBody');
  var dataCount = $('dataCount');
  var chartXT = $('chartXT');
  var chartVT = $('chartVT');
  var chartCASE = $('chartCASE');
  var statCase = $('statCase');
  var statTheta = $('statTheta');
  var statSin = $('statSin');
  var statD = $('statD');
  var statAccel = $('statAccel');
  var statTime = $('statTime');
  var statSpeed = $('statSpeed');
  var statOmega = $('statOmega');
  var statI = $('statI');

  var sceneW = 0, sceneH = 0, sceneDpr = 1;
  var charts = {};
  var paletteCache = null;

  /* ---------------- theme palette ---------------- */

  function palette() {
    if (paletteCache) return paletteCache;
    var css = getComputedStyle(document.documentElement);
    function v(name) { return css.getPropertyValue(name).trim(); }
    paletteCache = {
      panel: v('--panel'),
      panel2: v('--panel-2'),
      border: v('--border'),
      text: v('--text'),
      muted: v('--muted'),
      faint: v('--faint'),
      grid: v('--grid'),
      axis: v('--axis'),
      accent: v('--accent'),
      accent2: v('--accent-2'),
      good: v('--good'),
      sceneTop: v('--scene-top'),
      sceneBottom: v('--scene-bottom'),
      sceneFloor: v('--scene-floor'),
      track: v('--viz-track'),
      trackEdge: v('--viz-track-edge'),
      trackHi: v('--viz-track-hi'),
      block: v('--viz-block'),
      blockEdge: v('--viz-block-edge'),
      disk: v('--viz-disk'),
      diskHi: v('--viz-disk-hi'),
      diskEdge: v('--viz-disk-edge'),
      diskHub: v('--viz-disk-hub'),
      ball: v('--viz-ball'),
      ballHi: v('--viz-ball-hi'),
      mark: v('--viz-mark')
    };
    return paletteCache;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('moi-theme', theme); } catch (e) {}
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    paletteCache = null;
    drawScene();
    drawCharts();
  }

  themeToggle.addEventListener('click', function () {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- measurement + analysis ---------------- */

  /** I from a measured travel time: a = 2d/t², then I = m r₀² (g sin θ / a − 1). */
  function inertiaFromTime(st, t) {
    if (!t || t <= 0) return 0;
    var a = 2 * TRAVEL_D / (t * t);
    var ratio = (G_ACC * st.sin) / a;
    var i = st.mass * DISK_RADIUS * DISK_RADIUS * (ratio - 1);
    return isFinite(i) && i > 0 ? i : 0;
  }

  function analyze(id, tMeas) {
    var st = setupFor(id);
    var a = 2 * TRAVEL_D / (tMeas * tMeas);
    var vAvg = TRAVEL_D / tMeas;
    return {
      id: id,
      cfg: st.cfg,
      setup: st,
      tMeas: tMeas,
      tTrue: st.tTrue,
      accel: a,
      vAvg: vAvg,
      omegaAvg: vAvg / DISK_RADIUS,
      iMeas: inertiaFromTime(st, tMeas)
    };
  }

  function computeResults() {
    var rows = [];
    CONFIGS.forEach(function (cfg) {
      var arr = state.trials[cfg.id] || [];
      if (!arr.length) return;
      var st = setupFor(cfg.id);
      var tMean = mean(arr);
      var vAvg = TRAVEL_D / tMean;
      rows.push({
        cfg: cfg,
        st: st,
        n: arr.length,
        t: tMean,
        tSd: stdev(arr),
        a: 2 * TRAVEL_D / (tMean * tMean),
        v: vAvg,
        omega: vAvg / DISK_RADIUS,
        i: inertiaFromTime(st, tMean)
      });
    });

    var diskRow = null;
    rows.forEach(function (r) { if (r.cfg.id === 'disk') diskRow = r; });
    var iDiskMeas = diskRow ? diskRow.i : null;
    var iDiskTheory = 0.5 * DISK_MASS * DISK_RADIUS * DISK_RADIUS;

    rows.forEach(function (r) {
      r.iEach = (r.cfg.id !== 'disk' && iDiskMeas != null && r.st.nBalls)
        ? (r.i - iDiskMeas) / r.st.nBalls
        : null;
    });

    return {
      rows: rows,
      iDiskMeas: iDiskMeas,
      iDiskTheory: iDiskTheory,
      diffPct: iDiskMeas != null ? (iDiskMeas - iDiskTheory) / iDiskTheory * 100 : null
    };
  }

  /* ---------------- status + stats ---------------- */

  function setBadge(kind, text) {
    var el = $('runBadge');
    el.dataset.state = kind;
    el.textContent = text;
  }

  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function updateRunUI() {
    var busy = sim.running || state.auto;
    runBtn.disabled = busy;
    autoBtn.disabled = busy;
    clearBtn.disabled = busy;
    var btns = caseOptions.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = busy;

    var n = (state.trials[state.caseId] || []).length;
    runBtnLabel.textContent = busy
      ? 'Timing…'
      : (n >= MAX_TRIALS ? 'Retake trial ' + MAX_TRIALS : 'Release disk');

    trialPill.textContent = n ? n + ' / ' + MAX_TRIALS + ' trials' : 'No run yet';
    trialPill.dataset.tone = n >= MAX_TRIALS ? 'good' : '';
  }

  function updateCaseUI() {
    var btns = caseOptions.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var active = btns[i].dataset.caseId === state.caseId;
      btns[i].classList.toggle('is-active', active);
      btns[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    $('caseHint').textContent = configById(state.caseId).hint;
  }

  function updateHud() {
    var st = sim.setup;
    $('hudTime').textContent = sim.t.toFixed(2);
    $('hudVel').textContent = sim.v.toFixed(2);
    $('hudOmega').textContent = (sim.v / DISK_RADIUS).toFixed(1);
    $('hudTheta').textContent = st.thetaDeg.toFixed(1) + '°';
    $('hudSin').textContent = st.sin.toFixed(3);
    $('hudI').textContent = sci(st.iTotal, 2);
  }

  function updateStats() {
    var run = state.lastRun;
    var st = run ? run.setup : sim.setup;
    statCase.textContent = (run ? run.cfg : configById(state.caseId)).label;
    statTheta.textContent = st.thetaDeg.toFixed(1) + '°';
    statSin.textContent = st.sin.toFixed(3);
    statD.textContent = TRAVEL_D.toFixed(3) + ' m';
    statTime.textContent = run ? run.tMeas.toFixed(2) + ' s' : '—';
    statSpeed.textContent = run ? run.vAvg.toFixed(3) + ' m/s' : '—';
    statOmega.textContent = run ? run.omegaAvg.toFixed(2) + ' rad/s' : '—';
    statAccel.textContent = run ? run.accel.toFixed(3) + ' m/s²' : '—';
    statI.textContent = run ? sci(run.iMeas, 2) + ' kg·m²' : '—';
  }

  /* ---------------- table + results ---------------- */

  function renderTable() {
    var html = '';
    var total = 0;
    CONFIGS.forEach(function (cfg) {
      var arr = state.trials[cfg.id] || [];
      total += arr.length;
      var st = setupFor(cfg.id);
      var cells = '';
      for (var i = 0; i < MAX_TRIALS; i++) {
        cells += '<td' + (arr[i] == null ? ' class="empty"' : '') + '>' +
          (arr[i] != null ? arr[i].toFixed(2) : '—') + '</td>';
      }
      var tMean = arr.length ? mean(arr) : null;
      html += '<tr data-case-id="' + cfg.id + '"' + (cfg.id === state.caseId ? ' class="is-current"' : '') + '>' +
        '<td class="case-name">' + cfg.label + '</td>' + cells +
        '<td class="avg">' + (tMean != null ? tMean.toFixed(2) : '—') + '</td>' +
        '<td>' + (tMean != null ? (TRAVEL_D / tMean).toFixed(3) : '—') + '</td>' +
        '<td>' + (tMean != null ? sci(inertiaFromTime(st, tMean), 1) : '—') + '</td>' +
        '</tr>';
    });
    dataBody.innerHTML = html;
    dataCount.textContent = total + (total === 1 ? ' trial' : ' trials');
  }

  function renderResults() {
    var res = computeResults();
    var deltaEl = $('resultDelta');
    var noteEl = $('resultNote');
    var heroEl = $('resultI');

    if (res.iDiskMeas == null) {
      heroEl.textContent = '—';
      deltaEl.hidden = true;
    } else {
      heroEl.textContent = sci(res.iDiskMeas, 2);
      deltaEl.hidden = false;
      deltaEl.textContent = (res.diffPct >= 0 ? '+' : '') + res.diffPct.toFixed(1) + '%';
      deltaEl.dataset.tone = Math.abs(res.diffPct) <= 8 ? '' : 'warn';
    }

    $('resultTheory').textContent = sci(res.iDiskTheory, 2) + ' kg·m²';
    $('resultBallTheory').textContent = sci(BALL_MASS * R_OUTER * R_OUTER, 2) + ' kg·m²';

    var recorded = res.rows.length;
    $('resultN').textContent = recorded + ' / ' + CONFIGS.length;
    resultPill.textContent = recorded ? recorded + ' recorded' : 'No data';
    resultPill.dataset.tone = recorded >= CONFIGS.length ? 'good' : (recorded ? 'accent' : '');

    var html = '';
    res.rows.forEach(function (r) {
      if (r.cfg.id === 'disk') return;
      html += '<div><dt>' + r.cfg.short + ' · I total</dt><dd>' + sci(r.i, 2) + '</dd></div>';
      html += '<div><dt>' + r.cfg.short + ' · each ball</dt><dd>' +
        (r.iEach != null ? sci(r.iEach, 2) : '—') + '</dd></div>';
    });
    $('caseList').innerHTML = html;

    if (!recorded) {
      noteEl.textContent = 'Time the disk alone three times, then repeat each ball arrangement.';
    } else if (res.iDiskMeas == null) {
      noteEl.textContent = 'Record the disk alone to get its moment of inertia before adding the steel balls.';
    } else {
      var ballRows = res.rows.filter(function (r) { return r.cfg.id !== 'disk'; });
      if (!ballRows.length) {
        noteEl.textContent = 'Disk inertia measured. Add a ball arrangement to separate the balls from the disk.';
      } else {
        var fastest = ballRows.slice().sort(function (a, b) { return a.t - b.t; })[0];
        noteEl.textContent = 'I = m r₀² (g sin θ / a − 1) with a = 2d / t². ' + fastest.cfg.name +
          ' was fastest (' + fastest.t.toFixed(2) + ' s) because it carries the smallest moment of inertia.';
      }
    }
  }

  function updateMeta() {
    var run = state.lastRun;
    $('xtMeta').textContent = run
      ? run.cfg.short + ' · stopwatch ' + run.tMeas.toFixed(2) + ' s'
      : 'No run recorded yet';
    $('vtMeta').textContent = run
      ? run.cfg.short + ' · v̄ = ' + run.vAvg.toFixed(3) + ' m/s'
      : 'No run recorded yet';
    var res = computeResults();
    $('caseMeta').textContent = res.rows.length
      ? res.rows.length + ' of ' + CONFIGS.length + ' arrangements'
      : 'Record a run to plot moment of inertia';
  }

  function renderAll() {
    updateRunUI();
    updateStats();
    renderTable();
    renderResults();
    updateMeta();
    drawCharts();
  }

  /* ---------------- scene ---------------- */

  function resizeScene() {
    var rect = canvasWrap.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    sceneW = Math.max(240, Math.round(rect.width));
    sceneH = Math.max(200, Math.round(rect.height));
    sceneDpr = dpr;
    sceneCanvas.width = Math.round(sceneW * dpr);
    sceneCanvas.height = Math.round(sceneH * dpr);
    drawScene();
  }

  function geometry() {
    var padT = 62, padB = 52, padL = 34, padR = 34;
    var x0 = padL + 30;
    var x1 = Math.max(x0 + 140, sceneW - padR - 12);
    var span = x1 - x0;
    var drop = span * 0.30;                    // drawn slope is exaggerated for clarity
    var y1 = sceneH - padB - 42;
    var y0 = y1 - drop;
    if (y0 < padT + 16) {
      y0 = padT + 16;
      y1 = y0 + drop;
    }
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    return {
      x0: x0, y0: y0, x1: x1, y1: y1,
      ux: ux, uy: uy,
      nx: uy, ny: -ux,                          // normal pointing up, out of the board
      len: len,
      radiusPx: clamp(span * 0.088, 20, 64)
    };
  }

  function pointAt(g, f) {
    return { x: g.x0 + (g.x1 - g.x0) * f, y: g.y0 + (g.y1 - g.y0) * f };
  }

  function arrow(c, x, y, dx, dy, color) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;
    var ux = dx / len, uy = dy / len;
    var head = Math.min(10, len * 0.45);
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dx - ux * head * 0.8, y + dy - uy * head * 0.8);
    c.stroke();
    c.beginPath();
    c.moveTo(x + dx, y + dy);
    c.lineTo(x + dx - ux * head - uy * head * 0.55, y + dy - uy * head + ux * head * 0.55);
    c.lineTo(x + dx - ux * head + uy * head * 0.55, y + dy - uy * head - ux * head * 0.55);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawMark(c, g, f, label, P) {
    var p = pointAt(g, f);
    var out = 14;
    c.save();
    c.strokeStyle = P.mark;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(p.x + g.nx * 2, p.y + g.ny * 2);
    c.lineTo(p.x + g.nx * out, p.y + g.ny * out);
    c.stroke();
    c.fillStyle = P.mark;
    c.font = '600 9.5px ' + FONT;
    c.textAlign = label === 'stop' ? 'right' : 'left';
    c.fillText(label, p.x + g.nx * (out + 5) + (label === 'stop' ? 4 : -2), p.y + g.ny * (out + 12));
    c.restore();
  }

  function drawDisk(c, cx, cy, R, phi, cfg, P) {
    c.save();

    c.globalAlpha = 0.16;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(cx, cy + R * 0.94, R * 0.92, R * 0.14, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    var body = c.createRadialGradient(cx - R * 0.36, cy - R * 0.42, R * 0.12, cx, cy, R * 1.05);
    body.addColorStop(0, P.diskHi);
    body.addColorStop(1, P.disk);
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = body;
    c.fill();
    c.lineWidth = Math.max(1.5, R * 0.05);
    c.strokeStyle = P.diskEdge;
    c.stroke();

    // empty placeholders on both rims
    c.strokeStyle = P.diskHub;
    c.lineWidth = 1;
    c.globalAlpha = 0.45;
    [[R_OUTER, 0], [R_OUTER, 90], [R_OUTER, 180], [R_OUTER, 270],
      [R_INNER, 0], [R_INNER, 90], [R_INNER, 180], [R_INNER, 270]].forEach(function (ph) {
      var a = ph[1] * Math.PI / 180 + phi;
      var rad = ph[0] / DISK_RADIUS * R;
      c.beginPath();
      c.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, Math.max(2.5, R * 0.075), 0, Math.PI * 2);
      c.stroke();
    });
    c.globalAlpha = 1;

    // hub
    c.beginPath();
    c.arc(cx, cy, R * 0.15, 0, Math.PI * 2);
    c.fillStyle = P.diskHub;
    c.fill();

    // steel balls
    var br = Math.max(3, BALL_RADIUS / DISK_RADIUS * R);
    cfg.balls.forEach(function (b) {
      var a = b[0] * Math.PI / 180 + phi;
      var rad = ballRadius(b[1]) / DISK_RADIUS * R;
      var bx = cx + Math.cos(a) * rad;
      var by = cy + Math.sin(a) * rad;
      var ball = c.createRadialGradient(bx - br * 0.4, by - br * 0.42, br * 0.15, bx, by, br);
      ball.addColorStop(0, P.ballHi);
      ball.addColorStop(1, P.ball);
      c.beginPath();
      c.arc(bx, by, br, 0, Math.PI * 2);
      c.fillStyle = ball;
      c.fill();
      c.lineWidth = 0.8;
      c.strokeStyle = P.diskEdge;
      c.stroke();
    });

    c.restore();
  }

  function drawScene() {
    if (!sceneW || !sceneH) return;
    var c = sceneCanvas.getContext('2d');
    var P = palette();
    c.setTransform(sceneDpr, 0, 0, sceneDpr, 0, 0);
    c.clearRect(0, 0, sceneW, sceneH);

    var bg = c.createLinearGradient(0, 0, 0, sceneH);
    bg.addColorStop(0, P.sceneTop);
    bg.addColorStop(1, P.sceneBottom);
    c.fillStyle = bg;
    c.fillRect(0, 0, sceneW, sceneH);

    var g = geometry();
    var st = sim.setup;
    var yTable = g.y1 + 30;

    // table
    c.strokeStyle = P.sceneFloor;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(18, yTable);
    c.lineTo(sceneW - 18, yTable);
    c.stroke();

    // riser block under the raised end
    var bw = Math.max(20, g.radiusPx * 0.5);
    rr(c, g.x0 - bw / 2, g.y0 + 2, bw, Math.max(8, yTable - g.y0 - 2), 4);
    c.fillStyle = P.block;
    c.fill();
    c.strokeStyle = P.blockEdge;
    c.lineWidth = 1.2;
    c.stroke();

    // board
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = P.trackEdge;
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(g.x0 - 10, g.y0 - 2);
    c.lineTo(g.x1 + 10, g.y1 + 2);
    c.stroke();
    c.strokeStyle = P.track;
    c.lineWidth = 8.5;
    c.beginPath();
    c.moveTo(g.x0 - 10, g.y0 - 2);
    c.lineTo(g.x1 + 10, g.y1 + 2);
    c.stroke();
    c.globalAlpha = 0.65;
    c.strokeStyle = P.trackHi;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(g.x0 - 8, g.y0 - 5);
    c.lineTo(g.x1 + 8, g.y1 - 1);
    c.stroke();
    c.restore();

    // start and stop marks
    drawMark(c, g, 0, 'start', P);
    drawMark(c, g, 1, 'stop', P);

    // distance label along the board
    c.save();
    var mid = pointAt(g, 0.5);
    c.translate(mid.x, mid.y + g.ny * (g.radiusPx * 1.55));
    c.rotate(Math.atan2(g.uy, g.ux));
    c.fillStyle = P.muted;
    c.font = '600 10.5px ' + FONT;
    c.textAlign = 'center';
    c.fillText('d = ' + TRAVEL_D.toFixed(2) + ' m', 0, 0);
    c.restore();

    // incline angle at the low end
    var thetaDraw = Math.atan2(g.uy, g.ux);
    var arcR = clamp(g.radiusPx * 0.85, 26, 48);
    c.save();
    c.strokeStyle = P.axis;
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(g.x1, g.y1, arcR, Math.PI, Math.PI + thetaDraw, false);
    c.stroke();
    c.fillStyle = P.muted;
    c.font = '600 10px ' + FONT;
    c.textAlign = 'left';
    c.fillText('θ = ' + st.thetaDeg.toFixed(1) + '°',
      g.x1 - arcR - 4, g.y1 - arcR * 0.42 - 4);
    c.restore();

    // riser height dimension
    var dimX = Math.max(14, g.x0 - bw / 2 - 16);
    c.save();
    c.strokeStyle = P.axis;
    c.lineWidth = 1.1;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(dimX, yTable);
    c.lineTo(dimX, g.y0);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(dimX - 4, g.y0);
    c.lineTo(dimX + 4, g.y0);
    c.moveTo(dimX - 4, yTable);
    c.lineTo(dimX + 4, yTable);
    c.stroke();
    c.translate(dimX - 7, (yTable + g.y0) / 2);
    c.rotate(-Math.PI / 2);
    c.fillStyle = P.muted;
    c.font = '600 9.5px ' + FONT;
    c.textAlign = 'center';
    c.fillText('h = ' + (INCLINE_H * 100).toFixed(1) + ' cm', 0, 0);
    c.restore();

    // disk
    var f = clamp(sim.s / TRAVEL_D, 0, 1);
    var p = pointAt(g, f);
    var R = g.radiusPx;
    var cx = p.x + g.nx * R;
    var cy = p.y + g.ny * R;
    drawDisk(c, cx, cy, R, sim.phi, configById(state.caseId), P);

    // velocity arrow while running
    if (sim.running && sim.v > 0.02) {
      var grow = 16 + 54 * clamp(sim.v / (st.vEnd || 1), 0, 1);
      arrow(c, cx + g.ux * (R * 1.1), cy + g.uy * (R * 1.1), g.ux * grow, g.uy * grow, P.accent);
    }
  }

  /* ---------------- simulation ---------------- */

  function sampleAt(tt) {
    var st = sim.setup;
    var s = Math.min(TRAVEL_D, 0.5 * st.accel * tt * tt);
    var v = Math.min(st.vEnd, st.accel * tt);
    return { t: tt, s: s, v: v, w: v / DISK_RADIUS };
  }

  function startRun(id, speed) {
    var st = setupFor(id);
    state.caseId = id;
    sim.setup = st;
    sim.pendingId = id;
    sim.t = 0;
    sim.s = 0;
    sim.v = 0;
    sim.phi = 0;
    sim.samples = [sampleAt(0)];
    sim.nextIndex = 1;
    sim.duration = st.tTrue;
    sim.speed = speed || state.speed;
    sim.running = true;

    setBadge('running', 'Timing');
    setStatus('Disk released — stop the watch at the lower mark.');
    updateCaseUI();
    updateHud();
    updateRunUI();
    drawScene();

    return new Promise(function (resolve) { sim.resolve = resolve; });
  }

  function advanceSim(dt) {
    var st = sim.setup;
    sim.t += dt;

    if (sim.t >= sim.duration) {
      sim.t = sim.duration;
      sim.s = TRAVEL_D;
      sim.v = st.vEnd;
      sim.phi = TRAVEL_D / DISK_RADIUS;
      while (sim.nextIndex / SAMPLE_RATE <= sim.duration && sim.samples.length < MAX_SAMPLES) {
        sim.samples.push(sampleAt(sim.nextIndex / SAMPLE_RATE));
        sim.nextIndex++;
      }
      finishRun();
      return;
    }

    sim.s = 0.5 * st.accel * sim.t * sim.t;
    sim.v = st.accel * sim.t;
    sim.phi = sim.s / DISK_RADIUS;
    while (sim.nextIndex / SAMPLE_RATE <= sim.t && sim.samples.length < MAX_SAMPLES) {
      sim.samples.push(sampleAt(sim.nextIndex / SAMPLE_RATE));
      sim.nextIndex++;
    }
  }

  function recordTrial(id, t) {
    var arr = state.trials[id] || (state.trials[id] = []);
    if (arr.length < MAX_TRIALS) arr.push(t);
    else arr[MAX_TRIALS - 1] = t;
  }

  function finishRun() {
    var id = sim.pendingId;
    sim.running = false;

    // the stopwatch is a person: a small lag plus reaction scatter
    var measured = sim.setup.tTrue * (1 + STOPWATCH_BIAS) + randn() * STOPWATCH_SIGMA;
    measured = Math.max(0.2, measured);

    var run = analyze(id, measured);
    run.samples = sim.samples.slice();
    state.lastRun = run;
    recordTrial(id, measured);

    setBadge('done', 'Recorded');
    setStatus(run.cfg.name + ' — t = ' + measured.toFixed(2) + ' s, a = ' +
      run.accel.toFixed(3) + ' m/s², I = ' + sci(run.iMeas, 2) + ' kg·m².');
    updateHud();
    renderAll();
    drawScene();

    if (sim.resolve) {
      var done = sim.resolve;
      sim.resolve = null;
      done(run);
    }
  }

  async function autoRun() {
    if (sim.running || state.auto) return;
    state.auto = true;
    setBadge('auto', 'Auto-run');
    setStatus('Collecting three stopwatch trials for every arrangement…');
    updateRunUI();

    try {
      for (var i = 0; i < CONFIGS.length; i++) {
        var cfg = CONFIGS[i];
        if (cfg.id !== state.caseId) {
          state.caseId = cfg.id;
          state.lastRun = null;
          sim.setup = setupFor(cfg.id);
          sim.duration = sim.setup.tTrue;
          sim.t = 0;
          sim.s = 0;
          sim.v = 0;
          sim.phi = 0;
          updateCaseUI();
          renderTable();
          updateHud();
          drawScene();
        }
        while ((state.trials[cfg.id] || []).length < MAX_TRIALS && state.auto) {
          await startRun(cfg.id, 8);
          await sleep(130);
        }
      }
    } finally {
      state.auto = false;
      sim.running = false;
      renderAll();
      drawScene();
      var res = computeResults();
      setBadge('done', 'Complete');
      setStatus(res.iDiskMeas != null
        ? 'Auto-run finished — disk inertia I = ' + sci(res.iDiskMeas, 2) + ' kg·m².'
        : 'Auto-run finished.');
    }
  }

  /* ---------------- arrangement + buttons ---------------- */

  function buildCaseButtons() {
    CONFIGS.forEach(function (cfg) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'block-btn' + (cfg.id === state.caseId ? ' is-active' : '');
      b.dataset.caseId = cfg.id;
      b.setAttribute('aria-pressed', cfg.id === state.caseId ? 'true' : 'false');
      b.title = cfg.name;
      b.textContent = cfg.label;
      caseOptions.appendChild(b);
    });
  }

  function selectCase(id) {
    if (sim.running || state.auto || id === state.caseId) return;
    state.caseId = id;
    state.lastRun = null;
    sim.setup = setupFor(id);
    sim.t = 0;
    sim.s = 0;
    sim.v = 0;
    sim.phi = 0;
    sim.duration = sim.setup.tTrue;
    sim.samples = [];
    sim.nextIndex = 0;

    updateCaseUI();
    setBadge('idle', 'Idle');
    setStatus(configById(id).name + ' — I = ' + sci(sim.setup.iTotal, 2) +
      ' kg·m². Stop the watch at the lower mark.');
    updateHud();
    renderAll();
    drawScene();
  }

  caseOptions.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-case-id]');
    if (btn) selectCase(btn.dataset.caseId);
  });

  dataBody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-case-id]');
    if (tr) selectCase(tr.dataset.caseId);
  });

  runBtn.addEventListener('click', function () {
    if (sim.running || state.auto) return;
    startRun(state.caseId, state.speed);
  });

  autoBtn.addEventListener('click', function () {
    if (sim.running || state.auto) return;
    autoRun();
  });

  clearBtn.addEventListener('click', function () {
    if (sim.running || state.auto) return;
    CONFIGS.forEach(function (cfg) { state.trials[cfg.id] = []; });
    state.lastRun = null;
    sim.t = 0;
    sim.s = 0;
    sim.v = 0;
    sim.phi = 0;
    sim.samples = [];
    sim.nextIndex = 0;
    sim.setup = setupFor(state.caseId);
    sim.duration = sim.setup.tTrue;
    setBadge('idle', 'Idle');
    setStatus('Data cleared. Pick an arrangement and release the disk.');
    updateHud();
    renderAll();
    drawScene();
  });

  document.querySelectorAll('.speed button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.speed = Number(btn.dataset.speed) || 1;
      document.querySelectorAll('.speed button').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      if (sim.running) sim.speed = state.speed;
    });
  });

  /* ---------------- csv + downloads ---------------- */

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvText(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  function downloadText(text, filename, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function buildTableCSV() {
    var st0 = setupFor(state.caseId);
    var rows = [];
    rows.push(['Moment of Inertia on an Incline - PHY 1510 Experiment 10a']);
    rows.push(['Exported', new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['Disk mass m0 (kg)', DISK_MASS.toFixed(3)]);
    rows.push(['Disk radius r0 (m)', DISK_RADIUS.toFixed(4)]);
    rows.push(['Steel ball mass mb (kg)', BALL_MASS.toFixed(4)]);
    rows.push(['Outer rim radius r1 (m)', R_OUTER.toFixed(4)]);
    rows.push(['Inner rim radius r2 (m)', R_INNER.toFixed(4)]);
    rows.push(['Incline height h (m)', INCLINE_H.toFixed(4)]);
    rows.push(['Travel distance d (m)', TRAVEL_D.toFixed(3)]);
    rows.push(['sin(theta) = h / d', st0.sin.toFixed(4)]);
    rows.push(['Angle theta (deg)', st0.thetaDeg.toFixed(3)]);
    rows.push(['Stopwatch scatter sigma (s)', STOPWATCH_SIGMA.toFixed(3)]);
    rows.push([]);
    rows.push([
      'Arrangement', 'Balls', 'Trial 1 t (s)', 'Trial 2 t (s)', 'Trial 3 t (s)',
      'Average t (s)', 'Average speed (m/s)', 'Acceleration (m/s^2)',
      'Total I (kg m^2)', 'I per ball (kg m^2)'
    ]);

    var res = computeResults();
    CONFIGS.forEach(function (cfg) {
      var arr = state.trials[cfg.id] || [];
      var st = setupFor(cfg.id);
      var tMean = arr.length ? mean(arr) : null;
      var row = res.rows.filter(function (r) { return r.cfg.id === cfg.id; })[0];
      rows.push([
        cfg.name,
        cfg.balls.length ? cfg.balls.map(function (b) { return b[1][0] + ':' + ballRadius(b[1]).toFixed(3); }).join(' ') : 'none',
        arr[0] != null ? arr[0].toFixed(3) : '',
        arr[1] != null ? arr[1].toFixed(3) : '',
        arr[2] != null ? arr[2].toFixed(3) : '',
        tMean != null ? tMean.toFixed(3) : '',
        tMean != null ? (TRAVEL_D / tMean).toFixed(4) : '',
        tMean != null ? (2 * TRAVEL_D / (tMean * tMean)).toFixed(4) : '',
        tMean != null ? inertiaFromTime(st, tMean).toExponential(4) : '',
        row && row.iEach != null ? row.iEach.toExponential(4) : ''
      ]);
    });

    rows.push([]);
    rows.push(['Disk moment of inertia measured (kg m^2)',
      res.iDiskMeas != null ? res.iDiskMeas.toExponential(4) : '']);
    rows.push(['Disk moment of inertia accepted, m0 r0^2 / 2 (kg m^2)', res.iDiskTheory.toExponential(4)]);
    rows.push(['Difference (%)', res.diffPct != null ? res.diffPct.toFixed(2) : '']);
    rows.push(['Single ball at r1, mb r1^2 (kg m^2)', (BALL_MASS * R_OUTER * R_OUTER).toExponential(4)]);
    rows.push(['Single ball at r2, mb r2^2 (kg m^2)', (BALL_MASS * R_INNER * R_INNER).toExponential(4)]);
    return csvText(rows);
  }

  function buildRunCSV(run) {
    var rows = [];
    rows.push(['Run summary - Moment of Inertia on an Incline']);
    rows.push(['Arrangement', run.cfg.name]);
    rows.push(['Balls', run.cfg.balls.length]);
    rows.push(['Incline height h (m)', INCLINE_H.toFixed(4)]);
    rows.push(['Travel distance d (m)', TRAVEL_D.toFixed(3)]);
    rows.push(['sin(theta)', run.setup.sin.toFixed(4)]);
    rows.push(['Angle theta (deg)', run.setup.thetaDeg.toFixed(3)]);
    rows.push(['Stopwatch time (s)', run.tMeas.toFixed(3)]);
    rows.push(['Average speed (m/s)', run.vAvg.toFixed(4)]);
    rows.push(['Average angular speed (rad/s)', run.omegaAvg.toFixed(3)]);
    rows.push(['Acceleration (m/s^2)', run.accel.toFixed(4)]);
    rows.push(['Total moment of inertia (kg m^2)', run.iMeas.toExponential(4)]);
    rows.push(['Model moment of inertia (kg m^2)', run.setup.iTotal.toExponential(4)]);
    rows.push([]);
    rows.push(['Time (s)', 'Distance along incline (m)', 'Speed (m/s)', 'Angular speed (rad/s)']);
    run.samples.forEach(function (s) {
      rows.push([s.t.toFixed(4), s.s.toFixed(4), s.v.toFixed(4), s.w.toFixed(4)]);
    });
    return csvText(rows);
  }

  $('exportTableBtn').addEventListener('click', function () {
    downloadText(buildTableCSV(), 'moment-of-inertia-data.csv');
    toast('Data table exported as CSV');
  });

  $('exportRunBtn').addEventListener('click', function () {
    if (!state.lastRun) { toast('Release the disk first'); return; }
    downloadText(buildRunCSV(state.lastRun), 'moment-of-inertia-run.csv');
    toast('Run samples exported as CSV');
  });

  var CHART_NAMES = {
    xt: 'moment-of-inertia-distance-time',
    vt: 'moment-of-inertia-speed-time',
    case: 'moment-of-inertia-vs-ball-radius'
  };

  document.querySelectorAll('.export-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var chart = charts[btn.dataset.chart];
      if (!chart) return;
      var base = CHART_NAMES[btn.dataset.chart] || 'moment-of-inertia-plot';
      if (btn.dataset.format === 'png') {
        chart.exportPNG(base);
        toast('Plot exported as PNG');
      } else {
        chart.exportSVG(base);
        toast('Plot exported as SVG');
      }
    });
  });

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2300);
  }

  /* ---------------- charts ---------------- */

  function activeSetup() {
    var run = state.lastRun;
    return sim.running ? sim.setup : (run ? run.setup : sim.setup);
  }

  function cfgXT() {
    var P = palette();
    var run = state.lastRun;
    var st = activeSetup();
    var tEnd = st.tTrue;
    var tMax = Math.max(tEnd, run ? run.tMeas : 0);

    var curve = [];
    for (var i = 0; i <= 64; i++) {
      var tt = tEnd * i / 64;
      curve.push([tt, 0.5 * st.accel * tt * tt]);
    }

    var series = [{ type: 'line', label: 's = ½ a t²', color: P.accent, width: 2, points: curve }];
    if (run) {
      series.push({
        type: 'error', label: 'stopwatch stop', color: P.accent2,
        radius: 4.5, fill: P.panel, points: [[run.tMeas, TRAVEL_D]]
      });
    }

    return {
      colors: P,
      xLabel: 'Time (s)',
      yLabel: 'Distance along incline (m)',
      xMin: 0,
      xMax: Math.max(0.25, tMax * 1.12),
      yMin: 0,
      yMax: TRAVEL_D * 1.12,
      series: series,
      emptyText: 'Release the disk to trace its descent.',
      annotations: run ? [{
        x: run.tMeas, y: TRAVEL_D, dx: -8, dy: -13, align: 'right',
        text: 't = ' + run.tMeas.toFixed(2) + ' s', color: P.accent2
      }] : []
    };
  }

  function cfgVT() {
    var P = palette();
    var run = state.lastRun;
    var st = activeSetup();
    var tEnd = st.tTrue;
    var tMax = Math.max(tEnd, run ? run.tMeas : 0);
    var vAvg = run ? run.vAvg : TRAVEL_D / tEnd;

    var curve = [];
    for (var i = 0; i <= 64; i++) {
      var tt = tEnd * i / 64;
      curve.push([tt, st.accel * tt]);
    }

    var series = [
      { type: 'line', label: 'v = a t', color: P.accent, width: 2, points: curve },
      {
        type: 'line', label: 'average speed d / t', color: P.accent2, width: 1.6, dash: [5, 4],
        points: [[0, vAvg], [tMax, vAvg]]
      }
    ];
    if (run) {
      series.push({
        type: 'points', label: '', color: P.accent2, radius: 4,
        hollow: true, fill: P.panel, points: [[run.tMeas, run.vAvg]]
      });
    }

    return {
      colors: P,
      xLabel: 'Time (s)',
      yLabel: 'Speed (m/s)',
      xMin: 0,
      xMax: Math.max(0.25, tMax * 1.12),
      yMin: 0,
      yMax: Math.max(0.1, st.vEnd * 1.2),
      series: series,
      emptyText: 'Speed appears here during a run.'
    };
  }

  function cfgCASE() {
    var P = palette();
    var res = computeResults();
    var rows = res.rows;

    var points = rows.map(function (r) {
      var err = Math.abs(r.i - inertiaFromTime(r.st, Math.max(0.2, r.t + r.tSd))) * 1e4;
      return { x: meanBallRadius(r.cfg) * 100, y: r.i * 1e4, yerr: err };
    });

    var curve = [];
    for (var i = 0; i <= 40; i++) {
      var rr2 = (R_OUTER * 1.05) * i / 40;
      var ith = 0.5 * DISK_MASS * DISK_RADIUS * DISK_RADIUS + 4 * BALL_MASS * rr2 * rr2;
      curve.push([rr2 * 100, ith * 1e4]);
    }

    var series = [{
      type: 'line', label: 'model · m₀ + 4 balls', color: P.faint, width: 1.6, dash: [5, 4], points: curve
    }];
    if (points.length) {
      series.push({ type: 'error', label: 'measured', color: P.accent, radius: 4.5, fill: P.panel, points: points });
    }

    var annotations = rows.map(function (r) {
      var id = r.cfg.id;
      var dy = id === 'alternating' ? -13 : (id === 'inline' ? 13 : -11);
      return {
        x: meanBallRadius(r.cfg) * 100,
        y: r.i * 1e4,
        dx: 7, dy: dy, text: r.cfg.short, size: 9.5, color: P.muted
      };
    });

    return {
      colors: P,
      xLabel: 'Mean ball radius r (cm)',
      yLabel: 'I (10⁻⁴ kg·m²)',
      xMin: 0,
      xMax: R_OUTER * 100 * 1.18,
      yMin: 0,
      yMax: 15,
      series: series,
      annotations: annotations,
      emptyText: 'Record a run to plot the measured moment of inertia.'
    };
  }

  function drawCharts() {
    if (charts.xt) charts.xt.schedule();
    if (charts.vt) charts.vt.schedule();
    if (charts.case) charts.case.schedule();
  }

  /* ---------------- render loop ---------------- */

  var lastFrame = performance.now();
  var chartClock = 0;

  function frame(now) {
    var dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    if (sim.running) {
      advanceSim(dt * sim.speed);
      drawScene();
      updateHud();
      chartClock += dt;
      if (chartClock > 0.12) {
        chartClock = 0;
        if (charts.xt) charts.xt.schedule();
        if (charts.vt) charts.vt.schedule();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- init ---------------- */

  function init() {
    buildCaseButtons();
    charts.xt = ChartKit.create(chartXT, cfgXT);
    charts.vt = ChartKit.create(chartVT, cfgVT);
    charts.case = ChartKit.create(chartCASE, cfgCASE);

    themeToggle.setAttribute('aria-label',
      document.documentElement.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

    sim.setup = setupFor(state.caseId);
    sim.duration = sim.setup.tTrue;

    resizeScene();
    if (window.ResizeObserver) new ResizeObserver(resizeScene).observe(canvasWrap);
    else window.addEventListener('resize', resizeScene);
    window.addEventListener('orientationchange', function () {
      setTimeout(resizeScene, 120);
    });

    updateCaseUI();
    updateHud();
    renderAll();
    drawScene();
    requestAnimationFrame(frame);
  }

  init();
})();
