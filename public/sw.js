// Makes a second visit work with no signal.
// - The page and its scripts are saved on install.
// - The page itself is network-first, so a new deploy is picked up when you are online.
// - Everything else (hashed scripts, model weights from Hugging Face) is cache-first.
const CACHE = "moodtrail-v2";

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.add("./");
  const html = await (await fetch("./")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(["manifest.webmanifest", ...assets]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("moodtrail-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const cacheable =
    request.method === "GET" &&
    (url.origin === self.location.origin || url.hostname.endsWith("huggingface.co") || url.hostname.endsWith("githubusercontent.com"));
  if (!cacheable) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    }),
  );
});
