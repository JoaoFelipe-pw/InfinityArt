(function () {
  var requestForm = document.getElementById("reset-request-form");
  var resetForm = document.getElementById("reset-form");
  var emailInput = document.getElementById("email");
  var requestButton = document.getElementById("reset-request-btn");
  var statusBox = document.getElementById("reset-status");

  if (!requestForm || !emailInput || !requestButton) {
    return;
  }

  if (resetForm) {
    resetForm.classList.add("hidden");
  }

  function getAuth() {
    return window.InfinityFirebase && window.InfinityFirebase.auth;
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
    showAlert("Atencao", message);
  }

  function setStatus(message) {
    if (!statusBox) return;
    if (!message) {
      statusBox.textContent = "";
      statusBox.classList.add("hidden");
      return;
    }
    statusBox.textContent = message;
    statusBox.classList.remove("hidden");
  }

  function setButtonLoading(button, isLoading, loadingLabel) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      if (!button.dataset.label) {
        button.dataset.label = (button.textContent || "").trim();
      }
      button.textContent = loadingLabel || "A processar...";
    } else {
      button.disabled = false;
      if (button.dataset.label) {
        button.textContent = button.dataset.label;
      }
    }
  }

  function sendResetEmail(email) {
    var auth = getAuth();
    if (!auth || !auth.sendPasswordResetEmail) {
      return Promise.reject(new Error("Funcionalidade de e-mail não configurada."));
    }
    return auth.sendPasswordResetEmail(String(email || "").trim());
  }

  requestForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var email = String(emailInput.value || "").trim();
    if (!email) {
      showError("Introduza o seu e-mail.");
      return;
    }

    setButtonLoading(requestButton, true, "A enviar...");
    setStatus("");

    sendResetEmail(email)
      .then(function () {
        setStatus("Enviamos um e-mail com as instrucoes de reposicao.");
        showAlert("Email enviado", "Se o e-mail existir, vai receber as instrucoes em breve.");
      })
      .catch(function (error) {
        var code = error && error.code;
        if (code === "auth/user-not-found") {
          showError("Não encontramos conta com este e-mail.");
          return;
        }
        if (code === "auth/invalid-email") {
          showError("E-mail invalido.");
          return;
        }
        showError((error && error.message) || "Não foi possível enviar o e-mail.");
      })
      .finally(function () {
        setButtonLoading(requestButton, false);
      });
  });
})();

