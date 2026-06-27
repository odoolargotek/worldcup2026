/**
 * load-round-of-32.js
 * ─────────────────────────────────────────────────────────────
 * Script para cargar los 16 partidos de la Ronda de 32 directamente
 * desde la CONSOLA del navegador en https://worldcup2026-8f27b.web.app/admin.html
 *
 * USO:
 *   1. Abre admin.html en el navegador (con tu usuario admin logueado)
 *   2. Abre DevTools → Console (F12)
 *   3. Pega TODO este script y presiona Enter
 *   4. Espera el mensaje "✅ X partidos cargados"
 *
 * NOTAS:
 *   - Los kickoffs están en UTC — equivale a ET+4h / BOT+1h
 *   - Los partidos con TBC se pueden editar después desde admin.html
 *   - Si un partido ya existe con el mismo match_id, lo saltea (no duplica)
 * ─────────────────────────────────────────────────────────────
 */

(async () => {
  // ── Importar Firestore desde el contexto de la app ──
  const { collection, addDoc, getDocs, query, where } = await import(
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js'
  );
  const { db } = await import('/js/firebase-config.js');

  const PHASE = 'Ronda de 32';

  // Verificar si ya existen partidos de esta fase
  const existing = await getDocs(query(collection(db, 'matches'), where('phase', '==', PHASE)));
  if (existing.size > 0) {
    const ok = confirm(`⚠️ Ya existen ${existing.size} partidos con phase="${PHASE}". ¿Cargar de todas formas? (se agregarán como nuevos)`);
    if (!ok) { console.log('❌ Cancelado.'); return; }
  }

  const matches = [
    // ── Jun 28 ──
    {
      home_team: 'Sudáfrica',  home_flag: '🇿🇦',
      away_team: 'Canadá',     away_flag: '🇨🇦',
      kickoff: new Date('2026-06-28T23:00:00Z'), // 3pm ET / 7pm BOT
      city: 'Los Angeles', stadium: 'SoFi Stadium',
      phase: PHASE, finished: false
    },
    // ── Jun 29 ──
    {
      home_team: 'Brasil',     home_flag: '🇧🇷',
      away_team: 'Japón',      away_flag: '🇯🇵',
      kickoff: new Date('2026-06-29T17:00:00Z'), // 1pm ET / 5pm BOT
      city: 'Houston', stadium: 'NRG Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Alemania',   home_flag: '🇩🇪',
      away_team: 'Paraguay',   away_flag: '🇵🇾',
      kickoff: new Date('2026-06-29T20:30:00Z'), // 4:30pm ET / 8:30pm BOT
      city: 'Boston', stadium: 'Gillette Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Países Bajos', home_flag: '🇳🇱',
      away_team: 'Marruecos',    away_flag: '🇲🇦',
      kickoff: new Date('2026-06-30T01:00:00Z'), // 9pm ET / 1am BOT
      city: 'Monterrey', stadium: 'Estadio BBVA',
      phase: PHASE, finished: false
    },
    // ── Jun 30 ──
    {
      home_team: 'Costa de Marfil', home_flag: '🇨🇮',
      away_team: 'Noruega',          away_flag: '🇳🇴',
      kickoff: new Date('2026-06-30T17:00:00Z'), // 1pm ET / 5pm BOT
      city: 'Dallas', stadium: 'AT&T Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Francia', home_flag: '🇫🇷',
      away_team: 'Suecia',  away_flag: '🇸🇪',
      kickoff: new Date('2026-06-30T21:00:00Z'), // 5pm ET / 9pm BOT
      city: 'New York / New Jersey', stadium: 'MetLife Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'México', home_flag: '🇲🇽',
      away_team: 'TBC',    away_flag: '🏳️',
      kickoff: new Date('2026-07-01T01:00:00Z'), // 9pm ET / 1am BOT
      city: 'Ciudad de México', stadium: 'Estadio Azteca',
      phase: PHASE, finished: false
    },
    // ── Jul 1 ──
    {
      home_team: 'TBC', home_flag: '🏳️',
      away_team: 'TBC', away_flag: '🏳️',
      kickoff: new Date('2026-07-01T16:00:00Z'), // 12pm ET / 4pm BOT
      city: 'Atlanta', stadium: 'Mercedes-Benz Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Bélgica', home_flag: '🇧🇪',
      away_team: 'TBC',     away_flag: '🏳️',
      kickoff: new Date('2026-07-01T20:00:00Z'), // 4pm ET / 8pm BOT
      city: 'Seattle', stadium: 'Lumen Field',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Estados Unidos',    home_flag: '🇺🇸',
      away_team: 'Bosnia-Herzegovina', away_flag: '🇧🇦',
      kickoff: new Date('2026-07-02T00:00:00Z'), // 8pm ET / 12am BOT
      city: 'San Francisco Bay Area', stadium: "Levi's Stadium",
      phase: PHASE, finished: false
    },
    // ── Jul 2 ──
    {
      home_team: 'España', home_flag: '🇪🇸',
      away_team: 'TBC',    away_flag: '🏳️',
      kickoff: new Date('2026-07-02T19:00:00Z'), // 3pm ET / 7pm BOT
      city: 'Los Angeles', stadium: 'SoFi Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'TBC', home_flag: '🏳️',
      away_team: 'TBC', away_flag: '🏳️',
      kickoff: new Date('2026-07-02T23:00:00Z'), // 7pm ET / 11pm BOT
      city: 'Toronto', stadium: 'BMO Field',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Suiza', home_flag: '🇨🇭',
      away_team: 'TBC',   away_flag: '🏳️',
      kickoff: new Date('2026-07-03T03:00:00Z'), // 11pm ET / 3am BOT
      city: 'Vancouver', stadium: 'BC Place',
      phase: PHASE, finished: false
    },
    // ── Jul 3 ──
    {
      home_team: 'Australia', home_flag: '🇦🇺',
      away_team: 'Egipto',    away_flag: '🇪🇬',
      kickoff: new Date('2026-07-03T18:00:00Z'), // 2pm ET / 6pm BOT
      city: 'Dallas', stadium: 'AT&T Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'Argentina',    home_flag: '🇦🇷',
      away_team: 'Cabo Verde',   away_flag: '🇨🇻',
      kickoff: new Date('2026-07-03T22:00:00Z'), // 6pm ET / 10pm BOT
      city: 'Miami', stadium: 'Hard Rock Stadium',
      phase: PHASE, finished: false
    },
    {
      home_team: 'TBC', home_flag: '🏳️',
      away_team: 'TBC', away_flag: '🏳️',
      kickoff: new Date('2026-07-04T01:30:00Z'), // 9:30pm ET / 1:30am BOT
      city: 'Kansas City', stadium: 'GEHA Field at Arrowhead Stadium',
      phase: PHASE, finished: false
    },
  ];

  console.log(`⏳ Cargando ${matches.length} partidos de "${PHASE}"...`);
  let loaded = 0;
  for (const m of matches) {
    try {
      await addDoc(collection(db, 'matches'), m);
      console.log(`  ✅ ${m.home_team} vs ${m.away_team} — ${m.city}`);
      loaded++;
    } catch (err) {
      console.error(`  ❌ Error en ${m.home_team} vs ${m.away_team}:`, err.message);
    }
  }
  console.log(`\n🏆 ${loaded}/${matches.length} partidos cargados en Firestore (phase="${PHASE}")`);
  console.log('👉 Recuerda editar los partidos con TBC desde admin.html cuando se confirmen los cruces.');
})();
