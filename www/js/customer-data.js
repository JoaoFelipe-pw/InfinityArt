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

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
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

  function statusMeta(rawStatus) {
    var status = getString(rawStatus).toLowerCase() || "pendente";
    if (status === "entregue") return { label: "Entregue", color: "text-emerald-500", badge: "bg-emerald-500/10" };
    if (status === "em_producao") return { label: "Em producao", color: "text-amber-500", badge: "bg-amber-500/10" };
    if (status === "em_transporte") return { label: "Em transporte", color: "text-sky-500", badge: "bg-sky-500/10" };
    return { label: "Pendente", color: "text-orange-500", badge: "bg-orange-500/10" };
  }

  function normalizeSearchText(value) {
    return getString(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getSelectedPedidoId() {
    var params = new URLSearchParams(window.location.search || "");
    return getString(params.get("pedido"));
  }

  function stageDate(pedido, stageKey) {
    var stageMap = (pedido && pedido.stageDatesMs) || {};
    var stageValue = Number(stageMap[stageKey] || 0);
    if (isFinite(stageValue) && stageValue > 0) {
      return new Date(stageValue);
    }
    if (stageKey === "pendente") {
      return toDate(pedido.createdAt, pedido.createdAtClient);
    }
    return null;
  }

  function timelineItem(title, date, isDone) {
    return (
      '<div class="rounded-xl border px-3 py-3 ' +
      (isDone ? "border-emerald-500/30 bg-emerald-500/10" : "border-gray-200 dark:border-white/10 bg-white dark:bg-brand-blue/20") +
      '">' +
      '<p class="text-sm font-bold ' +
      (isDone ? "text-emerald-600 dark:text-emerald-300" : "text-gray-800 dark:text-gray-100") +
      '">' +
      title +
      "</p>" +
      '<p class="text-xs mt-1 ' +
      (isDone ? "text-emerald-700/80 dark:text-emerald-200/80" : "text-gray-500 dark:text-gray-400") +
      '">' +
      (date ? toDateText(date) : "Por atualizar") +
      "</p></div>"
    );
  }

  function loadData(session) {
    var db = getDb();
    if (!db || !session || !session.id) return Promise.resolve({ pedidos: [], userData: null });

    return Promise.all([
      db.collection("pedidos").where("clienteId", "==", session.id).get(),
      db.collection("usuarios").doc(session.id).get(),
    ]).then(function (results) {
      var pedidosSnap = results[0];
      var userDoc = results[1];
      var pedidos = pedidosSnap.docs.map(function (doc) {
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
      });

      pedidos.sort(function (a, b) {
        var aDate = toDate(a.createdAt, a.createdAtClient);
        var bDate = toDate(b.createdAt, b.createdAtClient);
        var aTs = aDate ? aDate.getTime() : 0;
        var bTs = bDate ? bDate.getTime() : 0;
        return bTs - aTs;
      });

      return {
        pedidos: pedidos,
        userData: userDoc.exists ? userDoc.data() || {} : null,
      };
    });
  }

  function getTotalSpent(pedidos, userData) {
    var delivered = pedidos
      .filter(function (pedido) {
        return pedido.status === "entregue";
      })
      .reduce(function (total, pedido) {
        var valor = Number(pedido.valor || 0);
        return total + (isFinite(valor) ? valor : 0);
      }, 0);

    if (delivered > 0) return delivered;
    return Number((userData && userData.totalGasto) || 0) || 0;
  }

  function renderProfile(pedidos, userData) {
    var totalEl = document.getElementById("profile-total-gasto");
    var listEl = document.getElementById("profile-recent-orders");
    if (!listEl) return;

    if (totalEl) {
      totalEl.textContent = toCurrency(getTotalSpent(pedidos, userData));
    }

    if (!pedidos.length) {
      listEl.innerHTML =
        '<div class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151f2b] p-4 text-sm text-slate-500 dark:text-slate-300">Este cliente ainda nao comprou nada na loja.</div>';
      return;
    }

    listEl.innerHTML = pedidos
      .slice(0, 4)
      .map(function (pedido) {
        var date = toDate(pedido.createdAt, pedido.createdAtClient);
        var meta = statusMeta(pedido.status);
        return (
          '<div class="flex items-center gap-4 bg-white dark:bg-[#151f2b] rounded-2xl px-4 min-h-[80px] py-3 justify-between transition-all border border-slate-100 dark:border-white/5 shadow-sm">' +
          '<div class="flex items-center gap-4">' +
          '<div class="text-accent flex items-center justify-center rounded-xl bg-accent/10 shrink-0 size-12"><span class="material-symbols-outlined">inventory_2</span></div>' +
          '<div class="flex flex-col justify-center">' +
          '<p class="text-slate-900 dark:text-white text-base font-bold leading-normal">' +
          (pedido.produto || "Produto sem nome") +
          "</p>" +
          '<p class="text-slate-500 dark:text-[#92adc9] text-xs font-medium leading-normal">' +
          toDateText(date) +
          " - " +
          toCurrency(pedido.valor) +
          "</p>" +
          "</div></div>" +
          '<div class="flex flex-col items-end gap-1"><span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-current/20 ' +
          meta.color +
          " " +
          meta.badge +
          '">' +
          meta.label +
          "</span></div></div>"
        );
      })
      .join("");
  }

  function matchesHistoricoSearch(pedido, normalizedQuery) {
    if (!normalizedQuery) return true;

    var date = toDate(pedido.createdAt, pedido.createdAtClient);
    var meta = statusMeta(pedido.status);
    var fields = [
      pedido.produto,
      pedido.descricao,
      meta.label,
      toDateText(date),
      String(Number(pedido.valor || 0)),
      toCurrency(pedido.valor),
    ];

    var searchable = normalizeSearchText(fields.join(" "));
    return searchable.indexOf(normalizedQuery) !== -1;
  }

  function renderHistorico(pedidos, queryText) {
    var listEl = document.getElementById("historico-list");
    if (!listEl) return;

    if (!pedidos.length) {
      listEl.innerHTML =
        '<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2633] p-4 text-sm text-slate-500 dark:text-slate-300">Este cliente ainda nao comprou nada na loja.</div>';
      return;
    }

    var normalizedQuery = normalizeSearchText(queryText);
    var filtered = pedidos.filter(function (pedido) {
      return matchesHistoricoSearch(pedido, normalizedQuery);
    });

    if (!filtered.length) {
      listEl.innerHTML =
        '<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2633] p-4 text-sm text-slate-500 dark:text-slate-300">Nenhum resultado encontrado para esta pesquisa.</div>';
      return;
    }

    listEl.innerHTML = filtered
      .map(function (pedido) {
        var date = toDate(pedido.createdAt, pedido.createdAtClient);
        var meta = statusMeta(pedido.status);
        var descricao = pedido.descricao ? '<p class="text-xs text-slate-500 dark:text-slate-400">' + pedido.descricao + "</p>" : "";

        return (
          '<div class="flex items-center gap-4 bg-white dark:bg-[#1A2633] px-4 min-h-[96px] py-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">' +
          '<div class="flex items-center gap-4 flex-1">' +
          '<div class="rounded-lg size-16 flex items-center justify-center bg-brand-blue/5 border border-slate-100 dark:border-slate-700"><span class="material-symbols-outlined text-brand-orange">inventory_2</span></div>' +
          '<div class="flex flex-col justify-center gap-1">' +
          '<p class="text-slate-900 dark:text-white text-base font-bold leading-tight">' +
          (pedido.produto || "Produto sem nome") +
          "</p>" +
          descricao +
          '<p class="text-xs font-semibold ' +
          meta.color +
          '">' +
          meta.label +
          " - " +
          toDateText(date) +
          "</p>" +
          "</div></div>" +
          '<div class="shrink-0 text-right"><p class="text-brand-orange font-black text-lg leading-none">' +
          toCurrency(pedido.valor) +
          "</p></div></div>"
        );
      })
      .join("");
  }

  function setupHistoricoSearch(pedidos) {
    var searchInput = document.getElementById("historico-search");
    if (!searchInput) {
      renderHistorico(pedidos);
      return;
    }

    function applyFilter() {
      renderHistorico(pedidos, searchInput.value);
    }

    searchInput.addEventListener("input", applyFilter);
    applyFilter();
  }

  function renderEncomendas(pedidos) {
    var root = document.querySelector("[data-app-shell]") || (document.body && document.body.firstElementChild);
    if (!root) return;

    var nav = document.querySelector("nav.fixed.bottom-0");
    var navWrapper = nav && root.contains(nav) ? nav.parentElement : null;
    var header = root.firstElementChild;

    Array.from(root.children).forEach(function (child) {
      if (child === header || child === navWrapper) return;
      child.remove();
    });

    var container = document.createElement("main");
    container.id = "encomendas-list";
    container.className = "px-4 py-5 space-y-3";

    if (!pedidos.length) {
      container.innerHTML =
        '<div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-blue/30 p-4 text-sm text-gray-600 dark:text-gray-300">Este cliente ainda nao comprou nada na loja.</div>';
      if (navWrapper && navWrapper.parentElement === root) {
        root.insertBefore(container, navWrapper);
      } else {
        root.appendChild(container);
      }
      return;
    }

    var selectedId = getSelectedPedidoId();
    if (selectedId) {
      var selectedPedido = pedidos.find(function (pedido) {
        return pedido.id === selectedId;
      });

      if (!selectedPedido) {
        container.innerHTML =
          '<div class="rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-200">Encomenda nao encontrada.</div>' +
          '<a href="Encomendas.html" class="inline-flex mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">Voltar a lista</a>';
        if (navWrapper && navWrapper.parentElement === root) {
          root.insertBefore(container, navWrapper);
        } else {
          root.appendChild(container);
        }
        return;
      }

      var selectedMeta = statusMeta(selectedPedido.status);
      var datePendente = stageDate(selectedPedido, "pendente");
      var dateProducao = stageDate(selectedPedido, "em_producao");
      var dateTransporte = stageDate(selectedPedido, "em_transporte");
      var dateEntregue = stageDate(selectedPedido, "entregue");

      container.innerHTML =
        '<a href="Encomendas.html" class="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-blue/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">' +
        '<span class="material-symbols-outlined text-base">arrow_back</span>Voltar' +
        "</a>" +
        '<article class="mt-3 rounded-2xl bg-white dark:bg-brand-blue/30 p-4 border border-gray-200 dark:border-white/10">' +
        '<div class="flex items-start justify-between gap-3">' +
        '<div class="min-w-0">' +
        '<h3 class="text-gray-900 dark:text-white text-lg font-extrabold truncate">' +
        (selectedPedido.produto || "Produto sem nome") +
        "</h3>" +
        '<p class="text-gray-600 dark:text-gray-300 text-sm mt-1">' +
        (selectedPedido.descricao || "Sem descricao adicional.") +
        "</p></div>" +
        '<div class="text-right shrink-0">' +
        '<p class="text-primary text-lg font-black">' +
        toCurrency(selectedPedido.valor) +
        "</p>" +
        '<span class="inline-block mt-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ' +
        selectedMeta.badge +
        " " +
        selectedMeta.color +
        '">' +
        selectedMeta.label +
        "</span></div></div>" +
        '<div class="mt-4 space-y-2">' +
        timelineItem("Encomenda efetuada", datePendente, !!datePendente) +
        timelineItem("Em producao", dateProducao, !!dateProducao) +
        timelineItem("Em transporte", dateTransporte, !!dateTransporte) +
        timelineItem("Entregue", dateEntregue, !!dateEntregue) +
        "</div></article>";

      if (navWrapper && navWrapper.parentElement === root) {
        root.insertBefore(container, navWrapper);
      } else {
        root.appendChild(container);
      }
      return;
    }

    var active = pedidos.filter(function (pedido) {
      return pedido.status !== "entregue";
    });
    var list = active.length ? active : pedidos;

    container.innerHTML = list
      .map(function (pedido) {
        var date = toDate(pedido.createdAt, pedido.createdAtClient);
        var meta = statusMeta(pedido.status);
        return (
          '<article class="rounded-2xl bg-white dark:bg-brand-blue/30 p-4 border border-gray-200 dark:border-white/10">' +
          '<a href="Encomendas.html?pedido=' +
          encodeURIComponent(pedido.id) +
          '" class="block">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
          '<h3 class="text-gray-900 dark:text-white text-base font-extrabold truncate">' +
          (pedido.produto || "Produto sem nome") +
          "</h3>" +
          '<p class="text-gray-600 dark:text-gray-300 text-sm mt-1">' +
          (pedido.descricao || "Sem descricao adicional.") +
          "</p>" +
          '<p class="text-xs mt-2 text-gray-500 dark:text-gray-400">' +
          toDateText(date) +
          "</p>" +
          "</div>" +
          '<div class="text-right shrink-0">' +
          '<p class="text-primary text-lg font-black">' +
          toCurrency(pedido.valor) +
          "</p>" +
          '<span class="inline-block mt-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ' +
          meta.badge +
          " " +
          meta.color +
          '">' +
          meta.label +
          "</span></div></div></a></article>"
        );
      })
      .join("");

    if (navWrapper && navWrapper.parentElement === root) {
      root.insertBefore(container, navWrapper);
    } else {
      root.appendChild(container);
    }
  }

  function init() {
    var page = window.location.pathname.split("/").pop().toLowerCase();
    if (page !== "perfil.html" && page !== "historico.html" && page !== "encomendas.html") return;

    var session = getSession();
    if (!session || !session.id) return;

    loadData(session)
      .then(function (data) {
        if (page === "perfil.html") renderProfile(data.pedidos, data.userData);
        if (page === "historico.html") setupHistoricoSearch(data.pedidos);
        if (page === "encomendas.html") renderEncomendas(data.pedidos);
      })
      .catch(function (error) {
        console.error("Erro ao carregar dados do cliente:", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
