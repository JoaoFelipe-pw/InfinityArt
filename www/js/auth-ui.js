(function () {
  var SESSION_KEY = "infinityart_session";

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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

  function showError(message) {
    ensureMobileAlertStyles();

    var previous = document.querySelector(".mobile-alert-backdrop");
    if (previous) previous.remove();

    var backdrop = document.createElement("div");
    backdrop.className = "mobile-alert-backdrop";

    var box = document.createElement("div");
    box.className = "mobile-alert";

    var head = document.createElement("div");
    head.className = "mobile-alert-head";
    head.textContent = "Atenção";

    var body = document.createElement("div");
    body.className = "mobile-alert-body";
    body.textContent = String(message || "Ocorreu um erro.");

    var actions = document.createElement("div");
    actions.className = "mobile-alert-actions";

    var ok = document.createElement("button");
    ok.className = "mobile-alert-btn";
    ok.type = "button";
    ok.textContent = "OK";
    ok.addEventListener("click", function () {
      backdrop.remove();
    });

    actions.appendChild(ok);
    box.appendChild(head);
    box.appendChild(body);
    box.appendChild(actions);
    backdrop.appendChild(box);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
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

  function loginUser(email, senha) {
    return findUserByEmail(email).then(function (doc) {
      if (!doc) throw new Error("Não encontramos conta com este e-mail.");
      var data = doc.data() || {};
      var savedPassword = data.senha != null ? data.senha : data.password;
      if (String(savedPassword || "") !== String(senha || "")) {
        throw new Error("Palavra-passe incorreta. Tente novamente.");
      }
      return {
        id: doc.id,
        nome: data.nome || "",
        email: data.email || "",
      };
    });
  }

  function registerUser(nome, email, senha) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("Base de dados não inicializada."));

    return findUserByEmail(email).then(function (existing) {
      if (existing) throw new Error("Este e-mail já está associado a uma conta.");

      var payload = {
        nome: String(nome || "").trim(),
        email: String(email || "").trim(),
        emailNorm: normalizeEmail(email),
        senha: String(senha || ""),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      return db.collection("usuarios").add(payload).then(function (ref) {
        return {
          id: ref.id,
          nome: payload.nome,
          email: payload.email,
        };
      });
    });
  }

  function bindLogin() {
    var emailInput = document.querySelector("input[type='email']");
    var passwordInput = document.querySelector("input[type='password']");
    var originalButton = byTextButton("entrar");
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
          window.location.href = "Menu.html";
        })
        .catch(function (error) {
          showError((error && error.message) || "Falha ao iniciar sessão. Verifique a ligação e tente novamente.");
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
    registerButton.addEventListener("click", function () {
      var nome = nameInput.value.trim();
      var email = emailInput.value.trim();
      var senha = passwordInput.value;

      if (!nome || !email || !senha) {
        showError("Preencha nome, e-mail e palavra-passe.");
        return;
      }

      registerButton.disabled = true;
      registerUser(nome, email, senha)
        .then(function (user) {
          saveSession(user);
          window.location.href = "Menu.html";
        })
        .catch(function (error) {
          showError((error && error.message) || "Falha ao criar conta. Tente novamente.");
          registerButton.disabled = false;
        });
    });
  }

  function init() {
    bindPasswordToggles();

    var page = window.location.pathname.split("/").pop().toLowerCase();
    if (page === "index.html") bindLogin();
    if (page === "criarconta.html") bindRegister();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
