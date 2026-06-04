// matches.js — Partidos agrupados por fase/grupo con banderas grandes
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await renderMatches(user);
});

async function renderMatches(user) {
  const container = document.getElementById('matchList');
  if (!container) return;

  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const now  = new Date();

  const myPreds = {};
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'),
      where('group_id', '==', GROUP_ID),
      where('user_uid', '==', user.uid)
    )
  );
  predsSnap.forEach(d => { myPreds[d.data().match_id] = d.data(); });

  const groups = {};
  snap.forEach(matchDoc => {
    const m     = matchDoc.data();
    const phase = m.phase || 'Sin fase';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push({ id: matchDoc.id, ...m });
  });

  container.innerHTML = '';

  Object.keys(groups).sort().forEach(phase => {
    const header = document.createElement('div');
    header.className = 'mb-2 mt-4';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="color:var(--gold);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;white-space:nowrap">⚽ ${phase}</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    container.appendChild(header);

    groups[phase].forEach(m => {
      const kickoff  = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
      const isDone   = m.home_score !== undefined;
      const isOpen   = !isDone && kickoff >= tomorrow;

      const myPred   = myPreds[m.id];
      let predBadge  = '';
      if (myPred) {
        const pts = myPred.points !== undefined
          ? `<span style="color:var(--gold);font-size:11px;font-weight:700"> +${myPred.points}pts</span>` : '';
        predBadge = `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">🔮 Tu pron.: <strong style="color:var(--text)">${myPred.home_score}-${myPred.away_score}</strong>${pts}</div>`;
      }

      const borderColor = isDone ? 'var(--gold)' : isOpen ? 'var(--green-light)' : 'var(--text-muted)';

      // Resultado o acción
      let actionArea = '';
      if (isDone) {
        actionArea = `
          <div style="text-align:center;min-width:64px">
            <div style="font-size:1.5rem;font-weight:800;color:var(--gold);line-height:1">${m.home_score} - ${m.away_score}</div>
            <div style="font-size:9px;color:var(--text-muted);letter-spacing:1px">FINAL</div>
          </div>`;
      } else if (isOpen) {
        actionArea = `<a class="btn btn-success btn-sm px-3" href="predict.html?gid=${GROUP_ID}&mid=${m.id}" style="white-space:nowrap">
          ${myPred ? '✏️ Editar' : '⚽ Pronosticar'}
        </a>`;
      } else {
        actionArea = `<span style="font-size:11px;color:var(--text-muted);text-align:center;white-space:nowrap">🔒 Cerrado</span>`;
      }

      const card = document.createElement('div');
      card.className = 'mb-2';
      card.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-left:4px solid ${borderColor};border-radius:10px;padding:12px 14px">
          <div style="display:flex;align-items:center;gap:10px">

            <!-- Local -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:52px">
              <span style="font-size:2rem;line-height:1">${m.home_flag||'⚽'}</span>
              <span style="font-size:0.7rem;color:var(--text-muted);text-align:center;max-width:60px;line-height:1.1">${m.home_team}</span>
            </div>

            <!-- Centro: hora/fecha + vs + pron -->
            <div style="flex:1;text-align:center">
              <div style="font-size:0.75rem;color:var(--text-muted)">
                📅 ${kickoff.toLocaleDateString('es-BO',{day:'2-digit',month:'short'})}
                · ⏰ ${kickoff.toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}
              </div>
              ${m.city ? `<div style="font-size:0.7rem;color:var(--text-muted)">📍 ${m.city}</div>` : ''}
              ${predBadge}
            </div>

            <!-- Visitante -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:52px">
              <span style="font-size:2rem;line-height:1">${m.away_flag||'⚽'}</span>
              <span style="font-size:0.7rem;color:var(--text-muted);text-align:center;max-width:60px;line-height:1.1">${m.away_team}</span>
            </div>

            <!-- Resultado / Botón -->
            <div class="ms-2">${actionArea}</div>
          </div>
        </div>`;
      container.appendChild(card);
    });
  });
}
