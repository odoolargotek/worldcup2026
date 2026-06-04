// ====================================================
// auth.js — Login, Registro, Logout, Guard de ruta
// ====================================================
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const PAGE = window.location.pathname.split('/').pop() || 'index.html';

const PUBLIC_PAGES    = ['index.html', ''];
const PROTECTED_PAGES = ['admin.html', 'load-matches.html', 'dashboard.html', 'matches.html',
                         'standings.html', 'groups.html', 'predict.html',
                         'group-detail.html', 'rules.html', 'news.html', 'profile.html'];

// --- Guard de ruta ---
onAuthStateChanged(auth, (user) => {
  const isPublic    = PUBLIC_PAGES.includes(PAGE);
  const isProtected = PROTECTED_PAGES.includes(PAGE);

  if (!user && isProtected) {
    window.location.href = 'index.html';
    return;
  }
  if (user && isPublic) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Mostrar nombre en navbar
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl && user) nameEl.textContent = user.displayName || user.email;

  // Mostrar/ocultar botones navbar en index
  const dashLink  = document.getElementById('dashboardLink');
  const logoutBtn = document.getElementById('logoutBtn');
  if (dashLink)  dashLink.classList.toggle('d-none', !user);
  if (logoutBtn) logoutBtn.classList.toggle('d-none', !user);
});

// --- Login (botones sueltos en index.html) ---
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail')?.value.trim();
  const pass  = document.getElementById('loginPass')?.value;
  const msg   = document.getElementById('loginMsg');
  if (!email || !pass) { if (msg) msg.innerHTML = err('Completa todos los campos'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = 'dashboard.html';
  } catch (e) {
    if (msg) msg.innerHTML = err(friendlyError(e.code));
  }
});

// Permitir Enter en el campo password del login
document.getElementById('loginPass')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
});

// --- Registro ---
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const name  = document.getElementById('regName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const pass  = document.getElementById('regPass')?.value;
  const msg   = document.getElementById('registerMsg');
  if (!name || !email || !pass) { if (msg) msg.innerHTML = err('Completa todos los campos'); return; }
  if (pass.length < 6) { if (msg) msg.innerHTML = err('La contraseña debe tener mínimo 6 caracteres'); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      display_name: name,
      email,
      created_at: new Date()
    });
    window.location.href = 'dashboard.html';
  } catch (e) {
    if (msg) msg.innerHTML = err(friendlyError(e.code));
  }
});

// --- Logout ---
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// --- Mensajes de error amigables ---
function friendlyError(code) {
  const map = {
    'auth/user-not-found':      'No existe una cuenta con ese correo',
    'auth/wrong-password':      'Contraseña incorrecta',
    'auth/invalid-credential':  'Correo o contraseña incorrectos',
    'auth/email-already-in-use':'Ya existe una cuenta con ese correo',
    'auth/weak-password':       'La contraseña debe tener mínimo 6 caracteres',
    'auth/invalid-email':       'El correo no es válido',
    'auth/too-many-requests':   'Demasiados intentos. Espera un momento.',
  };
  return map[code] || 'Error. Inténtalo de nuevo.';
}

function err(msg) {
  return `<span style="color:var(--danger);font-weight:600">⚠️ ${msg}</span>`;
}
