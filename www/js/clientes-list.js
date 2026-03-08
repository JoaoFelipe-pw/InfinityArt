(function () {
  var state = {
    clientes: [],
    filtro: "",
  };

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function initialsFromName(name, email) {
    var source = String(name || "").trim();
    if (!source) {
      source = String(email || "").split("@")[0];
    }
    var parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function cardTemplate(cliente) {
    var nome = escapeHtml(cliente.nome || "Sem nome");
    var email = escapeHtml(cliente.email || "sem-email");
    var initials = escapeHtml(initialsFromName(cliente.nome, cliente.email));
    var id = encodeURIComponent(cliente.id || "");
    return (
      '<div class="flex items-center gap-4 rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-accent-dark">' +
      '<div class="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/20">' +
      '<div class="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold text-base">' +
      initials +
      "</div>" +
      "</div>" +
      '<div class="flex flex-1 flex-col min-w-0">' +
      '<p class="font-bold text-slate-900 dark:text-slate-100 truncate">' +
      nome +
      "</p>" +
      '<p class="text-xs text-slate-500 dark:text-slate-400 truncate">' +
      email +
      "</p>" +
      "</div>" +
      '<button class="rounded-lg bg-primary/10 dark:bg-primary/20 px-4 py-2 text-xs font-bold text-primary" type="button" onclick="window.location.href=\'gerirCliente.html?uid=' +
      id +
      '\'">Gerir</button>' +
      "</div>"
    );
  }

  function filteredClientes() {
    var filtro = normalize(state.filtro);
    if (!filtro) return state.clientes.slice();

    return state.clientes.filter(function (cliente) {
      var nome = normalize(cliente.nome);
      var email = normalize(cliente.email);
      return nome.indexOf(filtro) >= 0 || email.indexOf(filtro) >= 0;
    });
  }

  function render() {
    var listEl = document.getElementById("clientes-list");
    var countEl = document.getElementById("clientes-count");
    var emptyEl = document.getElementById("clientes-empty");
    if (!listEl || !countEl || !emptyEl) return;

    var clientes = filteredClientes();
    countEl.textContent = "Resultados (" + clientes.length + ")";

    if (!clientes.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = clientes.map(cardTemplate).join("");
  }

  function bindSearch() {
    var searchEl = document.getElementById("clientes-search");
    if (!searchEl) return;
    searchEl.addEventListener("input", function () {
      state.filtro = searchEl.value || "";
      render();
    });
  }

  function loadClientes() {
    var db = getDb();
    if (!db) {
      console.error("Base de dados não inicializada para clientes.");
      return;
    }

    db.collection("usuarios")
      .get()
      .then(function (snap) {
        state.clientes = snap.docs
          .map(function (doc) {
            var data = doc.data() || {};
            return {
              id: doc.id,
              nome: data.nome || "",
              email: data.email || "",
              perfil: String(data.perfil || data.role || "cliente").toLowerCase(),
            };
          })
          .filter(function (cliente) {
            return cliente.perfil !== "admin" && !!(cliente.nome || cliente.email);
          })
          .sort(function (a, b) {
            return normalize(a.nome || a.email).localeCompare(normalize(b.nome || b.email));
          });

        render();
      })
      .catch(function (error) {
        console.error("Erro ao carregar clientes:", error);
        var emptyEl = document.getElementById("clientes-empty");
        if (emptyEl) {
          emptyEl.textContent = "Não foi possível carregar as contas agora.";
          emptyEl.classList.remove("hidden");
        }
      });
  }

  function init() {
    bindSearch();
    loadClientes();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
