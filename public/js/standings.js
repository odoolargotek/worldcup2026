// ====================================================
// standings.js — Ranking del grupo
// ====================================================
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  // Mostrar nombre del grupo
  const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
  if (gSnap.exists()) {
    const g = gSnap.data();
    const nameEl = document.getElementById('groupNameNav');
    if (nameEl) nameEl.textContent = g.name;
    const codeEl = document.getElementById('groupCodeDisplay');
    if (codeEl) codeEl.textContent = g.code;
  }
  // Copiar código
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(gSnap.data().code);
  });

  await renderStandings();
});

async function renderStandings() {
  const tbody = document.getElementById('rankingBody');
  if (!tbody) return;
  // Obtener predicciones del grupo con puntos asignados
  const q = query(collection(db, 'predictions'), where('group_id', '==', GROUP_ID));
  const snap = await getDocs(q);

  const totals = {}; // { uid: { pts, exact } }
  for (const d of snap.docs) {
    const { user_uid, points } = d.data();
    if (!totals[user_uid]) totals[user_uid] = { pts: 0, exact: 0 };
    if (points === 3) { totals[user_uid].pts += 3; totals[user_uid].exact += 1; }
    else if (points === 1) { totals[user_uid].pts += 1; }
  }

  // Ordenar
  const sorted = Object.entries(totals).sort((a, b) => b[1].pts - a[1].pts);
  tbody.innerHTML = '';
  let rank = 1;
  for (const [uid, data] of sorted) {
    const uSnap = await getDoc(doc(db, 'users', uid));
    const name = uSnap.exists() ? uSnap.data().display_name : uid.slice(0, 8);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${rank++}</td><td>${name}</td>
      <td><span class="badge-pts">${data.pts}</span></td>
      <td>${data.exact}</td>`;
    tbody.appendChild(tr);
  }
}
