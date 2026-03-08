(function () {
  var SESSION_KEY = "infinityart_session";
  var DEFAULT_AVATAR_URL =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAOSIbUCijs89DhvgmnIf2xbaFg0wCGubrQSj_aABVK53GNfy4lXZncW6MNMbYkdwUezHLxdgDzGmob_XT8aNHdvw-oOhq-QmbTP7_d2rn4i5CoAvSCJ3piRAOFvYns96-WAONSRpePlNOdTNikp5MUya2NoETl-rHeD3KcW6HCbDY5a0eTJMxsau7saC1MvwMK9hp2oNzMbmlzSdLYfexIDfVpb4xqg5hq32NhKbz07WOh3L3UrR31KWzi9hvxnuswnt_Pa4NJVyAn";
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var FALLBACK_MAX_DATAURL_CHARS = 600000;

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session || {}));
  }

  function getDb() {
    return window.InfinityFirebase && window.InfinityFirebase.db;
  }

  function getStorage() {
    return window.InfinityFirebase && window.InfinityFirebase.storage;
  }

  function safeText(value) {
    return String(value == null ? "" : value).trim();
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

    ok.addEventListener("click", closeAlert);

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

  function avatarFromData(data, session) {
    if (data && safeText(data.fotoUrl)) return safeText(data.fotoUrl);
    if (data && safeText(data.fotoDataUrl)) return safeText(data.fotoDataUrl);
    if (session && safeText(session.fotoUrl)) return safeText(session.fotoUrl);
    if (session && safeText(session.fotoDataUrl)) return safeText(session.fotoDataUrl);
    return "";
  }

  function setProfileTexts(data) {
    var nameEl = document.getElementById("profile-user-name");
    var emailEl = document.getElementById("profile-user-email");

    if (nameEl && data && data.nome) {
      nameEl.textContent = safeText(data.nome);
    }

    if (emailEl && data && data.email) {
      emailEl.textContent = safeText(data.email);
    }
  }

  function setAvatar(url) {
    var avatar = document.getElementById("profile-avatar");
    if (!avatar) return;

    var source = safeText(url) || DEFAULT_AVATAR_URL;
    var safeUrl = source.replace(/"/g, "%22");
    avatar.style.backgroundImage = 'url("' + safeUrl + '")';
  }

  function mergeAndSaveSession(session, updates) {
    if (!session) return null;
    var merged = {
      id: session.id,
      nome: updates.nome || session.nome || "",
      email: updates.email || session.email || "",
      perfil: updates.perfil || session.perfil || "cliente",
      fotoUrl: updates.fotoUrl || session.fotoUrl || "",
      fotoDataUrl: updates.fotoDataUrl || session.fotoDataUrl || "",
    };
    saveSession(merged);
    return merged;
  }

  function loadProfileFromFirestore(session) {
    var db = getDb();
    if (!db || !session || !session.id) return Promise.resolve(session);

    return db
      .collection("usuarios")
      .doc(session.id)
      .get()
      .then(function (doc) {
        if (!doc.exists) {
          setProfileTexts(session);
          setAvatar(avatarFromData(null, session));
          return session;
        }

        var data = doc.data() || {};
        var nextSession = mergeAndSaveSession(session, {
          nome: safeText(data.nome),
          email: safeText(data.email),
          perfil: safeText(data.perfil || data.role),
          fotoUrl: safeText(data.fotoUrl),
          fotoDataUrl: safeText(data.fotoDataUrl),
        });

        setProfileTexts(nextSession || session);
        setAvatar(avatarFromData(data, nextSession || session));
        return nextSession || session;
      })
      .catch(function (error) {
        console.error("Erro ao carregar perfil:", error);
        setProfileTexts(session);
        setAvatar(avatarFromData(null, session));
        return session;
      });
  }

  function setAvatarButtonState(button, isLoading) {
    if (!button) return;
    var icon = button.querySelector(".material-symbols-outlined");
    button.disabled = !!isLoading;
    button.classList.toggle("opacity-60", !!isLoading);
    button.classList.toggle("cursor-not-allowed", !!isLoading);
    if (icon) {
      icon.textContent = isLoading ? "hourglass_top" : "photo_camera";
    }
  }

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error(message || "Tempo limite excedido."));
      }, ms);

      promise.then(
        function (value) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (error) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  function humanUploadError(error) {
    var code = safeText(error && error.code).toLowerCase();
    if (code.indexOf("unauthorized") !== -1) {
      return "Sem permissao para upload. Ajuste as regras do Firebase Storage.";
    }
    if (code.indexOf("canceled") !== -1) {
      return "Upload cancelado.";
    }
    if (code.indexOf("retry-limit-exceeded") !== -1) {
      return "Falha de rede no upload. Tente novamente.";
    }
    if (code.indexOf("object-not-found") !== -1 || code.indexOf("bucket-not-found") !== -1) {
      return "Bucket de armazenamento nao encontrado. Verifique a configuracao do Firebase.";
    }
    return safeText((error && error.message) || "Nao foi possivel atualizar a foto de perfil.");
  }

  function uploadAvatarToStorage(session, file) {
    var db = getDb();
    var storage = getStorage();

    if (!db) return Promise.reject(new Error("Base de dados indisponivel."));
    if (!storage) return Promise.reject(new Error("Upload de imagens indisponivel."));
    if (!session || !session.id) return Promise.reject(new Error("Sessao invalida."));

    var extension = "jpg";
    if (file && file.type && file.type.indexOf("/") > -1) {
      extension = file.type.split("/")[1] || extension;
    }

    var path = "usuarios/" + session.id + "/avatar_" + Date.now() + "." + extension;
    var ref = storage.ref().child(path);
    var metadata = file && file.type ? { contentType: file.type } : undefined;

    return ref
      .put(file, metadata)
      .then(function (snapshot) {
        return snapshot.ref.getDownloadURL();
      })
      .then(function (downloadUrl) {
        var payload = { fotoUrl: downloadUrl, fotoDataUrl: "" };
        if (window.firebase && firebase.firestore && firebase.firestore.FieldValue) {
          payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        return db
          .collection("usuarios")
          .doc(session.id)
          .set(payload, { merge: true })
          .then(function () {
            var updated = mergeAndSaveSession(session, { fotoUrl: downloadUrl, fotoDataUrl: "" });
            return updated || session;
          });
      });
  }

  function compressImageToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var imageUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var maxSide = 320;
          var width = img.naturalWidth || img.width || 1;
          var height = img.naturalHeight || img.height || 1;
          var ratio = Math.min(1, maxSide / Math.max(width, height));
          var targetW = Math.max(1, Math.round(width * ratio));
          var targetH = Math.max(1, Math.round(height * ratio));

          var canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          var ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas indisponivel.");
          ctx.drawImage(img, 0, 0, targetW, targetH);

          var qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
          var dataUrl = "";
          for (var i = 0; i < qualities.length; i += 1) {
            dataUrl = canvas.toDataURL("image/jpeg", qualities[i]);
            if (dataUrl.length <= FALLBACK_MAX_DATAURL_CHARS) break;
          }

          if (!dataUrl || dataUrl.length > FALLBACK_MAX_DATAURL_CHARS) {
            throw new Error("Imagem muito grande para fallback local.");
          }

          URL.revokeObjectURL(imageUrl);
          resolve(dataUrl);
        } catch (error) {
          URL.revokeObjectURL(imageUrl);
          reject(error);
        }
      };

      img.onerror = function () {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Nao foi possivel ler a imagem selecionada."));
      };

      img.src = imageUrl;
    });
  }

  function saveAvatarAsDataUrl(session, file) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("Base de dados indisponivel."));
    if (!session || !session.id) return Promise.reject(new Error("Sessao invalida."));

    return compressImageToDataUrl(file).then(function (dataUrl) {
      var payload = { fotoDataUrl: dataUrl, fotoUrl: "" };
      if (window.firebase && firebase.firestore && firebase.firestore.FieldValue) {
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      }

      return db
        .collection("usuarios")
        .doc(session.id)
        .set(payload, { merge: true })
        .then(function () {
          var updated = mergeAndSaveSession(session, { fotoUrl: "", fotoDataUrl: dataUrl });
          return updated || session;
        });
    });
  }

  function uploadAvatar(session, file) {
    return withTimeout(uploadAvatarToStorage(session, file), 25000, "Upload demorou demasiado tempo.").catch(function () {
      return saveAvatarAsDataUrl(session, file);
    });
  }

  function bindAvatarUpload(session) {
    var input = document.getElementById("profile-avatar-input");
    var trigger = document.getElementById("profile-avatar-trigger");
    if (!input || !trigger || !session || !session.id) return;

    trigger.addEventListener("click", function () {
      input.click();
    });

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;

      if (!file.type || file.type.indexOf("image/") !== 0) {
        showAlert("Atenção", "Escolha um ficheiro de imagem.");
        input.value = "";
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        showAlert("Atenção", "A imagem deve ter no maximo 5MB.");
        input.value = "";
        return;
      }

      setAvatarButtonState(trigger, true);
      uploadAvatar(session, file)
        .then(function (updatedSession) {
          setAvatar(avatarFromData(null, updatedSession));
          session = updatedSession || session;
          setAvatarButtonState(trigger, false);
          input.value = "";
        })
        .catch(function (error) {
          console.error("Erro ao enviar foto:", error);
          showAlert("Erro no upload", humanUploadError(error));
          setAvatarButtonState(trigger, false);
          input.value = "";
        });
    });
  }

  function initProfile() {
    var session = getSession();
    if (!session) return;

    setProfileTexts(session);
    setAvatar(avatarFromData(null, session));
    bindAvatarUpload(session);

    loadProfileFromFirestore(session).then(function (nextSession) {
      if (nextSession) {
        setProfileTexts(nextSession);
        setAvatar(avatarFromData(null, nextSession));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfile);
  } else {
    initProfile();
  }
})();
