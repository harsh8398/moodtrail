import type { MLCEngine } from "@mlc-ai/web-llm";
import type { Place } from "./places";
import { plan, type Mood } from "./shortlist";
import type { Weather } from "./weather";

// Swap this for any model in WebLLM's prebuilt list. 1.5B fits most phones.
export const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

let engine: MLCEngine | null = null;
let loading: Promise<void> | null = null;

export const hasWebGPU = () => "gpu" in navigator;
export const isReady = () => engine !== null;

// Safe to call many times: the first call starts the download, the rest share it.
export function warmUp(onProgress: (pct: number) => void): Promise<void> {
  if (!hasWebGPU()) return Promise.resolve();
  loading ??= (async () => {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (p) => onProgress(Math.round(p.progress * 100)),
    });
  })().catch((err) => {
    loading = null; // allow a retry on the next tap
    throw err;
  });
  return loading;
}

async function stream(prompt: string, maxTokens: number, onText: (text: string) => void) {
  if (!engine) throw new Error("Model not loaded");
  const chunks = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    seed: 7,
    max_tokens: maxTokens,
    stream: true,
  });
  let text = "";
  for await (const chunk of chunks) {
    text += chunk.choices[0]?.delta?.content ?? "";
    onText(text.trim());
  }
  return text.trim();
}

// One short, friendly sentence on why this place suits the pair. Streams into the card as it is written.
export function describePlace(place: Place, moods: [Mood, Mood], weather: Weather | null, onText: (t: string) => void) {
  const { time, pace, feel } = plan(moods);
  const weatherLine = weather
    ? `Right now it is ${weather.tempC}C with a ${weather.rainPct}% chance of rain, and sunset is at ${weather.sunset}.`
    : "";
  return stream(
    `Two people are planning a ${time} outing at a ${pace} pace with a ${feel} feel.
They are considering ${place.name}, a ${place.kind.replace("_", " ")}. ${weatherLine}
Write ONE friendly sentence, under 20 words, on why it suits their plan. Use only the facts above. Do not invent details about the place.`,
    40,
    onText,
  );
}
