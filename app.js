import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  collection,
  query,
  where,
  isConfigured,
  slugify,
  getDeviceId,
  getVotedSlugs,
  markVoted,
  getCurrentSession,
  escapeText,
} from "./shared.js";

const activeList = document.getElementById("activeList");
const playedList = document.getElementById("playedList");
const playedSection = document.getElementById("playedSection");
const emptyState = document.getElementById("emptyState");
const setupWarning = document.getElementById("setupWarning");
const modalBackdrop = document.getElementById("modalBackdrop");
const openModalBtn = document.getElementById("openModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const submitBtn = document.getElementById("submitBtn");
const songInput = document.getElementById("songInput");
const artistInput = document.getElementById("artistInput");
const formError = document.getElementById("formError");
const toastEl = document.getElementById("toast");

if (!isConfigured) {
  setupWarning.style.display = "block";
  openModalBtn.disabled = true;
} else {
  init();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function openModal() {
  formError.textContent = "";
  songInput.value = "";
  artistInput.value = "";
  modalBackdrop.classList.add("open");
  setTimeout(() => songInput.focus(), 50);
}
function closeModal() {
  modalBackdrop.classList.remove("open");
}

openModalBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

let currentSession = "default";
let unsubscribeRequests = null;

function init() {
  getCurrentSession((session) => {
    currentSession = session;
    subscribeToRequests();
  });

  submitBtn.addEventListener("click", handleSubmit);
  [songInput, artistInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSubmit();
    })
  );
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

let lastDocs = [];

function render(docs) {
  lastDocs = docs;
  const active = docs.filter((d) => !d.played).sort((a, b) => b.votes - a.votes);
  const played = docs.filter((d) => d.played).sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));

  emptyState.style.display = active.length === 0 ? "block" : "none";
  activeList.innerHTML = "";
  const votedSlugs = getVotedSlugs();

  active.forEach((song, i) => {
    activeList.appendChild(renderCard(song, i, votedSlugs));
  });

  if (played.length > 0) {
    playedSection.style.display = "block";
    playedList.innerHTML = "";
    played.forEach((song) => {
      playedList.appendChild(renderCard(song, -1, votedSlugs, true));
    });
  } else {
    playedSection.style.display = "none";
  }
}

function renderCard(song, rankIndex, votedSlugs, isPlayed = false) {
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
  artist.textContent = song.artist || "Unknown artist";
  info.appendChild(title);
  info.appendChild(artist);
  li.appendChild(info);

  if (!isPlayed) {
    const voteBtn = document.createElement("button");
    voteBtn.className = "vote-btn";
    const hasVoted = votedSlugs.includes(song.id);
    if (hasVoted) voteBtn.classList.add("voted");
    voteBtn.innerHTML = `<span>${hasVoted ? "♥" : "♡"}</span><span class="count">${song.votes}</span>`;
    voteBtn.disabled = hasVoted;
    voteBtn.addEventListener("click", () => voteFor(song.id));
    li.appendChild(voteBtn);
  } else {
    const count = document.createElement("div");
    count.className = "vote-btn";
    count.innerHTML = `<span class="count">${song.votes}</span>`;
    li.appendChild(count);
  }

  return li;
}

async function voteFor(slug) {
  const votedSlugs = getVotedSlugs();
  if (votedSlugs.includes(slug)) return;
  markVoted(slug);
  render(lastDocs); // re-render instantly with the local vote; the live listener reconciles right after
  try {
    await updateDoc(doc(db, "requests", slug), { votes: increment(1) });
  } catch (err) {
    console.error(err);
    showToast("Couldn't record your vote — try again.");
  }
}

async function handleSubmit() {
  const song = escapeText(songInput.value);
  const artist = escapeText(artistInput.value);

  if (!song) {
    formError.textContent = "Enter a song title.";
    return;
  }
  if (!artist) {
    formError.textContent = "Enter the artist's name.";
    return;
  }

  submitBtn.disabled = true;
  const slug = slugify(song, artist);
  const ref = doc(db, "requests", slug);

  try {
    const existing = await getDoc(ref);
    if (existing.exists() && existing.data().session === currentSession) {
      const votedSlugs = getVotedSlugs();
      if (!votedSlugs.includes(slug)) {
        await updateDoc(ref, { votes: increment(1) });
        markVoted(slug);
        showToast("Already requested — added your vote instead!");
      } else {
        showToast("That song's already on the list.");
      }
    } else {
      await setDoc(ref, {
        song,
        artist,
        votes: 1,
        played: false,
        session: currentSession,
        createdAt: Date.now(),
      });
      markVoted(slug);
      showToast("Added to the request line!");
    }
    closeModal();
  } catch (err) {
    console.error(err);
    formError.textContent = "Something went wrong — try again.";
  } finally {
    submitBtn.disabled = false;
  }
}
