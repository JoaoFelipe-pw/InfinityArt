(function () {
  if (!window.firebase) {
    console.error("Firebase SDK não carregado.");
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyBZU7osNV93yBpAYwMbO39g8ZdppkxXpUA",
    authDomain: "infinityartfinal.firebaseapp.com",
    projectId: "infinityartfinal",
    storageBucket: "infinityartfinal.firebasestorage.app",
    messagingSenderId: "624502000124",
    appId: "1:624502000124:web:6fb70d6ceb27b704668a79",
    measurementId: "G-J0WN0ZC3NT",
  };

  var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  var auth = typeof firebase.auth === "function" ? firebase.auth(app) : null;
  var db = firebase.firestore(app);
  var storage = typeof firebase.storage === "function" ? firebase.storage(app) : null;

  var persistence =
    firebase.auth &&
    firebase.auth.Auth &&
    firebase.auth.Auth.Persistence &&
    firebase.auth.Auth.Persistence.LOCAL;
  if (auth && persistence && typeof auth.setPersistence === "function") {
    auth.setPersistence(persistence).catch(function (error) {
      console.warn("Falha ao definir persistencia de login:", error);
    });
  }

  window.InfinityFirebase = {
    app: app,
    auth: auth,
    db: db,
    storage: storage,
  };
})();
