const CACHE = 'igclub-v2';
const STATIC = [
    '/style.css',
    '/client.js',
    '/avatars.js',
    '/shared/monopoly-board.js',
    '/games/monopoly/board.js',
    '/games/monopoly/icons.js',
    '/games/monopoly/messages.js',
    '/games/monopoly/ui.js',
    '/games/monopoly/engine.js',
    '/games/monopoly/client.js',
    '/games/monopoly/script.js',
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

    if (!url.protocol.startsWith('http')) return;

    // Socket.io та API — завжди мережа
    if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) return;

    // HTML — завжди мережа
    if (e.request.headers.get('accept')?.includes('text/html')) return;

    // Стратегія stale-while-revalidate:
    // — відразу повертаємо закешовану версію (швидко)
    // — паралельно оновлюємо кеш з мережі (юзер отримає оновлення на наступному завантаженні)
    e.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(e.request).then(cached => {
                const networkFetch = fetch(e.request).then(res => {
                    if (res.ok && e.request.method === 'GET') {
                        cache.put(e.request, res.clone());
                    }
                    return res;
                }).catch(() => null);

                return cached || networkFetch;
            })
        )
    );
});
