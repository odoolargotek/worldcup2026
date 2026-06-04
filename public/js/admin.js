// ====================================================
// admin.js — Panel admin: cargar partidos y resultados
// Proteger esta ruta con Firestore Rules (solo admin)
// ====================================================
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, addDoc, updateDoc,
  query, orderBy, writeBatch, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

let matchesCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadMatchesAdmin();
});

async function loadMatchesAdmin() {
  const q = query(collection(db, 'matches'), orderBy('kickoff'));
  const snap = await getDocs(q);
  matchesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('matchSelect');
  if (!sel) return;
  sel.innerHTML = matchesCache.map(m =>
    `<option value="${m.id}">${m.home_team} vs ${m.away_team} (${m.phase})</option>`
  ).join('');
}

// --- Guardar resultado + calcular puntos ---
document.getElementById('saveResultBtn')?.addEventListener('click', async () => {
  const mid  = document.getElementById('matchSelect').value;
  const hs   = parseInt(document.getElementById('resultHome').value);
  const as   = parseInt(document.getElementById('resultAway').value);
  if (isNaN(hs) || isNaN(as)) { alert('Ingresa el resultado'); return; }

  const resultOutcome = hs > as ? 'H' : as > hs ? 'A' : 'D'; // Home / Away / Draw

  // Actualizar partido
  await updateDoc(doc(db, 'matches', mid), { home_score: hs, away_score: as });

  // Recalcular puntos de todos los pronósticos para este partido
  const q = query(collection(db, 'predictions'), where('match_id', '==', mid));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(predDoc => {
    const p = predDoc.data();
    const predOutcome = p.home_score > p.away_score ? 'H' : p.away_score > p.home_score ? 'A' : 'D';
    let pts = 0;
    if (p.home_score === hs && p.away_score === as) pts = 3;
    else if (predOutcome === resultOutcome) pts = 1;
    batch.update(predDoc.ref, { points: pts });
  });
  await batch.commit();

  document.getElementById('adminMsg').innerHTML =
    `<span class="badge bg-success">✅ Resultado guardado y puntos calculados (${snap.size} pronósticos)</span>`;
});

// --- Agregar partido nuevo ---
document.getElementById('addMatchBtn')?.addEventListener('click', async () => {
  const home    = document.getElementById('newHomeTeam').value.trim();
  const away    = document.getElementById('newAwayTeam').value.trim();
  const kickoff = document.getElementById('newKickoff').value;
  const phase   = document.getElementById('newPhase').value;
  if (!home || !away || !kickoff) { alert('Completa todos los campos'); return; }
  await addDoc(collection(db, 'matches'), {
    home_team: home, away_team: away,
    kickoff: new Date(kickoff), phase
  });
  await loadMatchesAdmin();
  document.getElementById('adminMsg').innerHTML =
    '<span class="badge bg-primary">✅ Partido agregado</span>';
});
