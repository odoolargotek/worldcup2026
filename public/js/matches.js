// matches.js — Partidos en tiempo real con onSnapshot
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, onSnapshot, getDocs, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { fmtDate, fmtTime } from './time.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

let myPreds    = {};
let unsub      = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  // Cargar pronósticos del usuario (una sola vez al inicio)
  const predsSnap = await getDocs(
    query(collection(db, 'predictions'),
      where('group_id', '==', GROUP_ID),
      where('user_uid',  '==', user.uid)
    )
  );
  predsSnap.forEach(d => { myPreds[d.data().match_id] = d.data(); });

  // Escuchar partidos en tiempo real
  if (unsub) unsub();
  unsub = onSnapshot(
    query(collection(db, 'matches'), orderBy('kickoff')),
    (snap) => renderMatches(snap),
    (err) => console.error('[matches] onSnapshot error:', err)
  );
});

function deadlineBadge(kickoff, isDone, hasMyPred) {
  if (isDone) return '';
  const now      = new Date();
  const diffMs   = kickoff - now;
  const diffHrs  = diffMs / 36e5;
  const diffMins = diffMs / 60000;

  if (diffMs <= 0) {
    return `<span style="background:rgba(100,100,100,0.3);color:#94a3b8;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">🔒 Cerrado</span>`;
  } else if (diffMins <= 60) {
    const mins = Math.floor(diffMins);
    return `<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;animation:pulse 1s infinite">⏰ ¡${mins} min!</span>`;
  } else if (diffHrs <= 3) {
    const hrs  = Math.floor(diffHrs);
    const mins = Math.floor((diffHrs - hrs) * 60);
    return `<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">🔴 ${hrs}h ${mins}m restantes</span>`;
  } else if (diffHrs <= 24) {
    const hrs = Math.floor(diffHrs);
    const color     = hasMyPred ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.2)';
    const textColor = hasMyPred ? 'var(--green-light)' : 'var(--gold)';
    const icon      = hasMyPred ? '✅' : '⚠️';
    return `<span style="background:${color};color:${textColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">${icon} Hoy vence · ${hrs}h</span>`;
  } else {
    const days = Math.floor(diffHrs / 24);
    if (days <= 3) {
      return `<span style="background:rgba(59,130,246,0.15);color:#93c5fd;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">📅 ${days}d restantes</span>`;
    }
    return '';
  }
}

function renderMatches(snap) {
  const container = document.getElementById('matchList');
  if (!container) return;
  const now = new Date();

  const groups = {};
  snap.forEach(d => {
    const m = d.data();
    const phase = m.phase || 'Sin fase';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push({ id: d.id, ...m });
  });

  container.innerHTML = '';

  Object.keys(groups).sort().forEach(phase => {
    const header = document.createElement('div');
    header.className = 'mb-2 mt-4';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="color:var(--gold);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;white-space:nowrap">⚽ ${phase}</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    container.appendChild(header);

    groups[phase].forEach(m => {
      const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
      const isDone  = m.home_score !== undefined && m.home_score !== null;
      const isOpen  = !isDone && kickoff > now;
      const myPred  = myPreds[m.id];

      const badge = deadlineBadge(kickoff, isDone, !!myPred);

      let predBadge = '';
      if (myPred) {
        const pts = myPred.points !== undefined
          ? `<span style="color:var(--gold);font-weight:700"> +${myPred.points}pts</span>` : '';
        predBadge = `<div style="font-size:12px;color:var(--text-muted);margin-top:5px">🔮 <strong style="color:var(--text)">${myPred.home_score} - ${myPred.away_score}</strong>${pts}</div>`;
      } else if (isOpen) {
        predBadge = `<div style="font-size:11px;color:var(--text-muted);margin-top:5px;font-style:italic">Sin pronóstico aún</div>`;
      }

      let actionArea = '';
      if (isDone) {
        actionArea = `
          <div style="text-align:center;min-width:64px">
            <div style="font-size:1.6rem;font-weight:800;color:var(--gold);line-height:1">${m.home_score} - ${m.away_score}</div>
            <div style="font-size:9px;color:var(--text-muted);letter-spacing:1px;margin-top:2px">FINAL</div>
          </div>`;
      } else if (isOpen) {
        actionArea = `<a class="btn btn-sm px-3" href="predict.html?gid=${GROUP_ID}&mid=${m.id}"
          style="background:${myPred?'transparent':'var(--green)'};color:${myPred?'var(--green-light)':'#fff'};
                 border:1px solid var(--green);white-space:nowrap;font-size:12px;font-weight:600">
          ${myPred ? '✏️ Editar' : '⚽ Pronosticar'}
        </a>`;
      } else {
        actionArea = `<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">🔒</span>`;
      }

      const borderColor = isDone ? 'var(--gold)' : isOpen ? 'var(--green-light)' : '#475569';

      const card = document.createElement('div');
      card.className = 'mb-2';
      card.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-left:4px solid ${borderColor};border-radius:10px;padding:14px 14px 10px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">
              <span style="font-size:2.2rem;line-height:1">${m.home_flag || '⚽'}</span>
              <span style="font-size:0.78rem;color:var(--text);font-weight:600;text-align:center;line-height:1.2">${m.home_team}</span>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:0.95rem;font-weight:700;color:var(--text-muted)">vs</div>
              <div style="font-size:0.88rem;color:var(--text);font-weight:600;margin-top:4px">${fmtDate(kickoff)}</div>
              <div style="font-size:1rem;font-weight:700;color:var(--gold);margin-top:1px">${fmtTime(kickoff)}</div>
              ${m.city ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📍 ${m.city}</div>` : ''}
              ${predBadge}
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">
              <span style="font-size:2.2rem;line-height:1">${m.away_flag || '⚽'}</span>
              <span style="font-size:0.78rem;color:var(--text);font-weight:600;text-align:center;line-height:1.2">${m.away_team}</span>
            </div>
            <div style="min-width:72px;text-align:right">${actionArea}</div>
          </div>
          ${badge ? `<div style="margin-top:8px;text-align:center">${badge}</div>` : ''}
        </div>`;
      container.appendChild(card);
    });
  });
}
