/* Service worker : tout est mis en cache à l'installation, puis servi hors-ligne. */
const CACHE = 'voyante-v2';
const ASSETS = [
	'./',
	'./index.html',
	'./style.css',
	'./app.js',
	'./manifest.json',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

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
