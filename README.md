# MoodTrail

Two people tap their moods, get three places to go, and put the phone away.

Live at [harsh.zip/moodtrail](https://harsh.zip/moodtrail/). Built for the DEV Hacktoberfest "Touch Grass" challenge.

## How it works

1. Each of you picks an energy, vibe and time budget.
2. The app finds named parks and nature reserves near you (OpenStreetMap, through Nominatim) and today's weather and sunset (Open-Meteo).
3. A scoring function in `src/shortlist.ts` picks three places. The same moods and places always give the same picks.
4. An open-weight model running in your browser (Qwen2.5-1.5B through [WebLLM](https://github.com/mlc-ai/web-llm), on WebGPU) writes a one-sentence note for each pick, streamed into the card.
5. Optional: add a movie night list and it picks one title for when you're back.

Your moods, location and watchlist stay in the browser. Only your coordinates go to the place and weather lookups. There is no backend and no API key.

Without WebGPU the picks still work, just without the model's notes.

## Run it

```bash
npm install
npm run dev
```

The model downloads on your first tap (about 880 MB, cached after that). Swap it by changing `MODEL_ID` in `src/llm.ts` to any id from WebLLM's prebuilt list.

## Files

- `src/main.ts` UI
- `src/shortlist.ts` scoring and the merged mood plan
- `src/llm.ts` model loading and note writing
- `src/places.ts` place lookup and cache
- `src/weather.ts` forecast and sunset
- `public/sw.js` caches the app and model weights for offline use

## License

MIT
