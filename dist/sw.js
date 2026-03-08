// Vadodara Flood Archives - Service Worker
// Provides offline functionality and controlled caching

const CACHE_VERSION = 'v1.0.0-94f72290';
const CACHE_NAME = `flood-archives-${CACHE_VERSION}`;
const MAP_TILE_CACHE = `map-tiles-${CACHE_VERSION}`;
const MAX_TILE_CACHE = 50;

const STATIC_ASSETS = [
    '/',
    './index.html',
    './style.css?v=v1.0.0-94f72290',
    './app.js?v=v1.0.0-94f72290',
    './data.js?v=v1.0.0-94f72290',
    './translations.js?v=v1.0.0-94f72290',
    './manifest.json?v=v1.0.0-94f72290',
    './social-preview.png'
];

const CDN_RESOURCES = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2'
];

function isLiveFeedRequest(url) {
    return url.hostname === 'docs.google.com' || url.hostname.endsWith('.googleusercontent.com');
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== MAP_TILE_CACHE) {
                        return caches.delete(cacheName);
                    }
                    return undefined;
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(handleMapTile(event.request));
        return;
    }

    if (isLiveFeedRequest(url) || url.hostname.includes('tally.so')) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    if (CDN_RESOURCES.some((cdn) => event.request.url.includes(cdn))) {
        event.respondWith(handleCDN(event.request));
        return;
    }

    event.respondWith(handleStatic(event.request));
});

async function handleStatic(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        fetchAndCache(request, cache);
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

async function handleCDN(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

async function handleMapTile(request) {
    const cache = await caches.open(MAP_TILE_CACHE);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const keys = await cache.keys();
            if (keys.length >= MAX_TILE_CACHE) {
                await cache.delete(keys[0]);
            }
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return cached || new Response('Tile unavailable offline', { status: 503 });
    }
}

async function fetchAndCache(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
    } catch (error) {
        // User already has cached content.
    }
}

self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
        );
    }
});
