import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc,
  query, orderBy, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// ── Auth guard
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/index.html'; }
});

// ── Utilidad pública: guardar auditoría ANTES de modificar
export async function logPredictionAudit({ predictionId, groupId, userUid, matchId, before, after, reason = '' }) {
  await addDoc(collection(db, 'prediction_audit'), {
    prediction_id: predictionId,
    group_id:      groupId,
    user_uid:      userUid,
    match_id:      matchId,
    before,
    after,
    changed_by:    auth.currentUser?.uid || 'unknown',
    changed_at:    serverTimestamp(),
    reason
  });
}

// ══════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════
const state = {
  groups:   [],
  members:  [],
  matches:  [],
  users:    {},
  current:  null,   // { docId, data } del pronóstico cargado
};

// ── Catálogos auxiliares para el historial
let catalogMatches = {};
let catalogUsers   = {};
let catalogGroups  = {};
let allAudit       = [];

// ══════════════════════════════════════════════════
// DOM REFS — Sección corrección
// ══════════════════════════════════════════════════
const selGroup   = document.getElementById('selGroup');
const selPlayer  = document.getElementById('selPlayer');
const selMatch   = document.getElementById('selMatch');
const previewBox = document.getElementById('previewBox');
const editForm   = document.getElementById('editForm');
const inputHome  = document.getElementById('editHome');
const inputAway  = document.getElementById('editAway');
const inputReason= document.getElementById('editReason');
const btnSave    = document.getElementById('btnSavePred');
const editLog    = document.getElementById('editLog');

// ── DOM REFS — Historial
const filterGroup  = document.getElementById('filterGroup');
const filterUser   = document.getElementById('filterUser');
const filterMatch  = document.getElementById('filterMatch');
const btnLoadAudit = document.getElementById('btnLoadAudit');
const auditTable   = document.getElementById('auditTable');
const auditBody    = document.getElementById('auditBody');
const auditStatus  = document.getElementById('auditStatus');

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
function calcPoints(ah, aa, ph, pa) {
  if ([ah, aa, ph, pa].some(v => v == null)) return null;
  [ah, aa, ph, pa] = [ah, aa, ph, pa].map(Number);
  if (ph === ah && pa === aa) return 6;
  const res = v => v > 0 ? 'H' : v < 0 ? 'A' : 'D';
  return res(ph - pa) === res(ah - aa) ? 3 : 0;
}

function fmtKickoff(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function tsToStr(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleString('es-BO', { timeZone: 'America/La_Paz', hour12: false });
}

function ptsBadge(p) {
  if (p === 6) return '<span style="color:#f59e0b;font-weight:700">+6 🎯</span>';
  if (p === 3) return '<span style="color:#34d399;font-weight:700">+3 ✅</span>';
  if (p === 0) return '<span style="color:#94a3b8">0</span>';
  return '<span style="color:#94a3b8">—</span>';
}

function elog(msg, color = '#94a3b8') {
  editLog.style.display = 'block';
  editLog.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
  editLog.scrollTop = editLog.scrollHeight;
}

function stepEnable(id)  { const el = document.getElementById(id); if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'all'; } }
function stepDisable(id) { const el = document.getElementById(id); if (el) { el.style.opacity = '0.4'; el.style.pointerEvents = 'none'; } }

// ══════════════════════════════════════════════════
// PASO 1 — Cargar grupos
// ══════════════════════════════════════════════════
async function loadGroups() {
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('name')));
  state.groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  selGroup.innerHTML = '<option value="">— Selecciona una comparsa —</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name} (${g.code})</option>`).join('');

  // También poblar el filtro del historial
  filterGroup.innerHTML = '<option value="">Todas las comparsas</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

// ══════════════════════════════════════════════════
// PASO 2 — Grupo seleccionado → cargar jugadores
// ══════════════════════════════════════════════════
selGroup.addEventListener('change', async () => {
  const gid = selGroup.value;
  stepDisable('stepPlayer'); stepDisable('stepMatch'); stepDisable('stepScore');
  previewBox.style.display = 'none';
  editForm.style.display = 'none';
  selPlayer.innerHTML = '<option>⏳ Cargando jugadores...</option>';
  selMatch.innerHTML  = '<option value="">— Primero elige un jugador —</option>';
  if (!gid) return;

  const [memberSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'group_members'), where('group_id', '==', gid))),
    getDocs(collection(db, 'users'))
  ]);

  const usersMap = {};
  userSnap.forEach(d => { usersMap[d.id] = d.data(); state.users[d.id] = d.data(); });

  state.members = memberSnap.docs.map(d => ({
    ...d.data(),
    display_name: usersMap[d.data().user_uid]?.display_name
                || usersMap[d.data().user_uid]?.displayName
                || d.data().email
                || d.data().user_uid
  })).sort((a, b) => a.display_name.localeCompare(b.display_name));

  selPlayer.innerHTML = '<option value="">— Selecciona un jugador —</option>' +
    state.members.map(m =>
      `<option value="${m.user_uid}">${m.display_name} (${m.email || ''})</option>`
    ).join('');

  stepEnable('stepPlayer');
});

// ══════════════════════════════════════════════════
// PASO 3 — Jugador seleccionado → cargar partidos
// ══════════════════════════════════════════════════
selPlayer.addEventListener('change', async () => {
  stepDisable('stepMatch'); stepDisable('stepScore');
  previewBox.style.display = 'none';
  editForm.style.display = 'none';
  selMatch.innerHTML = '<option>⏳ Cargando partidos...</option>';
  if (!selPlayer.value) return;

  if (!state.matches.length) {
    const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
    state.matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const now  = new Date();
  const past = state.matches.filter(m => { const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff); return ko <= now; }).reverse();
  const future = state.matches.filter(m => { const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff); return ko > now; });

  function matchOpt(m) {
    const ko  = fmtKickoff(m.kickoff);
    const res = m.finished
      ? ` ✓ ${m.home_score}-${m.away_score} FINAL`
      : m.home_score != null ? ` ⚡ ${m.home_score}-${m.away_score} EN CURSO`
      : '';
    return `<option value="${m.id}">${m.home_flag || ''}${m.home_team} vs ${m.away_team}${m.away_flag || ''} — ${m.phase} · ${ko}${res}</option>`;
  }

  selMatch.innerHTML =
    '<option value="">— Selecciona un partido —</option>' +
    (past.length   ? `<optgroup label="📅 Partidos pasados">${past.map(matchOpt).join('')}</optgroup>` : '') +
    (future.length ? `<optgroup label="🔜 Próximos">${future.map(matchOpt).join('')}</optgroup>` : '');

  stepEnable('stepMatch');
});

// ══════════════════════════════════════════════════
// PASO 4 — Partido seleccionado → cargar pronóstico actual
// ══════════════════════════════════════════════════
selMatch.addEventListener('change', async () => {
  stepDisable('stepScore');
  previewBox.style.display = 'none';
  editForm.style.display = 'none';
  editLog.innerHTML = '';
  editLog.style.display = 'none';
  state.current = null;
  if (!selMatch.value) return;

  const gid   = selGroup.value;
  const uid   = selPlayer.value;
  const mid   = selMatch.value;
  const docId = `${gid}_${uid}_${mid}`;

  const match  = state.matches.find(m => m.id === mid);
  const member = state.members.find(m => m.user_uid === uid);
  const group  = state.groups.find(g => g.id === gid);

  const snap = await getDoc(doc(db, 'predictions', docId));
  const exists = snap.exists();
  const predData = exists ? snap.data() : null;

  // Preview del estado actual
  const ah = match.home_score != null ? Number(match.home_score) : null;
  const aa = match.away_score != null ? Number(match.away_score) : null;

  let resultLabel = '⏳ Sin resultado aún';
  if (match.finished)       resultLabel = `🏁 FINAL: ${ah} – ${aa}`;
  else if (ah != null)      resultLabel = `⚡ EN CURSO: ${ah} – ${aa}`;

  if (exists) {
    const pts = predData.points ?? '—';
    const ptsHtml = ptsBadge(predData.points);
    previewBox.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        <div><div class="lbl">Comparsa</div><div class="val purple">${group?.name}</div></div>
        <div><div class="lbl">Jugador</div><div class="val">${member?.display_name}</div></div>
        <div><div class="lbl">Partido</div><div class="val">${match.home_flag || ''}${match.home_team} vs ${match.away_team}${match.away_flag || ''}</div></div>
        <div><div class="lbl">Resultado del partido</div><div class="val muted">${resultLabel}</div></div>
        <div><div class="lbl">Pronóstico actual</div><div class="val big green">${predData.home_score ?? '?'} – ${predData.away_score ?? '?'}</div></div>
        <div><div class="lbl">Puntos actuales</div><div class="val big">${ptsHtml}</div></div>
      </div>`;
    previewBox.style.display = 'block';

    inputHome.value = predData.home_score ?? 0;
    inputAway.value = predData.away_score ?? 0;
    inputReason.value = '';
    editLog.innerHTML = '';
    editLog.style.display = 'none';
    editForm.style.display = 'block';
    stepEnable('stepScore');
    state.current = { docId, data: predData };
  } else {
    previewBox.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        <div><div class="lbl">Comparsa</div><div class="val purple">${group?.name}</div></div>
        <div><div class="lbl">Jugador</div><div class="val">${member?.display_name}</div></div>
        <div><div class="lbl">Partido</div><div class="val">${match.home_flag || ''}${match.home_team} vs ${match.away_team}${match.away_flag || ''}</div></div>
        <div><div class="lbl">Resultado</div><div class="val muted">${resultLabel}</div></div>
        <div style="grid-column:span 2"><div class="lbl">Pronóstico</div><div class="val" style="color:#f87171">∅ Este jugador no tiene pronóstico para este partido.</div></div>
      </div>`;
    previewBox.style.display = 'block';
  }
});

// ══════════════════════════════════════════════════
// GUARDAR corrección con auditoría
// ══════════════════════════════════════════════════
btnSave.addEventListener('click', async () => {
  if (!state.current) return;

  const newHome = parseInt(inputHome.value, 10);
  const newAway = parseInt(inputAway.value, 10);
  const reason  = inputReason.value.trim();

  if (isNaN(newHome) || isNaN(newAway) || newHome < 0 || newAway < 0) {
    elog('⚠️ Ingresa marcadores válidos (números ≥ 0).', '#f59e0b');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = '⏳ Guardando...';
  editLog.innerHTML = '';
  editLog.style.display = 'block';

  const { docId, data: predData } = state.current;

  try {
    const before = {
      home_score:    predData.home_score,
      away_score:    predData.away_score,
      points:        predData.points,
      points_synced: predData.points_synced
    };
    const after = {
      home_score:    newHome,
      away_score:    newAway,
      points:        predData.points,   // se recalcula en admin.html
      points_synced: false
    };

    // 1) Log de auditoría primero
    await logPredictionAudit({
      predictionId: docId,
      groupId:      predData.group_id,
      userUid:      predData.user_uid,
      matchId:      predData.match_id,
      before, after, reason
    });
    elog('📋 Registro de auditoría guardado.', '#a78bfa');

    // 2) Actualizar pronóstico
    await updateDoc(doc(db, 'predictions', docId), {
      home_score:    newHome,
      away_score:    newAway,
      points_synced: false
    });

    elog(`✅ ${before.home_score}-${before.away_score}  →  ${newHome}-${newAway}`, '#34d399');
    elog('⚠️  Ve a admin.html → Recalcular puntos para que se actualice el ranking.', '#f59e0b');

    // Reset
    state.current = null;
    editForm.style.display = 'none';
    previewBox.style.display = 'none';
    selMatch.value  = '';
    selPlayer.value = '';
    selGroup.value  = '';
    stepDisable('stepPlayer'); stepDisable('stepMatch'); stepDisable('stepScore');

  } catch (e) {
    elog('❌ Error al guardar: ' + e.message, '#f87171');
  }

  btnSave.disabled = false;
  btnSave.textContent = '💾 Guardar corrección';
});

// ══════════════════════════════════════════════════
// HISTORIAL — cargar y filtrar
// ══════════════════════════════════════════════════
btnLoadAudit.addEventListener('click', async () => {
  btnLoadAudit.disabled = true;
  btnLoadAudit.textContent = '⏳ Cargando...';
  auditBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">⏳ Cargando registros...</td></tr>';
  auditTable.style.display = 'table';

  try {
    // Cargar catálogos si no están
    if (!Object.keys(catalogMatches).length) {
      const [mSnap, uSnap] = await Promise.all([
        getDocs(collection(db, 'matches')),
        getDocs(collection(db, 'users'))
      ]);
      mSnap.forEach(d => { catalogMatches[d.id] = d.data(); });
      uSnap.forEach(d => { catalogUsers[d.id]   = d.data(); });
      state.groups.forEach(g => { catalogGroups[g.id] = g; });
    }

    const snap = await getDocs(query(collection(db, 'prediction_audit'), orderBy('changed_at', 'desc')));
    allAudit = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAudit();
  } catch (e) {
    auditStatus.textContent = '❌ Error: ' + e.message;
    auditStatus.style.color = '#f87171';
  }

  btnLoadAudit.disabled = false;
  btnLoadAudit.textContent = '🔄 Actualizar historial';
});

[filterGroup, filterUser, filterMatch].forEach(el => el.addEventListener('input', renderAudit));

function renderAudit() {
  const gf = filterGroup.value.trim().toLowerCase();
  const uf = filterUser.value.trim().toLowerCase();
  const mf = filterMatch.value.trim().toLowerCase();

  const filtered = allAudit.filter(r => {
    const gName = (catalogGroups[r.group_id]?.name || r.group_id || '').toLowerCase();
    const uName = (catalogUsers[r.user_uid]?.display_name || r.user_uid || '').toLowerCase();
    const m     = catalogMatches[r.match_id];
    const mName = (m ? `${m.home_team} vs ${m.away_team}` : r.match_id || '').toLowerCase();
    return (!gf || gName.includes(gf) || r.group_id?.includes(gf))
        && (!uf || uName.includes(uf) || r.user_uid?.includes(uf))
        && (!mf || mName.includes(mf) || r.match_id?.includes(mf));
  });

  if (!filtered.length) {
    auditBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">
      ${allAudit.length ? 'Sin registros para estos filtros.' : 'Aún no hay registros de auditoría.'}
    </td></tr>`;
    auditStatus.textContent = `0 de ${allAudit.length} registros`;
    auditStatus.style.color = '#94a3b8';
    return;
  }

  auditBody.innerHTML = filtered.map(r => {
    const match     = catalogMatches[r.match_id];
    const matchLbl  = match ? `${match.home_flag || ''}${match.home_team} vs ${match.away_team}` : r.match_id?.substring(0, 16) + '…';
    const userName  = catalogUsers[r.user_uid]?.display_name  || r.user_uid?.substring(0, 10) + '…';
    const groupName = catalogGroups[r.group_id]?.name         || r.group_id?.substring(0, 10) + '…';
    const adminName = catalogUsers[r.changed_by]?.display_name|| r.changed_by?.substring(0, 8) + '…';

    const bef = r.before ? `<strong>${r.before.home_score ?? '?'}-${r.before.away_score ?? '?'}</strong> ${ptsBadge(r.before.points)}` : '—';
    const aft = r.after  ? `<strong>${r.after.home_score  ?? '?'}-${r.after.away_score  ?? '?'}</strong> ${ptsBadge(r.after.points)}`  : '—';

    return `<tr>
      <td style="font-size:11px;color:#94a3b8;white-space:nowrap">${tsToStr(r.changed_at)}</td>
      <td style="font-weight:600;color:#a78bfa">${groupName}</td>
      <td style="color:#f1f5f9">${userName}</td>
      <td style="color:#94a3b8;font-size:12px">${matchLbl}</td>
      <td>${bef}</td>
      <td>${aft}</td>
      <td style="font-size:11px;color:#64748b">${r.reason || '—'}<br><span style="color:#475569">${adminName}</span></td>
    </tr>`;
  }).join('');

  auditStatus.textContent = `${filtered.length} de ${allAudit.length} registros`;
  auditStatus.style.color = '#4aafd4';
}

// ── Init
await loadGroups();
