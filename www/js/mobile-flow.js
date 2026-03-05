(function () {
  var TRANSITION_MS = 220;

  function shouldSkipNavigation(event, link) {
    if (!link || !link.href) return true;
    if (event.defaultPrevented) return true;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
    if (event.button !== 0) return true;
    if (link.target === "_blank") return true;
    if (link.hasAttribute("download")) return true;
    if (link.getAttribute("href") === "#" || link.getAttribute("href").startsWith("#")) return true;
    if (link.origin !== window.location.origin) return true;
    return false;
  }

  function getShell() {
    return document.querySelector("[data-app-shell]") || document.body.firstElementChild || document.body;
  }

  function animate(shell, className, done) {
    shell.classList.remove("app-page-enter", "app-page-exit-left", "app-page-exit-right");
    shell.classList.add(className);
    window.setTimeout(function () {
      if (typeof done === "function") done();
    }, TRANSITION_MS);
  }

  function navigate(url, direction) {
    if (!url) return;
    var shell = getShell();
    animate(shell, direction === "right" ? "app-page-exit-right" : "app-page-exit-left", function () {
      window.location.href = url;
    });
  }

  function resolveOnClickTarget(element) {
    var handler = element.getAttribute("onclick");
    if (!handler) return null;
    var match = handler.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
    return match ? match[1] : null;
  }

  function bindButtonNavigation(root) {
    root.querySelectorAll("[data-nav-target]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        navigate(button.getAttribute("data-nav-target"), "left");
      });
    });

    root.querySelectorAll("[onclick*='window.location.href']").forEach(function (button) {
      var target = resolveOnClickTarget(button);
      if (!target) return;
      button.removeAttribute("onclick");
      button.addEventListener("click", function (event) {
        event.preventDefault();
        navigate(target, "left");
      });
    });
  }

  function bindBackButtons(root) {
    root.querySelectorAll(".app-back-button, .material-symbols-outlined, .material-icons-round").forEach(function (icon) {
      var text = (icon.textContent || "").trim();
      if (text !== "arrow_back_ios" && text !== "arrow_back_ios_new" && !icon.classList.contains("app-back-button")) return;
      icon.classList.add("app-back-button");
      icon.style.cursor = "pointer";
      icon.addEventListener("click", function () {
        if (window.history.length > 1) {
          var shell = getShell();
          animate(shell, "app-page-exit-right", function () {
            window.history.back();
          });
          return;
        }
        navigate("Menu.html", "right");
      });
    });
  }

  function bindLinkNavigation() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a[href]");
      if (shouldSkipNavigation(event, link)) return;
      event.preventDefault();
      navigate(link.href, "left");
    });
  }

  function bindTapFeedback(root) {
    root.querySelectorAll("button, .app-tab-link, a").forEach(function (element) {
      element.addEventListener("pointerdown", function () {
        element.classList.add("app-tap-active");
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (eventName) {
        element.addEventListener(eventName, function () {
          element.classList.remove("app-tap-active");
        });
      });
    });
  }

  function markActiveTab(root) {
    var current = window.location.pathname.split("/").pop().toLowerCase();
    root.querySelectorAll("a[href$='.html']").forEach(function (anchor) {
      anchor.classList.add("app-tab-link");
      var href = (anchor.getAttribute("href") || "").toLowerCase();
      if (href === current) {
        anchor.classList.add("is-active");
      } else {
        anchor.classList.remove("is-active");
      }
    });
  }

  function boot() {
    var shell = getShell();
    if (!shell) return;
    shell.classList.add("app-shell");
    animate(shell, "app-page-enter");
    bindLinkNavigation();
    bindButtonNavigation(document);
    bindBackButtons(document);
    bindTapFeedback(document);
    markActiveTab(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
