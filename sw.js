/* 英文リーダー Service Worker
 *
 * HTMLはネットワークを優先し、最新版を取得できない場合だけ
 * キャッシュを使います。古いURLやオフライン起動時は、現在の
 * toeic-listening-reader.html にフォールバックします。
 */
const CACHE_NAME = 'english-reader-v20260725-1';
const APP_URL = './toeic-listening-reader.html';
const APP_SHELL = [
  APP_URL,
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('english-reader-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPageRequest =
    request.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isPageRequest) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
  } catch {
    // オフライン時は下のキャッシュへフォールバックします。
  }

  return (
    (await cache.match(request)) ||
    (await cache.match(APP_URL)) ||
    new Response('オフラインのため英文リーダーを開けません。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  );
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}
