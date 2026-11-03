// Notebook theme: dark-mode toggle, deep links, and the publications "code cell" filter.
(function () {
  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    });
  }

  // Opening a link to publications.html#some-paper expands that paper.
  function openTarget() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    var details = el && el.querySelector("details.pub-more");
    if (details) details.open = true;
  }
  window.addEventListener("hashchange", openTarget);
  openTarget();

  // Kernel indicator: briefly "busy" whenever a cell re-runs.
  var kState = document.querySelector(".kernel-state");
  var kDot = document.querySelector(".kernel-dot");
  function busy() {
    if (!kState) return;
    kState.textContent = "busy";
    kDot.classList.add("busy");
    clearTimeout(busy.t);
    busy.t = setTimeout(function () { kState.textContent = "idle"; kDot.classList.remove("busy"); }, 260);
  }

  // ---- publications filter
  var chips = document.querySelectorAll(".filter-chip");
  if (!chips.length) return;
  var search = document.getElementById("pub-search");
  var pubs = document.querySelectorAll(".pub-section .pub");
  var sections = document.querySelectorAll(".pub-section");
  var empty = document.querySelector(".filter-empty");
  var execIn = document.getElementById("filter-exec");
  var execOut = document.getElementById("filter-out");
  var runs = 1;
  var line = new URLSearchParams(location.search).get("line") || "all";

  function fit() { search.style.width = Math.max(2, search.value.length + 1) + "ch"; }

  function apply(run) {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.line === line)); });
    pubs.forEach(function (p) {
      var okLine = line === "all" || p.dataset.lines.split(" ").indexOf(line) !== -1;
      var okText = !q || p.textContent.toLowerCase().indexOf(q) !== -1;
      p.hidden = !(okLine && okText);
      if (!p.hidden) shown++;
    });
    sections.forEach(function (s) {
      var visible = s.querySelectorAll(".pub:not([hidden])");
      s.hidden = visible.length === 0;
      s.querySelector(".count").textContent = visible.length;
      visible.forEach(function (p, i) { p.querySelector(".c-idx").textContent = i + 1; });
    });
    empty.hidden = shown > 0;
    if (run) {
      runs++;
      execIn.textContent = "*";
      busy();
      setTimeout(function () { execIn.textContent = runs; execOut.textContent = runs; }, 200);
    }
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      line = c.dataset.line;
      var url = new URL(location.href);
      if (line === "all") url.searchParams.delete("line"); else url.searchParams.set("line", line);
      history.replaceState(null, "", url);
      apply(true);
    });
  });
  var typing;
  search.addEventListener("input", function () {
    fit();
    apply(false);
    clearTimeout(typing);
    typing = setTimeout(function () { apply(true); }, 400);
  });

  var expand = document.getElementById("expand-all");
  expand.addEventListener("click", function () {
    var open = expand.getAttribute("aria-pressed") !== "true";
    document.querySelectorAll(".pub:not([hidden]) details.pub-more").forEach(function (d) { d.open = open; });
    expand.setAttribute("aria-pressed", String(open));
    expand.textContent = open ? "TRUE" : "FALSE";
    apply(true);
  });

  fit();
  apply(false);
})();
