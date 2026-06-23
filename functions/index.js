const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

function normalizeTokens(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tokens = [];
  value.forEach((item) => {
    const token = String(item || "").trim();
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  });
  return tokens;
}

function statusLabel(status) {
  const value = String(status || "").trim().toLowerCase() || "pendente";
  if (value === "entregue") return "Entregue";
  if (value === "em_producao") return "Em producao";
  if (value === "em_transporte") return "Em transporte";
  return "Pendente";
}

function buildMessagePayload(title, body, data) {
  const payloadData = Object.assign({ title: String(title || ""), body: String(body || "") }, data || {});
  Object.keys(payloadData).forEach((key) => {
    if (payloadData[key] == null) payloadData[key] = "";
    payloadData[key] = String(payloadData[key]);
  });

  return {
    notification: { title: String(title || ""), body: String(body || "") },
    data: payloadData,
  };
}

async function sendPushToUser(uid, message) {
  if (!uid) return null;
  const userSnap = await admin.firestore().collection("usuarios").doc(uid).get();
  if (!userSnap.exists) return null;
  const tokens = normalizeTokens(userSnap.data().fcmTokens);
  if (!tokens.length) return null;

  const response = await admin.messaging().sendEachForMulticast(Object.assign({}, message, { tokens }));
  const invalid = [];

  response.responses.forEach((item, index) => {
    if (item.success) return;
    const code = item.error && item.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      invalid.push(tokens[index]);
    }
  });

  if (invalid.length) {
    await admin
      .firestore()
      .collection("usuarios")
      .doc(uid)
      .update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid) });
  }

  return response;
}

function getConfig(path, fallback) {
  const cfg = functions.config && typeof functions.config === "function" ? functions.config() : {};
  const parts = String(path || "").split(".");
  let current = cfg;
  for (let i = 0; i < parts.length; i += 1) {
    if (!current || typeof current !== "object") return fallback;
    current = current[parts[i]];
  }
  return current == null ? fallback : current;
}

function buildTransport() {
  const host = getConfig("smtp.host", "");
  const port = Number(getConfig("smtp.port", 465));
  const user = getConfig("smtp.user", "");
  const pass = getConfig("smtp.pass", "");
  const secure = String(getConfig("smtp.secure", "true")) === "true";

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function buildEmailTemplate(name, link) {
  const safeName = String(name || "InfinityArt");
  const safeLink = String(link || "");

  const subject = safeName + " - Recuperacao de palavra-passe";
  const text =
    "Ola,\n\n" +
    "Recebemos um pedido para repor a sua palavra-passe.\n" +
    "Abra o link abaixo para definir uma nova palavra-passe:\n\n" +
    safeLink +
    "\n\n" +
    "Se nao pediu esta reposicao, pode ignorar este email.\n";

  const html =
    "<p>Ola,</p>" +
    "<p>Recebemos um pedido para repor a sua palavra-passe.</p>" +
    "<p><a href=\"" +
    safeLink +
    "\">Clique aqui para definir uma nova palavra-passe</a></p>" +
    "<p>Se nao pediu esta reposicao, pode ignorar este email.</p>";

  return { subject, text, html };
}

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.sendPasswordResetEmail = functions.https.onRequest(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method-not-allowed" });
    return;
  }

  const email = String((req.body && req.body.email) || "").trim();
  if (!email) {
    res.status(400).json({ ok: false, error: "missing-email" });
    return;
  }

  const configuredUrl = getConfig("app.reset_url", "");
  const continueUrl = String((req.body && req.body.continueUrl) || configuredUrl || "").trim();
  const appName = getConfig("app.name", "InfinityArt");
  const fromAddress = getConfig("smtp.from", getConfig("smtp.user", ""));

  let resetLink = "";
  try {
    const settings = {};
    if (continueUrl) {
      settings.url = continueUrl;
      settings.handleCodeInApp = true;
    }
    resetLink = await admin.auth().generatePasswordResetLink(email, settings);
  } catch (error) {
    const code = error && error.code;
    if (code === "auth/user-not-found") {
      res.status(200).json({ ok: true });
      return;
    }
    if (code === "auth/invalid-email") {
      res.status(400).json({ ok: false, error: "invalid-email" });
      return;
    }
    if (code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri") {
      res.status(400).json({ ok: false, error: "invalid-continue-url" });
      return;
    }
    console.error("Failed to generate reset link:", error);
    res.status(500).json({ ok: false, error: "link-generation-failed" });
    return;
  }

  const transport = buildTransport();
  if (!transport) {
    res.status(500).json({ ok: false, error: "smtp-not-configured" });
    return;
  }

  const template = buildEmailTemplate(appName, resetLink);

  try {
    await transport.sendMail({
      from: fromAddress || undefined,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  } catch (error) {
    console.error("Failed to send reset email:", error);
    res.status(500).json({ ok: false, error: "email-send-failed" });
    return;
  }

  res.status(200).json({ ok: true });
});

exports.notifyOnPedidoCreate = functions.firestore.document("pedidos/{pedidoId}").onCreate(async (snap) => {
  const data = snap.data() || {};
  const uid = data.clienteId;
  if (!uid) return null;

  const produto = String(data.produto || "Pedido");
  const title = "Novo pedido";
  const body = "Novo pedido adicionado: " + produto + ".";

  const message = buildMessagePayload(title, body, {
    type: "pedido_novo",
    pedidoId: snap.id,
    status: String(data.status || "pendente"),
  });

  return sendPushToUser(uid, message);
});

exports.notifyOnPedidoUpdate = functions.firestore.document("pedidos/{pedidoId}").onUpdate(async (change) => {
  const before = change.before.data() || {};
  const after = change.after.data() || {};
  const uid = after.clienteId || before.clienteId;
  if (!uid) return null;

  const beforeStatus = String(before.status || "").trim().toLowerCase();
  const afterStatus = String(after.status || "").trim().toLowerCase();
  if (beforeStatus === afterStatus) return null;

  const produto = String(after.produto || "Pedido");
  const title = "Pedido atualizado";
  const body = "Estado atualizado para " + statusLabel(afterStatus) + ": " + produto + ".";

  const message = buildMessagePayload(title, body, {
    type: "pedido_status",
    pedidoId: change.after.id,
    status: afterStatus,
  });

  return sendPushToUser(uid, message);
});
