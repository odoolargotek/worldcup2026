// admin-predictions.js — Registro manual de pronósticos
import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, setDoc, getDoc, query,
  orderBy, where, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ── Estado global
const state = {
  groups:   [],
  members:  [],
  matches:  [],
  existing: null,
  history:  [],
};

// ── Elementos UI
const selGroup   = document.getElementById('selGroup');
const selPlayer  = document.getElementById('selPlayer');
const selMatch   = document.getElementById('selMatch');
const scoreHome  = document.getElementById('scoreHome');
const scoreAway  = document.getElementById('scoreAway');
const homeLabel  = document.getElementById('homeLabel');
const awayLabel  = document.getElementById('awayLabel');
const btnSave    = document.getElementById('btnSave');
const saveLog    = document.getElementById('saveLog');
const previewCard= document.getElementById('previewCard');
const saveSection= document.getElementById('saveSection');
const histSection= document.getElementById('histSection');
const histList   = document.getElementById('histList');
const warnEl     = document.getElementById('existingPredWarning');

function enable(id)  { const el = document.getElementById(id); if(el){ el.style.opacity='1'; el.style.pointerEvents='all'; } }
function disable(id) { const el = document.getElementById(id); if(el){ el.style.opacity='0.4'; el.style.pointerEvents='none'; } }

/**
 * Calcula puntos. Siempre convierte a Number para evitar problemas con strings.
 */
function calcPoints(actualH, actualA, predH, predA) {
  if (predH == null || predA == null || actualH == null || actualA == null) return null;
  actualH = Number(actualH); actualA = Number(actualA);
  predH   = Number(predH);   predA   = Number(predA);
  if (predH === actualH && predA === actualA) return 6;
  const pOut = predH > predA ? 'H' : predA > predH ? 'A' : 'D';
  const aOut = actualH > actualA ? 'H' : actualA > actualH ? 'A' : 'D';
  return pOut === aOut ? 3 : 0;
}

function fmtKickoff(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-BO', { timeZone:'America/La_Paz', day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true });
}

function log(msg, color = 'var(--text-muted)') {
  saveLog.classList.add('visible');
  saveLog.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
  saveLog.scrollTop = saveLog.scrollHeight;
}

// ════════════════════════════════════════════
// PASO 1 — Cargar grupos
// ════════════════════════════════════════════
async function loadGroups() {
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('name')));
  state.groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  selGroup.innerHTML = '<option value="">— Selecciona una comparsa —</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name} (${g.code})</option>`).join('');
}

// ════════════════════════════════════════════
// PASO 2 — Cargar miembros al elegir grupo
// ════════════════════════════════════════════
selGroup.addEventListener('change', async () => {
  const gid = selGroup.value;
  disable('stepPlayer'); disable('stepMatch'); disable('stepScore');
  previewCard.classList.remove('visible');
  saveSection.style.display = 'none';
  selPlayer.innerHTML = '<option>⏳ Cargando miembros...</option>';
  selMatch.innerHTML  = '<option value="">— Primero elige un jugador —</option>';
  if (!gid) return;

  const snap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', gid)));
  const uids = snap.docs.map(d => ({ member_doc_id: d.id, ...d.data() }));

  const usersSnap = await getDocs(collection(db, 'users'));
  const usersMap  = {};
  usersSnap.forEach(d => usersMap[d.id] = d.data());

  state.members = uids.map(m => ({
    ...m,
    display_name: usersMap[m.user_uid]?.display_name || usersMap[m.user_uid]?.displayName || m.user_uid,
    email: usersMap[m.user_uid]?.email || ''
  })).sort((a,b) => a.display_name.localeCompare(b.display_name));

  selPlayer.innerHTML = '<option value="">— Selecciona un jugador —</option>' +
    state.members.map(m => `<option value="${m.user_uid}">${m.display_name} (${m.email})</option>`).join('');

  enable('stepPlayer');
});

// ════════════════════════════════════════════
// PASO 3 — Cargar partidos al elegir jugador
// ════════════════════════════════════════════
selPlayer.addEventListener('change', async () => {
  disable('stepMatch'); disable('stepScore');
  previewCard.classList.remove('visible');
  saveSection.style.display = 'none';
  selMatch.innerHTML = '<option>⏳ Cargando partidos...</option>';
  if (!selPlayer.value) return;

  if (!state.matches.length) {
    const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
    state.matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const now = new Date();
  const past   = state.matches.filter(m => { const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff); return ko <= now; }).reverse();
  const future = state.matches.filter(m => { const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff); return ko > now; });

  function matchOpt(m) {
    const ko  = fmtKickoff(m.kickoff);
    const res = m.finished ? ` [${m.home_score}-${m.away_score} FINAL]`
              : m.home_score != null ? ` [${m.home_score}-${m.away_score} ⚡EN CURSO]`
              : '';
    return `<option value="${m.id}">${m.home_flag||''}${m.home_team} vs ${m.away_team}${m.away_flag||''} — ${m.phase} · ${ko}${res}</option>`;
  }

  selMatch.innerHTML =
    '<option value="">— Selecciona un partido —</option>' +
    (past.length   ? `<optgroup label="📅 Partidos pasados">${past.map(matchOpt).join('')}</optgroup>` : '') +
    (future.length ? `<optgroup label="🔜 Próximos partidos">${future.map(matchOpt).join('')}</optgroup>` : '');

  enable('stepMatch');
});

// ════════════════════════════════════════════
// PASO 4 — Al elegir partido
// ════════════════════════════════════════════
selMatch.addEventListener('change', async () => {
  disable('stepScore');
  previewCard.classList.remove('visible');
  saveSection.style.display = 'none';
  warnEl.style.display = 'none';
  state.existing = null;
  if (!selMatch.value) return;

  const match = state.matches.find(m => m.id === selMatch.value);
  if (!match) return;

  homeLabel.textContent = (match.home_flag||'') + ' ' + match.home_team;
  awayLabel.textContent = (match.away_flag||'') + ' ' + match.away_team;

  const gid = selGroup.value;
  const uid = selPlayer.value;
  const docId = `${gid}_${uid}_${match.id}`;
  const existing = await getDoc(doc(db, 'predictions', docId));
  if (existing.exists()) {
    const d = existing.data();
    scoreHome.value = d.home_score ?? 0;
    scoreAway.value = d.away_score ?? 0;
    warnEl.style.display = 'block';
    state.existing = { id: docId, ...d };
  } else {
    scoreHome.value = 0;
    scoreAway.value = 0;
  }

  enable('stepScore');
  updatePreview();
  saveSection.style.display = 'block';
});

// ════════════════════════════════════════════
// Preview en tiempo real
// ════════════════════════════════════════════
[scoreHome, scoreAway].forEach(el => el.addEventListener('input', updatePreview));

function updatePreview() {
  const gid   = selGroup.value;
  const uid   = selPlayer.value;
  const mid   = selMatch.value;
  if (!gid || !uid || !mid) return;

  const group  = state.groups.find(g => g.id === gid);
  const member = state.members.find(m => m.user_uid === uid);
  const match  = state.matches.find(m => m.id === mid);
  if (!group || !member || !match) return;

  const ph = parseInt(scoreHome.value);
  const pa = parseInt(scoreAway.value);
  const ah = match.home_score != null ? Number(match.home_score) : null;
  const aa = match.away_score != null ? Number(match.away_score) : null;
  const isFinished = match.finished === true;
  const inProgress = !isFinished && ah != null;

  let pts, ptsBadge;
  if (isFinished && ah != null) {
    pts = calcPoints(ah, aa, ph, pa);
    const cls = pts === 6 ? 'pts-6' : pts === 3 ? 'pts-3' : 'pts-0';
    ptsBadge = `<span class="pts-badge ${cls}">${pts} pts (final)</span>`;
  } else if (inProgress) {
    pts = calcPoints(ah, aa, ph, pa);
    const cls = pts === 6 ? 'pts-6' : pts === 3 ? 'pts-3' : 'pts-0';
    ptsBadge = `<span class="pts-badge ${cls}">${pts} pts proyectados ⚡</span>`;
  } else {
    ptsBadge = '<span class="pts-badge pts-pending">Pendiente (partido no iniciado)</span>';
    pts = null;
  }

  document.getElementById('pvGroup').textContent   = group.name;
  document.getElementById('pvPlayer').textContent  = member.display_name;
  document.getElementById('pvMatch').textContent   = `${match.home_flag||''}${match.home_team} vs ${match.away_team}${match.away_flag||''} — ${match.phase}`;
  document.getElementById('pvScore').textContent   = `${ph} - ${pa}`;
  document.getElementById('pvResult').textContent  = isFinished
    ? `${ah} - ${aa} FINAL`
    : inProgress ? `${ah} - ${aa} ⚡ EN CURSO`
    : 'Sin resultado aún';
  document.getElementById('pvPoints').innerHTML    = ptsBadge;

  previewCard.classList.add('visible');
}

// ════════════════════════════════════════════
// GUARDAR
// ════════════════════════════════════════════
btnSave.addEventListener('click', async () => {
  const gid = selGroup.value;
  const uid = selPlayer.value;
  const mid = selMatch.value;
  if (!gid || !uid || !mid) return;

  const group  = state.groups.find(g => g.id === gid);
  const member = state.members.find(m => m.user_uid === uid);
  const match  = state.matches.find(m => m.id === mid);
  const ph = parseInt(scoreHome.value);
  const pa = parseInt(scoreAway.value);

  if (isNaN(ph) || isNaN(pa)) {
    log('❌ Ingresa el marcador completo', '#f5a0ac');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = '⏳ Guardando...';
  saveLog.innerHTML = '';
  saveLog.classList.add('visible');

  try {
    const ah = match.home_score != null ? Number(match.home_score) : null;
    const aa = match.away_score != null ? Number(match.away_score) : null;
    const isFinished = match.finished === true;

    // puntos: solo calcular si el partido ya cerró; si está en curso o es futuro = null
    const pts = (isFinished && ah != null && aa != null)
      ? calcPoints(ah, aa, ph, pa)
      : null;

    const docId = `${gid}_${uid}_${mid}`;

    const customDateVal = document.getElementById('customDate').value;
    const createdAt = customDateVal ? Timestamp.fromDate(new Date(customDateVal)) : Timestamp.now();

    const payload = {
      group_id:      gid,
      match_id:      mid,
      user_uid:      uid,
      home_score:    ph,
      away_score:    pa,
      points:        pts,
      points_synced: isFinished,
      admin_note:    `Registro manual — ${new Date().toISOString()}`,
      created_at:    createdAt,
      updated_at:    Timestamp.now(),
    };

    await setDoc(doc(db, 'predictions', docId), payload);

    const ptsLabel = pts !== null ? `${pts} pts` : 'pendiente';
    log(`✅ Pronóstico guardado`, '#34d399');
    log(`   👤 ${member.display_name}`);
    log(`   ⚽ ${match.home_team} ${ph} - ${pa} ${match.away_team}`);
    log(`   🏅 Puntos: ${ptsLabel}`);
    log(`   🔑 Doc ID: ${docId}`, '#94a3b8');

    state.history.unshift({
      group: group.name,
      player: member.display_name,
      match: `${match.home_team} vs ${match.away_team}`,
      score: `${ph}-${pa}`,
      pts,
      docId,
      time: new Date().toLocaleTimeString('es-BO')
    });
    renderHistory();

    scoreHome.value = 0;
    scoreAway.value = 0;
    warnEl.style.display = 'none';
    state.existing = null;
    updatePreview();

    const viewSection = document.getElementById('futurePredSection');
    if (viewSection && viewSection.style.display !== 'none') loadFuturePredictions();
    const liveSection = document.getElementById('livePredSection');
    if (liveSection && liveSection.style.display !== 'none') loadLivePredictions();

  } catch(e) {
    log(`❌ Error: ${e.message}`, '#f5a0ac');
  }

  btnSave.disabled = false;
  btnSave.textContent = '💾 Guardar pronóstico';
});

// ════════════════════════════════════════════
// HISTORIAL DE SESIÓN
// ════════════════════════════════════════════
function renderHistory() {
  if (!state.history.length) return;
  histSection.style.display = 'block';
  histList.innerHTML = state.history.map(h => {
    const ptsCls  = h.pts === 6 ? '#f5a623' : h.pts === 3 ? '#34d399' : '#94a3b8';
    const ptsLabel = h.pts !== null ? `${h.pts} pts` : 'pendiente';
    return `<div class="hist-row">
      <span style="color:var(--text-muted);font-size:11px">${h.time}</span>
      <span style="font-weight:700">${h.player}</span>
      <span style="color:var(--text-muted)">·</span>
      <span>${h.match}</span>
      <span style="color:#4aafd4;font-weight:700">${h.score}</span>
      <span class="pts-badge" style="background:rgba(0,0,0,0.2);color:${ptsCls}">${ptsLabel}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// PRONÓSTICOS EN CURSO
// Partidos con kickoff pasado pero sin finished:true
// ════════════════════════════════════════════

let liveAllUsers   = null;
let liveAllGroups  = null;
let liveAllMembers = null;
let liveGroupFilter = 'all';

async function loadLivePredictions() {
  const container = document.getElementById('livePredContent');
  container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:30px">⏳ Cargando…</div>';

  const [matchSnap, predSnap, userSnap, groupSnap, memberSnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), orderBy('kickoff'))),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'groups')),
    getDocs(collection(db, 'group_members')),
  ]);

  const now     = new Date();
  const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const preds   = predSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  liveAllUsers   = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  liveAllGroups  = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  liveAllMembers = memberSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const userMap  = {}; liveAllUsers.forEach(u => { userMap[u.id] = u.display_name || u.displayName || u.email || u.id; });
  const groupMap = {}; liveAllGroups.forEach(g => { groupMap[g.id] = g.name; });

  // Partidos en curso: kickoff ya pasó y NO está marcado como finished
  const live = matches.filter(m => {
    const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    return ko <= now && m.finished !== true;
  });

  if (!live.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:8px">🏁</div>
        <div style="font-weight:700">No hay partidos en curso ahora mismo</div>
        <div style="font-size:12px;margin-top:4px">Todos los partidos pasados están marcados como finalizados.</div>
      </div>`;
    return;
  }

  // Tabs de comparsa
  const groupTabsEl = document.getElementById('liveGroupTabs');
  const activeGroups = [...new Set(liveAllMembers.map(m => m.group_id))]
    .map(gid => ({ id: gid, name: groupMap[gid] || gid }))
    .sort((a,b) => a.name.localeCompare(b.name));

  groupTabsEl.innerHTML =
    `<button class="lp-tab ${liveGroupFilter==='all'?'active':''}" data-gid="all">Todas las comparsas</button>` +
    activeGroups.map(g =>
      `<button class="lp-tab ${liveGroupFilter===g.id?'active':''}" data-gid="${g.id}">${g.name}</button>`
    ).join('');

  groupTabsEl.querySelectorAll('.lp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      groupTabsEl.querySelectorAll('.lp-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      liveGroupFilter = btn.dataset.gid;
      renderLiveTable(live, preds, userMap, groupMap);
    });
  });

  renderLiveTable(live, preds, userMap, groupMap);
}

function renderLiveTable(live, preds, userMap, groupMap) {
  const container = document.getElementById('livePredContent');

  const filteredMembers = liveGroupFilter === 'all'
    ? liveAllMembers
    : liveAllMembers.filter(m => m.group_id === liveGroupFilter);

  const uidSet  = [...new Set(filteredMembers.map(m => m.user_uid))];
  const players = uidSet
    .map(uid => ({ uid, name: userMap[uid] || uid }))
    .sort((a,b) => a.name.localeCompare(b.name));

  if (!players.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Sin jugadores en esta comparsa.</p>';
    return;
  }

  const predMap = {};
  preds.forEach(p => { predMap[`${p.match_id}_${p.user_uid}`] = p; });

  let html = '';

  live.forEach(m => {
    const ko = fmtKickoff(m.kickoff);
    const hasScore = m.home_score != null && m.away_score != null;
    const ah = hasScore ? Number(m.home_score) : null;
    const aa = hasScore ? Number(m.away_score) : null;

    const withPred = players.filter(p => predMap[`${m.id}_${p.uid}`]).length;
    const pct = players.length ? Math.round((withPred / players.length) * 100) : 0;
    const pctClr = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171';

    // Proyección de puntos si hay marcador parcial
    let projStats = null;
    if (hasScore) {
      let exact=0, winner=0, miss=0;
      players.forEach(p => {
        const pred = predMap[`${m.id}_${p.uid}`];
        if (!pred) return;
        const pts = calcPoints(ah, aa, pred.home_score, pred.away_score);
        if (pts === 6) exact++;
        else if (pts === 3) winner++;
        else miss++;
      });
      projStats = { exact, winner, miss };
    }

    html += `
    <div style="background:rgba(52,211,153,0.04);border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:14px 16px;margin-bottom:14px">

      <!-- Cabecera -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:800;font-size:0.95rem">
            ${m.home_flag||''}${m.home_team}
            ${hasScore
              ? `<span style="color:#f1f5f9;font-size:1.1rem;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);padding:2px 10px;border-radius:8px;margin:0 6px">${ah} – ${aa}</span>`
              : `<span style="color:var(--text-muted);font-size:0.85rem;margin:0 6px">vs</span>`
            }
            ${m.away_team}${m.away_flag||''}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
            📅 ${ko} &nbsp;·&nbsp; ${m.phase}${m.city ? ' &nbsp;·&nbsp; 📍 '+m.city : ''}
          </div>
        </div>

        <!-- Badge estado -->
        <span style="background:rgba(52,211,153,0.12);color:#34d399;border:1px solid rgba(52,211,153,0.3);border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">
          <span class="dot-live"></span>${hasScore ? '⚡ EN CURSO' : '⏳ INICIADO'}
        </span>

        <!-- Cobertura -->
        <div style="text-align:right;min-width:90px">
          <div style="font-size:12px;font-weight:800;color:${pctClr}">${withPred}/${players.length} pron. (${pct}%)</div>
          <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:5px;margin-top:3px">
            <div style="height:5px;background:${pctClr};border-radius:5px;width:${pct}%"></div>
          </div>
        </div>
      </div>

      <!-- Proyección si hay marcador parcial -->
      ${hasScore && projStats ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:12px">
        <span style="color:var(--text-muted)">Proyección con ${ah}–${aa}:</span>
        <span style="color:#f59e0b;font-weight:700">🟡 ${projStats.exact} exactos</span>
        <span style="color:#34d399;font-weight:700">🟢 ${projStats.winner} ganador</span>
        <span style="color:#f87171;font-weight:700">🔴 ${projStats.miss} fallan</span>
      </div>` : !hasScore ? `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;font-style:italic">
        Sin marcador parcial registrado — no se pueden proyectar puntos todavía.
      </div>` : ''}

      <!-- Tarjetas de jugadores -->
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${players.map(p => {
          const pred = predMap[`${m.id}_${p.uid}`];
          if (pred) {
            const ph2 = Number(pred.home_score);
            const pa2 = Number(pred.away_score);
            let ptsBadgeHtml = '';
            if (hasScore) {
              const pts = calcPoints(ah, aa, ph2, pa2);
              const cls = pts === 6 ? '#f59e0b' : pts === 3 ? '#34d399' : '#94a3b8';
              const ic  = pts === 6 ? '🟡' : pts === 3 ? '🟢' : '🔴';
              ptsBadgeHtml = `<span style="font-size:11px;font-weight:800;color:${cls};margin-left:4px">${ic} ${pts}pts proy.</span>`;
            }
            const playerGroups = liveAllMembers
              .filter(mb => mb.user_uid === p.uid)
              .map(mb => groupMap[mb.group_id] || mb.group_id)
              .join(', ');
            return `
            <div style="background:rgba(52,211,153,0.07);border:1px solid rgba(52,211,153,0.2);border-radius:8px;padding:7px 12px;font-size:12px">
              <div style="font-weight:700;color:#f1f5f9">${p.name}</div>
              <div style="font-size:1rem;font-weight:800;color:#34d399;margin:2px 0">${ph2} – ${pa2}${ptsBadgeHtml}</div>
              ${liveGroupFilter === 'all' ? `<div style="font-size:10px;color:var(--text-muted)">${playerGroups}</div>` : ''}
            </div>`;
          } else {
            return `
            <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:7px 12px;font-size:12px;opacity:0.7">
              <div style="font-weight:700;color:var(--text-muted)">${p.name}</div>
              <div style="font-size:11px;color:#f87171;margin-top:2px">∅ sin pronóstico</div>
            </div>`;
          }
        }).join('')}
      </div>
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--text-muted)">Sin datos.</p>';
}

// Botón toggle en curso
const btnToggleLive = document.getElementById('btnToggleLive');
const livePredSection = document.getElementById('livePredSection');
btnToggleLive.addEventListener('click', () => {
  const hidden = livePredSection.style.display === 'none' || livePredSection.style.display === '';
  livePredSection.style.display = hidden ? 'block' : 'none';
  btnToggleLive.innerHTML = hidden
    ? '<span class="dot-live"></span>Ocultar partidos en curso'
    : '<span class="dot-live"></span>Ver partidos en curso';
  if (hidden) loadLivePredictions();
});
document.getElementById('btnRefreshLive').addEventListener('click', loadLivePredictions);

// ════════════════════════════════════════════
// PRONÓSTICOS FUTUROS
// ════════════════════════════════════════════

let allUsers   = null;
let allGroups  = null;
let allMembers = null;
let futureGroupFilter = 'all';

async function loadFuturePredictions() {
  const container = document.getElementById('futurePredContent');
  container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:30px">⏳ Cargando…</div>';

  const [matchSnap, predSnap, userSnap, groupSnap, memberSnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), orderBy('kickoff'))),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'groups')),
    getDocs(collection(db, 'group_members')),
  ]);

  const now     = new Date();
  const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const preds   = predSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allUsers      = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allGroups     = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allMembers    = memberSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const userMap  = {}; allUsers.forEach(u => { userMap[u.id] = u.display_name || u.displayName || u.email || u.id; });
  const groupMap = {}; allGroups.forEach(g => { groupMap[g.id] = g.name; });

  const future = matches.filter(m => {
    const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    return ko > now;
  });

  if (!future.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px">No hay partidos futuros.</p>';
    return;
  }

  const groupTabsEl = document.getElementById('futureGroupTabs');
  const activeGroups = [...new Set(allMembers.map(m => m.group_id))]
    .map(gid => ({ id: gid, name: groupMap[gid] || gid }))
    .sort((a,b) => a.name.localeCompare(b.name));

  groupTabsEl.innerHTML =
    `<button class="fp-tab ${futureGroupFilter==='all'?'active':''}" data-gid="all">Todas las comparsas</button>` +
    activeGroups.map(g =>
      `<button class="fp-tab ${futureGroupFilter===g.id?'active':''}" data-gid="${g.id}">${g.name}</button>`
    ).join('');

  groupTabsEl.querySelectorAll('.fp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      groupTabsEl.querySelectorAll('.fp-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      futureGroupFilter = btn.dataset.gid;
      renderFutureTable(future, preds, userMap, groupMap);
    });
  });

  renderFutureTable(future, preds, userMap, groupMap);
}

function renderFutureTable(future, preds, userMap, groupMap) {
  const container = document.getElementById('futurePredContent');

  const filteredMembers = futureGroupFilter === 'all'
    ? allMembers
    : allMembers.filter(m => m.group_id === futureGroupFilter);

  const uidSet  = [...new Set(filteredMembers.map(m => m.user_uid))];
  const players = uidSet
    .map(uid => ({ uid, name: userMap[uid] || uid }))
    .sort((a,b) => a.name.localeCompare(b.name));

  if (!players.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Sin jugadores en esta comparsa.</p>';
    return;
  }

  const predMap = {};
  preds.forEach(p => { predMap[`${p.match_id}_${p.user_uid}`] = p; });

  let html = '';

  future.forEach(m => {
    const ko = fmtKickoff(m.kickoff);
    const withPred = players.filter(p => predMap[`${m.id}_${p.uid}`]).length;
    const pct = players.length ? Math.round((withPred / players.length) * 100) : 0;
    const pctColor = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171';

    html += `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:800;font-size:0.95rem">
            ${m.home_flag||''}${m.home_team}
            <span style="color:var(--text-muted);font-size:0.85rem;margin:0 6px">vs</span>
            ${m.away_team}${m.away_flag||''}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
            📅 ${ko} &nbsp;·&nbsp; ${m.phase}${m.city ? ' &nbsp;·&nbsp; 📍 '+m.city : ''}
          </div>
        </div>
        <span style="background:rgba(167,139,250,0.12);color:#a78bfa;border:1px solid rgba(167,139,250,0.3);border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">⏰ A FUTURO</span>
        <div style="text-align:right;min-width:90px">
          <div style="font-size:12px;font-weight:800;color:${pctColor}">${withPred}/${players.length} pron. (${pct}%)</div>
          <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:5px;margin-top:3px">
            <div style="height:5px;background:${pctColor};border-radius:5px;width:${pct}%"></div>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${players.map(p => {
          const pred = predMap[`${m.id}_${p.uid}`];
          if (pred) {
            const playerGroups = allMembers
              .filter(mb => mb.user_uid === p.uid)
              .map(mb => groupMap[mb.group_id] || mb.group_id)
              .join(', ');
            return `
            <div style="background:rgba(74,175,212,0.08);border:1px solid rgba(74,175,212,0.25);border-radius:8px;padding:7px 12px;font-size:12px">
              <div style="font-weight:700;color:#f1f5f9">${p.name}</div>
              <div style="font-size:1rem;font-weight:800;color:#4aafd4;margin:2px 0">${pred.home_score} – ${pred.away_score}</div>
              ${futureGroupFilter === 'all' ? `<div style="font-size:10px;color:var(--text-muted)">${playerGroups}</div>` : ''}
            </div>`;
          } else {
            return `
            <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:7px 12px;font-size:12px;opacity:0.7">
              <div style="font-weight:700;color:var(--text-muted)">${p.name}</div>
              <div style="font-size:11px;color:#f87171;margin-top:2px">∅ sin pronóstico</div>
            </div>`;
          }
        }).join('')}
      </div>
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--text-muted)">Sin pronósticos aún.</p>';
}

const btnToggleFuture = document.getElementById('btnToggleFuture');
const futurePredSection = document.getElementById('futurePredSection');
btnToggleFuture.addEventListener('click', () => {
  const hidden = futurePredSection.style.display === 'none' || futurePredSection.style.display === '';
  futurePredSection.style.display = hidden ? 'block' : 'none';
  btnToggleFuture.textContent = hidden ? '👁️ Ocultar pronósticos futuros' : '🔮 Ver pronósticos futuros';
  if (hidden) loadFuturePredictions();
});

// ── Init
loadGroups();
