import type { Place } from "./places";

export type Mood = { energy: string; vibe: string; time: string };

const BUDGET_KM: Record<string, number> = { "1h": 4, "2h": 10, "half day": 25 };
const ENERGY_INDEX: Record<string, number> = { chill: 0, moderate: 1, "push it": 2 };

const GREEN = /ravine|trail|creek|river|lake|forest|woods|conservation|wildflower|reserve|valley|bluff|beach|waterfront/i;
const SOCIAL = /square|common|garden|market|plaza|village|green|playground|community/i;

function vibeScore(vibe: string, p: Place) {
  const green = p.kind === "nature_reserve" || GREEN.test(p.name) ? 1 : 0;
  const social = SOCIAL.test(p.name) ? 1 : 0;
  if (vibe === "quiet") return green - 0.5 * social;
  if (vibe === "social") return social + 0.3;
  return green + (/lake|river|waterfront|ravine|bluff|beach/i.test(p.name) ? 0.5 : 0); // scenic
}

export type Ranked = { place: Place; why: string };

// The two moods merged into one plain description, so nothing downstream has to reconcile them.
export function plan(moods: [Mood, Mood]) {
  const time = BUDGET_KM[moods[0].time] <= BUDGET_KM[moods[1].time] ? moods[0].time : moods[1].time;
  const energy = (ENERGY_INDEX[moods[0].energy] + ENERGY_INDEX[moods[1].energy]) / 2;
  const pace = energy < 0.75 ? "relaxed" : energy < 1.5 ? "steady" : "brisk";
  const [a, b] = [moods[0].vibe, moods[1].vibe];
  const feel = a === b ? a : `${a} and ${b}`;
  return { time, pace, feel };
}

// Same moods and places always give the same three picks.
export function shortlist(moods: [Mood, Mood], places: Place[]): Ranked[] {
  const budget = Math.min(...moods.map((m) => BUDGET_KM[m.time]));
  const energy = (ENERGY_INDEX[moods[0].energy] + ENERGY_INDEX[moods[1].energy]) / 2;
  const ideal = budget * (0.3 + 0.25 * energy);

  const scored = places.map((place) => {
    const distance = -Math.abs(place.km - ideal) / budget;
    const vibe = (vibeScore(moods[0].vibe, place) + vibeScore(moods[1].vibe, place)) / 2;
    const tooFar = place.km > budget ? -2 : 0;
    return { place, score: vibe + 2 * distance + tooFar };
  });
  scored.sort((a, b) => b.score - a.score || a.place.km - b.place.km || a.place.name.localeCompare(b.place.name));

  const { time, pace } = plan(moods);
  return scored.slice(0, 3).map(({ place }) => ({
    place,
    why: `A good fit for a ${time} outing at a ${pace} pace.`,
  }));
}
