// sw.js (Service Worker para PWA)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('gastos-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/app.js',
                '/manifest.json'
                // Agrega más archivos si es necesario
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});