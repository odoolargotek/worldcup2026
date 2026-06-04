// standings.js — Ranking: favorito + pronósticos - penalidad
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;

  const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
  if (!gSnap.exists()) return;
  const g = gSnap.data();

  // Navbar y código
  const nameEl = document.getElementById('groupNameNav');
  if (nameEl) nameEl.textContent = g.name;
  const codeEl = document.getElementById('groupCodeDisplay');
  if (codeEl) codeEl.textContent = g.code;

  // Premio y cuota
  const prizeEl = document.getElementById('groupPrize');
  if (prizeEl) prizeEl.textContent = g.prize ? `$${g.prize}` : 'Sin definir';
  const feeEl = document.getElementById('groupFee');
  if (feeEl) feeEl.textContent = g.fee ? `Cuota: $${g.fee} por participante` : '';

  // Copiar código
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(g.code)
      .then(() => alert('✅ Código copiado: ' + g.code));
  });

  // Mi favorito
  const myMem = await getDoc(doc(db, 'group_members', `${GROUP_ID}_${user.uid}`));
  const myFav = myMem.exists() ? myMem.data().favorite : null;
  const favEl = document.getElementById('myFavoriteDisplay');
  if (favEl) favEl.textContent = myFav || 'Sin elegir';

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('rankingTab').classList.toggle('d-none', btn.dataset.tab !== 'ranking');
      document.getElementById('matchesTab').classList.toggle('d-none', btn.dataset.tab !== 'matches');
    });
  });

  await renderStandings(user);
});

async function renderStandings(currentUser) {
  const tbody = document.getElementById('rankingBody');
  if (!tbody) return;

  const membersSnap = await getDocs(
    query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID))
  );
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'), where('group_id', '==', GROUP_ID))
  );

  // Sumar puntos de pronósticos por usuario
  const predPts = {};
  predsSnap.forEach(d => {
    const { user_uid, points } = d.data();
    if (!predPts[user_uid]) predPts[user_uid] = 0;
    if (points) predPts[user_uid] += points;
  });

  const rows = [];
  for (const mDoc of membersSnap.docs) {
    const m = mDoc.data();
    const uSnap = await getDoc(doc(db, 'users', m.user_uid));
    const name     = uSnap.exists() ? (uSnap.data().display_name || uSnap.data().email) : m.user_uid.slice(0,8);
    const favPts   = m.favorite_pts  || 0;
    const penalty  = m.penalty_pts   || 0;
    const predTotal= predPts[m.user_uid] || 0;
    const total    = favPts + predTotal - penalty;
    rows.push({ name, favorite: m.favorite || '—', favPts, predTotal, penalty, total,
                isMe: m.user_uid === currentUser.uid });
  }

  rows.sort((a, b) => b.total - a.total);
  tbody.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];
  rows.forEach((r, i) => {
    const rankClass = i < 3 ? ['rank-1','rank-2','rank-3'][i] : '';
    const meStyle   = r.isMe ? 'background:rgba(22,163,74,0.1);' : '';
    const penBadge  = r.penalty > 0 ? ` <span style="color:var(--danger);font-size:11px">(-${r.penalty})</span>` : '';
    tbody.innerHTML += `
      <tr style="${meStyle}">
        <td class="${rankClass}">${i < 3 ? medals[i] : i+1}</td>
        <td>${r.name}${r.isMe ? ' <span style="color:var(--green-light);font-size:11px">(tú)</span>' : ''}</td>
        <td style="font-size:0.9rem">${r.favorite}</td>
        <td><span class="badge-pts">${r.favPts}</span></td>
        <td><span class="badge-pts">${r.predTotal}</span>${penBadge}</td>
        <td><span class="badge-pts" style="background:linear-gradient(135deg,var(--green),var(--green-dark));font-size:1rem">${r.total}</span></td>
      </tr>`;
  });
}
