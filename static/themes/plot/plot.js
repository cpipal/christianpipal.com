// Interactive scatter of all papers: x = year, y = research line. Vanilla JS + SVG.
(function () {
  var host = document.getElementById("paper-plot");
  if (!host) return;
  var papers = JSON.parse(document.getElementById("papers-data").textContent);
  var lines = JSON.parse(document.getElementById("lines-data").textContent);
  var mode = host.dataset.mode; // "home" | "pubs"
  var SVGNS = "http://www.w3.org/2000/svg";
  var SECTION_LABEL = { articles: "Journal article", chapters: "Chapter / proceedings", working: "Preprint", data: "Data / software" };

  papers = papers.filter(function (p) { return p.lines && p.lines.length; });
  var years = papers.map(function (p) { return p.year; }).filter(Boolean);
  var minY = Math.min.apply(null, years), maxY = Math.max.apply(null, years);
  var cols = [];
  for (var y = minY; y <= maxY; y++) cols.push(y);
  var hasUndated = papers.some(function (p) { return !p.year; });
  if (hasUndated) cols.push(null);
  function colIndex(p) { return p.year ? p.year - minY : cols.length - 1; }

  // Stable slot of each paper inside its year column (shared across rows, so multi-line papers align vertically).
  var byCol = {};
  papers
    .slice()
    .sort(function (a, b) { return (a.section + a.id).localeCompare(b.section + b.id); })
    .forEach(function (p) {
      var c = colIndex(p);
      (byCol[c] = byCol[c] || []).push(p);
      p._slot = byCol[c].length - 1;
    });
  var maxPerCol = Math.max.apply(null, Object.keys(byCol).map(function (k) { return byCol[k].length; }));

  var tip = document.createElement("div");
  tip.className = "plot-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  host.appendChild(tip);

  function el(name, attrs, parent) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function marker(section, cx, cy, r, parent, cls) {
    if (section === "chapters") return el("rect", { x: cx - r * 0.88, y: cy - r * 0.88, width: r * 1.76, height: r * 1.76, class: cls }, parent);
    if (section === "working") return el("path", { d: "M" + cx + " " + (cy - r * 1.2) + "L" + (cx + r * 1.2) + " " + cy + "L" + cx + " " + (cy + r * 1.2) + "L" + (cx - r * 1.2) + " " + cy + "Z", class: cls }, parent);
    if (section === "data") return el("path", { d: "M" + cx + " " + (cy - r * 1.15) + "L" + (cx + r * 1.1) + " " + (cy + r * 0.85) + "L" + (cx - r * 1.1) + " " + (cy + r * 0.85) + "Z", class: cls }, parent);
    return el("circle", { cx: cx, cy: cy, r: r, class: cls }, parent);
  }

  function href(p) { return (mode === "pubs" ? "" : "publications.html") + "#" + p.id; }

  function showTip(p, x, y) {
    tip.innerHTML = "";
    var t = document.createElement("strong");
    t.textContent = p.title;
    var a = document.createElement("span");
    a.innerHTML = p.authors; // pre-rendered, escaped by the build (own content)
    var v = document.createElement("span");
    v.className = "tip-meta";
    v.textContent = [SECTION_LABEL[p.section], p.venue, p.year].filter(Boolean).join(" · ");
    tip.append(t, a, v);
    tip.hidden = false;
    var hw = host.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(hw - tw - 4, x - tw / 2)) + "px";
    tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }

  var svg;
  function draw() {
    if (svg) svg.remove();
    var W = host.clientWidth;
    var narrow = W < 560;
    var labelW = narrow ? 64 : 112;
    var padR = 8, axisH = 26;
    var colW = (W - labelW - padR) / cols.length;
    var r = narrow ? 3.4 : 5;
    var step = r * 2 + (narrow ? 2.5 : 4);
    var perRow = Math.max(1, Math.floor((colW - 6) / step));
    var subRows = Math.ceil(maxPerCol / perRow);
    var rowH = Math.max(narrow ? 40 : 56, subRows * step + 18);
    var H = rowH * lines.length + axisH;

    svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, class: "plot-svg" });
    host.insertBefore(svg, tip);

    var grid = el("g", { class: "plot-grid", "aria-hidden": "true" }, svg);
    cols.forEach(function (c, i) {
      var x = labelW + i * colW;
      el("line", { x1: x, x2: x, y1: 0, y2: H - axisH, class: "gridline" }, grid);
      var tx = el("text", { x: x + colW / 2, y: H - 8, class: "tick" }, grid);
      tx.textContent = c === null ? "—" : narrow ? "'" + String(c).slice(2) : c;
      el("line", { x1: x + colW / 2, x2: x + colW / 2, y1: H - axisH, y2: H - axisH + 4, class: "tickmark" }, grid);
    });
    el("line", { x1: labelW, x2: W - padR, y1: H - axisH, y2: H - axisH, class: "axis" }, grid);
    el("line", { x1: labelW, x2: labelW, y1: 0, y2: H - axisH, class: "axis" }, grid);

    var rowLabels = el("g", { class: "row-labels" }, svg);
    lines.forEach(function (l, i) {
      var y0 = i * rowH;
      if (i > 0) el("line", { x1: labelW, x2: W - padR, y1: y0, y2: y0, class: "rowline", "aria-hidden": "true" }, grid);
      var g = el("g", { class: "row-label line-" + l.key, "data-line": l.key }, rowLabels);
      var t = el("text", { x: labelW - 10, y: y0 + rowH / 2 + 4, class: "row-text" }, g);
      var short = l.label.split(/[-\s]/)[0];
      t.textContent = narrow ? (short.length > 7 ? short.slice(0, 6) + "." : short) : l.label;
      if (mode === "pubs") {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", "Filter by " + l.label);
        g.addEventListener("click", function () { setLine(l.key); });
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLine(l.key); } });
      }
    });

    function pos(p, lineKey) {
      var li = lines.findIndex(function (l) { return l.key === lineKey; });
      var c = colIndex(p);
      var n = byCol[c].length;
      var used = Math.min(perRow, n);
      var cx0 = labelW + c * colW + colW / 2 - ((used - 1) * step) / 2;
      var rowsUsed = Math.ceil(n / perRow);
      var cy0 = li * rowH + rowH / 2 - ((rowsUsed - 1) * step) / 2;
      return { x: cx0 + (p._slot % perRow) * step, y: cy0 + Math.floor(p._slot / perRow) * step };
    }

    var links = el("g", { class: "links", "aria-hidden": "true" }, svg);
    var pts = el("g", { class: "points" }, svg);
    papers.forEach(function (p) {
      var ps = p.lines.map(function (k) { return pos(p, k); });
      if (ps.length > 1) {
        var ys = ps.map(function (q) { return q.y; });
        el("line", { x1: ps[0].x, x2: ps[0].x, y1: Math.min.apply(null, ys), y2: Math.max.apply(null, ys), class: "link", "data-id": p.id }, links);
      }
      p.lines.forEach(function (k, j) {
        var a = el("a", {
          href: href(p),
          class: "pt line-" + k + " sec-" + p.section,
          "data-id": p.id,
          "aria-label": p.title + " (" + (p.year || "undated") + ", " + k + ")",
        }, pts);
        if (j > 0) a.setAttribute("tabindex", "-1"); // one tab stop per paper
        marker(p.section, ps[j].x, ps[j].y, r, a, "mark");
        el("circle", { cx: ps[j].x, cy: ps[j].y, r: step / 2 + 2, class: "hit" }, a);
        var over = function () { highlight(p.id); showTip(p, ps[j].x, ps[j].y + step); };
        a.addEventListener("mouseenter", over);
        a.addEventListener("focus", over);
        a.addEventListener("mouseleave", function () { highlight(null); hideTip(); });
        a.addEventListener("blur", function () { highlight(null); hideTip(); });
        if (mode === "pubs") a.addEventListener("click", function () { revealPub(p.id); });
      });
    });
    syncFilter();
  }

  function highlight(id) {
    svg.classList.toggle("has-hover", !!id);
    svg.querySelectorAll(".pt, .link").forEach(function (e) { e.classList.toggle("is-hover", e.dataset.id === id); });
  }

  // ---- publications page: plot <-> filter chips
  function setLine(key) {
    var chip = document.querySelector('.filter-chip[data-line="' + key + '"]');
    var current = document.querySelector('.filter-chip[aria-pressed="true"]');
    if (current && current.dataset.line === key) chip = document.querySelector('.filter-chip[data-line="all"]');
    if (chip) chip.click();
  }
  function revealPub(id) {
    var pub = document.getElementById(id);
    if (pub && pub.hidden) {
      var search = document.getElementById("pub-search");
      if (search) { search.value = ""; search.dispatchEvent(new Event("input")); }
      var all = document.querySelector('.filter-chip[data-line="all"]');
      if (all) all.click();
    }
  }
  function syncFilter() {
    if (mode !== "pubs" || !svg) return;
    var active = (document.querySelector('.filter-chip[aria-pressed="true"]') || {}).dataset;
    var line = active ? active.line : "all";
    svg.querySelectorAll(".pt").forEach(function (a) {
      var pub = document.getElementById(a.dataset.id);
      var off = (pub && pub.hidden) || (line !== "all" && !a.classList.contains("line-" + line));
      a.classList.toggle("is-off", off);
    });
    svg.querySelectorAll(".row-label").forEach(function (g) {
      g.classList.toggle("is-active", g.dataset.line === line);
    });
    document.querySelectorAll(".legend-line[data-line]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.line === line));
    });
  }
  if (mode === "pubs") {
    document.querySelectorAll(".legend-line[data-line]").forEach(function (b) {
      b.addEventListener("click", function () { setLine(b.dataset.line); });
    });
    document.querySelectorAll(".filter-chip").forEach(function (c) {
      c.addEventListener("click", function () { setTimeout(syncFilter, 0); });
    });
    var s = document.getElementById("pub-search");
    if (s) s.addEventListener("input", function () { setTimeout(syncFilter, 0); });
  }

  var lastW = 0;
  function maybeDraw() {
    var w = host.clientWidth;
    if (w && w !== lastW) { lastW = w; draw(); }
  }
  if (window.ResizeObserver) new ResizeObserver(maybeDraw).observe(host);
  else window.addEventListener("resize", maybeDraw);
  maybeDraw();
})();
