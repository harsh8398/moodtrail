export type Weather = {
  tempC: number;
  rainPct: number;
  windKmh: number;
  sunset: string; // HH:MM local
};

const CACHE_KEY = "moodtrail:weather";

export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m&hourly=precipitation_probability` +
    `&daily=sunset&timezone=auto&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    const hour = new Date().getHours();
    const w: Weather = {
      tempC: Math.round(d.current.temperature_2m),
      rainPct: d.hourly.precipitation_probability[hour] ?? 0,
      windKmh: Math.round(d.current.wind_speed_10m),
      sunset: String(d.daily.sunset[0]).slice(11, 16),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(w));
    return w;
  } catch {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? (JSON.parse(cached) as Weather) : null;
  }
}
