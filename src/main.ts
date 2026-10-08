import { findPlaces, mapsUrl } from "./places";
import { shortlist, type Mood, type Ranked } from "./shortlist";
import { getWeather, type Weather } from "./weather";
import { describePlace, hasWebGPU, warmUp } from "./llm";

const FIELDS = [
  { key: "energy", label: "Energy", options: ["chill", "moderate", "push it"] },
  { key: "vibe", label: "Vibe", options: ["quiet", "scenic", "social"] },
  { key: "time", label: "Time", options: ["1h", "2h", "half day"] },
] as const;

const moods: [Mood, Mood] = [
  { energy: "moderate", vibe: "scenic", time: "2h" },
  { energy: "moderate", vibe: "scenic", time: "2h" },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const guide = $("guide");
const goButton = $<HTMLButtonElement>("go");
const status = $("status");
const results = $("results");
const watchlist = $<HTMLTextAreaElement>("watchlist");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

// The on-device guide starts downloading on the first tap, so it is usually ready by the time you press go.

function setGuide(state: "idle" | "loading" | "ready" | "off", pct = 0) {
  guide.className = `guide ${state}`;
  guide.replaceChildren();
  if (state === "idle") guide.textContent = "On-device guide, wakes on your first tap";
  if (state === "off") guide.textContent = "Simple mode (this browser has no WebGPU)";
  if (state === "ready") guide.textContent = "Guide ready, runs on this phone";
  if (state === "loading") {
    guide.append(el("span", "", `Waking up your guide ${pct}%`));
    const bar = el("div", "bar");
    const fill = el("i");
    fill.style.width = `${pct}%`;
    bar.append(fill);
    guide.append(bar);
  }
}

let warmStarted = false;
function warmUpOnce() {
  if (warmStarted) return;
  warmStarted = true;
  if (!hasWebGPU()) return setGuide("off");
  setGuide("loading", 0);
  warmUp((pct) => setGuide("loading", pct))
    .then(() => setGuide("ready"))
    .catch((err) => {
      console.warn("Model failed to load", err);
      warmStarted = false;
      setGuide("off");
    });
}

function renderPeople() {
  const root = $("people");
  root.replaceChildren();
  ["You", "Your partner"].forEach((who, i) => {
    const card = el("div", "card");
    card.append(el("h2", "", who));
    for (const f of FIELDS) {
      const field = el("div", "field");
      field.append(el("label", "", f.label));
      const seg = el("div", "seg");
      for (const opt of f.options) {
        const b = el("button", moods[i][f.key] === opt ? "on" : "", opt);
        b.onclick = () => {
          moods[i][f.key] = opt;
          renderPeople();
          warmUpOnce();
        };
        seg.append(b);
      }
      field.append(seg);
      card.append(field);
    }
    root.append(card);
  });
}

function showStatus(text: string) {
  status.hidden = !text;
  status.replaceChildren(el("span", "dot"), el("span", "", text));
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000 }),
  );
}

// Cards show up straight away with the rule-based reason. Each gets a note from the guide as it is written.
function showPicks(picks: Ranked[]) {
  results.replaceChildren(el("h2", "", "Your top picks"));
  return picks.map(({ place, why }, i) => {
    const card = el("article", "card pick");
    const body = el("div");
    const tags = el("div", "tags");
    tags.append(el("span", "", `${place.km} km`), el("span", "", place.kind.replace("_", " ")));
    const note = el("p", "note");
    const link = el("a", "", "Open in Maps");
    link.href = mapsUrl(place);
    link.target = "_blank";
    link.rel = "noopener";
    body.append(el("h3", "", place.name), tags, el("p", "", why), note, link);
    card.append(el("div", "num", String(i + 1)), body);
    results.append(card);
    return note;
  });
}

const WAITING = "Your guide is writing a note...";

async function writeNotes(picks: Ranked[], notes: HTMLElement[], weather: Weather | null) {
  if (!hasWebGPU()) return notes.forEach((n) => n.remove());
  notes.forEach((n) => (n.textContent = WAITING));
  try {
    await warmUp(() => {});
    for (let i = 0; i < picks.length; i++) {
      notes[i].textContent = "";
      await describePlace(picks[i].place, moods, weather, (text) => (notes[i].textContent = text));
    }
  } catch (err) {
    console.warn("Guide notes failed", err);
    notes.forEach((n) => (n.textContent === WAITING || !n.textContent ? n.remove() : null));
  }
}

function showMovieNight() {
  const titles = watchlist.value.split("\n").map((t) => t.trim()).filter(Boolean);
  if (!titles.length) return;
  const card = el("article", "card movie");
  card.append(
    el("small", "", "Movie night, for when you're back"),
    el("strong", "", titles[Math.floor(Math.random() * titles.length)]),
  );
  results.append(card);
}

async function run() {
  warmUpOnce();
  goButton.disabled = true;
  results.replaceChildren();
  try {
    showStatus("Finding where you are");
    const { latitude, longitude } = (await getPosition()).coords;
    showStatus("Looking at nearby parks");
    const [places, weather] = await Promise.all([findPlaces(latitude, longitude), getWeather(latitude, longitude)]);
    if (!places.length) return showStatus("No named parks found nearby.");

    const picks = shortlist(moods, places);
    const notes = showPicks(picks);
    showStatus("");
    goButton.textContent = "Writing your notes...";
    showMovieNight();
    await writeNotes(picks, notes, weather);
  } catch (err) {
    showStatus(`Something went wrong: ${(err as Error).message}`);
  } finally {
    goButton.disabled = false;
    goButton.textContent = "Where should we go?";
  }
}

watchlist.value = localStorage.getItem("moodtrail:watchlist") ?? "";
$<HTMLDetailsElement>("movie").open = watchlist.value.trim() !== "";
watchlist.oninput = () => {
  localStorage.setItem("moodtrail:watchlist", watchlist.value);
  warmUpOnce();
};
goButton.onclick = run;
setGuide(hasWebGPU() ? "idle" : "off");
renderPeople();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("sw.js");
}
