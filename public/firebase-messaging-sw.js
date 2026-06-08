// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCjgVg2iWMlx5V1YM8bNdBz5VN4LH7CQIM',
  authDomain:        'worldcup2026-8f27b.firebaseapp.com',
  projectId:         'worldcup2026-8f27b',
  storageBucket:     'worldcup2026-8f27b.firebasestorage.app',
  messagingSenderId: '687082605115',
  appId:             '1:687082605115:web:d13b23f3e8b8e9e0c47a8b',
});

const messaging = firebase.messaging();

// Network-first para HTML/JS/CSS: nunca sirve cache vieja de la app
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Solo interceptar recursos del mismo origen
  if (url.origin !== self.location.origin) return;
  const ext = url.pathname.split('.').pop();
  if (['html','js','css'].includes(ext)) {
    event.respondWith(
      fetch(event.request)
        .then(r => {
          // Actualizar cache con la respuesta fresca
          const clone = r.clone();
          caches.open('wc2026-v2').then(c => c.put(event.request, clone));
          return r;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// Forzar activación inmediata sin esperar cierre de tabs viejas
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'WC2026', {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    data: payload.data,
  });
});
