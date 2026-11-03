// Theme toggle (light/dark), publication filters, deep links.
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

  // ---- publications page filters
  var chips = document.querySelectorAll(".filter-chip");
  if (!chips.length) return;
  var search = document.getElementById("pub-search");
  var pubs = document.querySelectorAll(".pub-section .pub");
  var sections = document.querySelectorAll(".pub-section");
  var empty = document.querySelector(".filter-empty");
  var line = new URLSearchParams(location.search).get("line") || "all";

  function apply() {
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
      var n = s.querySelectorAll(".pub:not([hidden])").length;
      s.hidden = n === 0;
      s.querySelector(".count").textContent = n;
    });
    empty.hidden = shown > 0;
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      line = c.dataset.line;
      var url = new URL(location.href);
      if (line === "all") url.searchParams.delete("line"); else url.searchParams.set("line", line);
      history.replaceState(null, "", url);
      apply();
    });
  });
  search.addEventListener("input", apply);

  // Themes can relabel the button via data-expand-label / data-collapse-label.
  var expand = document.getElementById("expand-all");
  expand.addEventListener("click", function () {
    var open = expand.dataset.state !== "open";
    document.querySelectorAll(".pub:not([hidden]) details.pub-more").forEach(function (d) { d.open = open; });
    expand.dataset.state = open ? "open" : "closed";
    expand.textContent = open
      ? expand.dataset.collapseLabel || "Collapse all"
      : expand.dataset.expandLabel || "Expand all";
  });

  apply();
})();
