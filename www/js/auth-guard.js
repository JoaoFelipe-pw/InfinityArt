(function () {
  var SESSION_KEY = "infinityart_session";
  var LOGOUT_KEY = "infinityart_logout";
  var ADMIN_UPDATE_SEEN_KEY = "infinityart_admin_update_seen";
  var ORDER_UPDATE_SEEN_KEY = "infinityart_pedido_update_seen";
  var PUBLIC_PAGES = {
    "index.html": true,
    "criarconta.html": true,
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

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session || {}));
  }

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function safeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeStatus(value) {
    return safeText(value).toLowerCase() || "pendente";
  }

  function statusLabel(status) {
    var value = normalizeStatus(status);
    if (value === "entregue") return "Entregue";
    if (value === "em_producao") return "Em producao";
    if (value === "em_transporte") return "Em transporte";
    return "Pendente";
  }

  function formatDateTime(ms) {
    if (!ms || !isFinite(ms)) return "";
    var date = new Date(ms);
    if (isNaN(date.getTime())) return "";
    var day = date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    var time = date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return day + " " + time;
  }

  function toMillis(value) {
    if (value && typeof value.toDate === "function") return value.toDate().getTime();
    if (typeof value === "number" && isFinite(value)) return value;
    return 0;
  }

  function adminUpdateKey(uid) {
    return ADMIN_UPDATE_SEEN_KEY + ":" + uid;
  }

  function getLastAdminUpdate(uid) {
    try {
      var raw = localStorage.getItem(adminUpdateKey(uid));
      var value = Number(raw || 0);
      return isFinite(value) ? value : 0;
    } catch (e) {
      return 0;
    }
  }

  function setLastAdminUpdate(uid, value) {
    try {
      localStorage.setItem(adminUpdateKey(uid), String(value || 0));
    } catch (e) {}
  }

  function pedidoSeenKey(uid, pedidoId) {
    return ORDER_UPDATE_SEEN_KEY + ":" + uid + ":" + pedidoId;
  }

  function parseJson(value) {
    try {
      return JSON.parse(value || "");
    } catch (e) {
      return null;
    }
  }

  function getPedidoSeen(uid, pedidoId) {
    try {
      var raw = localStorage.getItem(pedidoSeenKey(uid, pedidoId));
      var parsed = parseJson(raw);
      if (!parsed) return null;
      return {
        ts: Number(parsed.ts || 0) || 0,
        status: normalizeStatus(parsed.status),
      };
    } catch (e) {
      return null;
    }
  }

  function setPedidoSeen(uid, pedidoId, ts, status) {
    try {
      localStorage.setItem(
        pedidoSeenKey(uid, pedidoId),
        JSON.stringify({
          ts: Number(ts || 0) || 0,
          status: normalizeStatus(status),
        })
      );
    } catch (e) {}
  }

  function clearPedidoSeen(uid, pedidoId) {
    try {
      localStorage.removeItem(pedidoSeenKey(uid, pedidoId));
    } catch (e) {}
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function signOutAuth() {
    try {
      localStorage.setItem(LOGOUT_KEY, String(Date.now()));
    } catch (e) {}
    var auth = window.InfinityFirebase && window.InfinityFirebase.auth;
    if (auth && typeof auth.signOut === "function") {
      return auth.signOut().catch(function () {});
    }
    return Promise.resolve();
  }

  function currentPage() {
    return window.location.pathname.split("/").pop().toLowerCase();
  }

  function getRole(session) {
    return String((session && (session.perfil || session.role)) || "cliente")
      .trim()
      .toLowerCase();
  }

  function mergeSessionFromDoc(session, data) {
    if (!session || !data) return session;
    var merged = Object.assign({}, session);
    var nome = safeText(data.nome);
    var email = safeText(data.email);
    var perfil = safeText(data.perfil || data.role);

    if (nome) merged.nome = nome;
    if (email) merged.email = email;
    if (perfil) merged.perfil = perfil.toLowerCase();

    saveSession(merged);
    return merged;
  }

  function ensureMobileAlertStyles() {
    if (document.getElementById("mobile-alert-styles")) return;
    var style = document.createElement("style");
    style.id = "mobile-alert-styles";
    style.textContent =
      ".mobile-alert-backdrop{position:fixed;inset:0;background:rgba(2,8,23,.62);backdrop-filter:blur(2px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;}" +
      ".mobile-alert{width:100%;max-width:340px;border-radius:18px;background:linear-gradient(180deg,rgba(18,36,68,.96),rgba(8,20,42,.98));border:1px solid rgba(255,255,255,.12);box-shadow:0 22px 42px rgba(0,0,0,.45);overflow:hidden;color:#fff;font-family:Inter,sans-serif;}" +
      ".mobile-alert-head{padding:14px 16px 6px 16px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,196,133,.95);}" +
      ".mobile-alert-body{padding:0 16px 14px 16px;font-size:15px;line-height:1.45;color:rgba(241,245,249,.98);}" +
      ".mobile-alert-actions{display:flex;border-top:1px solid rgba(255,255,255,.1);}" +
      ".mobile-alert-btn{appearance:none;border:0;background:transparent;color:#ffb158;font-weight:700;font-size:16px;height:50px;width:100%;}";
    document.head.appendChild(style);
  }

  function showAlert(title, message, onClose) {
    ensureMobileAlertStyles();

    var previous = document.querySelector(".mobile-alert-backdrop");
    if (previous) previous.remove();

    var backdrop = document.createElement("div");
    backdrop.className = "mobile-alert-backdrop";

    var box = document.createElement("div");
    box.className = "mobile-alert";

    var head = document.createElement("div");
    head.className = "mobile-alert-head";
    head.textContent = String(title || "Notificacao");

    var body = document.createElement("div");
    body.className = "mobile-alert-body";
    body.textContent = String(message || "Tem novas atualizacoes na sua conta.");

    var actions = document.createElement("div");
    actions.className = "mobile-alert-actions";

    var ok = document.createElement("button");
    ok.className = "mobile-alert-btn";
    ok.type = "button";
    ok.textContent = "OK";

    function closeAlert() {
      backdrop.remove();
      if (typeof onClose === "function") onClose();
    }

    ok.addEventListener("click", closeAlert);

    actions.appendChild(ok);
    box.appendChild(head);
    box.appendChild(body);
    box.appendChild(actions);
    backdrop.appendChild(box);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) closeAlert();
    });
    document.body.appendChild(backdrop);
  }

  function adminUpdateMessage(data) {
    var explicit = safeText(data && data.adminUpdateMessage);
    if (explicit) return explicit;
    var adminLabel = safeText(data && (data.adminUpdatedBy || data.adminUpdateBy));
    if (adminLabel) {
      return "O administrador " + adminLabel + " atualizou os dados da sua conta.";
    }
    return "O administrador atualizou os dados da sua conta.";
  }

  function pedidoTitle(data) {
    var produto = safeText(data && data.produto);
    return produto || "Pedido";
  }

  function pedidoTimestamp(data) {
    var updatedAt = toMillis(data && data.updatedAt);
    if (updatedAt) return updatedAt;
    var createdAt = toMillis(data && data.createdAt);
    if (createdAt) return createdAt;
    var createdAtClient = Number((data && data.createdAtClient) || 0);
    return isFinite(createdAtClient) ? createdAtClient : 0;
  }

  function pedidoStatusTimestamp(data, status) {
    var map = (data && data.stageDatesMs) || {};
    var stageTs = Number(map && map[status]);
    if (isFinite(stageTs) && stageTs > 0) return stageTs;
    return pedidoTimestamp(data);
  }

  function subscribeAccountUpdates(session) {
    var db = getDb();
    if (!db || !session || !session.id) return;
    if (getRole(session) === "admin") return;

    db.collection("usuarios")
      .doc(session.id)
      .onSnapshot(
        function (doc) {
          if (!doc.exists) return;
          var data = doc.data() || {};
          session = mergeSessionFromDoc(session, data) || session;

          var adminUpdateAt = toMillis(data.adminUpdateAt);
          if (!adminUpdateAt) return;

          var lastSeen = getLastAdminUpdate(session.id);
          if (!lastSeen || adminUpdateAt > lastSeen) {
            showAlert("Conta atualizada", adminUpdateMessage(data));
            setLastAdminUpdate(session.id, adminUpdateAt);
          }
        },
        function (error) {
          console.warn("Falha ao observar atualizacoes de conta:", error);
        }
      );
  }

  function subscribeOrderUpdates(session) {
    var db = getDb();
    if (!db || !session || !session.id) return;
    if (getRole(session) === "admin") return;

    var bootstrapped = false;

    db.collection("pedidos")
      .where("clienteId", "==", session.id)
      .onSnapshot(
        function (snapshot) {
          if (!bootstrapped) {
            snapshot.forEach(function (doc) {
              var data = doc.data() || {};
              var status = normalizeStatus(data.status);
              var ts = pedidoTimestamp(data);
              setPedidoSeen(session.id, doc.id, ts, status);
            });
            bootstrapped = true;
            return;
          }

          snapshot.docChanges().forEach(function (change) {
            var doc = change.doc;
            var data = doc.data() || {};
            var status = normalizeStatus(data.status);
            var ts = pedidoTimestamp(data);
            var seen = getPedidoSeen(session.id, doc.id);

            if (change.type === "added") {
              showAlert("Novo pedido", "Novo pedido adicionado: " + pedidoTitle(data) + ".");
              setPedidoSeen(session.id, doc.id, ts, status);
              return;
            }

            if (change.type === "modified") {
              if (seen && seen.status && seen.status !== status) {
                var statusTime = formatDateTime(pedidoStatusTimestamp(data, status));
                var timeSuffix = statusTime ? " em " + statusTime : "";
                showAlert(
                  "Pedido atualizado",
                  "O estado do pedido " +
                    pedidoTitle(data) +
                    " foi atualizado para " +
                    statusLabel(status) +
                    timeSuffix +
                    "."
                );
              }
              setPedidoSeen(session.id, doc.id, ts, status);
              return;
            }

            if (change.type === "removed") {
              clearPedidoSeen(session.id, doc.id);
            }
          });
        },
        function (error) {
          console.warn("Falha ao observar atualizacoes de pedidos:", error);
        }
      );
  }

  function saveFcmToken(session, token) {
    var db = getDb();
    if (!db || !session || !session.id) return;
    var value = safeText(token);
    if (!value) return;

    var payload = { fcmTokens: [value] };
    if (window.firebase && firebase.firestore && firebase.firestore.FieldValue) {
      payload = {
        fcmTokens: firebase.firestore.FieldValue.arrayUnion(value),
        fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }

    db.collection("usuarios").doc(session.id).set(payload, { merge: true }).catch(function (error) {
      console.warn("Falha ao guardar token FCM:", error);
    });
  }

  function initPushNotifications(session) {
    if (!session || !session.id) return;
    if (getRole(session) === "admin") return;
    if (!window.cordova || !window.FirebasePlugin) return;

    function fetchToken() {
      if (!window.FirebasePlugin.getToken) return;
      window.FirebasePlugin.getToken(
        function (token) {
          saveFcmToken(session, token);
        },
        function (error) {
          console.warn("FCM getToken erro:", error);
        }
      );
    }

    function ensurePermission() {
      if (!window.FirebasePlugin.hasPermission || !window.FirebasePlugin.grantPermission) {
        fetchToken();
        return;
      }

      window.FirebasePlugin.hasPermission(
        function (hasPermission) {
          if (hasPermission) {
            fetchToken();
            return;
          }
          window.FirebasePlugin.grantPermission(
            function () {
              fetchToken();
            },
            function () {
              fetchToken();
            }
          );
        },
        function () {
          fetchToken();
        }
      );
    }

    document.addEventListener(
      "deviceready",
      function () {
        ensurePermission();

        if (window.FirebasePlugin.onTokenRefresh) {
          window.FirebasePlugin.onTokenRefresh(
            function (token) {
              saveFcmToken(session, token);
            },
            function (error) {
              console.warn("FCM onTokenRefresh erro:", error);
            }
          );
        }

        if (window.FirebasePlugin.onMessageReceived) {
          window.FirebasePlugin.onMessageReceived(function () {
            // Mensagens em foreground podem ser tratadas aqui se necessario.
          });
        }
      },
      false
    );
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
      signOutAuth().finally(function () {
        clearSession();
        window.location.href = "index.html";
      });
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
        signOutAuth().finally(function () {
          clearSession();
          window.location.href = "index.html";
        });
      }
    });
  }

  var page = currentPage();
  var session = ensureAuthenticated(page);

  if (session) {
    ensureAdminAccess(page, session);
    subscribeAccountUpdates(session);
    subscribeOrderUpdates(session);
    initPushNotifications(session);
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
