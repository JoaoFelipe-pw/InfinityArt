(function () {
  var state = {
    uid: "",
    cliente: null,
    pedidos: [],
  };

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function getString(value) {
    return String(value == null ? "" : value).trim();
  }

  function toCurrency(value) {
    var number = Number(value);
    if (!isFinite(number)) number = 0;
    return number.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function toDate(value, fallbackMillis) {
    if (value && typeof value.toDate === "function") return value.toDate();
    if (typeof value === "number" && isFinite(value)) return new Date(value);
    if (typeof fallbackMillis === "number" && isFinite(fallbackMillis)) return new Date(fallbackMillis);
    return null;
  }

  function toDateText(date) {
    if (!date || isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function initialsFromName(name, email) {
    var source = String(name || "").trim();
    if (!source) source = String(email || "").split("@")[0];

    var parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function showAreaFeedback(elementId, message, tone) {
    var feedback = byId(elementId);
    if (!feedback) return;

    if (!message) {
      feedback.textContent = "";
      feedback.classList.add("hidden");
      return;
    }

    feedback.textContent = String(message);
    feedback.classList.remove("hidden", "text-emerald-600", "text-red-500", "text-slate-500");
    feedback.classList.remove("dark:text-emerald-400", "dark:text-red-400", "dark:text-slate-300");

    if (tone === "error") {
      feedback.classList.add("text-red-500", "dark:text-red-400");
      return;
    }

    if (tone === "success") {
      feedback.classList.add("text-emerald-600", "dark:text-emerald-400");
      return;
    }

    feedback.classList.add("text-slate-500", "dark:text-slate-300");
  }

  function showFeedback(message, tone) {
    showAreaFeedback("gerir-feedback", message, tone);
  }

  function showPedidoFeedback(message, tone) {
    showAreaFeedback("pedido-feedback", message, tone);
  }

  function setFormDisabled(disabled) {
    var form = byId("cliente-form");
    if (!form) return;
    form.querySelectorAll("input, textarea, select, button").forEach(function (element) {
      if (element.id === "cliente-totalgasto-input") return;
      element.disabled = !!disabled;
    });
  }

  function setPedidoFormDisabled(disabled) {
    var form = byId("pedido-form");
    if (!form) return;
    form.querySelectorAll("input, textarea, select, button").forEach(function (element) {
      element.disabled = !!disabled;
    });
  }

  function updateHeader(cliente) {
    var nome = getString(cliente.nome) || "Sem nome";
    var email = getString(cliente.email) || "sem-email";
    var perfil = getString(cliente.perfil || "cliente").toLowerCase();
    var estado = cliente.ativo === false ? "Inativo" : "Ativo";
    var totalGasto = toCurrency(cliente.totalGasto || 0);

    var avatarEl = byId("cliente-avatar");
    var nomeEl = byId("cliente-nome-head");
    var emailEl = byId("cliente-email-head");
    var metaEl = byId("cliente-meta-head");

    if (avatarEl) avatarEl.textContent = initialsFromName(nome, email);
    if (nomeEl) nomeEl.textContent = nome;
    if (emailEl) emailEl.textContent = email;
    if (metaEl) {
      metaEl.textContent =
        "ID: " + state.uid + " | Perfil: " + perfil + " | Estado: " + estado + " | Total: " + totalGasto;
    }
  }

  function fillForm(cliente) {
    var nomeInput = byId("cliente-nome-input");
    var emailInput = byId("cliente-email-input");
    var totalGastoInput = byId("cliente-totalgasto-input");
    var ativoInput = byId("cliente-ativo-input");

    if (nomeInput) nomeInput.value = getString(cliente.nome);
    if (emailInput) emailInput.value = getString(cliente.email);
    if (totalGastoInput) totalGastoInput.value = String(Number(cliente.totalGasto || 0));
    if (ativoInput) ativoInput.value = cliente.ativo === false ? "false" : "true";
  }

  function readPayloadFromForm() {
    var nome = getString(byId("cliente-nome-input") && byId("cliente-nome-input").value);
    var email = getString(byId("cliente-email-input") && byId("cliente-email-input").value);
    var ativoRaw = getString(byId("cliente-ativo-input") && byId("cliente-ativo-input").value);

    if (!nome) throw new Error("Preencha o nome do cliente.");
    if (!email) throw new Error("Preencha o e-mail do cliente.");
    if (!isValidEmail(email)) throw new Error("Informe um e-mail valido.");

    return {
      nome: nome,
      email: email,
      emailNorm: normalizeEmail(email),
      totalGasto: Number((state.cliente && state.cliente.totalGasto) || 0),
      ativo: ativoRaw !== "false",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function readPedidoPayloadFromForm() {
    var produto = getString(byId("pedido-produto-input") && byId("pedido-produto-input").value);
    var descricao = getString(byId("pedido-descricao-input") && byId("pedido-descricao-input").value);
    var valorRaw = getString(byId("pedido-valor-input") && byId("pedido-valor-input").value);
    var status = getString(byId("pedido-status-input") && byId("pedido-status-input").value).toLowerCase() || "pendente";

    if (!produto) throw new Error("Informe o nome do produto.");

    var valor = Number(valorRaw || 0);
    if (!isFinite(valor) || valor < 0) {
      throw new Error("Informe um valor valido para o pedido.");
    }

    var now = Date.now();
    var stageDatesMs = {
      pendente: now,
      em_producao: null,
      em_transporte: null,
      entregue: null,
    };
    if (stageDatesMs.hasOwnProperty(status)) {
      stageDatesMs[status] = now;
    }

    return {
      clienteId: state.uid,
      clienteNome: getString(state.cliente && state.cliente.nome),
      clienteEmail: getString(state.cliente && state.cliente.email),
      produto: produto,
      descricao: descricao,
      valor: valor,
      status: status,
      stageDatesMs: stageDatesMs,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient: Date.now(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function checkEmailConflict(db, uid, email, emailNorm) {
    return db
      .collection("usuarios")
      .where("emailNorm", "==", emailNorm)
      .limit(1)
      .get()
      .then(function (snap) {
        if (!snap.empty && snap.docs[0].id !== uid) {
          throw new Error("Ja existe outra conta com este e-mail.");
        }

        return db.collection("usuarios").where("email", "==", email).limit(1).get();
      })
      .then(function (snap) {
        if (!snap.empty && snap.docs[0].id !== uid) {
          throw new Error("Ja existe outra conta com este e-mail.");
        }
      });
  }

  function statusMeta(status) {
    var value = getString(status).toLowerCase() || "pendente";
    if (value === "entregue") return { label: "Entregue", className: "text-emerald-600 bg-emerald-600/10" };
    if (value === "em_producao") return { label: "Em producao", className: "text-amber-600 bg-amber-600/10" };
    if (value === "em_transporte") return { label: "Em transporte", className: "text-sky-600 bg-sky-600/10" };
    return { label: "Pendente", className: "text-orange-600 bg-orange-600/10" };
  }

  function statusOptions(currentStatus) {
    var current = getString(currentStatus).toLowerCase() || "pendente";
    var options = [
      { value: "pendente", label: "Pendente" },
      { value: "em_producao", label: "Em producao" },
      { value: "em_transporte", label: "Em transporte" },
      { value: "entregue", label: "Entregue" },
    ];

    return options
      .map(function (option) {
        return (
          '<option value="' +
          option.value +
          '"' +
          (option.value === current ? " selected" : "") +
          ">" +
          option.label +
          "</option>"
        );
      })
      .join("");
  }

  function renderPedidos() {
    var listEl = byId("cliente-pedidos-list");
    var emptyEl = byId("cliente-pedidos-empty");
    if (!listEl || !emptyEl) return;

    if (!state.pedidos.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");

    listEl.innerHTML = state.pedidos
      .map(function (pedido) {
        var meta = statusMeta(pedido.status);
        var date = toDate(pedido.createdAt, pedido.createdAtClient);
        return (
          '<article class="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
          '<p class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">' +
          (pedido.produto || "Produto") +
          "</p>" +
          '<p class="text-xs text-slate-500 dark:text-slate-300 mt-1">' +
          (pedido.descricao || "Sem descricao") +
          "</p>" +
          '<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">' +
          toDateText(date) +
          "</p>" +
          "</div>" +
          '<div class="text-right shrink-0">' +
          '<p class="text-sm font-black text-primary">' +
          toCurrency(pedido.valor) +
          "</p>" +
          '<span class="inline-block mt-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ' +
          meta.className +
          '">' +
          meta.label +
          "</span>" +
          '<select data-pedido-status data-pedido-id="' +
          pedido.id +
          '" class="mt-2 w-full rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100">' +
          statusOptions(pedido.status) +
          "</select></div></div></article>"
        );
      })
      .join("");
  }

  function updatePedidoStatus(pedidoId, status, sourceElement) {
    var db = getDb();
    if (!db || !pedidoId) return;

    if (sourceElement) sourceElement.disabled = true;
    showPedidoFeedback("A atualizar estado do pedido...", "info");

    var normalizedStatus = getString(status).toLowerCase() || "pendente";
    var updates = {
      status: normalizedStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    updates["stageDatesMs." + normalizedStatus] = Date.now();

    db.collection("pedidos")
      .doc(pedidoId)
      .update(updates)
      .then(function () {
        return loadPedidos(db);
      })
      .then(function () {
        return recomputeAndPersistTotal(db);
      })
      .then(function () {
        showPedidoFeedback("Estado do pedido atualizado.", "success");
      })
      .catch(function (error) {
        showPedidoFeedback((error && error.message) || "Falha ao atualizar pedido.", "error");
      })
      .finally(function () {
        if (sourceElement) sourceElement.disabled = false;
      });
  }

  function loadPedidos(db) {
    return db
      .collection("pedidos")
      .where("clienteId", "==", state.uid)
      .get()
      .then(function (snap) {
        state.pedidos = snap.docs
          .map(function (doc) {
            var data = doc.data() || {};
            return {
              id: doc.id,
              produto: getString(data.produto),
              descricao: getString(data.descricao),
              valor: Number(data.valor || 0),
              status: getString(data.status || "pendente").toLowerCase(),
              stageDatesMs: data.stageDatesMs || {},
              createdAt: data.createdAt || null,
              createdAtClient: Number(data.createdAtClient || 0),
            };
          })
          .sort(function (a, b) {
            var aDate = toDate(a.createdAt, a.createdAtClient);
            var bDate = toDate(b.createdAt, b.createdAtClient);
            var aTs = aDate ? aDate.getTime() : 0;
            var bTs = bDate ? bDate.getTime() : 0;
            return bTs - aTs;
          });

        renderPedidos();
      });
  }

  function recomputeAndPersistTotal(db) {
    var total = state.pedidos.reduce(function (acc, pedido) {
      if (pedido.status !== "entregue") return acc;
      var value = Number(pedido.valor || 0);
      return acc + (isFinite(value) ? value : 0);
    }, 0);

    return db
      .collection("usuarios")
      .doc(state.uid)
      .update({
        totalGasto: total,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function () {
        state.cliente = Object.assign({}, state.cliente || {}, { totalGasto: total });
        fillForm(state.cliente);
        updateHeader(state.cliente);
      });
  }

  function loadCliente() {
    var db = getDb();
    if (!db) {
      showFeedback("Base de dados nao inicializada.", "error");
      setFormDisabled(true);
      setPedidoFormDisabled(true);
      return;
    }

    showFeedback("A carregar cliente...", "info");
    setFormDisabled(true);
    setPedidoFormDisabled(true);

    db.collection("usuarios")
      .doc(state.uid)
      .get()
      .then(function (doc) {
        if (!doc.exists) {
          throw new Error("Cliente nao encontrado.");
        }

        state.cliente = doc.data() || {};
        updateHeader(state.cliente);
        fillForm(state.cliente);
        return loadPedidos(db);
      })
      .then(function () {
        return recomputeAndPersistTotal(db);
      })
      .then(function () {
        showFeedback("", "info");
        showPedidoFeedback("", "info");
        setFormDisabled(false);
        setPedidoFormDisabled(false);
      })
      .catch(function (error) {
        showFeedback((error && error.message) || "Falha ao carregar cliente.", "error");
        setFormDisabled(true);
        setPedidoFormDisabled(true);
      });
  }

  function saveCliente(event) {
    event.preventDefault();
    var db = getDb();
    if (!db) {
      showFeedback("Base de dados nao inicializada.", "error");
      return;
    }

    var saveButton = byId("cliente-save-btn");
    var payload;

    try {
      payload = readPayloadFromForm();
    } catch (error) {
      showFeedback(error.message, "error");
      return;
    }

    if (saveButton) saveButton.disabled = true;
    showFeedback("A guardar alteracoes...", "info");

    checkEmailConflict(db, state.uid, payload.email, payload.emailNorm)
      .then(function () {
        return db.collection("usuarios").doc(state.uid).update(payload);
      })
      .then(function () {
        state.cliente = Object.assign({}, state.cliente || {}, payload);
        fillForm(state.cliente);
        updateHeader(state.cliente);
        showFeedback("Alteracoes guardadas com sucesso.", "success");
      })
      .catch(function (error) {
        showFeedback((error && error.message) || "Falha ao guardar alteracoes.", "error");
      })
      .finally(function () {
        if (saveButton) saveButton.disabled = false;
      });
  }

  function resetPedidoForm() {
    var produto = byId("pedido-produto-input");
    var descricao = byId("pedido-descricao-input");
    var valor = byId("pedido-valor-input");
    var status = byId("pedido-status-input");

    if (produto) produto.value = "";
    if (descricao) descricao.value = "";
    if (valor) valor.value = "0";
    if (status) status.value = "pendente";
  }

  function addPedido(event) {
    event.preventDefault();
    var db = getDb();
    if (!db) {
      showPedidoFeedback("Base de dados nao inicializada.", "error");
      return;
    }

    var addButton = byId("pedido-save-btn");
    var payload;

    try {
      payload = readPedidoPayloadFromForm();
    } catch (error) {
      showPedidoFeedback(error.message, "error");
      return;
    }

    if (addButton) addButton.disabled = true;
    showPedidoFeedback("A guardar pedido...", "info");

    db.collection("pedidos")
      .add(payload)
      .then(function () {
        return loadPedidos(db);
      })
      .then(function () {
        return recomputeAndPersistTotal(db);
      })
      .then(function () {
        resetPedidoForm();
        showPedidoFeedback("Pedido adicionado com sucesso.", "success");
      })
      .catch(function (error) {
        showPedidoFeedback((error && error.message) || "Falha ao adicionar pedido.", "error");
      })
      .finally(function () {
        if (addButton) addButton.disabled = false;
      });
  }

  function getUidFromQuery() {
    var params = new URLSearchParams(window.location.search || "");
    return getString(params.get("uid"));
  }

  function bindForm() {
    var form = byId("cliente-form");
    if (form) form.addEventListener("submit", saveCliente);

    var pedidoForm = byId("pedido-form");
    if (pedidoForm) pedidoForm.addEventListener("submit", addPedido);

    var pedidosList = byId("cliente-pedidos-list");
    if (pedidosList) {
      pedidosList.addEventListener("change", function (event) {
        var select = event.target.closest("[data-pedido-status]");
        if (!select) return;
        var pedidoId = getString(select.getAttribute("data-pedido-id"));
        var novoStatus = getString(select.value).toLowerCase();
        updatePedidoStatus(pedidoId, novoStatus, select);
      });
    }
  }

  function init() {
    bindForm();
    state.uid = getUidFromQuery();

    if (!state.uid) {
      showFeedback("Cliente nao informado. Volte a lista e clique em Gerir.", "error");
      setFormDisabled(true);
      setPedidoFormDisabled(true);
      return;
    }

    loadCliente();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
