// Vadodara Flood Archives - Service Worker
// Provides offline functionality and intelligent caching

const CACHE_VERSION = 'v2'; // Bumped to invalidate old cache with broken code
const CACHE_NAME = `flood-archives-${CACHE_VERSION}`;
const MAP_TILE_CACHE = `map-tiles-${CACHE_VERSION}`;
const MAX_TILE_CACHE = 50; // Limit map tile cache to prevent storage bloat

// Static assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',          // Added - main application code
    '/data.js',
    '/translations.js',
    '/social-preview.png'
];

// External resources (CDNs) - cache with network-first strategy
const CDN_RESOURCES = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2'
];

// INSTALL: Cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            // Skip waiting to activate immediately
            return self.skipWaiting();
        })
    );
});

// ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old versions
                    if (cacheName !== CACHE_NAME && cacheName !== MAP_TILE_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// FETCH: Intelligent caching strategies
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy 1: Map Tiles (Cache with LRU limit)
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(handleMapTile(event.request));
        return;
    }

    // Strategy 2: Tally.so (Network only, no cache)
    if (url.hostname.includes('tally.so')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Strategy 3: CDN Resources (Network-first, fallback to cache)
    if (CDN_RESOURCES.some(cdn => event.request.url.includes(cdn))) {
        event.respondWith(handleCDN(event.request));
        return;
    }

    // Strategy 4: Static Assets (Cache-first)
    event.respondWith(handleStatic(event.request));
});

// Cache-first strategy for static assets
async function handleStatic(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        // Return cached version, update in background
        fetchAndCache(request, cache);
        return cached;
    }

    // Not in cache, fetch from network
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Network failed and no cache - return offline page
        return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Network-first for CDN resources
async function handleCDN(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        // Network failed, try cache
        const cached = await caches.match(request);
        if (cached) return cached;

        throw error;
    }
}

// Intelligent map tile caching (LRU with limit)
async function handleMapTile(request) {
    const cache = await caches.open(MAP_TILE_CACHE);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    // Fetch new tile
    try {
        const response = await fetch(request);

        if (response.ok) {
            // Implement LRU: check cache size
            const keys = await cache.keys();
            if (keys.length >= MAX_TILE_CACHE) {
                // Delete oldest (first) entry
                await cache.delete(keys[0]);
            }

            // Add new tile
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Return cached or placeholder
        return cached || new Response('Tile unavailable offline', {
            status: 503
        });
    }
}

// Background cache update (for cache-first strategy)
async function fetchAndCache(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
    } catch (error) {
        // Silently fail - user already has cached version
    }
}

// Listen for messages from main thread (for manual cache updates)
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((names) => {
                return Promise.all(names.map(name => caches.delete(name)));
            })
        );
    }
});

console.log('[SW] Service Worker loaded successfully');
