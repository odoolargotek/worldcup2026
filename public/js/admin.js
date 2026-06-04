// admin.js — Panel admin ampliado
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, addDoc, updateDoc, getDoc, deleteDoc,
  query, orderBy, writeBatch, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ---- TABS ----
document.querySelectorAll('[data-atab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['results','matches','groupsmgr'].forEach(t => {
      document.getElementById(`atab-${t}`)?.classList.toggle('d-none', btn.dataset.atab !== t);
    });
    if (btn.dataset.atab === 'matches')   loadAllMatchesList();
    if (btn.dataset.atab === 'groupsmgr') loadGroupsMgr();
  });
});

// =============================================
// TAB RESULTADOS
// =============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadMatchesAdmin();
  await loadMatchesDone();
});

async function loadMatchesAdmin() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const sel  = document.getElementById('matchSelect');
  if (!sel) return;
  const pending = snap.docs.filter(d => d.data().home_score === undefined);
  sel.innerHTML = pending.length
    ? pending.map(d => {
        const m = d.data();
        return `<option value="${d.id}">${m.home_flag||''} ${m.home_team} vs ${m.away_team} ${m.away_flag||''} — ${m.phase}</option>`;
      }).join('')
    : '<option>No hay partidos pendientes</option>';
}

async function loadMatchesDone() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const sel  = document.getElementById('matchSelectDone');
  if (!sel) return;
  const done = snap.docs.filter(d => d.data().home_score !== undefined);
  sel.innerHTML = done.length
    ? done.map(d => {
        const m = d.data();
        return `<option value="${d.id}">${m.home_flag||''} ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} ${m.away_flag||''} — ${m.phase}</option>`;
      }).join('')
    : '<option>Sin partidos con resultado</option>';
}

document.getElementById('saveResultBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelect').value;
  const hs  = parseInt(document.getElementById('resultHome').value);
  const as_ = parseInt(document.getElementById('resultAway').value);
  const msg = document.getElementById('adminMsg');
  if (!mid || isNaN(hs) || isNaN(as_)) { msg.innerHTML = badge('Completa el resultado','danger'); return; }

  const matchRef  = doc(db, 'matches', mid);
  const matchSnap = await getDoc(matchRef);
  const matchData = matchSnap.data();
  const outcome   = hs > as_ ? 'H' : as_ > hs ? 'A' : 'D';
  const phase     = matchData.phase || '';

  await updateDoc(matchRef, { home_score: hs, away_score: as_ });

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id','==',mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => {
    const p = predDoc.data();
    const predOut = p.home_score > p.away_score ? 'H' : p.away_score > p.home_score ? 'A' : 'D';
    let pts = 0;
    if (p.home_score === hs && p.away_score === as_) pts = 6;
    else if (predOut === outcome) pts = 3;
    batch.update(predDoc.ref, { points: pts });
  });
  await batch.commit();

  const allMembersSnap = await getDocs(collection(db, 'group_members'));
  const favBatch = writeBatch(db);
  let favCount = 0;
  allMembersSnap.forEach(mDoc => {
    const m    = mDoc.data();
    const favs = m.favorites || {};
    const favTeam = favs[phase];
    let favPts = 0;
    if (favTeam === matchData.home_team)      favPts = hs > as_ ? 3 : hs === as_ ? 1 : 0;
    else if (favTeam === matchData.away_team) favPts = as_ > hs ? 3 : hs === as_ ? 1 : 0;
    if (favPts > 0) {
      const current = (m.favorites_pts || {})[phase] || 0;
      favBatch.update(mDoc.ref, { [`favorites_pts.${phase}`]: current + favPts });
      favCount++;
    }
  });
  await favBatch.commit();

  msg.innerHTML = `<div class="mt-2 p-2 rounded" style="background:rgba(22,163,74,0.15);border:1px solid var(--green);color:var(--green-light)">
    ✅ Resultado guardado — ${predsSnap.size} pronósticos — ${favCount} favoritos actualizados
  </div>`;
  await loadMatchesAdmin();
  await loadMatchesDone();
});

document.getElementById('resetResultBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectDone').value;
  const msg = document.getElementById('resetMsg');
  if (!mid) return;
  if (!confirm('¿Resetear resultado de este partido? Se revertirán los puntos.')) return;

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id','==',mid)));
  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();
  const phase     = matchData.phase || '';
  const hs = matchData.home_score, as_ = matchData.away_score;

  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => { batch.update(predDoc.ref, { points: 0 }); });

  const allMembersSnap = await getDocs(collection(db, 'group_members'));
  allMembersSnap.forEach(mDoc => {
    const m    = mDoc.data();
    const favs = m.favorites || {};
    const favTeam = favs[phase];
    let favPts = 0;
    if (favTeam === matchData.home_team)      favPts = hs > as_ ? 3 : hs === as_ ? 1 : 0;
    else if (favTeam === matchData.away_team) favPts = as_ > hs ? 3 : hs === as_ ? 1 : 0;
    if (favPts > 0) {
      const current = (m.favorites_pts || {})[phase] || 0;
      batch.update(mDoc.ref, { [`favorites_pts.${phase}`]: Math.max(0, current - favPts) });
    }
  });
  await batch.commit();
  await updateDoc(doc(db, 'matches', mid), { home_score: null, away_score: null });

  msg.innerHTML = `<div style="color:#fbbf24">🔄 Resultado reseteado correctamente</div>`;
  await loadMatchesAdmin();
  await loadMatchesDone();
});

// =============================================
// TAB PARTIDOS
// =============================================
async function loadAllMatchesList() {
  const container = document.getElementById('allMatchesList');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted)">Cargando...</div>';

  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Sin partidos.</p>'; return; }

  let html = '';
  snap.docs.forEach(d => {
    const m = d.data();
    const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    const isDone  = m.home_score !== undefined;
    const label   = kickoff.toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      day:'2-digit', month:'short',
      hour:'numeric', minute:'2-digit', hour12: true
    });
    html += `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <span style="font-size:1.2rem">${m.home_flag||'⚽'}</span>
        <span style="flex:1;font-size:0.85rem;font-weight:600">${m.home_team} vs ${m.away_team} ${m.away_flag||''}</span>
        <span style="font-size:0.78rem;color:var(--text-muted)">${m.phase}</span>
        <span style="font-size:0.78rem;color:var(--gold)">${label}</span>
        ${isDone ? `<span style="font-size:0.78rem;color:var(--green-light);font-weight:700">${m.home_score}-${m.away_score}</span>` : '<span style="font-size:0.78rem;color:var(--text-muted)">Pendiente</span>'}
        <button class="btn btn-sm btn-outline-danger" style="font-size:11px;padding:2px 10px" onclick="deleteMatchConfirm('${d.id}','${m.home_team} vs ${m.away_team}',${isDone})">🗑️</button>
      </div>`;
  });
  container.innerHTML = html;
}

window.deleteMatchConfirm = async function(mid, label, isDone) {
  const warn = isDone ? ' (tiene resultado cargado)' : '';
  if (!confirm(`¿Eliminar partido "${label}"${warn}? Se borrarán sus pronósticos.`)) return;
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id','==',mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'matches', mid));
  await batch.commit();
  await loadAllMatchesList();
};

document.getElementById('addMatchBtn')?.addEventListener('click', async () => {
  const home    = document.getElementById('newHomeTeam').value.trim();
  const homeFlag= document.getElementById('newHomeFlag').value.trim();
  const away    = document.getElementById('newAwayTeam').value.trim();
  const awayFlag= document.getElementById('newAwayFlag').value.trim();
  const kickoff = document.getElementById('newKickoff').value;
  const phase   = document.getElementById('newPhase').value;
  const city    = document.getElementById('newCity').value.trim();
  const msg     = document.getElementById('addMatchMsg');
  if (!home || !away || !kickoff) { msg.innerHTML = badge('Completa los campos obligatorios','danger'); return; }
  await addDoc(collection(db, 'matches'), {
    home_team: home, home_flag: homeFlag,
    away_team: away, away_flag: awayFlag,
    kickoff: new Date(kickoff), phase, city
  });
  msg.innerHTML = badge('✅ Partido agregado','success');
  ['newHomeTeam','newHomeFlag','newAwayTeam','newAwayFlag','newKickoff','newCity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  await loadMatchesAdmin();
});

// =============================================
// BORRAR TODOS — loop individual (evita limite batch)
// =============================================
document.getElementById('deleteAllMatchesBtn')?.addEventListener('click', async () => {
  if (!confirm('⚠️ ¿Borrar TODOS los partidos y sus pronósticos? Esta acción es irreversible.')) return;

  const btn = document.getElementById('deleteAllMatchesBtn');
  const list = document.getElementById('allMatchesList');
  btn.disabled = true;
  btn.textContent = '⏳ Borrando...';

  const matchesSnap = await getDocs(collection(db, 'matches'));
  let total = matchesSnap.size;
  let done  = 0;

  for (const mDoc of matchesSnap.docs) {
    // borrar pronósticos del partido
    const predsSnap = await getDocs(
      query(collection(db, 'predictions'), where('match_id','==', mDoc.id))
    );
    for (const p of predsSnap.docs) {
      await deleteDoc(p.ref);
    }
    // borrar el partido
    await deleteDoc(mDoc.ref);
    done++;
    list.innerHTML = `<p style="color:var(--text-muted)">⏳ Borrando ${done}/${total}...</p>`;
  }

  btn.disabled = false;
  btn.textContent = '🗑️ Borrar todos los partidos';
  list.innerHTML = `<p style="color:var(--green-light)">✅ ${total} partidos eliminados. 
    <a href="load-matches.html" style="color:var(--gold)">Ir a cargar partidos →</a></p>`;
  await loadMatchesAdmin();
  await loadMatchesDone();
});

// =============================================
// TAB COMPARSAS
// =============================================
async function loadGroupsMgr() {
  const container = document.getElementById('groupsMgrList');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted)">Cargando comparsas...</div>';

  const snap = await getDocs(query(collection(db, 'groups'), orderBy('created_at','desc')));
  if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Sin comparsas.</p>'; return; }

  const membersSnap = await getDocs(collection(db, 'group_members'));
  const memberCount = {};
  membersSnap.forEach(d => {
    const gid = d.data().group_id;
    memberCount[gid] = (memberCount[gid] || 0) + 1;
  });

  const predsSnap = await getDocs(collection(db, 'predictions'));
  const predCount = {};
  predsSnap.forEach(d => {
    const gid = d.data().group_id;
    predCount[gid] = (predCount[gid] || 0) + 1;
  });

  container.innerHTML = '';

  const totalGroups  = snap.size;
  const totalMembers = Object.values(memberCount).reduce((a,b)=>a+b,0);
  const totalPreds   = Object.values(predCount).reduce((a,b)=>a+b,0);
  const summary = document.createElement('div');
  summary.className = 'row g-3 mb-4';
  summary.innerHTML = `
    <div class="col-4">
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:var(--gold)">${totalGroups}</div>
        <div style="font-size:11px;color:var(--text-muted)">Comparsas</div>
      </div>
    </div>
    <div class="col-4">
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:var(--green-light)">${totalMembers}</div>
        <div style="font-size:11px;color:var(--text-muted)">Participantes</div>
      </div>
    </div>
    <div class="col-4">
      <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#a5b4fc">${totalPreds}</div>
        <div style="font-size:11px;color:var(--text-muted)">Pronósticos</div>
      </div>
    </div>`;
  container.appendChild(summary);

  snap.docs.forEach(gDoc => {
    const g   = gDoc.data();
    const gid = gDoc.id;
    const members = memberCount[gid] || 0;
    const preds   = predCount[gid]   || 0;
    const created = g.created_at?.toDate ? g.created_at.toDate() : null;

    const row = document.createElement('div');
    row.style.cssText = 'background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px';
    row.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.95rem">👥 ${g.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            Cód: <strong style="color:var(--gold);letter-spacing:2px">${g.code}</strong>
            &nbsp;·&nbsp; 👥 ${members} miembros
            &nbsp;·&nbsp; 🔮 ${preds} pronósticos
            ${g.prize ? `&nbsp;·&nbsp; 🏆 $${g.prize}` : ''}
            ${created ? `&nbsp;·&nbsp; 📅 ${created.toLocaleDateString('es-BO')}` : ''}
          </div>
        </div>
        <button class="btn btn-sm btn-outline-danger" style="font-size:11px;white-space:nowrap" 
          onclick="deleteGroupConfirm('${gid}','${g.name.replace(/'/g,"\\'")}')">🗑 Eliminar</button>
      </div>`;
    container.appendChild(row);
  });
}

let _deleteGroupId = null;
let _deleteModal   = null;

window.deleteGroupConfirm = function(gid, name) {
  _deleteGroupId = gid;
  document.getElementById('confirmDeleteMsg').textContent =
    `¿Eliminar la comparsa "${name}" con todos sus miembros y pronósticos?`;
  if (!_deleteModal) _deleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
  _deleteModal.show();
};

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  if (!_deleteGroupId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true; btn.textContent = 'Eliminando...';

  const batch = writeBatch(db);
  const memSnap  = await getDocs(query(collection(db, 'group_members'), where('group_id','==',_deleteGroupId)));
  memSnap.forEach(d => batch.delete(d.ref));
  const predSnap = await getDocs(query(collection(db, 'predictions'),   where('group_id','==',_deleteGroupId)));
  predSnap.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'groups', _deleteGroupId));
  await batch.commit();

  _deleteModal.hide();
  btn.disabled = false; btn.textContent = '🗑️ Eliminar definitivamente';
  _deleteGroupId = null;
  await loadGroupsMgr();
});

function badge(text, type) {
  const colors = { success:'var(--green)', danger:'var(--danger)', warning:'var(--gold)' };
  return `<span style="color:${colors[type]||'#fff'};font-size:0.85rem;font-weight:600">${text}</span>`;
}
