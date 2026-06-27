// auth-ready.js — Promesa compartida de autenticación
// Todos los módulos importan esta promesa en lugar de llamar
// onAuthStateChanged por separado, reduciendo roundtrips a Firebase Auth.
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub(); // escuchar solo una vez para la promesa inicial
    resolve(user);
  });
});
