(function () {
  var SESSION_KEY = "infinityart_session";

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function fillProfileFromSession() {
    var session = getSession();
    if (!session) return;

    var nameEl = document.getElementById("profile-user-name");
    var emailEl = document.getElementById("profile-user-email");

    if (nameEl && session.nome) {
      nameEl.textContent = session.nome;
    }

    if (emailEl && session.email) {
      emailEl.textContent = session.email;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillProfileFromSession);
  } else {
    fillProfileFromSession();
  }
})();
