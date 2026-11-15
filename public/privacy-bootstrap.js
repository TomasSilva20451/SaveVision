(function () {
  if (window.__fintwinPrivacy) return;
  window.__fintwinPrivacy = true;

  var STORAGE_KEY = "fintwin-privacy-hidden";
  var style = document.createElement("style");
  style.setAttribute("data-privacy-style", "");
  style.textContent = [
    "html.privacy-hidden [data-privacy-sensitive]:not(input):not(textarea){filter:blur(.4rem);opacity:.68;user-select:none;caret-color:transparent;transition:filter 160ms ease-out,opacity 160ms ease-out}",
    "html.privacy-hidden input[data-privacy-sensitive],html.privacy-hidden textarea[data-privacy-sensitive]{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:0 0 .42rem color-mix(in srgb,var(--foreground,#0f172a) 72%,transparent)!important;caret-color:transparent;user-select:none}",
    "html.privacy-hidden input[data-privacy-sensitive]:focus,html.privacy-hidden textarea[data-privacy-sensitive]:focus{color:inherit!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important;caret-color:auto;user-select:text}",
    "@media (prefers-reduced-motion:reduce){html.privacy-hidden [data-privacy-sensitive]{transition:none!important}}",
  ].join("");
  document.head.appendChild(style);
  var AMOUNT = /[+\-−]?\s?(?:\d{1,3}(?:[.\s\u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?\s?[kK]?\s?€/g;

  function rangesOf(text) {
    var ranges = [];
    var pattern = new RegExp(AMOUNT.source, "g");
    var match;
    while ((match = pattern.exec(text))) {
      ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
  }

  function isWholeAmount(text) {
    var trimmed = text.trim();
    if (!trimmed || trimmed.length > 80) return false;
    var leading = text.length - text.trimStart().length;
    var ranges = rangesOf(text);
    return ranges.length === 1 && ranges[0][0] === leading && ranges[0][1] === leading + trimmed.length;
  }

  function skipped(element) {
    if (!element) return true;
    if (element.closest("[data-privacy-ignore], [data-privacy-sensitive], script, style")) return true;
    if (element.closest("header.app-header")) return true;
    var shell = element.closest(".app-shell");
    var sidebar = shell ? shell.querySelector(":scope > aside") : null;
    if (sidebar && sidebar.contains(element)) return true;
    var menu = element.closest("nav");
    if (menu && menu.getAttribute("aria-label") === "Principal") return true;
    return false;
  }

  function isChartAmount(text) {
    var trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= 16 && /^[+\-−]?\d[\d\s.,]*$/.test(trimmed);
  }

  function mask(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var texts = [];
    var current;
    while ((current = walker.nextNode())) texts.push(current);

    for (var i = 0; i < texts.length; i++) {
      var node = texts[i];
      var parent = node.parentElement;
      var text = node.textContent || "";
      if (!parent || text.indexOf("€") === -1) continue;
      if (skipped(parent)) continue;

      if (parent.childNodes.length === 1 && parent.children.length === 0 && isWholeAmount(text)) {
        parent.dataset.privacySensitive = "";
        continue;
      }

      var ranges = rangesOf(text);
      if (!ranges.length) continue;
      var fragment = document.createDocumentFragment();
      var cursor = 0;
      for (var r = 0; r < ranges.length; r++) {
        if (ranges[r][0] > cursor) fragment.append(text.slice(cursor, ranges[r][0]));
        var wrap = document.createElement("span");
        wrap.dataset.privacySensitive = "";
        wrap.dataset.privacyWrap = "";
        wrap.textContent = text.slice(ranges[r][0], ranges[r][1]);
        fragment.append(wrap);
        cursor = ranges[r][1];
      }
      if (cursor < text.length) fragment.append(text.slice(cursor));
      parent.replaceChild(fragment, node);
    }

    var fields = root.querySelectorAll("input, textarea");
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      if (skipped(field)) continue;
      var hint = (field.name + " " + field.id + " " + (field.getAttribute("aria-label") || "") + " " + (field.inputMode || "")).toLowerCase();
      var value = field.value || "";
      var moneyField = /amount|montante|valor|preco|preço|saldo|decimal/.test(hint) && /^[+\-−]?\d[\d\s.,]*$/.test(value.trim());
      if (rangesOf(value).length || moneyField) field.dataset.privacySensitive = "";
    }

    var labelled = root.querySelectorAll("[title], [aria-label]");
    for (var a = 0; a < labelled.length; a++) {
      var labelledNode = labelled[a];
      if (labelledNode.closest("[data-privacy-ignore]")) continue;
      if (labelledNode.dataset.privacyTitle != null || labelledNode.dataset.privacyAria != null) continue;
      var title = labelledNode.getAttribute("title") || "";
      var aria = labelledNode.getAttribute("aria-label") || "";
      if (rangesOf(title).length) {
        labelledNode.dataset.privacyTitle = title;
        labelledNode.setAttribute("title", "Montante oculto");
      }
      if (rangesOf(aria).length) {
        labelledNode.dataset.privacyAria = aria;
        labelledNode.setAttribute("aria-label", "Montante oculto");
      }
    }

    var charts = root.querySelectorAll("svg text, svg tspan");
    for (var c = 0; c < charts.length; c++) {
      var chart = charts[c];
      if (chart.dataset.privacyOriginal != null) {
        chart.textContent = chart.dataset.privacyOriginal;
        delete chart.dataset.privacyOriginal;
      }
      var label = chart.textContent || "";
      if (!isChartAmount(label) && !isWholeAmount(label)) continue;
      chart.dataset.privacySensitive = "";
      chart.dataset.privacyChart = "";
    }
  }

  function clear(root) {
    var titles = root.querySelectorAll("[data-privacy-title]");
    for (var t = 0; t < titles.length; t++) {
      titles[t].setAttribute("title", titles[t].dataset.privacyTitle || "");
      delete titles[t].dataset.privacyTitle;
    }
    var labels = root.querySelectorAll("[data-privacy-aria]");
    for (var l = 0; l < labels.length; l++) {
      labels[l].setAttribute("aria-label", labels[l].dataset.privacyAria || "");
      delete labels[l].dataset.privacyAria;
    }
    var charts = root.querySelectorAll("[data-privacy-original]");
    for (var i = 0; i < charts.length; i++) {
      charts[i].textContent = charts[i].dataset.privacyOriginal || "";
      delete charts[i].dataset.privacyOriginal;
    }
    var chartMarks = root.querySelectorAll("[data-privacy-chart]");
    for (var c = 0; c < chartMarks.length; c++) delete chartMarks[c].dataset.privacyChart;
    var wraps = root.querySelectorAll("[data-privacy-wrap]");
    for (var w = 0; w < wraps.length; w++) {
      var text = wraps[w].firstChild;
      if (text && wraps[w].parentNode) wraps[w].parentNode.replaceChild(text, wraps[w]);
    }
    var marked = root.querySelectorAll("[data-privacy-sensitive]");
    for (var m = 0; m < marked.length; m++) delete marked[m].dataset.privacySensitive;
  }

  function paintButton(hidden) {
    var button = document.querySelector("[data-privacy-toggle]");
    if (!button) return;
    button.setAttribute("aria-pressed", hidden ? "true" : "false");
    button.setAttribute("aria-label", hidden ? "Mostrar montantes" : "Ocultar montantes");
    var label = button.querySelector("[data-privacy-label]");
    if (label) label.textContent = hidden ? "Oculto" : "Modo seguro";
  }

  function apply(hidden) {
    document.documentElement.classList.toggle("privacy-hidden", hidden);
    if (hidden) mask(document.body);
    else clear(document.body);
    paintButton(hidden);
  }

  function readHidden() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function toggle() {
    var next = !document.documentElement.classList.contains("privacy-hidden");
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch (error) {
      /* sessão privada sem storage */
    }
    apply(next);
  }

  window.fintwinTogglePrivacy = toggle;

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest("[data-privacy-toggle]") : null;
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      toggle();
    },
    true,
  );

  var frame = 0;
  var observer = new MutationObserver(function () {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      if (document.documentElement.classList.contains("privacy-hidden")) mask(document.body);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  function remask() {
    if (!document.documentElement.classList.contains("privacy-hidden")) return;
    mask(document.body);
    paintButton(true);
  }

  window.addEventListener("popstate", remask);
  var pushState = history.pushState;
  var replaceState = history.replaceState;
  history.pushState = function () {
    var result = pushState.apply(this, arguments);
    remask();
    return result;
  };
  history.replaceState = function () {
    var result = replaceState.apply(this, arguments);
    remask();
    return result;
  };
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var link = target && target.closest ? target.closest("a[href]") : null;
      if (!link) return;
      window.setTimeout(remask, 50);
      window.setTimeout(remask, 400);
    },
    true,
  );

  apply(readHidden());
})();
