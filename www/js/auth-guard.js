(function () {
  var SESSION_KEY = "infinityart_session";
  var PUBLIC_PAGES = {
    "index.html": true,
    "criarconta.html": true,
    "esqueceu_senha.html": true,
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

  function ensureAuthenticated() {
    var page = currentPage();
    if (PUBLIC_PAGES[page]) return;

    var session = getSession();
    if (!session || !session.email) {
      window.location.href = "index.html";
    }
  }

  function bindLogoutShortcut() {
    document.addEventListener("keydown", function (event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        clearSession();
        window.location.href = "index.html";
      }
    });
  }

  ensureAuthenticated();
  bindLogoutShortcut();
})();
