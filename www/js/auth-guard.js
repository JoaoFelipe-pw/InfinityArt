(function () {
  var SESSION_KEY = "infinityart_session";
  var PUBLIC_PAGES = {
    "index.html": true,
    "criarconta.html": true,
    "esqueceu_senha.html": true,
  };
  var ADMIN_PAGES = {
    "admin.html": true,
    "clientes.html": true,
    "gerircliente.html": true,
  };

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function currentPage() {
    return window.location.pathname.split("/").pop().toLowerCase();
  }

  function getRole(session) {
    return String((session && (session.perfil || session.role)) || "cliente")
      .trim()
      .toLowerCase();
  }

  function ensureAuthenticated(page) {
    if (PUBLIC_PAGES[page]) return null;

    var session = getSession();
    if (!session || !session.email) {
      window.location.href = "index.html";
      return null;
    }

    return session;
  }

  function ensureAdminAccess(page, session) {
    if (!ADMIN_PAGES[page]) return;
    if (getRole(session) !== "admin") {
      window.location.href = "Menu.html";
    }
  }

  function applyRoleVisibility(session) {
    var isAdmin = getRole(session) === "admin";
    document.querySelectorAll("[data-admin-only]").forEach(function (element) {
      if (isAdmin) {
        element.classList.remove("hidden");
      } else {
        element.classList.add("hidden");
      }
    });
  }

  function findHeaderHost() {
    return (
      document.querySelector("header") ||
      document.querySelector(".sticky.top-0") ||
      document.querySelector("[class*='sticky'][class*='top-0']") ||
      null
    );
  }

  function findHeaderRowHost(header) {
    if (!header) return null;
    return (
      header.querySelector(".app-logout-slot") ||
      header.querySelector(".flex.items-center.justify-between") ||
      header.querySelector(".justify-between.items-center") ||
      null
    );
  }

  function injectLogoutButton(page) {
    if (PUBLIC_PAGES[page]) return;
    if (document.getElementById("app-logout-btn")) return;

    if (!document.getElementById("app-logout-style")) {
      var style = document.createElement("style");
      style.id = "app-logout-style";
      style.textContent =
        ".app-logout-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:9999px;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.18);color:#fff;font:700 11px/1 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;}" +
        ".app-logout-slot{margin-left:auto;}" +
        ".app-logout-btn-slot{position:static;}" +
        ".app-logout-btn-row{position:static;margin-left:auto;}" +
        ".app-logout-btn-inline{position:absolute;top:50%;right:10px;transform:translateY(-50%);z-index:8;}" +
        ".app-logout-btn-floating{position:fixed;top:12px;right:12px;z-index:9998;}" +
        ".app-logout-btn .material-symbols-outlined{font-size:18px;line-height:1;}" +
        ".app-logout-btn-floating:active{transform:scale(.98);}"+
        ".app-logout-btn-inline:active{transform:translateY(-50%) scale(.98);}"+
        "@media (min-width: 540px){.app-logout-btn-floating{top:16px;right:max(16px,calc((100vw - 430px)/2 + 12px));}}";
      document.head.appendChild(style);
    }

    var button = document.createElement("button");
    button.id = "app-logout-btn";
    button.type = "button";
    button.className = "app-logout-btn";
    button.innerHTML = '<span class="material-symbols-outlined">logout</span><span>Sair</span>';
    button.addEventListener("click", function () {
      clearSession();
      window.location.href = "index.html";
    });

    var host = findHeaderHost();
    if (host) {
      var rowHost = findHeaderRowHost(host);
      if (rowHost) {
        if (rowHost.classList.contains("app-logout-slot")) {
          button.classList.add("app-logout-btn-slot");
        } else {
          button.classList.add("app-logout-btn-row");
        }
        rowHost.appendChild(button);
        return;
      }

      if (window.getComputedStyle(host).position === "static") {
        host.style.position = "relative";
      }
      button.classList.add("app-logout-btn-inline");
      host.appendChild(button);
      return;
    }

    button.classList.add("app-logout-btn-floating");
    document.body.appendChild(button);
  }

  function bindLogoutShortcut() {
    document.addEventListener("keydown", function (event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        clearSession();
        window.location.href = "index.html";
      }
    });
  }

  var page = currentPage();
  var session = ensureAuthenticated(page);

  if (session) {
    ensureAdminAccess(page, session);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyRoleVisibility(session);
      injectLogoutButton(page);
    });
  } else {
    applyRoleVisibility(session);
    injectLogoutButton(page);
  }

  bindLogoutShortcut();
})();
