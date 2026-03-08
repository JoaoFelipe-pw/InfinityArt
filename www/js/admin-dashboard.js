(function () {
  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
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

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function isAdminUser(data) {
    var perfil = String((data && (data.perfil || data.role)) || "cliente")
      .trim()
      .toLowerCase();
    return perfil === "admin";
  }

  function loadKpis() {
    var db = getDb();
    if (!db) return;

    Promise.all([db.collection("usuarios").get(), db.collection("pedidos").get()])
      .then(function (results) {
        var usersSnap = results[0];
        var pedidosSnap = results[1];
        var totalSales = 0;
        var pendingOrders = 0;
        var soldProducts = 0;

        usersSnap.docs.forEach(function (doc) {
          var data = doc.data() || {};
          if (isAdminUser(data)) return;
          var totalGasto = Number(data.totalGasto || 0);
          if (isFinite(totalGasto)) totalSales += totalGasto;
        });

        pedidosSnap.docs.forEach(function (doc) {
          var data = doc.data() || {};
          var status = String(data.status || "pendente").toLowerCase();
          if (status === "entregue") {
            soldProducts += 1;
          } else {
            pendingOrders += 1;
          }
        });

        setText("admin-total-sales", toCurrency(totalSales));
        setText("admin-pending-orders", String(pendingOrders));
        setText("admin-products-sold", String(soldProducts));
      })
      .catch(function (error) {
        console.error("Erro ao carregar dados do painel admin:", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadKpis);
  } else {
    loadKpis();
  }
})();
