const CACHE = 'igclub-v1';
const STATIC = [
    '/style.css',
    '/client.js',
    '/games/monopoly/board.js',
    '/games/monopoly/icons.js',
    '/games/monopoly/ui.js',
    '/games/tysyacha/tysyacha.css',
    '/games/tysyacha/tysyacha.js',
    '/games/mafia/mafia.css',
    '/games/mafia/mafia.js',
    '/games/durak/durak.css',
    '/games/durak/durak.js',
    '/manifest.json',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Socket.io та API — завжди мережа
    if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) return;

    // HTML — завжди мережа (no-store)
    if (e.request.headers.get('accept')?.includes('text/html')) return;

    // Статика — cache-first
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res.ok && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            });
        })
    );
});
