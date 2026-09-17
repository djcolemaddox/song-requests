import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  isConfigured,
  getCurrentSession,
} from "./shared.js";

const activeList = document.getElementById("activeList");
const playedList = document.getElementById("playedList");
const playedSection = document.getElementById("playedSection");
const emptyState = document.getElementById("emptyState");
const setupWarning = document.getElementById("setupWarning");
const sessionInfo = document.getElementById("sessionInfo");
const resetBtn = document.getElementById("resetBtn");
const toastEl = document.getElementById("toast");

if (!isConfigured) {
  setupWarning.style.display = "block";
  resetBtn.disabled = true;
} else {
  init();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

let currentSession = "default";
let unsubscribeRequests = null;

function init() {
  getCurrentSession((session) => {
    currentSession = session;
    sessionInfo.textContent = `Board: ${session}`;
    subscribeToRequests();
  });

  resetBtn.addEventListener("click", handleReset);
}

function subscribeToRequests() {
  if (unsubscribeRequests) unsubscribeRequests();
  const q = query(collection(db, "requests"), where("session", "==", currentSession));
  unsubscribeRequests = onSnapshot(
    q,
    (snap) => {
      const docs = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      render(docs);
    },
    (err) => {
      console.error(err);
      showToast("Connection issue — check your Firebase setup.");
    }
  );
}

function render(docs) {
  const active = docs.filter((d) => !d.played).sort((a, b) => b.votes - a.votes);
  const played = docs.filter((d) => d.played).sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));

  emptyState.style.display = active.length === 0 && played.length === 0 ? "block" : "none";
  activeList.innerHTML = "";
  active.forEach((song, i) => activeList.appendChild(renderCard(song, i)));

  if (played.length > 0) {
    playedSection.style.display = "block";
    playedList.innerHTML = "";
    played.forEach((song) => playedList.appendChild(renderCard(song, -1, true)));
  } else {
    playedSection.style.display = "none";
  }
}

function renderCard(song, rankIndex, isPlayed = false) {
  const li = document.createElement("li");
  li.className = "song-card";
  if (isPlayed) li.classList.add("played");
  if (rankIndex === 0) li.classList.add("top1");
  if (rankIndex === 1) li.classList.add("top2");
  if (rankIndex === 2) li.classList.add("top3");

  const rank = document.createElement("div");
  rank.className = "rank";
  rank.textContent = isPlayed ? "✓" : `#${rankIndex + 1}`;
  li.appendChild(rank);

  const info = document.createElement("div");
  info.className = "song-info";
  const title = document.createElement("div");
  title.className = "song-title";
  title.textContent = song.song;
  const artist = document.createElement("div");
  artist.className = "song-artist";
  artist.textContent = `${song.artist || "Unknown artist"} · ${song.votes} vote${song.votes === 1 ? "" : "s"}`;
  info.appendChild(title);
  info.appendChild(artist);
  li.appendChild(info);

  const controls = document.createElement("div");
  controls.className = "dj-controls";
  const playedBtn = document.createElement("button");
  playedBtn.className = "icon-btn played-toggle";
  if (isPlayed) playedBtn.classList.add("is-played");
  playedBtn.textContent = isPlayed ? "Played ✓" : "Mark played";
  playedBtn.addEventListener("click", () => togglePlayed(song.id, !isPlayed));
  controls.appendChild(playedBtn);
  li.appendChild(controls);

  return li;
}

async function togglePlayed(id, played) {
  try {
    await updateDoc(doc(db, "requests", id), {
      played,
      playedAt: played ? Date.now() : null,
    });
  } catch (err) {
    console.error(err);
    showToast("Couldn't update that song — try again.");
  }
}

async function handleReset() {
  const confirmed = confirm(
    "Clear the board? Everyone's screens will reset to empty. Tonight's requests stay saved in Firebase, they just won't show anymore."
  );
  if (!confirmed) return;
  const newSession = `session-${Date.now()}`;
  try {
    await setDoc(doc(db, "settings", "session"), { currentSession: newSession });
    showToast("Board cleared for the next dance!");
  } catch (err) {
    console.error(err);
    showToast("Couldn't reset — check your connection.");
  }
}
