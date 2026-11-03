// Terminal theme: dark by default, keyboard navigation (h r p t c, l = light/dark, / = search).
(function () {
  var root = document.documentElement;
  // Make dark the explicit default so the shared toggle in js/main.js flips correctly.
  if (!root.dataset.theme) root.dataset.theme = "dark";

  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  var keys = {};
  document.querySelectorAll(".nav a[data-key]").forEach(function (a) { keys[a.dataset.key] = a.href; });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var search = document.getElementById("pub-search");
    if (typing(e)) {
      if (e.key === "Escape" && e.target === search) { search.blur(); }
      return;
    }
    if (e.key === "/" && search) { e.preventDefault(); search.focus(); return; }
    if (e.key === "l") { var t = document.querySelector(".theme-toggle"); if (t) t.click(); return; }
    if (keys[e.key]) { location.href = keys[e.key]; }
  });
})();
