// fix-team-names.js
// Corrige nombres inconsistentes de equipos en Firestore
// SIN borrar partidos ni pronósticos — solo actualiza home_team / away_team
import { db } from './firebase-config.js';
import { collection, getDocs, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// Mapa: nombre incorrecto (lowercase) → nombre canónico correcto
const NAME_FIX = {
  // Qatar
  'catar':             { name: 'Qatar',          flag: '🇶🇦' },
  'katar':             { name: 'Qatar',          flag: '🇶🇦' },
  // USA
  'estados unidos':    { name: 'USA',            flag: '🇺🇸' },
  'united states':     { name: 'USA',            flag: '🇺🇸' },
  // Turquía
  'türkiye':           { name: 'Turquía',        flag: '🇹🇷' },
  'turkey':            { name: 'Turquía',        flag: '🇹🇷' },
  // Países Bajos
  'netherlands':       { name: 'Países Bajos',   flag: '🇳🇱' },
  'holanda':           { name: 'Países Bajos',   flag: '🇳🇱' },
  'holland':           { name: 'Países Bajos',   flag: '🇳🇱' },
  // Corea del Sur
  'south korea':       { name: 'Corea del Sur',  flag: '🇰🇷' },
  'korea republic':    { name: 'Corea del Sur',  flag: '🇰🇷' },
  // Chequia
  'czech republic':    { name: 'Chequia',        flag: '🇨🇿' },
  'czechia':           { name: 'Chequia',        flag: '🇨🇿' },
  // México
  'mexico':            { name: 'México',         flag: '🇲🇽' },
  // Bosnia
  'bosnia and herzegovina': { name: 'Bosnia y Herzegovina', flag: '🇧🇦' },
  'bosnia':            { name: 'Bosnia y Herzegovina', flag: '🇧🇦' },
  // Arabia Saudita
  'saudi arabia':      { name: 'Arabia Saudita', flag: '🇸🇦' },
  // Costa de Marfil
  "côte d'ivoire":     { name: 'Costa de Marfil', flag: '🇨🇮' },
  'ivory coast':       { name: 'Costa de Marfil', flag: '🇨🇮' },
  // RD Congo
  'dr congo':          { name: 'RD Congo',       flag: '🇨🇩' },
  'democratic republic of congo': { name: 'RD Congo', flag: '🇨🇩' },
  // Nueva Zelanda
  'new zealand':       { name: 'Nueva Zelanda',  flag: '🇳🇿' },
  // Cabo Verde
  'cape verde':        { name: 'Cabo Verde',     flag: '🇨🇻' },
};

export async function fixTeamNames(onLog) {
  const log = onLog || (() => {});
  const snap = await getDocs(collection(db, 'matches'));

  let fixed = 0;
  let checked = 0;

  // Firestore permite max 500 ops por batch
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const d of snap.docs) {
    const m = d.data();
    const homeKey = (m.home_team || '').toLowerCase().trim();
    const awayKey = (m.away_team || '').toLowerCase().trim();
    const fixHome = NAME_FIX[homeKey];
    const fixAway = NAME_FIX[awayKey];
    checked++;

    if (fixHome || fixAway) {
      const update = {};
      if (fixHome) {
        update.home_team = fixHome.name;
        update.home_flag = fixHome.flag;
        log(`  🔧 [${m.phase}] home: "${m.home_team}" → "${fixHome.name}"`, '#a78bfa');
      }
      if (fixAway) {
        update.away_team = fixAway.name;
        update.away_flag = fixAway.flag;
        log(`  🔧 [${m.phase}] away: "${m.away_team}" → "${fixAway.name}"`, '#a78bfa');
      }
      batch.update(doc(db, 'matches', d.id), update);
      batchCount++;
      fixed++;

      // Commit batch cada 400 para no exceder límite
      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();

  log(`\n✅ ${checked} partidos revisados — ${fixed} nombres corregidos`, fixed > 0 ? '#34d399' : 'var(--text-muted)');
  return { checked, fixed };
}
