// fix-knockout-teams.js
// Actualiza partidos de Octavos con equipos reales y carga Cuartos/Semis/3er/Final
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// =============================================
// OCTAVOS DE FINAL — equipos reales confirmados
// La clave es el kickoff UTC para identificar cada partido en Firestore
// =============================================
const OCTAVOS_REAL = [
  // Hoy 4-Jul — 1:00 PM hora local Bolivia = 17:00 UTC
  { kickoffUTC: '2026-07-04T17:00:00Z', home_team: 'Canadá',        home_flag: '🇨🇦', away_team: 'Marruecos',     away_flag: '🇲🇦', phase: 'Octavos', city: 'Seattle' },
  // Hoy 4-Jul — 5:00 PM hora local Bolivia = 21:00 UTC
  { kickoffUTC: '2026-07-04T21:00:00Z', home_team: 'Paraguay',      home_flag: '🇵🇾', away_team: 'Francia',       away_flag: '🇫🇷', phase: 'Octavos', city: 'Kansas City' },
  // Mañana 5-Jul — 4:00 PM = 20:00 UTC
  { kickoffUTC: '2026-07-05T20:00:00Z', home_team: 'Brasil',        home_flag: '🇧🇷', away_team: 'Noruega',       away_flag: '🇳🇴', phase: 'Octavos', city: 'Boston' },
  // Mañana 5-Jul — 8:00 PM = 00:00 UTC 6-Jul
  { kickoffUTC: '2026-07-06T00:00:00Z', home_team: 'México',        home_flag: '🇲🇽', away_team: 'Inglaterra',    away_flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', phase: 'Octavos', city: 'Atlanta' },
  // Lun 6-Jul — 3:00 PM = 19:00 UTC
  { kickoffUTC: '2026-07-06T19:00:00Z', home_team: 'Portugal',      home_flag: '🇵🇹', away_team: 'España',        away_flag: '🇪🇸', phase: 'Octavos', city: 'Miami' },
  // Lun 6-Jul — 8:00 PM = 00:00 UTC 7-Jul
  { kickoffUTC: '2026-07-07T00:00:00Z', home_team: 'Estados Unidos',home_flag: '🇺🇸', away_team: 'Bélgica',       away_flag: '🇧🇪', phase: 'Octavos', city: 'Dallas' },
  // Mar 7-Jul — 12:00 PM = 16:00 UTC
  { kickoffUTC: '2026-07-07T16:00:00Z', home_team: 'Argentina',     home_flag: '🇦🇷', away_team: 'Egipto',        away_flag: '🇪🇬', phase: 'Octavos', city: 'Houston' },
  // Mar 7-Jul — 4:00 PM = 20:00 UTC
  { kickoffUTC: '2026-07-07T20:00:00Z', home_team: 'Suiza',         home_flag: '🇨🇭', away_team: 'Colombia',      away_flag: '🇨🇴', phase: 'Octavos', city: 'San Francisco' },
];

// =============================================
// CUARTOS DE FINAL — equipos Por Definir
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
  { kickoffUTC: '2026-07-19T19:00:00Z', home_team: 'Por definir', home_flag: '⚽', away_team: 'Por definir', away_flag: '⚽', phase: 'Final', city: 'Por definir', type: 'final' },
];

// ==============================
// UTILIDADES
// ==============================
function log(msg, type = 'info') {
  const el = document.getElementById('fixLog');
  if (!el) return;
  const colors = { info: '#4aafd4', ok: '#34d399', warn: '#fbbf24', err: '#f87171' };
  el.innerHTML += `<div style="color:${colors[type] || '#fff'};font-size:13px;padding:2px 0">${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

function toDate(iso) { return new Date(iso); }

// ==============================
// FUNCIÓN PRINCIPAL: actualizar Octavos
// ==============================
async function fixOctavosTeams() {
  log('🔍 Buscando partidos de Octavos en Firestore...');
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtrar solo partidos de Octavos
  const octavosInDB = allMatches.filter(m => {
    const p = (m.phase || '').toLowerCase();
    const t = (m.type  || '').toLowerCase();
    return p.includes('octavo') || t.includes('octavo') || t.includes('ronda_16') || t.includes('r32') === false && p === 'octavos';
  });

  log(`📋 Encontrados ${octavosInDB.length} partido(s) de Octavos en Firestore`);
  if (octavosInDB.length === 0) {
    log('⚠️ No hay partidos de Octavos. Verifica que estén cargados con phase=Octavos', 'warn');
  }

  let updated = 0, notFound = 0;

  for (const real of OCTAVOS_REAL) {
    const targetTime = toDate(real.kickoffUTC).getTime();
    // Buscar por kickoff (con margen de ±5 min = 300000ms)
    const match = octavosInDB.find(m => {
      const mTime = m.kickoff?.toDate ? m.kickoff.toDate().getTime() : new Date(m.kickoff).getTime();
      return Math.abs(mTime - targetTime) < 300000;
    });

    if (!match) {
      log(`❌ No encontrado: ${real.home_team} vs ${real.away_team} @ ${real.kickoffUTC}`, 'err');
      notFound++;
      continue;
    }

    await updateDoc(doc(db, 'matches', match.id), {
      home_team: real.home_team,
      home_flag: real.home_flag,
      away_team: real.away_team,
      away_flag: real.away_flag,
      city:      real.city,
    });
    log(`✅ Actualizado: ${match.home_team} → ${real.home_team} vs ${real.away_team} (id: ${match.id})`, 'ok');
    updated++;
  }

  log(`\n📊 Resultado: ${updated} actualizados · ${notFound} no encontrados`, updated > 0 ? 'ok' : 'warn');
  document.getElementById('fixOctavosBtn').disabled = false;
  document.getElementById('fixOctavosBtn').textContent = '🔄 Actualizar Octavos';
}

// ==============================
// FUNCIÓN: cargar nuevas fases
// ==============================
async function loadNewPhases(matches, label) {
  log(`\n📥 Cargando ${label}...`);
  const snap = await getDocs(collection(db, 'matches'));
  const existing = snap.docs.map(d => ({
    id: d.id,
    kickoffMs: d.data().kickoff?.toDate ? d.data().kickoff.toDate().getTime() : new Date(d.data().kickoff).getTime()
  }));

  let inserted = 0, skipped = 0;
  for (const m of matches) {
    const targetMs = toDate(m.kickoffUTC).getTime();
    const dup = existing.find(e => Math.abs(e.kickoffMs - targetMs) < 300000 &&
      // también verificar si la phase coincide
      true
    );
    // Verificar duplicado más estricto: mismo kickoff Y misma fase
    const snapPhase = await getDocs(query(
      collection(db, 'matches'),
      where('phase', '==', m.phase)
    ));
    const dupStrict = snapPhase.docs.find(d => {
      const ms = d.data().kickoff?.toDate ? d.data().kickoff.toDate().getTime() : new Date(d.data().kickoff).getTime();
      return Math.abs(ms - targetMs) < 300000;
    });

    if (dupStrict) {
      log(`⏭️ Ya existe: ${m.phase} @ ${m.kickoffUTC}`, 'warn');
      skipped++;
      continue;
    }

    await addDoc(collection(db, 'matches'), {
      home_team: m.home_team, home_flag: m.home_flag,
      away_team: m.away_team, away_flag: m.away_flag,
      kickoff:   toDate(m.kickoffUTC),
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
// AUTH + UI
// ==============================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  document.getElementById('fixOctavosBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('fixOctavosBtn');
    btn.disabled = true; btn.textContent = '⏳ Actualizando...';
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
