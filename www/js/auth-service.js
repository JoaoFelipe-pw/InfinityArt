import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

const USERS_COLLECTION = "usuarios";
const SESSION_KEY = "infinityart_session";

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function getUserPassword(userData) {
  return userData.senha ?? userData.password ?? "";
}

function getSafeUser(userData, id) {
  return {
    id: id || null,
    nome: userData.nome || "",
    login: userData.login || "",
  };
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function findUserByLogin(login) {
  const loginNorm = normalizeLogin(login);
  const usersRef = collection(db, USERS_COLLECTION);

  let snap = await getDocs(
    query(usersRef, where("loginNorm", "==", loginNorm), limit(1))
  );

  if (snap.empty) {
    snap = await getDocs(query(usersRef, where("login", "==", String(login).trim()), limit(1)));
  }

  if (snap.empty) {
    return null;
  }

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function loginUser(login, senha) {
  const user = await findUserByLogin(login);
  if (!user) {
    throw new Error("Login não encontrado.");
  }

  if (String(getUserPassword(user)) !== String(senha)) {
    throw new Error("Palavra-passe incorreta.");
  }

  return getSafeUser(user, user.id);
}

export async function registerUser({ nome, login, senha }) {
  const existing = await findUserByLogin(login);
  if (existing) {
    throw new Error("Esse login já está em uso.");
  }

  const payload = {
    nome: String(nome || "").trim(),
    login: String(login || "").trim(),
    loginNorm: normalizeLogin(login),
    senha: String(senha || ""),
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, USERS_COLLECTION), payload);
  return getSafeUser(payload, ref.id);
}
