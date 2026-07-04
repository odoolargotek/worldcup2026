// fix-octavos-kickoffs.js
// Ajusta los kickoffs de los 8 partidos de Octavos a los horarios oficiales (BOT, UTC-4) guardados en UTC

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// Horarios oficiales en Bolivia (BOT) convertidos a UTC
// BOT = UTC-4
const OCTAVOS_KICKOFFS = [
  // Vie 4/7 — 1:00 pm BOT → 17:00 UTC
  { home: 'Canadá',        away: 'Marruecos',  kickoffUTC: '2026-07-04T17:00:00Z' },
  // Vie 4/7 — 5:00 pm BOT → 21:00 UTC
  { home: 'Paraguay',      away: 'Francia',    kickoffUTC: '2026-07-04T21:00:00Z' },
  // Sáb 5/7 — 4:00 pm BOT → 20:00 UTC
  { home: 'Brasil',        away: 'Noruega',    kickoffUTC: '2026-07-05T20:00:00Z' },
  // Sáb 5/7 — 8:00 pm BOT → 00:00 UTC 6/7
  { home: 'México',        away: 'Inglaterra', kickoffUTC: '2026-07-06T00:00:00Z' },
  // Lun 6/7 — 3:00 pm BOT → 19:00 UTC
  { home: 'Portugal',      away: 'España',     kickoffUTC: '2026-07-06T19:00:00Z' },
  // Lun 6/7 — 8:00 pm BOT → 00:00 UTC 7/7
  { home: 'Estados Unidos',away: 'Bélgica',    kickoffUTC: '2026-07-07T00:00:00Z' },
  // Mar 7/7 — 12:00 pm BOT → 16:00 UTC
  { home: 'Argentina',     away: 'Egipto',     kickoffUTC: '2026-07-07T16:00:00Z' },
  // Mar 7/7 — 4:00 pm BOT → 20:00 UTC
  { home: 'Suiza',         away: 'Colombia',   kickoffUTC: '2026-07-07T20:00:00Z' },
];

function log(msg, type = 'info') {
  const el = document.getElementById('octLog');
  if (!el) return;
  const colors = {
    info: '#4aafd4',
    ok:   '#34d399',
    warn: '#fbbf24',
    err:  '#f87171',
  };
  el.innerHTML += `<div style="color:${colors[type] || '#fff'};font-size:13px;padding:2px 0">${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

function toJsDate(iso) {
  return new Date(iso);
}

async function fixOctavosKickoffs() {
  log('🔍 Buscando partidos de Octavos por equipos (home+away)...');

  let updated = 0;
  let missing = 0;
  let skipped = 0;

  for (const cfg of OCTAVOS_KICKOFFS) {
    const q = query(
      collection(db, 'matches'),
      where('home_team', '==', cfg.home),
      where('away_team', '==', cfg.away)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      log(`❌ No encontrado en Firestore: ${cfg.home} vs ${cfg.away}`, 'err');
      missing++;
      continue;
    }

    const d = snap.docs[0];
    const data = d.data();

    // No tocar partidos que ya estén marcados como finalizados
    if (data.finished) {
      log(`⏭️ ${cfg.home} vs ${cfg.away} [${d.id}] ya está FINAL · se deja sin cambios`, 'warn');
      skipped++;
      continue;
    }

    const oldKickoffRaw = data.kickoff;
    const oldKickoff = oldKickoffRaw?.toDate
      ? oldKickoffRaw.toDate()
      : oldKickoffRaw
        ? new Date(oldKickoffRaw)
        : null;

    const oldIso = oldKickoff ? oldKickoff.toISOString() : '(sin kickoff)';

    const newKickoff = toJsDate(cfg.kickoffUTC);
    const newIso = newKickoff.toISOString();

    await updateDoc(doc(db, 'matches', d.id), { kickoff: newKickoff });

    log(`✅ ${cfg.home} vs ${cfg.away} [${d.id}]`, 'ok');
    log(`   ⏱️ Antes: ${oldIso}`, 'info');
    log(`   ⏱️ Ahora: ${newIso}`, 'info');

    updated++;
  }

  log(
    `\n📊 Ajuste completo: ${updated} actualizados · ${skipped} saltados (FINAL) · ${missing} no encontrados`,
    updated ? 'ok' : 'warn'
  );

  const btn = document.getElementById('fixKickoffsBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '⚙️ Ajustar horarios Octavos';
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // solo admin logueado
    window.location.href = 'index.html';
    return;
  }
  const btn = document.getElementById('fixKickoffsBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '⏳ Ajustando...';
      const logBox = document.getElementById('octLog');
      if (logBox) logBox.innerHTML = '';
      await fixOctavosKickoffs();
    });
  }
});
