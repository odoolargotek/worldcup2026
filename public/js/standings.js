// standings.js — Ranking con favoritos, podio de premios y admin close
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, getDoc, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');
const PHASES   = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                  'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

let groupData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;

  const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
  if (!gSnap.exists()) return;
  groupData = gSnap.data();

  // Nav y código
  const nameEl = document.getElementById('groupNameNav');
  if (nameEl) nameEl.textContent = groupData.name;
  const codeEl = document.getElementById('groupCodeDisplay');
  if (codeEl) codeEl.textContent = groupData.code;
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(groupData.code).then(() => alert('✅ Código copiado: ' + groupData.code));
  });

  // Premio / pozo (se actualiza tras contar miembros)
  const prizeEl = document.getElementById('groupPrize');
  const feeEl   = document.getElementById('groupFee');

  // Botón cerrar inscripciones (solo admin)
  const myMemberSnap = await getDoc(doc(db, 'group_members', `${GROUP_ID}_${user.uid}`));
  const myRole = myMemberSnap.exists() ? myMemberSnap.data().role : null;
  if (myRole === 'admin') renderAdminPanel(user, groupData);

  await renderStandings(user, prizeEl, feeEl);
});

function renderAdminPanel(user, g) {
  const container = document.getElementById('rankingTab');
  if (!container) return;

  // Insertar panel admin encima del ranking
  const panel = document.createElement('div');
  panel.id = 'adminPanel';
  panel.style.cssText = 'background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px 18px;margin-bottom:16px';
  panel.innerHTML = `
    <div style="font-size:12px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">⚙️ Panel de administrador</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button id="toggleOpenBtn" class="btn btn-sm ${
        g.is_open === false
          ? 'btn-outline-success'
          : 'btn-outline-danger'
      }" style="font-size:12px;font-weight:700">
        ${g.is_open === false ? '🟢 Reabrir inscripciones' : '🔴 Cerrar inscripciones'}
      </button>
    </div>
    <div id="adminMsg" style="margin-top:8px;font-size:12px"></div>`;

  container.parentNode.insertBefore(panel, container);

  document.getElementById('toggleOpenBtn')?.addEventListener('click', async () => {
    const newState = !(g.is_open === false);
    await updateDoc(doc(db, 'groups', GROUP_ID), { is_open: !newState });
    g.is_open = !newState;
    const btn = document.getElementById('toggleOpenBtn');
    if (btn) {
      btn.textContent = g.is_open === false ? '🟢 Reabrir inscripciones' : '🔴 Cerrar inscripciones';
      btn.className   = `btn btn-sm ${g.is_open === false ? 'btn-outline-success' : 'btn-outline-danger'}`;
    }
    const msg = document.getElementById('adminMsg');
    if (msg) {
      msg.style.color = g.is_open === false ? '#fca5a5' : 'var(--green-light)';
      msg.textContent = g.is_open === false
        ? '🔴 Inscripciones cerradas. Nadie nuevo puede unirse.'
        : '🟢 Inscripciones reabiertas.';
    }
  });
}

function calcPrize(g, memberCount) {
  if (!g) return 0;
  if (g.type === 'open')   return (g.fee || 0) * memberCount;
  if (g.type === 'closed') return g.prize || 0;
  return g.prize || 0;
}

function distLabel(g, memberCount) {
  const total = calcPrize(g, memberCount);
  if (!total) return null;
  const pct = g.prize_pct || { p1:100, p2:0, p3:0 };
  const lines = [];
  if (pct.p1) lines.push(`🥇 $${Math.round(total * pct.p1 / 100)} (${pct.p1}%)`);
  if (pct.p2) lines.push(`🥈 $${Math.round(total * pct.p2 / 100)} (${pct.p2}%)`);
  if (pct.p3) lines.push(`🥉 $${Math.round(total * pct.p3 / 100)} (${pct.p3}%)`);
  return lines;
}

async function renderStandings(currentUser, prizeEl, feeEl) {
  const rankingTab = document.getElementById('rankingTab');
  if (!rankingTab) return;

  const membersSnap = await getDocs(
    query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID))
  );
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'), where('group_id', '==', GROUP_ID))
  );

  const memberCount = membersSnap.size;
  const totalPrize  = calcPrize(groupData, memberCount);

  // Actualizar bloque de premio en el header de la comparsa
  if (prizeEl) {
    if (groupData.type === 'open') {
      prizeEl.innerHTML = totalPrize
        ? `<span style="color:var(--green-light)">💰 Pozo: $${totalPrize}</span>`
        : '<span style="color:var(--text-muted)">Sin cuota</span>';
    } else {
      prizeEl.textContent = totalPrize ? `$${totalPrize}` : 'Sin definir';
    }
  }
  if (feeEl) {
    feeEl.textContent = groupData.fee
      ? `Cuota: $${groupData.fee} · ${memberCount} participantes`
      : `${memberCount} participantes`;
  }

  const predsByUser = {};
  predsSnap.forEach(d => {
    const p = d.data();
    if (!predsByUser[p.user_uid]) predsByUser[p.user_uid] = [];
    predsByUser[p.user_uid].push(p);
  });

  const rows = [];
  for (const mDoc of membersSnap.docs) {
    const m     = mDoc.data();
    const uSnap = await getDoc(doc(db, 'users', m.user_uid));
    const name  = uSnap.exists()
      ? (uSnap.data().display_name || uSnap.data().email?.split('@')[0])
      : 'Jugador';

    const favs      = m.favorites     || {};
    const favsPts   = m.favorites_pts || {};
    const penalties = m.penalties     || {};
    const totalFavPts  = Object.values(favsPts).reduce((a,b)=>a+b, 0);
    const totalPenalty = Object.values(penalties).reduce((a,b)=>a+b, 0);

    const userPreds = predsByUser[m.user_uid] || [];
    let exactos = 0, resultados = 0, predPts = 0;
    userPreds.forEach(p => {
      if (p.points === 6) exactos++;
      else if (p.points === 3) resultados++;
      predPts += p.points || 0;
    });

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

  // --- Podio de premios ---
  const distLines = distLabel(groupData, memberCount);
  if (distLines && distLines.length && totalPrize > 0) {
    const podio = document.createElement('div');
    podio.style.cssText = 'background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(22,163,74,0.05));border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px 18px;margin-bottom:16px';
    podio.innerHTML = `
      <div style="font-size:12px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
        🏆 Distribución del premio — Pozo total: $${totalPrize}
        ${groupData.type === 'open' ? `<span style="color:var(--text-muted);font-weight:400"> ($${groupData.fee||0} × ${memberCount} personas)</span>` : ''}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${distLines.map(l => `
          <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:8px 14px;font-size:0.88rem;font-weight:700;color:var(--gold)">${l}</div>
        `).join('')}
      </div>
      ${rows.length >= 1 && rows[0].name ? `
        <div style="margin-top:10px;font-size:12px;color:var(--text-muted)">
          Lider actual: <strong style="color:var(--gold)">${rows[0].name}</strong> con ${rows[0].total} pts
        </div>` : ''}
    `;
    rankingTab.appendChild(podio);
  }

  // --- Tarjetas de ranking ---
  const medals = ['🥇','🥈','🥉'];
  const pct    = groupData?.prize_pct || { p1:100, p2:0, p3:0 };
  const pctArr = [pct.p1, pct.p2, pct.p3];

  rows.forEach((r, i) => {
    const medal   = i < 3 ? medals[i] : `<span style="color:var(--text-muted);font-size:0.9rem">${i+1}</span>`;
    const meStyle = r.isMe ? 'border-color:var(--green)!important;box-shadow:0 0 0 1px var(--green)' : '';

    // Premio individual si aplica
    let prizeChip = '';
    if (totalPrize > 0 && i < 3 && pctArr[i] > 0) {
      const amount = Math.round(totalPrize * pctArr[i] / 100);
      prizeChip = `<span style="font-size:11px;background:rgba(245,158,11,0.15);color:var(--gold);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:2px 8px;margin-left:6px">💰 $${amount}</span>`;
    }

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
           <span>⚠️ Penalidades</span><span>-${r.totalPenalty} pts</span>
         </div>` : '';

    const card = document.createElement('div');
    card.className = 'mb-3';
    card.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;${meStyle}">
        <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">
          <div style="font-size:1.5rem;min-width:36px;text-align:center">${medal}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:1rem">
              ${r.name}
              ${r.isMe ? '<span style="color:var(--green-light);font-size:11px;margin-left:6px">(tú)</span>' : ''}
              ${prizeChip}
            </div>
            <div style="font-size:12px;color:var(--text-muted)">
              🏆 ${r.chosenCount}/12 favs · 🔮 ${r.exactos} exactos · ✅ ${r.resultados} resultados
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.8rem;font-weight:800;color:${
              i===0?'var(--gold)':i===1?'#9ca3af':i===2?'#d97706':'var(--green-light)'
            }">${r.total}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">pts</div>
          </div>
        </div>
        <details style="padding:0">
          <summary style="padding:10px 18px;cursor:pointer;font-size:12px;color:var(--text-muted);list-style:none">
            ▼ Ver desglose de puntos
          </summary>
          <div style="padding:4px 18px 12px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">🏆 Favoritos por grupo</div>
            ${favsLines || noFavsMsg}
            <div class="ranking-concept" style="font-weight:700;margin-top:4px">
              <span>Subtotal favoritos</span>
              <span style="color:var(--green-light)">+${r.totalFavPts} pts</span>
            </div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px">🔮 Pronósticos</div>
            <div class="ranking-concept">
              <span>Scores exactos ×${r.exactos} (6pts)</span>
              <span style="color:var(--green-light)">+${r.exactos*6} pts</span>
            </div>
            <div class="ranking-concept">
              <span>Resultados correctos ×${r.resultados} (3pts)</span>
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
    rankingTab.innerHTML += '<p style="color:var(--text-muted);text-align:center;padding:40px 0">Aún no hay participantes.</p>';
  }
}
