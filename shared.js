import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  collection,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const isConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).includes("PASTE_YOUR")
);

let app, db;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment, collection, query, where };

// Turn "Blinding Lights" + "The Weeknd" into a stable, comparable id so
// re-submitting the same song merges into the existing entry instead of
// creating a duplicate.
export function slugify(song, artist) {
  const clean = (s) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const key = `${clean(song)}__${clean(artist)}`;
  return key.slice(0, 300) || `song-${Date.now()}`;
}

// Every phone gets a random local id, stored in localStorage, used only to
// remember which songs *this device* has already voted for. It is not tied
// to any name or account.
export function getDeviceId() {
  let id = localStorage.getItem("jukebox_device_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random()}`;
    localStorage.setItem("jukebox_device_id", id);
  }
  return id;
}

export function getVotedSlugs() {
  try {
    return JSON.parse(localStorage.getItem("jukebox_voted") || "[]");
  } catch {
    return [];
  }
}

export function markVoted(slug) {
  const voted = getVotedSlugs();
  if (!voted.includes(slug)) {
    voted.push(slug);
    localStorage.setItem("jukebox_voted", JSON.stringify(voted));
  }
}

export function getCurrentSession(callback) {
  const ref = doc(db, "settings", "session");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data().currentSession : "default");
  });
}

export function escapeText(str) {
  return String(str).slice(0, 120).trim();
}
