// fix-knockout-teams.js
// Actualiza partidos de Octavos con equipos reales y carga Cuartos/Semis/3er/Final
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// =============================================
// OCTAVOS DE FINAL — equipos reales
// kickoffUTC = hora oficial UTC del partido
// Los 4 con offset Bolivia (-4h) se listan con su alternativa -4h también
// =============================================
const OCTAVOS_REAL = [
  // Hoy 4-Jul 13:00 BOT = 17:00 UTC  (alternativa guardada: 13:00 UTC = 09:00 BOT)
  { kickoffUTC: '2026-07-04T17:00:00Z', home_team: 'Canadá',        home_flag: '🇨🇦', away_team: 'Marruecos',      away_flag: '🇲🇦', phase: 'Octavos', city: 'Seattle' },
  // Hoy 4-Jul 17:00 BOT = 21:00 UTC
  { kickoffUTC: '2026-07-04T21:00:00Z', home_team: 'Paraguay',      home_flag: '🇵🇾', away_team: 'Francia',        away_flag: '🇫🇷', phase: 'Octavos', city: 'Kansas City' },
  // 5-Jul 16:00 BOT = 20:00 UTC
  { kickoffUTC: '2026-07-05T20:00:00Z', home_team: 'Brasil',        home_flag: '🇧🇷', away_team: 'Noruega',        away_flag: '🇳🇴', phase: 'Octavos', city: 'Boston' },
  // 5-Jul 20:00 BOT = 00:00 UTC 6-Jul
  { kickoffUTC: '2026-07-06T00:00:00Z', home_team: 'México',        home_flag: '🇲🇽', away_team: 'Inglaterra',     away_flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', phase: 'Octavos', city: 'Atlanta' },
  // 6-Jul 15:00 BOT = 19:00 UTC
  { kickoffUTC: '2026-07-06T19:00:00Z', home_team: 'Portugal',      home_flag: '🇵🇹', away_team: 'España',         away_flag: '🇪🇸', phase: 'Octavos', city: 'Miami' },
  // 6-Jul 20:00 BOT = 00:00 UTC 7-Jul
  { kickoffUTC: '2026-07-07T00:00:00Z', home_team: 'Estados Unidos',home_flag: '🇺🇸', away_team: 'Bélgica',        away_flag: '🇧🇪', phase: 'Octavos', city: 'Dallas' },
  // 7-Jul 12:00 BOT = 16:00 UTC
  { kickoffUTC: '2026-07-07T16:00:00Z', home_team: 'Argentina',     home_flag: '🇦🇷', away_team: 'Egipto',         away_flag: '🇪🇬', phase: 'Octavos', city: 'Houston' },
  // 7-Jul 16:00 BOT = 20:00 UTC
  { kickoffUTC: '2026-07-07T20:00:00Z', home_team: 'Suiza',         home_flag: '🇨🇭', away_team: 'Colombia',       away_flag: '🇨🇴', phase: 'Octavos', city: 'San Francisco' },
];

// =============================================
// CUARTOS DE FINAL
// =============================================
const CUARTOS = [
  { kickoffUTC: '2026-07-09T20:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Cuartos', city: 'Por definir', type: 'cuartos' },
  { kickoffUTC: '2026-07-10T19:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Cuartos', city: 'Por definir', type: 'cuartos' },
  { kickoffUTC: '2026-07-11T21:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Cuartos', city: 'Por definir', type: 'cuartos' },
  { kickoffUTC: '2026-07-12T01:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Cuartos', city: 'Por definir', type: 'cuartos' },
];

// =============================================
// SEMIFINALES
// =============================================
const SEMIS = [
  { kickoffUTC: '2026-07-14T19:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Semifinales', city: 'Por definir', type: 'semifinal' },
  { kickoffUTC: '2026-07-15T19:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Semifinales', city: 'Por definir', type: 'semifinal' },
];

// =============================================
// 3ER LUGAR Y FINAL
// =============================================
const TERCERO_FINAL = [
  { kickoffUTC: '2026-07-18T21:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Tercer lugar', city: 'Por definir', type: 'tercer_lugar' },
  { kickoffUTC: '2026-07-19T19:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Final',        city: 'Por definir', type: 'final' },
];

// ==============================
// UTILIDADES
// ==============================
function log(msg, type = 'info') {
  const el = document.getElementById('fixLog');
  if (!el) return;
  const colors = { info: '#4aafd4', ok: '#34d399', warn: '#fbbf24', err: '#f87171' };
  el.innerHTML += `<div style="color:${colors[type]||'#fff'};font-size:13px;padding:2px 0">${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

const MS_4H = 4 * 60 * 60 * 1000; // ±4 horas en ms

function getMs(firestoreVal) {
  if (!firestoreVal) return 0;
  if (firestoreVal.toDate) return firestoreVal.toDate().getTime();
  return new Date(firestoreVal).getTime();
}

// ==============================
// FIX OCTAVOS — estrategia tri-nivel
// 1° Busca por kickoff ±4h
// 2° Si falla, muestra los restantes sin asignar con su kickoff real
//    para que el admin los confirme o el script los asigne por orden
// 3° Fallback: asigna por orden de kickoff a los no emparejados
// ==============================
async function fixOctavosTeams() {
  log('🔍 Leyendo todos los partidos de Octavos en Firestore...');

  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtrar Octavos (phase o type)
  let octavos = allMatches.filter(m => {
    const p = (m.phase || '').toLowerCase();
    const t = (m.type  || '').toLowerCase();
    return p.includes('octavo') || p === 'octavos' ||
           t.includes('octavo') || t.includes('ronda_16') || t.includes('r32');
  });

  // También incluir los que tengan phase === 'Ronda de 32'
  const r32 = allMatches.filter(m => {
    const p = (m.phase || '').toLowerCase();
    return p.includes('ronda de 32') || p.includes('ronda_32') || p === 'r32';
  });
  octavos = [...new Map([...octavos, ...r32].map(m => [m.id, m])).values()];

  // Ordenar por kickoff
  octavos.sort((a, b) => getMs(a.kickoff) - getMs(b.kickoff));

  log(`📋 Encontrados ${octavos.length} partido(s) knockout sin fase de grupos`);
  if (octavos.length === 0) {
    log('⚠️ No se encontraron partidos de Octavos/R32. Verifica la phase en Firestore.', 'warn');
    document.getElementById('fixOctavosBtn').disabled = false;
    document.getElementById('fixOctavosBtn').textContent = '🔄 Actualizar Octavos';
    return;
  }

  // Mostrar dump de IDs + kickoffs para diagnóstico
  log('📊 Partidos encontrados en Firestore:', 'info');
  octavos.forEach(m => {
    const kms  = getMs(m.kickoff);
    const kStr = kms ? new Date(kms).toISOString() : '?';
    log(`  → [${m.id}] ${m.home_team} vs ${m.away_team} | kickoff: ${kStr}`, 'warn');
  });

  // — FASE 1: emparejar por kickoff ±4h —
  const reales   = [...OCTAVOS_REAL]; // copia para marcar usados
  const matched  = new Map(); // docId → real
  const usedReal = new Set();

  for (const real of reales) {
    const targetMs = new Date(real.kickoffUTC).getTime();
    const match = octavos.find(m =>
      !matched.has(m.id) &&
      Math.abs(getMs(m.kickoff) - targetMs) <= MS_4H
    );
    if (match) {
      matched.set(match.id, real);
      usedReal.add(real.kickoffUTC);
      log(`✅ Emparejado por kickoff: [${match.id}] ${match.home_team} → ${real.home_team} vs ${real.away_team}`, 'ok');
    }
  }

  // — FASE 2: fallback ordinal para los no emparejados —
  const unmatchedOct  = octavos.filter(m => !matched.has(m.id));
  const unmatchedReal = reales.filter(r => !usedReal.has(r.kickoffUTC));

  if (unmatchedOct.length > 0 && unmatchedReal.length > 0) {
    log(`\n🔄 Fallback ordinal: ${unmatchedOct.length} partido(s) sin emparejar → asignando por orden de kickoff`, 'warn');
    unmatchedOct.forEach((m, i) => {
      if (unmatchedReal[i]) {
        matched.set(m.id, unmatchedReal[i]);
        log(`🟡 Ordinal [${m.id}] ${m.home_team} → ${unmatchedReal[i].home_team} vs ${unmatchedReal[i].away_team}`, 'warn');
      }
    });
  }

  // — FASE 3: aplicar updates a Firestore —
  let updated = 0;
  for (const [docId, real] of matched) {
    await updateDoc(doc(db, 'matches', docId), {
      home_team: real.home_team,
      home_flag: real.home_flag,
      away_team: real.away_team,
      away_flag: real.away_flag,
      city:      real.city,
    });
    log(`🟢 Guardado: [${docId}] → ${real.home_team} vs ${real.away_team}`, 'ok');
    updated++;
  }

  const notDone = octavos.length - updated;
  log(`\n📊 Resultado final: ${updated} actualizados · ${notDone} sin asignar`, updated === OCTAVOS_REAL.length ? 'ok' : 'warn');

  if (notDone > 0) {
    log('⚠️ Partidos sin asignar: revisa el dump de kickoffs arriba y ajusta manualmente en Firebase Console.', 'warn');
  }

  document.getElementById('fixOctavosBtn').disabled = false;
  document.getElementById('fixOctavosBtn').textContent = '🔄 Actualizar Octavos';
}

// ==============================
// CARGAR NUEVAS FASES
// ==============================
async function loadNewPhases(matches, label) {
  log(`\n📥 Cargando ${label}...`);

  let inserted = 0, skipped = 0;
  for (const m of matches) {
    const targetMs = new Date(m.kickoffUTC).getTime();
    const snapPhase = await getDocs(query(collection(db, 'matches'), where('phase', '==', m.phase)));
    const dup = snapPhase.docs.find(d => Math.abs(getMs(d.data().kickoff) - targetMs) <= MS_4H);

    if (dup) {
      log(`⏭️ Ya existe: ${m.phase} @ ${m.kickoffUTC}`, 'warn');
      skipped++;
      continue;
    }

    await addDoc(collection(db, 'matches'), {
      home_team: m.home_team, home_flag: m.home_flag,
      away_team: m.away_team, away_flag: m.away_flag,
      kickoff:   new Date(m.kickoffUTC),
      phase:     m.phase,
      city:      m.city,
      type:      m.type,
      finished:  false,
    });
    log(`✅ Insertado: ${m.phase} @ ${m.kickoffUTC}`, 'ok');
    inserted++;
  }
  log(`📊 ${label}: ${inserted} insertados · ${skipped} ya existían`, inserted > 0 ? 'ok' : 'info');
}

// ==============================
// AUTH + BOTONES
// ==============================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  document.getElementById('fixOctavosBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('fixOctavosBtn');
    btn.disabled = true; btn.textContent = '⏳ Procesando...';
    document.getElementById('fixLog').innerHTML = '';
    await fixOctavosTeams();
  });

  document.getElementById('loadCuartosBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loadCuartosBtn');
    btn.disabled = true; btn.textContent = '⏳ Cargando...';
    document.getElementById('fixLog').innerHTML = '';
    await loadNewPhases(CUARTOS, 'Cuartos de Final');
    btn.disabled = false; btn.textContent = '⚽ Cargar Cuartos';
  });

  document.getElementById('loadSemisBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loadSemisBtn');
    btn.disabled = true; btn.textContent = '⏳ Cargando...';
    document.getElementById('fixLog').innerHTML = '';
    await loadNewPhases(SEMIS, 'Semifinales');
    btn.disabled = false; btn.textContent = '🏆 Cargar Semifinales';
  });

  document.getElementById('loadFinalBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loadFinalBtn');
    btn.disabled = true; btn.textContent = '⏳ Cargando...';
    document.getElementById('fixLog').innerHTML = '';
    await loadNewPhases([...TERCERO_FINAL], '3er lugar + Final');
    btn.disabled = false; btn.textContent = '🥇 Cargar 3er lugar + Final';
  });

  document.getElementById('loadAllPhasesBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loadAllPhasesBtn');
    btn.disabled = true; btn.textContent = '⏳ Cargando todo...';
    document.getElementById('fixLog').innerHTML = '';
    await loadNewPhases(CUARTOS, 'Cuartos');
    await loadNewPhases(SEMIS, 'Semifinales');
    await loadNewPhases([...TERCERO_FINAL], '3er lugar + Final');
    btn.disabled = false; btn.textContent = '🚀 Cargar todas las fases';
  });
});
