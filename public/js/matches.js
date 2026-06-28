// matches.js — Partidos agrupados por FECHA, filtrados por group.stage
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, onSnapshot, getDocs, getDoc, doc, query, orderBy, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { fmtTime } from './time.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');
const TZ       = 'America/La_Paz';

let myPreds      = {};
let unsub        = null;
let activeFilter = 'all';
let groupStage   = null;
let _snapCache   = null;

function isGroupPhase(phase) {
  if (!phase) return true;
  const s = String(phase).trim().toLowerCase();
  return s.startsWith('grupo') || s === 'fase_grupos' || s === 'fase de grupos' || s === 'grupos';
}

function groupIsGroupStage() {
  if (!groupStage) return true;
  const s = String(groupStage).trim().toLowerCase();
  return s === 'fase_grupos' || s === '' || s === 'fase de grupos' || s === 'grupos';
}

function matchBelongsToGroup(m) {
  const matchIsGroup = isGroupPhase(m.phase);
  const gIsGroup     = groupIsGroupStage();
  return matchIsGroup === gIsGroup;
}

// ── Helper: armar badge de score final (ET/penales) ──────────────────────
function finalScoreBadge(m) {
  const hasET  = m.et_home_score != null && m.et_away_score != null;
  const hasPen = m.pen_home_score != null && m.pen_away_score != null;
  if (!hasET && !hasPen) return '';
  let parts = [];
  if (hasET)  parts.push(`ET ${m.et_home_score}–${m.et_away_score}`);
  if (hasPen) parts.push(`Pen ${m.pen_home_score}–${m.pen_away_score}`);
  return `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;letter-spacing:0.3px">⏱ Final: ${parts.join(' · ')}</div>`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const predsSnap = await getDocs(
    query(collection(db, 'predictions'),
      where('group_id', '==', GROUP_ID),
      where('user_uid',  '==', user.uid)
    )
  );
  predsSnap.forEach(d => { myPreds[d.data().match_id] = d.data(); });

  if (GROUP_ID) {
    const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
    if (gSnap.exists()) groupStage = gSnap.data().stage || null;
  }

  injectFilterBar();

  if (unsub) unsub();
  unsub = onSnapshot(
    query(collection(db, 'matches'), orderBy('kickoff')),
    (snap) => {
      _snapCache = snap;
      renderMatches(snap);
    },
    (err) => console.error('[matches] onSnapshot error:', err)
  );
});

function injectFilterBar() {
  const existing = document.getElementById('matchFilterBar');
  if (existing) return;

  const bar = document.createElement('div');
  bar.id = 'matchFilterBar';
  bar.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;';
  bar.innerHTML = `
    <button class="mfbtn active" data-filter="all">📋 Todos</button>
    <button class="mfbtn" data-filter="upcoming">⏳ Próximos</button>
    <button class="mfbtn" data-filter="nopred">🎯 Sin pronóstico</button>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .mfbtn {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-muted, #94a3b8);
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .mfbtn:hover { background: rgba(255,255,255,0.08); color: var(--text, #f1f5f9); }
    .mfbtn.active { background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.5); color: #34d399; }
    .mfbtn[data-filter="upcoming"].active { background: rgba(74,175,212,0.15); border-color: rgba(74,175,212,0.5); color: #4aafd4; }
    .mfbtn[data-filter="nopred"].active { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.5); color: #f59e0b; }
    .match-empty-filter { text-align:center; padding:40px 20px; color:var(--text-muted,#94a3b8); font-size:14px; }
  `;
  document.head.appendChild(style);

  bar.querySelectorAll('.mfbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.mfbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilter();
    });
  });

  const matchList = document.getElementById('matchList');
  matchList?.parentNode.insertBefore(bar, matchList);
}

function applyFilter() {
  const container = document.getElementById('matchList');
  if (!container) return;
  const now = new Date();

  const emptyMsg = container.querySelector('.match-empty-filter');
  if (emptyMsg) emptyMsg.remove();

  let visibleTotal = 0;

  const cards = container.querySelectorAll('[data-match-id]');
  cards.forEach(card => {
    const kickoffMs = parseInt(card.dataset.kickoff);
    const hasPred   = card.dataset.haspred === '1';
    const finished  = card.dataset.finished === '1';
    const isOpen    = !finished && kickoffMs > now.getTime();

    let show = false;
    if (activeFilter === 'all')      show = true;
    if (activeFilter === 'upcoming') show = isOpen;
    if (activeFilter === 'nopred')   show = isOpen && !hasPred;

    card.style.display = show ? '' : 'none';
    if (show) visibleTotal++;
  });

  const headers = container.querySelectorAll('[data-date-header]');
  headers.forEach(header => {
    const dateKey  = header.dataset.dateHeader;
    const dayCards = container.querySelectorAll(`[data-match-id][data-date="${dateKey}"]`);
    const anyVisible = Array.from(dayCards).some(c => c.style.display !== 'none');
    header.style.display = anyVisible ? '' : 'none';
  });

  if (visibleTotal === 0) {
    const msg = document.createElement('div');
    msg.className = 'match-empty-filter';
    msg.innerHTML = activeFilter === 'upcoming' ? '⏳ No hay partidos próximos disponibles.'
                  : activeFilter === 'nopred'   ? '✅ ¡Excelente! Ya tienes todos los pronósticos cargados.'
                  : 'No hay partidos para mostrar.';
    container.appendChild(msg);
  }
}

function toLocalDateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function todayKey() { return toLocalDateKey(new Date()); }
function tomorrowKey() {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return toLocalDateKey(t);
}

function dateLabel(key) {
  const tk = todayKey();
  const mk = tomorrowKey();
  if (key === tk) return { text: 'Hoy',    color: '#34d399', emoji: '📅' };
  if (key === mk) return { text: 'Mañana', color: '#4aafd4', emoji: '📅' };
  const [y, m, d] = key.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12);
  const label   = dateObj.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' });
  return { text: label, color: 'var(--gold)', emoji: '📆' };
}

function deadlineBadge(kickoff, isFinal, hasScore, hasMyPred) {
  if (isFinal) return '';
  const now      = new Date();
  const diffMs   = kickoff - now;
  const diffHrs  = diffMs / 36e5;
  const diffMins = diffMs / 60000;

  if (diffMs <= 0 && hasScore) return '<span style="background:rgba(239,68,68,0.25);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">🔴 EN VIVO</span>';
  if (diffMs <= 0)             return '<span style="background:rgba(100,100,100,0.3);color:#94a3b8;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">🔒 Cerrado</span>';
  if (diffMins <= 60) { const mins = Math.floor(diffMins); return '<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">⏰ ¡' + mins + ' min!</span>'; }
  if (diffHrs  <=  3) { const hrs=Math.floor(diffHrs),mins=Math.floor((diffHrs-hrs)*60); return '<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">🔴 '+hrs+'h '+mins+'m restantes</span>'; }
  if (diffHrs  <= 24) { const hrs=Math.floor(diffHrs),color=hasMyPred?'rgba(34,197,94,0.15)':'rgba(245,158,11,0.2)',textColor=hasMyPred?'var(--green-light)':'var(--gold)',icon=hasMyPred?'✅':'⚠️'; return '<span style="background:'+color+';color:'+textColor+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">'+icon+' Hoy vence · '+hrs+'h</span>'; }
  const days = Math.floor(diffHrs / 24);
  if (days <= 3) return '<span style="background:rgba(59,130,246,0.15);color:#93c5fd;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap">📅 ' + days + 'd restantes</span>';
  return '';
}

function predResult(pred, match) {
  if (!pred || match.home_score === undefined || match.home_score === null) return null;
  const ph=Number(pred.home_score),pa=Number(pred.away_score),mh=Number(match.home_score),ma=Number(match.away_score);
  if (ph===mh && pa===ma) return 'exact';
  if (Math.sign(ph-pa)===Math.sign(mh-ma)) return 'winner';
  return 'miss';
}

let _badgeStyleInjected = false;
function injectBadgeStyles() {
  if (_badgeStyleInjected) return;
  _badgeStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes badge-pop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
    @keyframes badge-shine{0%,100%{box-shadow:0 0 6px rgba(251,191,36,0.4)}50%{box-shadow:0 0 18px rgba(251,191,36,0.85),0 0 32px rgba(251,191,36,0.3)}}
    .badge-exact{animation:badge-pop 0.45s cubic-bezier(.36,.07,.19,.97) both,badge-shine 2s ease-in-out 0.45s infinite}
    .badge-winner{animation:badge-pop 0.4s cubic-bezier(.36,.07,.19,.97) both}
    .badge-miss{animation:badge-pop 0.35s ease both}
  `;
  document.head.appendChild(style);
}

function resultBadge(type) {
  injectBadgeStyles();
  if (type==='exact')  return '<div class="badge-exact" style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,rgba(251,191,36,0.3),rgba(245,158,11,0.18));border:1.5px solid rgba(251,191,36,0.75);border-radius:24px;padding:5px 14px;margin-top:7px;font-size:12px;font-weight:900;color:#fbbf24;letter-spacing:0.3px">🎉 ¡Felicidades Crack! 🎯</div>';
  if (type==='winner') return '<div class="badge-winner" style="display:inline-flex;align-items:center;gap:6px;background:rgba(52,211,153,0.18);border:1.5px solid rgba(52,211,153,0.5);border-radius:24px;padding:5px 14px;margin-top:7px;font-size:12px;font-weight:800;color:#34d399">⚽️ ¡Le atinaste al ganador!</div>';
  if (type==='miss')   return '<div class="badge-miss" style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:24px;padding:4px 12px;margin-top:7px;font-size:11px;font-weight:600;color:#f87171">💔 Esta vez no fue… ¡ánimo!</div>';
  return '';
}

function renderMatches(snap) {
  const container = document.getElementById('matchList');
  if (!container) return;
  const now = new Date();

  const byDate = {};
  snap.forEach(d => {
    const m = d.data();
    if (!matchBelongsToGroup(m)) return;
    const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    const key     = toLocalDateKey(kickoff);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push({ id: d.id, ...m, _kickoff: kickoff });
  });

  container.innerHTML = '';

  if (Object.keys(byDate).length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><div style="font-size:3rem;margin-bottom:12px">⚽</div><div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:6px">No hay partidos disponibles</div><div style="font-size:0.85rem">Los partidos aparecerán aquí en cuanto estén cargados.</div></div>`;
    return;
  }

  const tk = todayKey();
  Object.keys(byDate).sort().forEach(function(key) {
    const matches = byDate[key].sort((a,b) => a._kickoff - b._kickoff);
    const lbl     = dateLabel(key);
    const isToday = key === tk;
    const open    = matches.filter(m => !m.finished && m._kickoff > now);
    const pending = open.filter(m => !myPreds[m.id]).length;

    let alertChip = '';
    if (isToday && pending > 0)                      alertChip = '<span style="background:rgba(239,68,68,0.2);color:#fca5a5;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:8px">⚠️ '+pending+' sin pronosticar</span>';
    else if (isToday && open.length > 0 && !pending) alertChip = '<span style="background:rgba(34,197,94,0.15);color:#34d399;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:8px">✅ Todo pronosticado</span>';

    const header = document.createElement('div');
    header.className = 'mb-2 mt-4';
    header.dataset.dateHeader = key;
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<div style="flex:1;height:1px;background:var(--border)"></div>'+
        '<div style="display:flex;align-items:center;gap:4px;white-space:nowrap">'+
          '<span style="color:'+lbl.color+';font-size:0.85rem;font-weight:800;text-transform:capitalize;letter-spacing:1px">'+lbl.emoji+' '+lbl.text+'</span>'+
          '<span style="color:var(--text-muted);font-size:0.75rem;font-weight:500"> · '+matches.length+' partido'+(matches.length>1?'s':'')+alertChip+'</span>'+
        '</div>'+
        '<div style="flex:1;height:1px;background:var(--border)"></div>'+
      '</div>';
    container.appendChild(header);

    matches.forEach(function(m) {
      const kickoff  = m._kickoff;
      const isFinal  = m.finished === true;
      const hasScore = m.home_score !== undefined && m.home_score !== null;
      const isLive   = !isFinal && hasScore && kickoff <= now;
      const isOpen   = !isFinal && !hasScore && kickoff > now;
      const myPred   = myPreds[m.id];
      const badge    = deadlineBadge(kickoff, isFinal, hasScore, !!myPred);
      const phaseChip = m.phase ? '<span style="background:rgba(245,158,11,0.12);color:var(--gold);font-size:9px;font-weight:700;padding:1px 7px;border-radius:20px;letter-spacing:1px">'+m.phase+'</span>' : '';

      // Score 90' + badge score final (ET/pen)
      const score90 = hasScore ? (m.home_score + ' – ' + m.away_score) : null;
      const scoreFinalBadge = isFinal ? finalScoreBadge(m) : '';

      let predBadge = '';
      if (myPred) {
        const pts = myPred.points !== undefined ? '<span style="color:var(--gold);font-weight:700"> +'+myPred.points+'pts</span>' : '';
        predBadge = '<div style="font-size:12px;color:var(--text-muted);margin-top:5px">🔮 <strong style="color:var(--text)">'+myPred.home_score+' – '+myPred.away_score+'</strong>'+pts+'</div>';
        if (isFinal) { const rType=predResult(myPred,m); if(rType) predBadge+=resultBadge(rType); }
      } else if (isOpen) {
        predBadge = '<div style="font-size:11px;color:var(--text-muted);margin-top:5px;font-style:italic">Sin pronóstico aún</div>';
      }

      let actionArea = '';
      if (isFinal) {
        actionArea =
          '<div style="text-align:center;min-width:64px">'+
            '<div style="font-size:1.4rem;font-weight:800;color:var(--gold);line-height:1">'+(score90||'–')+'</div>'+
            '<div style="font-size:9px;color:var(--text-muted);letter-spacing:1px;margin-top:2px">90\' FINAL</div>'+
            scoreFinalBadge+
          '</div>';
      } else if (isLive) {
        actionArea =
          '<div style="text-align:center;min-width:64px">'+
            '<div style="font-size:1.4rem;font-weight:800;color:#34d399;line-height:1">'+(score90||'–')+'</div>'+
            '<div style="font-size:9px;color:#34d399;letter-spacing:1px;margin-top:2px">EN VIVO</div>'+
          '</div>';
      } else if (isOpen) {
        const btnBg=myPred?'transparent':'var(--green)',btnColor=myPred?'var(--green-light)':'#fff',btnLabel=myPred?'✏️ Editar':'⚽ Pronosticar';
        actionArea = '<a class="btn btn-sm px-3" href="predict.html?gid='+GROUP_ID+'&mid='+m.id+'" style="background:'+btnBg+';color:'+btnColor+';border:1px solid var(--green);white-space:nowrap;font-size:12px;font-weight:600">'+btnLabel+'</a>';
      } else {
        actionArea = '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">🔒</span>';
      }

      const rType = isFinal && myPred ? predResult(myPred,m) : null;
      const borderColor = rType==='exact'?'#fbbf24':rType==='winner'?'#34d399':isFinal?'var(--gold)':isLive?'#34d399':isOpen?'var(--green-light)':'#475569';

      const card = document.createElement('div');
      card.className = 'mb-2';
      card.dataset.matchId  = m.id;
      card.dataset.date     = key;
      card.dataset.kickoff  = kickoff.getTime();
      card.dataset.finished = isFinal ? '1' : '0';
      card.dataset.haspred  = myPred  ? '1' : '0';

      card.innerHTML =
        '<div style="background:var(--bg-card);border:1px solid var(--border);border-left:4px solid '+borderColor+';border-radius:10px;padding:14px 14px 10px">'+
          '<div style="display:flex;align-items:center;gap:8px">'+
            '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">'+
              '<span style="font-size:2.2rem;line-height:1">'+(m.home_flag||'⚽')+'</span>'+
              '<span style="font-size:0.78rem;color:var(--text);font-weight:600;text-align:center;line-height:1.2">'+m.home_team+'</span>'+
            '</div>'+
            '<div style="flex:1;text-align:center">'+
              '<div style="font-size:0.95rem;font-weight:700;color:var(--text-muted)">vs</div>'+
              '<div style="font-size:1rem;font-weight:700;color:var(--gold);margin-top:4px">'+fmtTime(kickoff)+'</div>'+
              (m.city?'<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📍 '+m.city+'</div>':'')+
              (phaseChip?'<div style="margin-top:5px">'+phaseChip+'</div>':'')+
              predBadge+
            '</div>'+
            '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">'+
              '<span style="font-size:2.2rem;line-height:1">'+(m.away_flag||'⚽')+'</span>'+
              '<span style="font-size:0.78rem;color:var(--text);font-weight:600;text-align:center;line-height:1.2">'+m.away_team+'</span>'+
            '</div>'+
            '<div style="min-width:72px;text-align:right">'+actionArea+'</div>'+
          '</div>'+
          (badge?'<div style="margin-top:8px;text-align:center">'+badge+'</div>':'')+
        '</div>';
      container.appendChild(card);
    });
  });

  applyFilter();
}
