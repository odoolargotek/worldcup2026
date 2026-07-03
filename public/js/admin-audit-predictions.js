import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// ─── Auth guard ────────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/index.html'; return; }
});

// ─── Utilidad: guardar entrada de auditoría ANTES de modificar ─────────────
export async function logPredictionAudit({ predictionId, groupId, userUid, matchId, before, after, reason = '' }) {
  const adminUser = auth.currentUser;
  await addDoc(collection(db, 'prediction_audit'), {
    prediction_id: predictionId,
    group_id:      groupId,
    user_uid:      userUid,
    match_id:      matchId,
    before:        before,   // { home_score, away_score, points, points_synced }
    after:         after,    // { home_score, away_score, points, points_synced }
    changed_by:    adminUser?.uid || 'unknown',
    changed_at:    serverTimestamp(),
    reason:        reason
  });
}

// ─── Estado ────────────────────────────────────────────────────────────────
let allAudit   = [];
let allMatches = {};
let allUsers   = {};
let allGroups  = {};

// ─── DOM refs ──────────────────────────────────────────────────────────────
const filterGroup   = document.getElementById('filterGroup');
const filterUser    = document.getElementById('filterUser');
const filterMatch   = document.getElementById('filterMatch');
const btnLoad       = document.getElementById('btnLoadAudit');
const auditTable    = document.getElementById('auditTable');
const auditBody     = document.getElementById('auditBody');
const statusMsg     = document.getElementById('auditStatus');

// ─── Sección de corrección manual ─────────────────────────────────────────
const editPredId    = document.getElementById('editPredId');
const btnLoadPred   = document.getElementById('btnLoadPred');
const editForm      = document.getElementById('editForm');
const editCurrent   = document.getElementById('editCurrent');
const inputHome     = document.getElementById('editHome');
const inputAway     = document.getElementById('editAway');
const inputReason   = document.getElementById('editReason');
const btnSavePred   = document.getElementById('btnSavePred');
const editLog       = document.getElementById('editLog');

function status(msg, color = '#94a3b8') {
  statusMsg.style.color = color;
  statusMsg.textContent = msg;
}

function elog(msg, color = '#94a3b8') {
  editLog.style.display = 'block';
  editLog.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
  editLog.scrollTop = editLog.scrollHeight;
}

function tsToStr(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleString('es-BO', { timeZone: 'America/La_Paz', hour12: false });
}

function pointsLabel(p) {
  if (p === 6) return '<span style="color:#34d399;font-weight:700">+6 🎯</span>';
  if (p === 3) return '<span style="color:#4aafd4;font-weight:700">+3 ✅</span>';
  return '<span style="color:#94a3b8">0</span>';
}

// ─── Cargar catálogos ──────────────────────────────────────────────────────
async function loadCatalogs() {
  const [mSnap, uSnap, gSnap] = await Promise.all([
    getDocs(collection(db, 'matches')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'groups')),
  ]);
  mSnap.forEach(d => { allMatches[d.id] = d.data(); });
  uSnap.forEach(d => { allUsers[d.id]   = d.data(); });
  gSnap.forEach(d => { allGroups[d.id]  = d.data(); });

  // Poblar filtro de comparsas
  filterGroup.innerHTML = '<option value="">Todas las comparsas</option>';
  Object.entries(allGroups).forEach(([id, g]) => {
    filterGroup.innerHTML += `<option value="${id}">${g.name || id}</option>`;
  });
}

// ─── Cargar historial de auditoría ────────────────────────────────────────
btnLoad.addEventListener('click', async () => {
  btnLoad.disabled = true;
  btnLoad.textContent = '⏳ Cargando...';
  auditBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">⏳ Cargando registros...</td></tr>';
  auditTable.style.display = 'table';

  try {
    let q = query(collection(db, 'prediction_audit'), orderBy('changed_at', 'desc'));
    const snap = await getDocs(q);
    allAudit = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAudit();
  } catch(e) {
    status('❌ Error cargando auditoría: ' + e.message, '#f87171');
  }

  btnLoad.disabled = false;
  btnLoad.textContent = '🔍 Cargar historial';
});

// ─── Filtros en tiempo real ────────────────────────────────────────────────
[filterGroup, filterUser, filterMatch].forEach(el => el.addEventListener('input', renderAudit));

function renderAudit() {
  const gf = filterGroup.value.trim().toLowerCase();
  const uf = filterUser.value.trim().toLowerCase();
  const mf = filterMatch.value.trim().toLowerCase();

  const filtered = allAudit.filter(r => {
    const gName  = (allGroups[r.group_id]?.name || r.group_id || '').toLowerCase();
    const uName  = (allUsers[r.user_uid]?.display_name || r.user_uid || '').toLowerCase();
    const mName  = (allMatches[r.match_id]
      ? `${allMatches[r.match_id].home_team} vs ${allMatches[r.match_id].away_team}`
      : r.match_id || '').toLowerCase();
    return (!gf || gName.includes(gf))
        && (!uf || uName.includes(uf) || r.user_uid.includes(uf))
        && (!mf || mName.includes(mf) || r.match_id?.includes(mf));
  });

  if (filtered.length === 0) {
    auditBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">Sin registros para estos filtros.</td></tr>';
    status(`0 registros mostrados de ${allAudit.length} totales.`, '#94a3b8');
    return;
  }

  auditBody.innerHTML = filtered.map(r => {
    const match   = allMatches[r.match_id];
    const matchLbl = match ? `${match.home_team} vs ${match.away_team}` : r.match_id?.substring(0,16) + '…';
    const userName = allUsers[r.user_uid]?.display_name || r.user_uid?.substring(0,10) + '…';
    const groupName = allGroups[r.group_id]?.name || r.group_id?.substring(0,10) + '…';
    const adminName = allUsers[r.changed_by]?.display_name || r.changed_by?.substring(0,10) + '…';

    const beforeStr = r.before ? `${r.before.home_score ?? '?'}-${r.before.away_score ?? '?'} ${pointsLabel(r.before.points)}` : '—';
    const afterStr  = r.after  ? `${r.after.home_score  ?? '?'}-${r.after.away_score  ?? '?'} ${pointsLabel(r.after.points)}`  : '—';

    return `<tr>
      <td style="font-size:11px;color:#94a3b8">${tsToStr(r.changed_at)}</td>
      <td style="font-weight:600;color:#a78bfa">${groupName}</td>
      <td style="color:#f1f5f9">${userName}</td>
      <td style="color:#94a3b8">${matchLbl}</td>
      <td>${beforeStr}</td>
      <td>${afterStr}</td>
      <td style="font-size:11px;color:#64748b">${r.reason || '—'} <span style="color:#475569">(${adminName})</span></td>
    </tr>`;
  }).join('');

  status(`${filtered.length} registros mostrados de ${allAudit.length} totales.`, '#4aafd4');
}

// ─── Corrección manual con log de auditoría ───────────────────────────────
let currentPredData = null;
let currentPredDocId = null;

btnLoadPred.addEventListener('click', async () => {
  const rawId = editPredId.value.trim();
  if (!rawId) { elog('⚠️ Ingresa el ID del pronóstico.', '#f59e0b'); return; }

  editLog.innerHTML = '';
  editForm.style.display = 'none';
  currentPredData = null;

  elog('🔍 Buscando pronóstico...', '#94a3b8');
  try {
    const snap = await getDoc(doc(db, 'predictions', rawId));
    if (!snap.exists()) {
      elog(`❌ No existe el documento: ${rawId}`, '#f87171');
      return;
    }
    currentPredData  = snap.data();
    currentPredDocId = rawId;

    const match  = allMatches[currentPredData.match_id];
    const user   = allUsers[currentPredData.user_uid];
    const group  = allGroups[currentPredData.group_id];

    editCurrent.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div><div style="font-size:11px;color:#94a3b8">Comparsa</div><div style="font-weight:700;color:#a78bfa">${group?.name || currentPredData.group_id}</div></div>
        <div><div style="font-size:11px;color:#94a3b8">Usuario</div><div style="font-weight:700;color:#f1f5f9">${user?.display_name || currentPredData.user_uid?.substring(0,12)}</div></div>
        <div><div style="font-size:11px;color:#94a3b8">Partido</div><div style="font-weight:700;color:#f1f5f9">${match ? match.home_team+' vs '+match.away_team : currentPredData.match_id}</div></div>
        <div><div style="font-size:11px;color:#94a3b8">Pronóstico actual</div><div style="font-size:1.4rem;font-weight:800;color:#34d399">${currentPredData.home_score ?? '?'} – ${currentPredData.away_score ?? '?'}</div></div>
        <div><div style="font-size:11px;color:#94a3b8">Puntos actuales</div><div style="font-size:1.4rem;font-weight:800;color:#4aafd4">${currentPredData.points ?? 0} pts</div></div>
        <div><div style="font-size:11px;color:#94a3b8">Synced</div><div style="color:#94a3b8">${currentPredData.points_synced ? '✅' : '⏳ pendiente'}</div></div>
      </div>`;

    inputHome.value = currentPredData.home_score ?? '';
    inputAway.value = currentPredData.away_score ?? '';
    inputReason.value = '';
    editForm.style.display = 'block';
    elog('✅ Pronóstico cargado. Edita los valores y guarda.', '#34d399');
  } catch(e) {
    elog('❌ Error: ' + e.message, '#f87171');
  }
});

btnSavePred.addEventListener('click', async () => {
  if (!currentPredData || !currentPredDocId) return;

  const newHome = parseInt(inputHome.value, 10);
  const newAway = parseInt(inputAway.value, 10);
  const reason  = inputReason.value.trim();

  if (isNaN(newHome) || isNaN(newAway) || newHome < 0 || newAway < 0) {
    elog('⚠️ Ingresa marcadores válidos (números ≥ 0).', '#f59e0b');
    return;
  }

  btnSavePred.disabled = true;
  btnSavePred.textContent = '⏳ Guardando...';
  editLog.innerHTML = '';

  try {
    const before = {
      home_score:    currentPredData.home_score,
      away_score:    currentPredData.away_score,
      points:        currentPredData.points,
      points_synced: currentPredData.points_synced
    };

    const after = {
      home_score:    newHome,
      away_score:    newAway,
      points:        currentPredData.points,   // puntos se recalculan aparte
      points_synced: false                      // marcar para recalcular
    };

    // 1) Guardar auditoría ANTES de modificar
    await logPredictionAudit({
      predictionId: currentPredDocId,
      groupId:      currentPredData.group_id,
      userUid:      currentPredData.user_uid,
      matchId:      currentPredData.match_id,
      before,
      after,
      reason
    });
    elog('📋 Registro de auditoría guardado.', '#a78bfa');

    // 2) Actualizar el pronóstico
    await updateDoc(doc(db, 'predictions', currentPredDocId), {
      home_score:    newHome,
      away_score:    newAway,
      points_synced: false
    });
    elog(`✅ Pronóstico actualizado: ${before.home_score}-${before.away_score}  →  ${newHome}-${newAway}`, '#34d399');
    elog('⚠️  Los puntos quedaron marcados como no sincronizados. Ve a admin.html → Recalcular puntos para este partido.', '#f59e0b');

    currentPredData = null;
    currentPredDocId = null;
    editForm.style.display = 'none';
    editPredId.value = '';
  } catch(e) {
    elog('❌ Error al guardar: ' + e.message, '#f87171');
  }

  btnSavePred.disabled = false;
  btnSavePred.textContent = '💾 Guardar corrección';
});

// ─── Init ──────────────────────────────────────────────────────────────────
await loadCatalogs();
