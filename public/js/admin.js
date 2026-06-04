// admin.js — Cargar resultados + calcular puntos pronósticos + favoritos
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, addDoc, updateDoc, getDoc,
  query, orderBy, writeBatch, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadMatchesAdmin();
});

async function loadMatchesAdmin() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const sel  = document.getElementById('matchSelect');
  if (!sel) return;
  sel.innerHTML = snap.docs
    .filter(d => d.data().home_score === undefined)
    .map(d => {
      const m = d.data();
      return `<option value="${d.id}">${m.home_flag || ''} ${m.home_team} vs ${m.away_team} ${m.away_flag || ''} — ${m.phase}</option>`;
    }).join('');
  if (!sel.innerHTML) sel.innerHTML = '<option>No hay partidos pendientes</option>';
}

document.getElementById('saveResultBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelect').value;
  const hs  = parseInt(document.getElementById('resultHome').value);
  const as_ = parseInt(document.getElementById('resultAway').value);
  const msg = document.getElementById('adminMsg');
  if (!mid || isNaN(hs) || isNaN(as_)) { msg.innerHTML = '<span class="badge bg-danger">Completa el resultado</span>'; return; }

  const matchRef  = doc(db, 'matches', mid);
  const matchSnap = await getDoc(matchRef);
  const matchData = matchSnap.data();
  const outcome   = hs > as_ ? 'H' : as_ > hs ? 'A' : 'D';

  // 1. Guardar resultado
  await updateDoc(matchRef, { home_score: hs, away_score: as_ });

  // 2. Calcular puntos pronósticos
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => {
    const p = predDoc.data();
    const predOutcome = p.home_score > p.away_score ? 'H' : p.away_score > p.home_score ? 'A' : 'D';
    let pts = 0;
    if (p.home_score === hs && p.away_score === as_) pts = 6;  // score exacto: 3 + 3 bonus
    else if (predOutcome === outcome) pts = 3;                  // resultado correcto
    batch.update(predDoc.ref, { points: pts });
  });
  await batch.commit();

  // 3. Puntos de favoritos (todos los group_members)
  const allMembersSnap = await getDocs(collection(db, 'group_members'));
  const favBatch = writeBatch(db);
  let favCount = 0;
  allMembersSnap.forEach(mDoc => {
    const m = mDoc.data();
    let favPts = 0;
    if (m.favorite === matchData.home_team)      favPts = hs > as_ ? 3 : hs === as_ ? 1 : 0;
    else if (m.favorite === matchData.away_team) favPts = as_ > hs ? 3 : hs === as_ ? 1 : 0;
    if (favPts > 0) {
      favBatch.update(mDoc.ref, { favorite_pts: (m.favorite_pts || 0) + favPts });
      favCount++;
    }
  });
  await favBatch.commit();

  msg.innerHTML = `<div class="mt-2 p-2 rounded" style="background:rgba(22,163,74,0.15);border:1px solid var(--green);color:var(--green-light)">
    ✅ <strong>Resultado guardado</strong> &mdash; ${predsSnap.size} pronósticos calculados &mdash; ${favCount} favoritos actualizados
  </div>`;
  await loadMatchesAdmin();
});

document.getElementById('addMatchBtn')?.addEventListener('click', async () => {
  const home    = document.getElementById('newHomeTeam').value.trim();
  const away    = document.getElementById('newAwayTeam').value.trim();
  const kickoff = document.getElementById('newKickoff').value;
  const phase   = document.getElementById('newPhase').value;
  const msg     = document.getElementById('adminMsg');
  if (!home || !away || !kickoff) { msg.innerHTML = '<span class="badge bg-danger">Completa todos los campos</span>'; return; }
  await addDoc(collection(db, 'matches'), { home_team: home, away_team: away, kickoff: new Date(kickoff), phase });
  msg.innerHTML = '<span class="badge bg-primary">✅ Partido agregado</span>';
  await loadMatchesAdmin();
});
