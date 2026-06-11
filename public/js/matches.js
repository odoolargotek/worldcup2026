// matches.js — Partidos agrupados por FECHA (no por grupo) para facilitar pronósticos diarios
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, onSnapshot, getDocs, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { fmtTime } from './time.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');
const TZ       = 'America/La_Paz';

let myPreds = {};
let unsub   = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const predsSnap = await getDocs(
    query(collection(db, 'predictions'),
      where('group_id', '==', GROUP_ID),
      where('user_uid',  '==', user.uid)
    )
  );
  predsSnap.forEach(d => { myPreds[d.data().match_id] = d.data(); });

  if (unsub) unsub();
  unsub = onSnapshot(
    query(collection(db, 'matches'), orderBy('kickoff')),
    (snap) => renderMatches(snap),
    (err)  => console.error('[matches] onSnapshot error:', err)
  );
});

// ── Helpers de fecha ────────────────────────────────────────────────────────

function toLocalDateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function todayKey()    { return toLocalDateKey(new Date()); }
function tomorrowKey() {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return toLocalDateKey(t);
}

function dateLabel(key) {
  const tk = todayKey();
  const mk = tomorrowKey();
  if (key === tk) return { text: 'Hoy', color: '#34d399', emoji: '📅' };
  if (key === mk) return { text: 'Mañana', color: '#4aafd4', emoji: '📅' };
  const [y, m, d] = key.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12);
  const label   = dateObj.toLocaleDateString('es-BO', { weekday:'short', day:'2-digit', month:'short' });
  return { text: label, color: 'var(--gold)', emoji: '📆' };
}

// ── Badge de urgencia ────────────────────────────────────────────────────────

function deadlineBadge(kickoff, isFinal, hasScore, hasMyPred) {
  if (isFinal) return '';
  const now      = new Date();
  const diffMs   = kickoff - now;
  const diffHrs  = diffMs / 36e5;
  const diffMins = diffMs / 60000;

  // Partido en curso (kickoff pasó pero no cerrado aún)
  if (diffMs <= 0 && hasScore && !isFinal) {
    return `<span style="background:rgba(239,68,68,0.25);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;animation:pulse 1s infinite">🔴 EN VIVO</span>`;
  }

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
    const hrs       = Math.floor(diffHrs);
    const color     = hasMyPred ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.2)';
    const textColor = hasMyPred ? 'var(--green-light)'   : 'var(--gold)';
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

// ── Render principal ─────────────────────────────────────────────────────────

function renderMatches(snap) {
  const container = document.getElementById('matchList');
  if (!container) return;
  const now = new Date();

  const byDate = {};
  snap.forEach(d => {
    const m       = d.data();
    const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    const key     = toLocalDateKey(kickoff);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push({ id: d.id, ...m, _kickoff: kickoff });
  });

  container.innerHTML = '';

  const tk = todayKey();
  const sortedKeys = Object.keys(byDate).sort();

  sortedKeys.forEach(key => {
    const matches = byDate[key].sort((a, b) => a._kickoff - b._kickoff);
    const lbl     = dateLabel(key);
    const isToday = key === tk;

    // isDone = tiene score Y está cerrado (finished: true)
    const open    = matches.filter(m => {
      const isFinal = m.finished === true;
      return !isFinal && m._kickoff > now;
    });
    const pending = open.filter(m => !myPreds[m.id]).length;

    let alertChip = '';
    if (isToday && pending > 0) {
      alertChip = `<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:8px">⚠️ ${pending} sin pronosticar</span>`;
    } else if (isToday && open.length > 0 && pending === 0) {
      alertChip = `<span style="background:rgba(34,197,94,0.15);color:#34d399;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:8px">✅ Todo pronosticado</span>`;
    }

    const header = document.createElement('div');
    header.className = 'mb-2 mt-4';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <div style="display:flex;align-items:center;gap:4px;white-space:nowrap">
          <span style="color:${lbl.color};font-size:0.85rem;font-weight:800;text-transform:capitalize;letter-spacing:1px">
            ${lbl.emoji} ${lbl.text}
          </span>
          <span style="color:var(--text-muted);font-size:0.75rem;font-weight:500">
            · ${matches.length} partido${matches.length > 1 ? 's' : ''}
          </span>
          ${alertChip}
        </div>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    container.appendChild(header);

    matches.forEach(m => {
      const kickoff  = m._kickoff;
      // isFinal: partido cerrado definitivamente
      const isFinal  = m.finished === true;
      // hasScore: tiene marcador cargado (parcial o final)
      const hasScore = m.home_score !== undefined && m.home_score !== null;
      // isLive: kickoff pasó, tiene score pero no está cerrado
      const isLive   = !isFinal && hasScore && kickoff <= now;
      // isOpen: aún puede pronosticarse
      const isOpen   = !isFinal && !hasScore && kickoff > now;

      const myPred  = myPreds[m.id];
      const badge   = deadlineBadge(kickoff, isFinal, hasScore, !!myPred);

      const phaseChip = m.phase
        ? `<span style="background:rgba(245,158,11,0.12);color:var(--gold);font-size:9px;font-weight:700;padding:1px 7px;border-radius:20px;letter-spacing:1px">${m.phase}</span>`
        : '';

      // FIX: usa pred_home / pred_away (no home_score / away_score)
      let predBadge = '';
      if (myPred) {
        const pts = myPred.points !== undefined
          ? `<span style="color:var(--gold);font-weight:700"> +${myPred.points}pts</span>` : '';
        predBadge = `<div style="font-size:12px;color:var(--text-muted);margin-top:5px">🔮 <strong style="color:var(--text)">${myPred.pred_home} - ${myPred.pred_away}</strong>${pts}</div>`;
      } else if (isOpen) {
        predBadge = `<div style="font-size:11px;color:var(--text-muted);margin-top:5px;font-style:italic">Sin pronóstico aún</div>`;
      }

      let actionArea = '';
      if (isFinal) {
        // Partido cerrado: muestra score final
        actionArea = `
          <div style="text-align:center;min-width:64px">
            <div style="font-size:1.6rem;font-weight:800;color:var(--gold);line-height:1">${m.home_score} - ${m.away_score}</div>
            <div style="font-size:9px;color:var(--text-muted);letter-spacing:1px;margin-top:2px">FINAL</div>
          </div>`;
      } else if (isLive) {
        // Partido en curso: muestra score con badge EN VIVO
        actionArea = `
          <div style="text-align:center;min-width:64px">
            <div style="font-size:1.6rem;font-weight:800;color:#34d399;line-height:1">${m.home_score} - ${m.away_score}</div>
            <div style="font-size:9px;color:#34d399;letter-spacing:1px;margin-top:2px;animation:pulse 1s infinite">EN VIVO</div>
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

      const borderColor = isFinal ? 'var(--gold)' : isLive ? '#34d399' : isOpen ? 'var(--green-light)' : '#475569';

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
              <div style="font-size:1rem;font-weight:700;color:var(--gold);margin-top:4px">${fmtTime(kickoff)}</div>
              ${m.city ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📍 ${m.city}</div>` : ''}
              ${phaseChip ? `<div style="margin-top:5px">${phaseChip}</div>` : ''}
              ${predBadge}
            </div>
            <div style=