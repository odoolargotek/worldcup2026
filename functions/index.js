const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest }  = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

initializeApp();
const db = getFirestore();

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';

const ALIASES = {
  'mexico': ['mexico','méxico'],
  'usa': ['usa','united states','united states of america'],
  'south korea': ['south korea','corea del sur','korea republic'],
};
function norm(n) {
  const s = (n || '').toLowerCase().trim();
  for (const [c, vs] of Object.entries(ALIASES)) if (vs.includes(s)) return c;
  return s;
}

/**
 * syncStreamingDaily:
 * Cron diario a las 9:30 AM hora Bolivia (UTC-4 = 13:30 UTC)
 * Actualiza canales de streaming para partidos del día.
 */
exports.syncStreamingDaily = onSchedule({
  schedule: '30 13 * * *',   // 13:30 UTC = 9:30 AM Bolivia
  timeZone: 'America/La_Paz',
  region: 'us-central1',
}, async () => {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  console.log(`[syncStreaming] Inicio — fecha Bolivia: ${todayStr}`);

  // Traer partidos de hoy
  const matchesSnap = await db.collection('matches').get();
  const todayMatches = matchesSnap.docs.filter(d => {
    const ko = d.data().kickoff?.toDate?.() || new Date(d.data().kickoff);
    return ko.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' }) === todayStr;
  });

  if (!todayMatches.length) {
    console.log('[syncStreaming] Sin partidos hoy.');
    return;
  }

  // Consultar TheSportsDB
  const resp   = await fetch(`${TSDB}/eventsday.php?d=${todayStr}&l=FIFA%20World%20Cup`);
  const json   = await resp.json();
  const events = json.events || [];
  console.log(`[syncStreaming] ${events.length} eventos de TheSportsDB`);

  let updated = 0;
  for (const mDoc of todayMatches) {
    const m  = mDoc.data();
    const ev = events.find(e => norm(e.strHomeTeam) === norm(m.home_team) && norm(e.strAwayTeam) === norm(m.away_team));
    if (!ev) { console.log(`  ⚠️ Sin match: ${m.home_team} vs ${m.away_team}`); continue; }

    const channels = [];
    if (ev.strTVStation) channels.push(ev.strTVStation);
    if (ev.strVideo)     channels.push(ev.strVideo);

    await db.collection('matches').doc(mDoc.id).update({
      channels,
      tv_station:          ev.strTVStation || null,
      stream_url:          ev.strVideo     || null,
      thumb:               ev.strThumb     || null,
      tsdb_id:             ev.idEvent      || null,
      channels_synced_at:  Timestamp.now(),
    });
    console.log(`  ✅ ${m.home_team} vs ${m.away_team} → ${channels.join(', ') || 'sin canal'}`);
    updated++;
  }

  // Guardar log en Firestore
  await db.collection('app_config').doc('streaming_sync').set({
    last_sync:       Timestamp.now(),
    matches_updated: updated,
    date_synced:     todayStr,
    trigger:         'scheduled',
  });

  console.log(`[syncStreaming] Fin — ${updated} partido(s) actualizados.`);
});

/**
 * syncStreamingManual:
 * Endpoint HTTP para trigger manual desde el admin si fuera necesario
 * (el botón del admin lo hace directo desde Firestore sin esta función,
 * este endpoint queda como fallback)
 */
exports.syncStreamingManual = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  res.json({ ok: true, message: 'Usa el botón del admin que actualiza directo desde el browser.' });
});
