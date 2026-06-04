// ====================================================
// firebase-config.js — worldcup2026-8f27b
// ====================================================
import { initializeApp }   from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth }          from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getMessaging }     from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBqgyEIJHn6l572fYfHtBvIjua19PKpIa0',
  authDomain:        'worldcup2026-8f27b.firebaseapp.com',
  projectId:         'worldcup2026-8f27b',
  storageBucket:     'worldcup2026-8f27b.firebasestorage.app',
  messagingSenderId: '767785242897',
  appId:             '1:767785242897:web:ab306ac8afd5ba7dae3cb0',
  measurementId:     'G-6W7JNJCG36'
};

const app = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const messaging = getMessaging(app);

// VAPID key pública (generada en Firebase Console → Project Settings → Cloud Messaging)
// REEMPLAZAR con tu clave real después de configurar FCM en la consola
export const VAPID_KEY = 'REEMPLAZAR_CON_TU_VAPID_KEY_DE_FIREBASE_CONSOLE';
