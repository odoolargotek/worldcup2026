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
});

// --- Tabs Login / Registro ---
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('loginForm')?.classList.toggle('d-none', tab !== 'login');
    document.getElementById('registerForm')?.classList.toggle('d-none', tab !== 'register');
  });
});

// --- Login ---
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message);
  }
});

// --- Registro ---
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;
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
  } catch (err) {
    showError(err.message);
  }
});

// --- Logout ---
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

function showError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.classList.remove('d-none'); }
}
