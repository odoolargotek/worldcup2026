// standings.js — Ranking detallado con desglose de puntos por concepto
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

  // Navbar
  const nameEl = document.getElementById('groupNameNav');
  if (nameEl) nameEl.textContent = g.name;

  // Código
  const codeEl = document.getElementById('groupCodeDisplay');
  if (codeEl) codeEl.textContent = g.code;
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(g.code).then(() => alert('✅ Código copiado: ' + g.code));
  });

  // Premio y cuota
  const prizeEl = document.getElementById('groupPrize');
  if (prizeEl) prizeEl.textContent = g.prize ? `$${g.prize}` : 'Sin definir';
  const feeEl = document.getElementById('groupFee');
  if (feeEl) feeEl.textContent = g.fee ? `Cuota: $${g.fee} por participante` : '';

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
      document.getElementById('rankingTab')?.classList.toggle('d-none', btn.dataset.tab !== 'ranking');
      document.getElementById('matchesTab')?.classList.toggle('d-none', btn.dataset.tab !== 'matches');
    });
  });

  await renderStandings(user);
});

async function renderStandings(currentUser) {
  const container = document.getElementById('rankingBody');
  // Reemplazamos la tabla por cards detalladas
  const rankingTab = document.getElementById('rankingTab');
  if (!rankingTab) return;

  // Obtener miembros
  const membersSnap = await getDocs(
    query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID))
  );

  // Obtener todos los pronósticos del grupo
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'), where('group_id', '==', GROUP_ID))
  );

  // Obtener partidos para saber nombres
  const matchesSnap = await getDocs(collection(db, 'matches'));
  const matchesMap  = {};
  matchesSnap.forEach(d => { matchesMap[d.id] = d.data(); });

  // Agrupar pronósticos por usuario
  const predsByUser = {};
  predsSnap.forEach(d => {
    const p = d.data();
    if (!predsByUser[p.user_uid]) predsByUser[p.user_uid] = [];
    predsByUser[p.user_uid].push(p);
  });

  // Construir filas
  const rows = [];
  for (const mDoc of membersSnap.docs) {
    const m = mDoc.data();
    const uSnap = await getDoc(doc(db, 'users', m.user_uid));
    const name    = uSnap.exists() ? (uSnap.data().display_name || uSnap.data().email?.split('@')[0]) : 'Jugador';
    const favPts  = m.favorite_pts  || 0;
    const penalty = m.penalty_pts   || 0;

    // Desglose de pronósticos
    const userPreds  = predsByUser[m.user_uid] || [];
    let exactos      = 0;
    let resultados   = 0;
    let predPtsTotal = 0;
    userPreds.forEach(p => {
      if (p.points === 6) exactos++;
      else if (p.points === 3) resultados++;
      predPtsTotal += p.points || 0;
    });

    const total = favPts + predPtsTotal - penalty;
    rows.push({
      name, isMe: m.user_uid === currentUser.uid,
      favorite: m.favorite || '—',
      favPts, penalty, exactos, resultados,
      predPtsTotal, total
    });
  }

  rows.sort((a, b) => b.total - a.total);

  // Render como cards detalladas
  rankingTab.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];

  rows.forEach((r, i) => {
    const medal    = i < 3 ? medals[i] : `<span style="color:var(--text-muted);font-size:0.9rem">${i+1}</span>`;
    const meStyle  = r.isMe ? 'border-color:var(--green) !important;box-shadow:0 0 0 1px var(--green)' : '';
    const penLine  = r.penalty > 0
      ? `<div class="ranking-concept" style="color:var(--danger)">
           <span>⚠️ Penalidad por cambio de favorito</span>
           <span>-${r.penalty} pts</span>
         </div>` : '';

    const card = document.createElement('div');
    card.className = 'mb-3';
    card.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;${meStyle}">

        <!-- Header: posición + nombre + total -->
        <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">
          <div style="font-size:1.5rem;min-width:36px;text-align:center">${medal}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:1rem">
              ${r.name}
              ${r.isMe ? '<span style="color:var(--green-light);font-size:11px;margin-left:6px">(tú)</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted)">⚽ Favorito: <strong style="color:var(--text)">${r.favorite}</strong></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.8rem;font-weight:800;color:${i===0?'var(--gold)':i===1?'#9ca3af':i===2?'#d97706':'var(--green-light)'}">${r.total}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">puntos</div>
          </div>
        </div>

        <!-- Desglose de puntos -->
        <div style="padding:10px 18px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Desglose</div>

          <div class="ranking-concept">
            <span>🎯 Equipo favorito (${r.favorite})</span>
            <span style="color:var(--green-light)">+${r.favPts} pts</span>
          </div>

          <div class="ranking-concept">
            <span>🔮 Scores exactos ×${r.exactos} (6pts c/u)</span>
            <span style="color:var(--green-light)">+${r.exactos * 6} pts</span>
          </div>

          <div class="ranking-concept">
            <span>✅ Resultados correctos ×${r.resultados} (3pts c/u)</span>
            <span style="color:var(--green-light)">+${r.resultados * 3} pts</span>
          </div>

          ${penLine}

          <div style="height:1px;background:var(--border);margin:8px 0"></div>
          <div class="ranking-concept" style="font-weight:700">
            <span style="color:var(--text)">Total</span>
            <span style="color:var(--gold);font-size:1rem">${r.total} pts</span>
          </div>
        </div>
      </div>`;
    rankingTab.appendChild(card);
  });

  if (rows.length === 0) {
    rankingTab.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px 0">Aún no hay participantes en esta comparsa.</p>';
  }
}
