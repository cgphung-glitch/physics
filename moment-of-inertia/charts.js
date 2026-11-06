/* ============================================================
   ChartKit — dependency-free canvas charts with PNG / SVG export
   Exposes: window.ChartKit.create(canvas, getConfig)
   ============================================================ */
(function (global) {
  'use strict';

  var FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var measureCanvas = document.createElement('canvas');
  var measureCtx = measureCanvas.getContext('2d');

  function measureText(text, size, weight) {
    measureCtx.font = (weight || 400) + ' ' + size + 'px ' + FONT;
    return measureCtx.measureText(String(text)).width;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function n(v) {
    return Math.round(v * 100) / 100;
  }

  /* ---------------- scales & ticks ---------------- */

  function niceTicks(min, max, target) {
    if (!isFinite(min) || !isFinite(max) || max <= min) return [];
    var span = max - min;
    var raw = span / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = mag;
    var best = Infinity;
    [1, 2, 2.5, 5, 10].forEach(function (c) {
      var candidate = c * mag;
      var count = span / candidate;
      var score = Math.abs(count - target) + (count < 2.5 ? 1.2 : 0);
      if (score < best) { best = score; step = candidate; }
    });
    var out = [];
    var start = Math.ceil(min / step - 1e-9) * step;
    for (var v = start, i = 0; v <= max + step * 1e-6 && i < 80; v += step, i++) {
      out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    }
    return out;
  }

  function tickDecimals(step) {
    var d = 0;
    var s = Math.abs(step);
    while (d < 4 && Math.abs(s - Math.round(s)) > 1e-6) { s *= 10; d++; }
    return d;
  }

  function fmt(v, decimals) {
    var s = v.toFixed(decimals);
    if (s === '-0' || /^-0\.0+$/.test(s)) s = s.slice(1);
    return s;
  }

  /* ---------------- renderers ---------------- */

  function CanvasRenderer(ctx) {
    this.ctx = ctx;
    this.type = 'canvas';
  }

  CanvasRenderer.prototype = {
    rect: function (x, y, w, h, fill, radius) {
      var c = this.ctx;
      c.save();
      c.fillStyle = fill;
      if (radius) roundRectPath(c, x, y, w, h, radius);
      else { c.beginPath(); c.rect(x, y, w, h); }
      c.fill();
      c.restore();
    },
    line: function (x1, y1, x2, y2, o) {
      o = o || {};
      var c = this.ctx;
      c.save();
      c.strokeStyle = o.color || '#000';
      c.lineWidth = o.width || 1;
      c.globalAlpha = o.opacity == null ? 1 : o.opacity;
      c.setLineDash(o.dash || []);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.restore();
    },
    polyline: function (pts, o) {
      if (!pts || pts.length < 2) return;
      o = o || {};
      var c = this.ctx;
      c.save();
      c.strokeStyle = o.color || '#000';
      c.lineWidth = o.width || 1.5;
      c.globalAlpha = o.opacity == null ? 1 : o.opacity;
      c.setLineDash(o.dash || []);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      c.restore();
    },
    circle: function (cx, cy, r, o) {
      o = o || {};
      var c = this.ctx;
      c.save();
      c.globalAlpha = o.opacity == null ? 1 : o.opacity;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      if (o.fill) { c.fillStyle = o.fill; c.fill(); }
      if (o.stroke) {
        c.strokeStyle = o.stroke;
        c.lineWidth = o.strokeWidth || 1.4;
        c.stroke();
      }
      c.restore();
    },
    text: function (str, x, y, o) {
      o = o || {};
      var c = this.ctx;
      c.save();
      c.font = (o.weight || 400) + ' ' + (o.size || 10) + 'px ' + FONT;
      c.fillStyle = o.color || '#000';
      c.textAlign = o.align || 'left';
      c.textBaseline = o.baseline || 'alphabetic';
      c.globalAlpha = o.opacity == null ? 1 : o.opacity;
      if (o.rotate) {
        c.translate(x, y);
        c.rotate(o.rotate);
        c.fillText(str, 0, 0);
      } else {
        c.fillText(str, x, y);
      }
      c.restore();
    },
    clip: function (x, y, w, h) {
      var c = this.ctx;
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
    },
    unclip: function () { this.ctx.restore(); }
  };

  function SvgRenderer(w, h) {
    this.w = w;
    this.h = h;
    this.parts = [];
    this.defs = [];
    this.openGroups = 0;
    this.clipId = 0;
    this.type = 'svg';
  }

  SvgRenderer.prototype = {
    rect: function (x, y, w, h, fill, radius) {
      if (radius) {
        this.parts.push(
          '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) +
          '" rx="' + n(radius) + '" fill="' + esc(fill) + '"/>'
        );
      } else {
        this.parts.push(
          '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) +
          '" fill="' + esc(fill) + '"/>'
        );
      }
    },
    line: function (x1, y1, x2, y2, o) {
      o = o || {};
      var attrs = 'x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"';
      attrs += ' stroke="' + esc(o.color || '#000') + '" stroke-width="' + n(o.width || 1) + '"';
      attrs += ' stroke-linecap="round"';
      if (o.dash && o.dash.length) attrs += ' stroke-dasharray="' + o.dash.join(' ') + '"';
      if (o.opacity != null && o.opacity !== 1) attrs += ' stroke-opacity="' + o.opacity + '"';
      this.parts.push('<line ' + attrs + '/>');
    },
    polyline: function (pts, o) {
      if (!pts || pts.length < 2) return;
      o = o || {};
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join(' ');
      var attrs = 'd="' + d + '" fill="none" stroke="' + esc(o.color || '#000') +
        '" stroke-width="' + n(o.width || 1.5) + '" stroke-linecap="round" stroke-linejoin="round"';
      if (o.dash && o.dash.length) attrs += ' stroke-dasharray="' + o.dash.join(' ') + '"';
      if (o.opacity != null && o.opacity !== 1) attrs += ' stroke-opacity="' + o.opacity + '"';
      this.parts.push('<path ' + attrs + '/>');
    },
    circle: function (cx, cy, r, o) {
      o = o || {};
      var attrs = 'cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '"';
      attrs += ' fill="' + esc(o.fill || 'none') + '"';
      if (o.stroke) {
        attrs += ' stroke="' + esc(o.stroke) + '" stroke-width="' + n(o.strokeWidth || 1.4) + '"';
      }
      if (o.opacity != null && o.opacity !== 1) attrs += ' opacity="' + o.opacity + '"';
      this.parts.push('<circle ' + attrs + '/>');
    },
    text: function (str, x, y, o) {
      o = o || {};
      var attrs = 'x="' + n(x) + '" y="' + n(y) + '"';
      attrs += ' fill="' + esc(o.color || '#000') + '"';
      attrs += ' font-size="' + n(o.size || 10) + '"';
      if (o.weight) attrs += ' font-weight="' + o.weight + '"';
      if (o.align && o.align !== 'start') attrs += ' text-anchor="' + (o.align === 'right' ? 'end' : 'middle') + '"';
      if (o.baseline === 'middle') attrs += ' dominant-baseline="middle"';
      else if (o.baseline === 'hanging') attrs += ' dominant-baseline="hanging"';
      if (o.opacity != null && o.opacity !== 1) attrs += ' fill-opacity="' + o.opacity + '"';
      if (o.rotate) attrs += ' transform="rotate(' + (o.rotate * 180 / Math.PI) + ' ' + n(x) + ' ' + n(y) + ')"';
      this.parts.push('<text ' + attrs + '>' + esc(str) + '</text>');
    },
    clip: function (x, y, w, h) {
      var id = 'clip' + (++this.clipId);
      this.defs.push(
        '<clipPath id="' + id + '"><rect x="' + n(x) + '" y="' + n(y) + '" width="' +
        n(w) + '" height="' + n(h) + '"/></clipPath>'
      );
      this.parts.push('<g clip-path="url(#' + id + ')">');
      this.openGroups++;
    },
    unclip: function () {
      if (this.openGroups > 0) {
        this.parts.push('</g>');
        this.openGroups--;
      }
    }
  };

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

  /* ---------------- chart drawing ---------------- */

  function drawChart(r, W, H, cfg) {
    var c = cfg.colors || {};
    var series = (cfg.series || []).filter(function (s) { return s && s.points && s.points.length; });

    var pad = { l: 54, r: 20, t: 16, b: 46 };
    if (W < 380) pad.l = 46;

    // ---- legend ----
    var legendItems = series.filter(function (s) { return s.label; });
    var legendAt = [];
    var legendBottom = 0;
    if (legendItems.length) {
      var lx = pad.l;
      var ly = 15;
      for (var i = 0; i < legendItems.length; i++) {
        var it = legendItems[i];
        var tw = measureText(it.label, 9.5, 500);
        var iw = 16 + 5 + tw + 15;
        if (lx + iw > W - pad.r && lx > pad.l) { lx = pad.l; ly += 16; }
        legendAt.push({ item: it, x: lx, y: ly });
        lx += iw;
        legendBottom = Math.max(legendBottom, ly);
      }
      pad.t = legendBottom + 18;
    }

    var plot = {
      x: pad.l,
      y: pad.t,
      w: Math.max(10, W - pad.l - pad.r),
      h: Math.max(10, H - pad.t - pad.b)
    };

    var xMin = Number(cfg.xMin);
    var xMax = Number(cfg.xMax);
    var yMin = Number(cfg.yMin);
    var yMax = Number(cfg.yMax);
    if (!isFinite(xMin) || !isFinite(xMax) || xMax <= xMin) { xMin = 0; xMax = 1; }
    if (!isFinite(yMin) || !isFinite(yMax) || yMax <= yMin) { yMin = 0; yMax = 1; }

    var sx = function (v) { return plot.x + (v - xMin) / (xMax - xMin) * plot.w; };
    var sy = function (v) { return plot.y + plot.h - (v - yMin) / (yMax - yMin) * plot.h; };

    // ---- grid ----
    var xTicks = niceTicks(xMin, xMax, Math.max(3, Math.min(7, Math.round(plot.w / 74))));
    var yTicks = niceTicks(yMin, yMax, Math.max(3, Math.min(6, Math.round(plot.h / 52))));
    var xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : (xMax - xMin);
    var yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : (yMax - yMin);
    var xDec = tickDecimals(xStep);
    var yDec = tickDecimals(yStep);

    xTicks.forEach(function (t) {
      var px = sx(t);
      if (px < plot.x - 0.5 || px > plot.x + plot.w + 0.5) return;
      r.line(px, plot.y, px, plot.y + plot.h, { color: c.grid, width: 1 });
      r.text(fmt(t, xDec), px, plot.y + plot.h + 16, {
        color: c.muted, size: 9.5, align: 'center', weight: 450
      });
    });

    yTicks.forEach(function (t) {
      var py = sy(t);
      if (py < plot.y - 0.5 || py > plot.y + plot.h + 0.5) return;
      r.line(plot.x, py, plot.x + plot.w, py, { color: c.grid, width: 1 });
      r.text(fmt(t, yDec), plot.x - 9, py, {
        color: c.muted, size: 9.5, align: 'right', baseline: 'middle', weight: 450
      });
    });

    // ---- axes ----
    r.line(plot.x, plot.y, plot.x, plot.y + plot.h, { color: c.axis, width: 1.2 });
    r.line(plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, { color: c.axis, width: 1.2 });

    // ---- axis labels ----
    if (cfg.xLabel) {
      r.text(cfg.xLabel, plot.x + plot.w / 2, H - 10, {
        color: c.muted, size: 10.5, align: 'center', weight: 500
      });
    }
    if (cfg.yLabel) {
      r.text(cfg.yLabel, 13, plot.y + plot.h / 2, {
        color: c.muted, size: 10.5, align: 'center', baseline: 'middle', weight: 500, rotate: -Math.PI / 2
      });
    }

    var hasData = series.some(function (s) { return s.points.length > 0; });

    if (!hasData && cfg.emptyText) {
      r.text(cfg.emptyText, plot.x + plot.w / 2, plot.y + plot.h / 2, {
        color: c.faint, size: 10.5, align: 'center', baseline: 'middle', weight: 450
      });
      drawLegend(r, legendAt, c);
      return;
    }

    // ---- series ----
    r.clip(plot.x, plot.y, plot.w, plot.h);
    series.forEach(function (s) {
      var color = s.color || c.accent;

      if (s.type === 'line') {
        var line = s.points.map(function (p) { return [sx(p[0]), sy(p[1])]; });
        r.polyline(line, { color: color, width: s.width || 2, dash: s.dash, opacity: s.opacity });
        return;
      }

      if (s.type === 'error') {
        s.points.forEach(function (p) {
          var px = sx(p[0]);
          var py = sy(p[1]);
          var err = p.yerr || 0;
          if (err > 0) {
            var hi = sy(p[1] + err);
            var lo = sy(p[1] - err);
            r.line(px, hi, px, lo, { color: color, width: s.width || 1.3, opacity: 0.9 });
            r.line(px - 3.5, hi, px + 3.5, hi, { color: color, width: s.width || 1.3, opacity: 0.9 });
            r.line(px - 3.5, lo, px + 3.5, lo, { color: color, width: s.width || 1.3, opacity: 0.9 });
          }
          r.circle(px, py, s.radius || 4, {
            fill: s.fill || c.panel,
            stroke: color,
            strokeWidth: 1.8,
            opacity: s.opacity == null ? 1 : s.opacity
          });
        });
        return;
      }

      // points
      var radius = s.radius || 2.6;
      var hollow = !!s.hollow;
      s.points.forEach(function (p) {
        r.circle(sx(p[0]), sy(p[1]), radius, {
          fill: hollow ? (s.fill || c.panel) : color,
          stroke: hollow ? color : undefined,
          strokeWidth: 1.8,
          opacity: s.opacity == null ? 1 : s.opacity
        });
      });
    });
    r.unclip();

    if (cfg.inset) drawInset(r, cfg.inset, plot, c);

    // ---- annotations ----
    (cfg.annotations || []).forEach(function (a) {
      r.text(a.text, sx(a.x) + (a.dx || 0), sy(a.y) + (a.dy || 0), {
        color: a.color || c.text,
        size: a.size || 10.5,
        align: a.align || 'left',
        baseline: a.baseline || 'alphabetic',
        weight: a.weight || 550
      });
    });

    drawLegend(r, legendAt, c);
  }

  function drawInset(r, inset, plot, c) {
    var w = Math.min(inset.width || 196, Math.max(120, plot.w * 0.4));
    var h = inset.height || 116;
    var x = plot.x + 14;
    var y = plot.y + 14;
    var ix = x + 34;
    var iy = y + 24;
    var iw = w - 46;
    var ih = h - 46;

    r.rect(x, y, w, h, c.panel, 7);
    r.line(x, y, x + w, y, { color: c.axis, width: 1 });
    r.line(x, y + h, x + w, y + h, { color: c.axis, width: 1 });
    r.line(x, y, x, y + h, { color: c.axis, width: 1 });
    r.line(x + w, y, x + w, y + h, { color: c.axis, width: 1 });

    r.text(inset.title || 'data close-up', x + 9, y + 13, {
      color: c.muted, size: 8, weight: 650
    });

    var xMin = inset.xMin, xMax = inset.xMax, yMin = inset.yMin, yMax = inset.yMax;
    var px = function (v) { return ix + (v - xMin) / (xMax - xMin) * iw; };
    var py = function (v) { return iy + ih - (v - yMin) / (yMax - yMin) * ih; };

    var xt = niceTicks(xMin, xMax, 2);
    var yt = niceTicks(yMin, yMax, 2);
    var xd = xt.length > 1 ? tickDecimals(xt[1] - xt[0]) : 2;
    var yd = yt.length > 1 ? tickDecimals(yt[1] - yt[0]) : 1;

    yt.forEach(function (t) {
      r.line(ix, py(t), ix + iw, py(t), { color: c.grid, width: 0.8 });
      r.text(fmt(t, yd), ix - 5, py(t), {
        color: c.faint, size: 7.5, align: 'right', baseline: 'middle'
      });
    });
    xt.forEach(function (t) {
      r.text(fmt(t, xd), px(t), iy + ih + 10, {
        color: c.faint, size: 7.5, align: 'center'
      });
    });
    r.line(ix, iy, ix, iy + ih, { color: c.axis, width: 1 });
    r.line(ix, iy + ih, ix + iw, iy + ih, { color: c.axis, width: 1 });

    r.clip(ix, iy, iw, ih);
    (inset.series || []).forEach(function (s) {
      var color = s.color || c.accent;
      if (s.type === 'line') {
        r.polyline(s.points.map(function (p) { return [px(p[0]), py(p[1])]; }), {
          color: color, width: s.width || 1.4, dash: s.dash
        });
        return;
      }
      s.points.forEach(function (p) {
        if (p.yerr > 0) {
          r.line(px(p.x), py(p.y - p.yerr), px(p.x), py(p.y + p.yerr), { color: color, width: 1 });
        }
        r.circle(px(p.x), py(p.y), s.radius || 3, {
          fill: c.panel, stroke: color, strokeWidth: 1.6
        });
      });
    });
    r.unclip();
  }

  function drawLegend(r, legendAt, c) {
    legendAt.forEach(function (entry) {
      var it = entry.item;
      var color = it.color || c.accent;
      var y = entry.y;
      if (it.type === 'line') {
        r.line(entry.x, y - 3, entry.x + 14, y - 3, { color: color, width: 2, dash: it.dash });
      } else if (it.type === 'error') {
        r.circle(entry.x + 7, y - 3, 3.2, { fill: it.fill || c.panel, stroke: color, strokeWidth: 1.6 });
      } else {
        r.circle(entry.x + 7, y - 3, 3, { fill: color, opacity: it.opacity == null ? 1 : it.opacity });
      }
      r.text(it.label, entry.x + 20, y, { color: c.muted, size: 9.5, weight: 500 });
    });
  }

  /* ---------------- downloads ---------------- */

  function saveBlob(blob, filename) {
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

  /* ---------------- public API ---------------- */

  function create(canvas, getConfig) {
    var lastCfg = null;
    var lastW = 0;
    var lastH = 0;
    var raf = 0;

    function draw() {
      var cfg = getConfig();
      if (!cfg) return;
      var parent = canvas.parentElement;
      var rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      var w = Math.max(240, Math.round(rect.width));
      var h = Math.max(150, Math.round(rect.height));
      var dpr = Math.min(global.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawChart(new CanvasRenderer(ctx), w, h, cfg);

      lastCfg = cfg;
      lastW = w;
      lastH = h;
    }

    function schedule() {
      if (raf) return;
      raf = global.requestAnimationFrame(function () { raf = 0; draw(); });
    }

    function exportPNG(baseName) {
      if (!lastCfg) draw();
      if (!lastCfg) return;
      var w = lastW || 640;
      var h = lastH || 260;
      var scale = 3;
      var out = document.createElement('canvas');
      out.width = w * scale;
      out.height = h * scale;
      var ctx = out.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = lastCfg.colors.panel;
      ctx.fillRect(0, 0, w, h);
      drawChart(new CanvasRenderer(ctx), w, h, lastCfg);
      var name = (baseName || 'plot') + '.png';
      if (out.toBlob) {
        out.toBlob(function (blob) { if (blob) saveBlob(blob, name); }, 'image/png');
      } else {
        var link = document.createElement('a');
        link.href = out.toDataURL('image/png');
        link.download = name;
        link.click();
      }
    }

    function svgString() {
      if (!lastCfg) draw();
      if (!lastCfg) return '';
      var w = lastW || 640;
      var h = lastH || 260;
      var r = new SvgRenderer(w, h);
      drawChart(r, w, h, lastCfg);
      while (r.openGroups > 0) r.parts.push('</g>'), r.openGroups--;
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + ' ' + h + '" font-family="' + esc(FONT) + '">\n' +
        '<rect width="' + w + '" height="' + h + '" fill="' + esc(lastCfg.colors.panel) + '"/>\n' +
        (r.defs.length ? '<defs>' + r.defs.join('') + '</defs>\n' : '') +
        r.parts.join('\n') + '\n</svg>\n'
      );
    }

    function exportSVG(baseName) {
      var svg = svgString();
      if (!svg) return;
      saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), (baseName || 'plot') + '.svg');
    }

    if (global.ResizeObserver && canvas.parentElement) {
      new ResizeObserver(schedule).observe(canvas.parentElement);
    } else {
      global.addEventListener('resize', schedule);
    }
    global.addEventListener('orientationchange', schedule);
    schedule();

    return {
      draw: draw,
      schedule: schedule,
      exportPNG: exportPNG,
      exportSVG: exportSVG,
      svgString: svgString,
      getConfig: function () { return lastCfg; }
    };
  }

  global.ChartKit = { create: create };
})(window);
