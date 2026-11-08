/* 후쿠오카 여행 노트 — 서비스 워커
   - 앱 화면(HTML/CSS/JS): 네트워크 우선, 끊기면 캐시 → 업데이트는 바로 반영되고 오프라인에서도 열림
   - 라이브러리·폰트(CDN): 캐시 우선 + 백그라운드 갱신
   - 지도 타일: 한 번 본 영역은 캐시 (최대 약 1,500장)
   - 동기화·주소 검색·날씨 API: 캐시하지 않음 */
const VERSION = 'v5';
const SHELL = `shell-${VERSION}`;
const CDN = 'cdn-v1';
const TILES = 'tiles-v1';
const TILE_LIMIT = 1500;
const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/core.js', 'js/store.js', 'js/config.js', 'js/geo.js', 'js/places.js', 'js/place-form.js',
  'js/plan.js', 'js/home.js', 'js/info.js', 'js/sync.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, CDN, TILES]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

let tilePuts = 0;
async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - TILE_LIMIT; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        throw err;
      }
    })());
    return;
  }

  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        c.put(req, res.clone());
        if (++tilePuts % 100 === 0) trimTiles();
      }
      return res;
    })());
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CDN);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
  // 그 밖의 요청(Supabase, Nominatim, Open-Meteo)은 브라우저 기본 동작
});
