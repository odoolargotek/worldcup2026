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

function calcPoints(actualH, actualA, predH, predA) {
  if (predH == null || predA == null) return null;
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

// ══════════════════════════════════════════
// PASO 1 — Cargar grupos
// ══════════════════════════════════════════
async function loadGroups() {
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('name')));
  state.groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  selGroup.innerHTML = '<option value="">— Selecciona una comparsa —</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name} (${g.code})</option>`).join('');
}

// ══════════════════════════════════════════
// PASO 2 — Cargar miembros al elegir grupo
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
// PASO 3 — Cargar partidos al elegir jugador
// ══════════════════════════════════════════
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
    const res = m.finished ? ` [${m.home_score}-${m.away_score} FINAL]` : m.home_score != null ? ` [${m.home_score}-${m.away_score} en juego]` : '';
    return `<option value="${m.id}">${m.home_flag||''}${m.home_team} vs ${m.away_team}${m.away_flag||''} — ${m.phase} · ${ko}${res}</option>`;
  }

  selMatch.innerHTML =
    '<option value="">— Selecciona un partido —</option>' +
    (past.length   ? `<optgroup label="📅 Partidos pasados">${past.map(matchOpt).join('')}</optgroup>` : '') +
    (future.length ? `<optgroup label="🔜 Próximos partidos">${future.map(matchOpt).join('')}</optgroup>` : '');

  enable('stepMatch');
});

// ══════════════════════════════════════════
// PASO 4 — Al elegir partido
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
// Preview en tiempo real
// ══════════════════════════════════════════
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
  const ah = match.home_score;
  const aa = match.away_score;
  const isFinished = match.finished === true;

  let pts, ptsBadge;
  if (isFinished && ah != null) {
    pts = calcPoints(ah, aa, ph, pa);
    const cls = pts === 6 ? 'pts-6' : pts === 3 ? 'pts-3' : 'pts-0';
    ptsBadge = `<span class="pts-badge ${cls}">${pts} pts</span>`;
  } else {
    ptsBadge = '<span class="pts-badge pts-pending">Pendiente (partido no cerrado)</span>';
    pts = null;
  }

  document.getElementById('pvGroup').textContent   = group.name;
  document.getElementById('pvPlayer').textContent  = member.display_name;
  document.getElementById('pvMatch').textContent   = `${match.home_flag||''}${match.home_team} vs ${match.away_team}${match.away_flag||''} — ${match.phase}`;
  document.getElementById('pvScore').textContent   = `${ph} - ${pa}`;
  document.getElementById('pvResult').textContent  = isFinished ? `${ah} - ${aa} FINAL` : match.home_score != null ? `${ah} - ${aa} en juego` : 'Sin resultado aún';
  document.getElementById('pvPoints').innerHTML    = ptsBadge;

  previewCard.classList.add('visible');
}

// ══════════════════════════════════════════
// GUARDAR
// ══════════════════════════════════════════
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
    const ah = match.home_score ?? null;
    const aa = match.away_score ?? null;
    // ✅ FIX: usar === true para evitar undefined
    const isFinished = match.finished === true;
    const pts = (isFinished && ah != null) ? calcPoints(ah, aa, ph, pa) : 0;

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
      points_synced: isFinished,   // ✅ siempre boolean (true o false)
      admin_note:    `Registro manual — ${new Date().toISOString()}`,
      created_at:    createdAt,
    };

    await setDoc(doc(db, 'predictions', docId), payload);

    log(`✅ Pronóstico guardado`, '#34d399');
    log(`   👤 ${member.display_name}`);
    log(`   ⚽ ${match.home_team} ${ph} - ${pa} ${match.away_team}`);
    log(`   🏅 Puntos: ${pts}${!isFinished ? ' (partido pendiente)' : ''}`);
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

  } catch(e) {
    log(`❌ Error: ${e.message}`, '#f5a0ac');
  }

  btnSave.disabled = false;
  btnSave.textContent = '💾 Guardar pronóstico';
});

// ══════════════════════════════════════════
// HISTORIAL DE SESIÓN
// ══════════════════════════════════════════
function renderHistory() {
  if (!state.history.length) return;
  histSection.style.display = 'block';
  histList.innerHTML = state.history.map(h => {
    const ptsCls = h.pts === 6 ? '#f5a623' : h.pts === 3 ? '#34d399' : '#94a3b8';
    return `<div class="hist-row">
      <span style="color:var(--text-muted);font-size:11px">${h.time}</span>
      <span style="font-weight:700">${h.player}</span>
      <span style="color:var(--text-muted)">·</span>
      <span>${h.match}</span>
      <span style="color:#4aafd4;font-weight:700">${h.score}</span>
      <span class="pts-badge" style="background:rgba(0,0,0,0.2);color:${ptsCls}">${h.pts} pts</span>
    </div>`;
  }).join('');
}

// ── Init
loadGroups();
