// Hover / tap effects for the portrait ("Fig. 0").
//
// <div class="portrait" data-fx="detect json">: one of the listed effects is picked at random on every hover/tap.
// Effects are set in content/site.yml (portrait_effect) and can be forced with ?fx=detect or ?fx=json.
// Box coordinates are in % of the 400×500 portrait (static/img/portrait.jpg).
(function () {
  var BOXES = [
    { label: "face", p: 0.99, x: 28, y: 14, w: 47, h: 52, c: "#4ade80" },
    { label: "glasses", p: 0.97, x: 27, y: 29.5, w: 48, h: 12, c: "#60a5fa" },
    { label: "beard", p: 0.93, x: 30.5, y: 44, w: 40, h: 22, c: "#fbbf24" },
    { label: "pol_comm_researcher", p: 0.88, x: 3, y: 4, w: 94, h: 93, c: "#f472b6" },
  ];
  var JSON_LINES = [
    "{",
    '  <k>"variable"</k>: <s>"author"</s>,',
    '  <k>"glasses"</k>: <n>true</n>,',
    '  <k>"beard"</k>: <n>true</n>,',
    '  <k>"mood"</k>: <s>"approachable"</s>,',
    '  <k>"confidence"</k>: <n>0.87</n>,',
    '  <k>"kappa_human"</k>: <n>0.81</n>,',
    '  <k>"batch_size"</k>: <n>1</n>',
    "}",
  ];
  var CAPTIONS = {
    detect: "The author, as seen by an object detector.",
    json: "The author, coded by an LLM (temperature = 0).",
  };

  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  function overlay(portrait, kind) {
    var o = el("div", "fx-layer fx-layer-" + kind, portrait);
    o.setAttribute("aria-hidden", "true");
    return o;
  }

  function drawBoxes(portrait) {
    var o = overlay(portrait, "detect");
    BOXES.forEach(function (b, i) {
      var box = el("div", "fx-box" + (b.w > 90 ? " fx-box-frame" : ""), o);
      box.style.cssText = "left:" + b.x + "%;top:" + b.y + "%;width:" + b.w + "%;height:" + b.h + "%;--c:" + b.c +
        ";transition-delay:" + i * 90 + "ms";
      el("span", "fx-tag", box, b.label + " " + b.p.toFixed(2));
    });
    var status = el("div", "fx-status", o, "yolo-cpipal · " + BOXES.length + " objects<span class=\"fx-optional\"> · 12 ms</span>");
    status.style.transitionDelay = BOXES.length * 90 + "ms";
    return o;
  }

  function drawJSON(portrait) {
    var pre = el("pre", "fx-code", overlay(portrait, "json"));
    JSON_LINES.forEach(function (l, i) {
      el("span", "fx-line", pre, l + "\n").style.transitionDelay = 120 + i * 60 + "ms";
    });
    return pre.parentNode;
  }

  function setup(portrait) {
    var choices = (new URLSearchParams(location.search).get("fx") || portrait.dataset.fx || "")
      .split(/[\s,]+/).filter(function (f) { return CAPTIONS[f]; });
    var img = portrait.querySelector("img");
    if (!choices.length || !img) return;
    portrait.classList.add("fx");
    var layers = {};
    choices.forEach(function (f) { layers[f] = (f === "detect" ? drawBoxes : drawJSON)(portrait); });
    var fx = null;

    // All caption variants are stacked in one grid cell and only toggled visible, so the caption
    // always has the height of the longest one and the page never shifts on hover.
    var caption = portrait.closest("figure") && portrait.closest("figure").querySelector("figcaption");
    var variants = {};
    if (caption) {
      var no = caption.querySelector(".fig-no");
      var prefix = no ? no.outerHTML + " " : "";
      var texts = { idle: caption.textContent.replace(no ? no.textContent : "", "").trim() };
      choices.forEach(function (f) { texts[f] = CAPTIONS[f]; });
      caption.innerHTML = "";
      caption.classList.add("fx-caption");
      Object.keys(texts).forEach(function (k) {
        variants[k] = el("span", k === "idle" ? "fx-cap-on" : "", caption, prefix);
        variants[k].appendChild(document.createTextNode(texts[k]));
        if (k !== "idle") variants[k].setAttribute("aria-hidden", "true");
      });
    }
    function showCaption(k) {
      Object.keys(variants).forEach(function (v) {
        variants[v].classList.toggle("fx-cap-on", v === k);
        variants[v].setAttribute("aria-hidden", v === k ? "false" : "true");
      });
    }

    function on() {
      // new random pick on every hover / tap
      fx = choices[Math.floor(Math.random() * choices.length)];
      portrait.dataset.fx = fx;
      Object.keys(layers).forEach(function (f) { layers[f].classList.toggle("fx-current", f === fx); });
      portrait.classList.add("fx-active");
      showCaption(fx);
    }
    function off() { portrait.classList.remove("fx-active"); showCaption("idle"); }
    function toggle() { portrait.classList.contains("fx-active") ? off() : on(); }

    portrait.tabIndex = 0;
    portrait.setAttribute("role", "button");
    portrait.setAttribute("aria-label", "Portrait of the author. Activate for a visual joke.");
    portrait.addEventListener("mouseenter", on);
    portrait.addEventListener("mouseleave", off);
    portrait.addEventListener("focus", on);
    portrait.addEventListener("blur", off);
    // touch: tap toggles (there's no hover on phones)
    portrait.addEventListener("click", function (e) { if (e.pointerType !== "mouse") toggle(); });
    portrait.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      if (e.key === "Escape") off();
    });
  }

  document.querySelectorAll(".portrait[data-fx]").forEach(setup);
})();
