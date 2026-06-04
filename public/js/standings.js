// standings.js — Ranking con favoritos por grupo
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');
const PHASES   = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                  'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;

  const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
  if (!gSnap.exists()) return;
  const g = gSnap.data();

  const nameEl = document.getElementById('groupNameNav');
  if (nameEl) nameEl.textContent = g.name;

  const codeEl = document.getElementById('groupCodeDisplay');
  if (codeEl) codeEl.textContent = g.code;
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(g.code).then(() => alert('✅ Código copiado: ' + g.code));
  });

  const prizeEl = document.getElementById('groupPrize');
  if (prizeEl) prizeEl.textContent = g.prize ? `$${g.prize}` : 'Sin definir';
  const feeEl = document.getElementById('groupFee');
  if (feeEl) feeEl.textContent = g.fee ? `Cuota: $${g.fee} por participante` : '';

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
  const rankingTab = document.getElementById('rankingTab');
  if (!rankingTab) return;

  const membersSnap = await getDocs(
    query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID))
  );
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'), where('group_id', '==', GROUP_ID))
  );

  const predsByUser = {};
  predsSnap.forEach(d => {
    const p = d.data();
    if (!predsByUser[p.user_uid]) predsByUser[p.user_uid] = [];
    predsByUser[p.user_uid].push(p);
  });

  const rows = [];
  for (const mDoc of membersSnap.docs) {
    const m = mDoc.data();
    const uSnap = await getDoc(doc(db, 'users', m.user_uid));
    const name  = uSnap.exists() ? (uSnap.data().display_name || uSnap.data().email?.split('@')[0]) : 'Jugador';

    // Puntos de favoritos: suma de todos los grupos
    const favs      = m.favorites     || {};
    const favsPts   = m.favorites_pts || {};
    const penalties = m.penalties     || {};
    const totalFavPts  = Object.values(favsPts).reduce((a,b)=>a+b, 0);
    const totalPenalty = Object.values(penalties).reduce((a,b)=>a+b, 0);

    // Pronósticos
    const userPreds = predsByUser[m.user_uid] || [];
    let exactos = 0, resultados = 0, predPts = 0;
    userPreds.forEach(p => {
      if (p.points === 6) exactos++;
      else if (p.points === 3) resultados++;
      predPts += p.points || 0;
    });

    // Resumen favoritos elegidos
    const chosenCount = PHASES.filter(ph => favs[ph]).length;

    const total = totalFavPts + predPts - totalPenalty;
    rows.push({
      name, isMe: m.user_uid === currentUser.uid,
      favs, favsPts, penalties,
      totalFavPts, totalPenalty,
      exactos, resultados, predPts,
      chosenCount, total
    });
  }

  rows.sort((a, b) => b.total - a.total);

  rankingTab.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];

  rows.forEach((r, i) => {
    const medal   = i < 3 ? medals[i] : `<span style="color:var(--text-muted);font-size:0.9rem">${i+1}</span>`;
    const meStyle = r.isMe ? 'border-color:var(--green)!important;box-shadow:0 0 0 1px var(--green)' : '';

    // Desglose de favoritos por grupo (solo los que tienen)
    const favsLines = PHASES
      .filter(ph => r.favs[ph])
      .map(ph => {
        const pts = r.favsPts[ph] || 0;
        const pen = r.penalties[ph] || 0;
        return `<div class="ranking-concept" style="font-size:0.8rem">
          <span style="color:var(--text-muted)">${ph}: <strong style="color:var(--text)">${r.favs[ph]}</strong></span>
          <span>
            <span style="color:var(--green-light)">+${pts}</span>
            ${pen ? `<span style="color:var(--danger)"> -${pen}</span>` : ''}
          </span>
        </div>`;
      }).join('');

    const noFavsMsg = r.chosenCount === 0
      ? `<div style="color:var(--text-muted);font-size:0.82rem;font-style:italic">Sin favoritos elegidos</div>` : '';

    const penLine = r.totalPenalty > 0
      ? `<div class="ranking-concept" style="color:var(--danger);font-weight:600">
           <span>⚠️ Penalidades totales</span><span>-${r.totalPenalty} pts</span>
         </div>` : '';

    const card = document.createElement('div');
    card.className = 'mb-3';
    card.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;${meStyle}">

        <!-- Header -->
        <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">
          <div style="font-size:1.5rem;min-width:36px;text-align:center">${medal}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:1rem">
              ${r.name}
              ${r.isMe ? '<span style="color:var(--green-light);font-size:11px;margin-left:6px">(tú)</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted)">
              🏆 ${r.chosenCount}/12 favoritos · 🔮 ${r.exactos} exactos · ✅ ${r.resultados} resultados
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.8rem;font-weight:800;color:${i===0?'var(--gold)':i===1?'#9ca3af':i===2?'#d97706':'var(--green-light)'}">${r.total}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">pts</div>
          </div>
        </div>

        <!-- Desglose colapsable -->
        <details style="padding:0">
          <summary style="padding:10px 18px;cursor:pointer;font-size:12px;color:var(--text-muted);list-style:none">
            ▼ Ver desglose de puntos
          </summary>
          <div style="padding:4px 18px 12px">

            <!-- Favoritos -->
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">🏆 Favoritos por grupo</div>
            ${favsLines || noFavsMsg}
            <div class="ranking-concept" style="font-weight:700;margin-top:4px">
              <span>Subtotal favoritos</span>
              <span style="color:var(--green-light)">+${r.totalFavPts} pts</span>
            </div>

            <!-- Pronosticos -->
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px">🔮 Pronósticos</div>
            <div class="ranking-concept">
              <span>Scores exactos ×${r.exactos} (6pts c/u)</span>
              <span style="color:var(--green-light)">+${r.exactos*6} pts</span>
            </div>
            <div class="ranking-concept">
              <span>Resultados correctos ×${r.resultados} (3pts c/u)</span>
              <span style="color:var(--green-light)">+${r.resultados*3} pts</span>
            </div>

            ${penLine}

            <div style="height:1px;background:var(--border);margin:8px 0"></div>
            <div class="ranking-concept" style="font-weight:700">
              <span>Total</span>
              <span style="color:var(--gold);font-size:1rem">${r.total} pts</span>
            </div>
          </div>
        </details>
      </div>`;
    rankingTab.appendChild(card);
  });

  if (rows.length === 0) {
    rankingTab.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px 0">Aún no hay participantes.</p>';
  }
}
