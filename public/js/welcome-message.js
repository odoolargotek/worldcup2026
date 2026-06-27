// welcome-message.js — Modal de bienvenida al loguearse
// Importar en dashboard.html y en todas las páginas protegidas
import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, arrayUnion
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

const STORAGE_KEY = 'wc2026_welcome_checked';

// Solo mostrar una vez por sesión de navegador
function alreadyCheckedThisSession() {
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}
function markChecked() {
  sessionStorage.setItem(STORAGE_KEY, '1');
}

onAuthStateChanged(auth, async (user) => {
  if (!user || alreadyCheckedThisSession()) return;
  markChecked();

  const now = new Date();
  const snap = await getDocs(collection(db, 'welcome_messages'));
  const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => {
    if (m.active === false) return false;
    if (m.expires_at && new Date(m.expires_at.seconds * 1000) < now) return false;
    if (m.seen_by && m.seen_by.includes(user.uid)) return false;
    if (m.type === 'user' && m.user_uid !== user.uid) return false;
    return true;
  });

  if (!msgs.length) return;

  // Mostrar de a uno, empezando por los personalizados
  const sorted = msgs.sort((a,b) => (a.type==='user'?0:1) - (b.type==='user'?0:1));
  showModal(sorted, 0, user.uid);
});

function showModal(msgs, idx, uid) {
  if (idx >= msgs.length) return;
  const m = msgs[idx];

  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
    backdrop-filter:blur(4px);animation:fadeIn .25s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes fadeIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      .wc-modal {
        background:linear-gradient(135deg,#0f172a,#1e293b);
        border:1px solid rgba(167,139,250,0.35);
        border-radius:20px;
        padding:32px 28px;
        max-width:480px;
        width:100%;
        box-shadow:0 25px 60px rgba(0,0,0,0.6);
        animation:fadeIn .25s ease;
        text-align:center;
      }
      .wc-modal-emoji { font-size:3rem; margin-bottom:12px; }
      .wc-modal-title { font-weight:800; font-size:1.25rem; color:#f1f5f9; margin-bottom:14px; }
      .wc-modal-body  { font-size:15px; color:#cbd5e1; line-height:1.65; white-space:pre-wrap; margin-bottom:24px; }
      .wc-modal-btn {
        background:linear-gradient(135deg,#6d28d9,#a78bfa);
        color:#fff; font-weight:800; font-size:15px;
        border:none; border-radius:12px; padding:12px 36px;
        cursor:pointer; width:100%; transition:opacity .15s;
      }
      .wc-modal-btn:hover { opacity:.88; }
      .wc-modal-counter { font-size:11px; color:#475569; margin-top:12px; }
    </style>
    <div class="wc-modal">
      ${m.emoji ? `<div class="wc-modal-emoji">${m.emoji}</div>` : ''}
      ${m.title ? `<div class="wc-modal-title">${m.title}</div>` : ''}
      <div class="wc-modal-body">${m.body}</div>
      <button class="wc-modal-btn" id="wcAcceptBtn">✅ Entendido</button>
      ${msgs.length > 1 ? `<div class="wc-modal-counter">${idx+1} de ${msgs.length}</div>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('wcAcceptBtn').addEventListener('click', async () => {
    // Marcar como visto en Firestore
    try {
      await updateDoc(doc(db, 'welcome_messages', m.id), {
        seen_by: arrayUnion(uid)
      });
    } catch(e) { console.warn('welcome seen_by error:', e); }

    overlay.remove();
    // Mostrar siguiente mensaje si hay más
    showModal(msgs, idx + 1, uid);
  });
}
