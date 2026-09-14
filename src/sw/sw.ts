/* Service worker : tout est mis en cache à l'installation, puis servi hors-ligne. */

// Script classique (pas de module) : les service workers modules ne sont pas lus partout.
const sw = self as unknown as ServiceWorkerGlobalScope;

// __BUILD_HASH__ est remplacé au build par une empreinte du contenu de l'app
// (scripts/stamp-build.ts) : chaque modification publiée renomme le cache, ce qui
// met à jour les appareils où l'app est installée.
const CACHE = 'voyante-__BUILD_HASH__';
const ASSETS = [
	'./',
	'./index.html',
	'./style.css',
	'./app.js',
	'./zone-logic.js',
	'./secret-gesture.js',
	'./manifest.json',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || new URL(request.url).origin !== sw.location.origin) return;

	event.respondWith((async () => {
		const cache = await caches.open(CACHE);
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;
		if (request.mode === 'navigate') {
			const shell = await cache.match('./index.html');
			if (shell) return shell;
		}
		return fetch(request);
	})());
});
