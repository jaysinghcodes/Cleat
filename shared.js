/* Cleat theme: Dark (Warm mist) / Light (Grey) / System (follows OS).
   ?theme=dark|light|system previews without persisting. */
(function () {
  var KEY = "cleat-theme-pref";
  var PREFS = ["system", "dark", "light"];
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var pref = "system";
  function resolve(p) { return p === "system" ? (mq && mq.matches ? "light" : "dark") : p; }
  function apply(p, persist) {
    pref = p;
    var t = resolve(p);
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-theme-pref", p);
    if (persist) { try { localStorage.setItem(KEY, p); } catch (e) {} }
    document.querySelectorAll("[data-theme-label]").forEach(function (el) {
      el.textContent = p === "system" ? "System (" + (t === "dark" ? "Dark" : "Light") + ")" : (t === "dark" ? "Dark" : "Light");
      el.title = "Theme: click to cycle System → Dark → Light";
    });
  }
  var param = null, saved = null;
  try { param = new URLSearchParams(location.search).get("theme"); } catch (e) {}
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (param && PREFS.indexOf(param) >= 0) apply(param, false);
  else apply(PREFS.indexOf(saved) >= 0 ? saved : "system", false);
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (pref === "system") apply("system", false); });
  window.toggleCleatTheme = function () { apply(PREFS[(PREFS.indexOf(pref) + 1) % PREFS.length], true); };
})();
