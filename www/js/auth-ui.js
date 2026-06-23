(function () {
  var SESSION_KEY = "infinityart_session";
  var ACCOUNT_CREATED_KEY = "infinityart_account_created";
  var LOGOUT_KEY = "infinityart_logout";

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function getAuth() {
    return window.InfinityFirebase && window.InfinityFirebase.auth;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

    function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function setInputValidity(input, isValid) {
    if (!input) return;
    if (isValid) {
      input.classList.remove("border-red-500", "ring-2", "ring-red-400/30");
      input.removeAttribute("aria-invalid");
      return;
    }
    input.classList.add("border-red-500", "ring-2", "ring-red-400/30");
    input.setAttribute("aria-invalid", "true");
  }
function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearLogoutFlag() {
    try {
      localStorage.removeItem(LOGOUT_KEY);
    } catch (e) {}
  }

  function getStoredSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearStoredSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function byTextButton(text) {
    return Array.from(document.querySelectorAll("button")).find(function (button) {
      return (button.textContent || "").trim().toLowerCase().includes(text);
    });
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
    head.textContent = String(title || "Alerta");

    var body = document.createElement("div");
    body.className = "mobile-alert-body";
    body.textContent = String(message || "Ocorreu um erro.");

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

    ok.addEventListener("click", function () {
      closeAlert();
    });

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

  function showError(message) {
    showAlert("Atenção", message);
  }

  function humanAuthError(error, context) {
    var code = safeText((error && (error.code || error.message)) || "").toLowerCase();

    if (code.indexOf("auth/invalid-credential") !== -1) {
      return "E-mail ou senha incorretos.";
    }
    if (code.indexOf("auth/wrong-password") !== -1) {
      return "Senha incorreta.";
    }
    if (code.indexOf("auth/user-not-found") !== -1) {
      return "Conta nao encontrada.";
    }
    if (code.indexOf("auth/invalid-email") !== -1) {
      return "E-mail invalido.";
    }
    if (code.indexOf("auth/user-disabled") !== -1) {
      return "Conta desativada.";
    }
    if (code.indexOf("auth/network-request-failed") !== -1) {
      return "Falha de rede. Verifique a ligacao.";
    }
    if (code.indexOf("auth/too-many-requests") !== -1) {
      return "Muitas tentativas. Tente novamente mais tarde.";
    }

    if (context === "register") {
      if (code.indexOf("auth/email-already-in-use") !== -1) {
        return "Este e-mail ja esta em uso.";
      }
      if (code.indexOf("auth/weak-password") !== -1) {
        return "A senha e fraca. Use pelo menos 6 caracteres.";
      }
      if (code.indexOf("auth/operation-not-allowed") !== -1) {
        return "Registo desativado. Contacte o administrador.";
      }
      return "Falha ao criar conta. Tente novamente.";
    }

    return "Falha ao iniciar sessao. Verifique os dados e tente novamente.";
  }

  function resetButtonListeners(button) {
    var clone = button.cloneNode(true);
    button.parentNode.replaceChild(clone, button);
    return clone;
  }

  function bindPasswordToggles() {
    document.querySelectorAll("button").forEach(function (button) {
      var icon = button.querySelector(".material-symbols-outlined");
      if (!icon || (icon.textContent || "").trim() !== "visibility") return;
      button.type = "button";
      button.addEventListener("click", function () {
        var wrapper = button.closest(".relative");
        if (!wrapper) return;
        var input = wrapper.querySelector("input[type='password'], input[type='text']");
        if (!input) return;
        var isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        icon.textContent = isPassword ? "visibility_off" : "visibility";
      });
    });
  }

  function findUserByEmail(email) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("Base de dados não inicializada."));

    var emailTrimmed = String(email || "").trim();
    var emailNorm = normalizeEmail(emailTrimmed);

    return db
      .collection("usuarios")
      .where("emailNorm", "==", emailNorm)
      .limit(1)
      .get()
      .then(function (snap) {
        if (!snap.empty) return snap.docs[0];
        return db.collection("usuarios").where("email", "==", emailTrimmed).limit(1).get().then(function (snap2) {
          return snap2.empty ? null : snap2.docs[0];
        });
      });
  }

  function findUserByUid(uid) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("Base de dados não inicializada."));
    if (!uid) return Promise.resolve(null);
    return db
      .collection("usuarios")
      .where("uid", "==", String(uid))
      .limit(1)
      .get()
      .then(function (snap) {
        return snap.empty ? null : snap.docs[0];
      });
  }

  function buildSessionFromDoc(doc, authUser) {
    var data = (doc && doc.data()) || {};
    var perfil = String(data.perfil || data.role || "cliente").trim().toLowerCase();
    return {
      id: (doc && doc.id) || (authUser && authUser.uid) || "",
      nome: data.nome || (authUser && authUser.displayName) || "",
      email: data.email || (authUser && authUser.email) || "",
      perfil: perfil,
    };
  }

  function ensureUserProfile(authUser, fallbackEmail, nomeHint) {
    var db = getDb();
    var uid = authUser && authUser.uid;
    var email = (authUser && authUser.email) || fallbackEmail || "";
    var emailNorm = normalizeEmail(email);

    if (!db) {
      return Promise.resolve({
        id: uid || "",
        nome: (authUser && authUser.displayName) || nomeHint || "",
        email: email,
        perfil: "cliente",
      });
    }

    return findUserByUid(uid)
      .then(function (doc) {
        if (doc) return doc;
        return findUserByEmail(email);
      })
      .then(function (doc) {
        if (doc) {
          var data = doc.data() || {};
          var updates = {};
          if (uid && !data.uid) updates.uid = uid;
          if (email && !data.email) updates.email = String(email || "").trim();
          if (emailNorm && !data.emailNorm) updates.emailNorm = emailNorm;
          if (nomeHint && !data.nome) updates.nome = String(nomeHint || "").trim();
          if (Object.keys(updates).length) {
            return doc.ref.update(updates).then(function () {
              return doc;
            });
          }
          return doc;
        }

        var payload = {
          nome: String(nomeHint || (authUser && authUser.displayName) || "").trim(),
          email: String(email || "").trim(),
          emailNorm: emailNorm,
          uid: uid || null,
          perfil: "cliente",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        return db.collection("usuarios").add(payload).then(function (ref) {
          return db.collection("usuarios").doc(ref.id).get();
        });
      })
      .then(function (doc) {
        return buildSessionFromDoc(doc, authUser);
      });
  }

  function restoreSessionFromAuth() {
    var auth = getAuth();
    if (!auth || typeof auth.onAuthStateChanged !== "function") return;
    auth.onAuthStateChanged(function (user) {
      var logoutFlag = null;
      try {
        logoutFlag = localStorage.getItem(LOGOUT_KEY);
      } catch (e) {}
      if (user && logoutFlag) {
        auth.signOut().catch(function () {}).finally(function () {
          clearLogoutFlag();
        });
        return;
      }
      if (user) {
        ensureUserProfile(user, user.email)
          .then(function (session) {
            saveSession(session);
            clearLogoutFlag();
            window.location.href = "Menu.html";
          })
          .catch(function () {});
        return;
      }
      if (getStoredSession()) {
        clearStoredSession();
      }
      clearLogoutFlag();
    });
  }
  function loginUser(email, senha) {
    var auth = getAuth();
    if (!auth || !auth.signInWithEmailAndPassword) {
      return Promise.reject(new Error("Autenticação não inicializada."));
    }
    return auth.signInWithEmailAndPassword(email, senha).then(function (credential) {
      return ensureUserProfile(credential && credential.user, email);
    });
  }
  function registerUser(nome, email, senha) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("Base de dados não inicializada."));

    var auth = getAuth();
    if (!auth || !auth.createUserWithEmailAndPassword) {
      return Promise.reject(new Error("Autenticação não inicializada."));
    }

    return auth.createUserWithEmailAndPassword(email, senha).then(function (credential) {
      var user = credential && credential.user;
      var name = String(nome || "").trim();
      var updatePromise =
        user && name && typeof user.updateProfile === "function"
          ? user.updateProfile({ displayName: name })
          : Promise.resolve();
      return updatePromise.then(function () {
        return ensureUserProfile(user, email, name);
      });
    });
  }
  function bindLogin() {
    var emailInput = document.querySelector("input[type='email']");
    var passwordInput = document.querySelector("input[type='password']");
    var originalButton = document.getElementById("login-btn") || byTextButton("entrar");
    var loginButton = originalButton ? resetButtonListeners(originalButton) : null;
    if (!emailInput || !passwordInput || !loginButton) return;

    loginButton.removeAttribute("onclick");
    loginButton.type = "button";
    loginButton.addEventListener("click", function () {
      var email = emailInput.value.trim();
      var senha = passwordInput.value;

      if (!email || !senha) {
        showError("Preencha e-mail e palavra-passe.");
        return;
      }

      loginButton.disabled = true;
      loginUser(email, senha)
        .then(function (user) {
          saveSession(user);
          clearLogoutFlag();
          window.location.href = "Menu.html";
        })
        .catch(function (error) {
          showError(humanAuthError(error, "login"));
          loginButton.disabled = false;
        });
    });
  }

  function bindRegister() {
    var inputs = document.querySelectorAll("input");
    var nameInput = inputs[0];
    var emailInput = document.querySelector("input[type='email']");
    var passwordInput = document.querySelector("input[type='password']");
    var originalButton = byTextButton("criar conta");
    var registerButton = originalButton ? resetButtonListeners(originalButton) : null;
    if (!nameInput || !emailInput || !passwordInput || !registerButton) return;

    registerButton.removeAttribute("onclick");
    registerButton.type = "button";

    if (emailInput) {
      var validateEmail = function () {
        var value = emailInput.value.trim();
        var valid = !value || isValidEmail(value);
        setInputValidity(emailInput, valid);
      };
      emailInput.addEventListener("input", validateEmail);
      emailInput.addEventListener("blur", validateEmail);
    }

    registerButton.addEventListener("click", function () {
      var nome = nameInput.value.trim();
      var email = emailInput.value.trim();
      var senha = passwordInput.value;

      if (!nome || !email || !senha) {
        showError("Preencha nome, e-mail e palavra-passe.");
        return;
      }

      if (!isValidEmail(email)) {
        showError("Informe um e-mail válido.");
        setInputValidity(emailInput, false);
        return;
      }

      if (String(senha || "").length < 6) {
        showError("A palavra-passe deve ter pelo menos 6 caracteres.");
        return;
      }

      registerButton.disabled = true;
      registerUser(nome, email, senha)
        .then(function () {
          localStorage.removeItem(SESSION_KEY);
          clearLogoutFlag();
          try {
            sessionStorage.setItem(ACCOUNT_CREATED_KEY, "1");
          } catch (e) {}
          window.location.href = "index.html";
        })
        .catch(function (error) {
          showError(humanAuthError(error, "register"));
          registerButton.disabled = false;
        });
    });
  }
  function init() {
    restoreSessionFromAuth();
    bindPasswordToggles();

    var page = window.location.pathname.split("/").pop().toLowerCase();
    if (page === "index.html") {
      bindLogin();
      try {
        if (sessionStorage.getItem(ACCOUNT_CREATED_KEY) === "1") {
          sessionStorage.removeItem(ACCOUNT_CREATED_KEY);
          showAlert("Conta criada", "Conta criada com sucesso. Faça login para continuar.");
        }
      } catch (e) {}
    }
    if (page === "criarconta.html") bindRegister();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();







