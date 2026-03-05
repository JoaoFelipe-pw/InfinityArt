(function () {
  if (!window.firebase) {
    console.error("Firebase SDK não carregado.");
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyDp72KCaKjPUvdFB2tqLCmKPbQb3yljzh4",
    authDomain: "infinityart-17a46.firebaseapp.com",
    projectId: "infinityart-17a46",
    storageBucket: "infinityart-17a46.firebasestorage.app",
    messagingSenderId: "957825069999",
    appId: "1:957825069999:web:3465f97c0715cb0977755a",
    measurementId: "G-HY6SR1DKW8",
  };

  var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore(app);

  window.InfinityFirebase = {
    app: app,
    db: db,
  };
})();
