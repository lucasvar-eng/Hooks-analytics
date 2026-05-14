/**
 * Service Worker mínimo para Hooks Analytics.
 *
 * Estrategia conservadora:
 *  - El shell de la app (HTML, manifest, icons) usa "stale-while-revalidate":
 *    sirve la versión cacheada al toque y revalida en background.
 *  - Las llamadas a /api/* SIEMPRE pasan al network (no se cachean) — son
 *    datos vivos que cambian a cada minuto.
 *  - Los assets de Vite (hashed .js/.css) usan cache-first: el hash cambia
 *    cuando hay un nuevo build, así que invalidar es automático.
 *
 * Bump CACHE_VERSION cuando rompamos contratos de cache.
 */

const CACHE_VERSION = 'hooks-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;

const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  // Cachear el shell mínimo. No esperamos a que termine (skipWaiting para
  // que la nueva versión entre en vigor al toque).
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar caches viejas que no son de la versión actual.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Mismo origen + GET solamente. Los POST/PUT/DELETE nunca se cachean.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 2. NUNCA cachear /api/* — son datos vivos.
  if (url.pathname.startsWith('/api/')) return;

  // 3. Assets de Vite hasheados (/assets/index-XXXX.js): cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSETS_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Shell (HTML, manifest, icons): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
