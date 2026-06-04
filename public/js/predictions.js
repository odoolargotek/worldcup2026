// ====================================================
// predictions.js — Guardar/cargar pronóstico de usuario
// ====================================================
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');
const MATCH_ID = params.get('mid');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const matchSnap = await getDoc(doc(db, 'matches', MATCH_ID));
  if (!matchSnap.exists()) return;
  const m = matchSnap.data();
  const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);

  // Rellenar vista
  document.getElementById('homeFlag').textContent = m.home_flag || '🏳';
  document.getElementById('awayFlag').textContent = m.away_flag || '🏳';
  document.getElementById('homeName').textContent = m.home_team;
  document.getElementById('awayName').textContent = m.away_team;
  document.getElementById('matchPhase').textContent = m.phase;
  document.getElementById('matchKickoff').textContent = kickoff.toLocaleString('es-BO');
  document.getElementById('backLink').href = `group.html?gid=${GROUP_ID}`;

  // Bloquear si el partido ya empezó o ya tiene resultado
  if (kickoff <= new Date() || m.home_score !== undefined) {
    document.getElementById('submitPrediction').disabled = true;
    document.getElementById('predictMsg').innerHTML =
      '<span class="badge bg-secondary">Pronóstico cerrado</span>';
  }

  // Cargar pronóstico previo
  const predId = `${GROUP_ID}_${MATCH_ID}_${user.uid}`;
  const predSnap = await getDoc(doc(db, 'predictions', predId));
  if (predSnap.exists()) {
    const p = predSnap.data();
    document.getElementById('homeScore').value = p.home_score;
    document.getElementById('awayScore').value = p.away_score;
  }

  // Guardar pronóstico
  document.getElementById('predictForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hs = parseInt(document.getElementById('homeScore').value);
    const as = parseInt(document.getElementById('awayScore').value);
    await setDoc(doc(db, 'predictions', predId), {
      group_id: GROUP_ID,
      match_id: MATCH_ID,
      user_uid: user.uid,
      home_score: hs,
      away_score: as,
      points: null,
      saved_at: new Date()
    });
    document.getElementById('predictMsg').innerHTML =
      '<span class="badge bg-success">✅ Pronóstico guardado</span>';
  });
});
