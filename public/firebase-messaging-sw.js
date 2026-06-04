// Service Worker para Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBqgyEIJHn6l572fYfHtBvIjua19PKpIa0',
  authDomain:        'worldcup2026-8f27b.firebaseapp.com',
  projectId:         'worldcup2026-8f27b',
  storageBucket:     'worldcup2026-8f27b.firebasestorage.app',
  messagingSenderId: '767785242897',
  appId:             '1:767785242897:web:ab306ac8afd5ba7dae3cb0',
});

const messaging = firebase.messaging();

// Notificación en background (app cerrada / en otra pestaña)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: '⚽ Ver comparsa' },
      { action: 'dismiss', title: 'Cerrar' },
    ]
  });
});

// Click en la notificación: abrir la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
