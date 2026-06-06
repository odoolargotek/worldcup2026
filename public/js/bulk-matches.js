// bulk-matches.js — Carga masiva del calendario fase de grupos Mundial 2026
// Fuente: FIFA / ESPN / BBC (abril-junio 2026)
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// Todos los 48 partidos de fase de grupos (horarios UTC-4 / hora Bolivia)
const ALL_MATCHES = [
  // ── GRUPO A: México, Sudáfrica, Corea del Sur, Chequia ──
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Sudáfrica',    away_flag:'🇿🇦', kickoff:'2026-06-11T15:00', phase:'Grupo A', city:'Ciudad de México' },
  { home_team:'Corea del Sur',home_flag:'🇰🇷', away_team:'Chequia',      away_flag:'🇨🇿', kickoff:'2026-06-11T22:00', phase:'Grupo A', city:'Los Ángeles' },
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Corea del Sur',away_flag:'🇰🇷', kickoff:'2026-06-15T22:00', phase:'Grupo A', city:'Ciudad de México' },
  { home_team:'Sudáfrica',    home_flag:'🇿🇦', away_team:'Chequia',      away_flag:'🇨🇿', kickoff:'2026-06-16T19:00', phase:'Grupo A', city:'Atlanta' },
  { home_team:'Sudáfrica',    home_flag:'🇿🇦', away_team:'Corea del Sur',away_flag:'🇰🇷', kickoff:'2026-06-20T20:00', phase:'Grupo A', city:'Dallas' },
  { home_team:'Chequia',      home_flag:'🇨🇿', away_team:'México',       away_flag:'🇲🇽', kickoff:'2026-06-20T20:00', phase:'Grupo A', city:'Ciudad de México' },
  // ── GRUPO B: Canadá, Bosnia y Herzegovina, Qatar, Suiza ──
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Bosnia y Herzegovina', away_flag:'🇧🇦', kickoff:'2026-06-12T15:00', phase:'Grupo B', city:'Toronto' },
  { home_team:'Qatar',        home_flag:'🇶🇦', away_team:'Suiza',        away_flag:'🇨🇭', kickoff:'2026-06-12T19:00', phase:'Grupo B', city:'Miami' },
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Qatar',        away_flag:'🇶🇦', kickoff:'2026-06-16T15:00', phase:'Grupo B', city:'Toronto' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Bosnia y Herzegovina', away_flag:'🇧🇦', kickoff:'2026-06-16T22:00', phase:'Grupo B', city:'Boston' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Canadá',       away_flag:'🇨🇦', kickoff:'2026-06-21T16:00', phase:'Grupo B', city:'Vancouver' },
  { home_team:'Bosnia y Herzegovina', home_flag:'🇧🇦', away_team:'Qatar', away_flag:'🇶🇦', kickoff:'2026-06-21T16:00', phase:'Grupo B', city:'Seattle' },
  // ── GRUPO C: Brasil, Marruecos, Haití, Escocia ──
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Marruecos',    away_flag:'🇲🇦', kickoff:'2026-06-13T16:00', phase:'Grupo C', city:'San Francisco' },
  { home_team:'Haití',        home_flag:'🇭🇹', away_team:'Escocia',      away_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', kickoff:'2026-06-13T22:00', phase:'Grupo C', city:'Nueva York' },
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Haití',        away_flag:'🇭🇹', kickoff:'2026-06-17T16:00', phase:'Grupo C', city:'Houston' },
  { home_team:'Marruecos',    home_flag:'🇲🇦', away_team:'Escocia',      away_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', kickoff:'2026-06-17T22:00', phase:'Grupo C', city:'Filadelfia' },
  { home_team:'Marruecos',    home_flag:'🇲🇦', away_team:'Haití',        away_flag:'🇭🇹', kickoff:'2026-06-22T20:00', phase:'Grupo C', city:'Dallas' },
  { home_team:'Escocia',      home_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', away_team:'Brasil',      away_flag:'🇧🇷', kickoff:'2026-06-22T20:00', phase:'Grupo C', city:'San Francisco' },
  // ── GRUPO D: USA, Paraguay, Australia, Turquía ──
  { home_team:'USA',          home_flag:'🇺🇸', away_team:'Paraguay',     away_flag:'🇵🇾', kickoff:'2026-06-12T21:00', phase:'Grupo D', city:'Los Ángeles' },
  { home_team:'Australia',    home_flag:'🇦🇺', away_team:'Turquía',      away_flag:'🇹🇷', kickoff:'2026-06-13T12:00', phase:'Grupo D', city:'Kansas City' },
  { home_team:'USA',          home_flag:'🇺🇸', away_team:'Australia',    away_flag:'🇦🇺', kickoff:'2026-06-17T19:00', phase:'Grupo D', city:'Dallas' },
  { home_team:'Turquía',      home_flag:'🇹🇷', away_team:'Paraguay',     away_flag:'🇵🇾', kickoff:'2026-06-17T22:00', phase:'Grupo D', city:'Boston' },
  { home_team:'Turquía',      home_flag:'🇹🇷', away_team:'USA',          away_flag:'🇺🇸', kickoff:'2026-06-22T16:00', phase:'Grupo D', city:'Atlanta' },
  { home_team:'Paraguay',     home_flag:'🇵🇾', away_team:'Australia',    away_flag:'🇦🇺', kickoff:'2026-06-22T16:00', phase:'Grupo D', city:'Miami' },
  // ── GRUPO E: Alemania, Curazao, Costa de Marfil, Ecuador ──
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Curazao',      away_flag:'🇨🇼', kickoff:'2026-06-13T19:00', phase:'Grupo E', city:'Nueva York' },
  { home_team:'Costa de Marfil', home_flag:'🇨🇮', away_team:'Ecuador',   away_flag:'🇪🇨', kickoff:'2026-06-14T15:00', phase:'Grupo E', city:'Seattle' },
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Costa de Marfil', away_flag:'🇨🇮', kickoff:'2026-06-18T15:00', phase:'Grupo E', city:'Filadelfia' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Curazao',      away_flag:'🇨🇼', kickoff:'2026-06-18T19:00', phase:'Grupo E', city:'Los Ángeles' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Alemania',     away_flag:'🇩🇪', kickoff:'2026-06-23T20:00', phase:'Grupo E', city:'Houston' },
  { home_team:'Curazao',      home_flag:'🇨🇼', away_team:'Costa de Marfil', away_flag:'🇨🇮', kickoff:'2026-06-23T20:00', phase:'Grupo E', city:'Dallas' },
  // ── GRUPO F: Países Bajos, Japón, Suecia, Túnez ──
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Japón',        away_flag:'🇯🇵', kickoff:'2026-06-14T12:00', phase:'Grupo F', city:'Vancouver' },
  { home_team:'Suecia',       home_flag:'🇸🇪', away_team:'Túnez',        away_flag:'🇹🇳', kickoff:'2026-06-14T19:00', phase:'Grupo F', city:'Atlanta' },
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Suecia',       away_flag:'🇸🇪', kickoff:'2026-06-18T22:00', phase:'Grupo F', city:'Kansas City' },
  { home_team:'Japón',        home_flag:'🇯🇵', away_team:'Túnez',        away_flag:'🇹🇳', kickoff:'2026-06-19T15:00', phase:'Grupo F', city:'Los Ángeles' },
  { home_team:'Japón',        home_flag:'🇯🇵', away_team:'Suecia',       away_flag:'🇸🇪', kickoff:'2026-06-23T16:00', phase:'Grupo F', city:'Seattle' },
  { home_team:'Túnez',        home_flag:'🇹🇳', away_team:'Países Bajos', away_flag:'🇳🇱', kickoff:'2026-06-23T16:00', phase:'Grupo F', city:'Boston' },
  // ── GRUPO G: Bélgica, Egipto, Irán, Nueva Zelanda ──
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Egipto',       away_flag:'🇪🇬', kickoff:'2026-06-14T22:00', phase:'Grupo G', city:'Miami' },
  { home_team:'Irán',         home_flag:'🇮🇷', away_team:'Nueva Zelanda',away_flag:'🇳🇿', kickoff:'2026-06-15T15:00', phase:'Grupo G', city:'Houston' },
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Irán',         away_flag:'🇮🇷', kickoff:'2026-06-19T19:00', phase:'Grupo G', city:'Nueva York' },
  { home_team:'Egipto',       home_flag:'🇪🇬', away_team:'Nueva Zelanda',away_flag:'🇳🇿', kickoff:'2026-06-19T22:00', phase:'Grupo G', city:'Toronto' },
  { home_team:'Egipto',       home_flag:'🇪🇬', away_team:'Irán',         away_flag:'🇮🇷', kickoff:'2026-06-24T20:00', phase:'Grupo G', city:'San Francisco' },
  { home_team:'Nueva Zelanda',home_flag:'🇳🇿', away_team:'Bélgica',      away_flag:'🇧🇪', kickoff:'2026-06-24T20:00', phase:'Grupo G', city:'Vancouver' },
  // ── GRUPO H: España, Cabo Verde, Arabia Saudita, Uruguay ──
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Cabo Verde',   away_flag:'🇨🇻', kickoff:'2026-06-15T12:00', phase:'Grupo H', city:'Los Ángeles' },
  { home_team:'Arabia Saudita', home_flag:'🇸🇦', away_team:'Uruguay',   away_flag:'🇺🇾', kickoff:'2026-06-15T19:00', phase:'Grupo H', city:'Kansas City' },
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Arabia Saudita', away_flag:'🇸🇦', kickoff:'2026-06-20T15:00', phase:'Grupo H', city:'Dallas' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'Cabo Verde',   away_flag:'🇨🇻', kickoff:'2026-06-20T19:00', phase:'Grupo H', city:'Seattle' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'España',       away_flag:'🇪🇸', kickoff:'2026-06-25T20:00', phase:'Grupo H', city:'Atlanta' },
  { home_team:'Cabo Verde',   home_flag:'🇨🇻', away_team:'Arabia Saudita', away_flag:'🇸🇦', kickoff:'2026-06-25T20:00', phase:'Grupo H', city:'Boston' },
  // ── GRUPO I: Francia, Senegal, Irak, Noruega ──
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Senegal',      away_flag:'🇸🇳', kickoff:'2026-06-16T12:00', phase:'Grupo I', city:'Filadelfia' },
  { home_team:'Irak',         home_flag:'🇮🇶', away_team:'Noruega',      away_flag:'🇳🇴', kickoff:'2026-06-16T19:00', phase:'Grupo I', city:'Miami' },
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Irak',         away_flag:'🇮🇶', kickoff:'2026-06-22T12:00', phase:'Grupo I', city:'Nueva York' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Senegal',      away_flag:'🇸🇳', kickoff:'2026-06-22T19:00', phase:'Grupo I', city:'Houston' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Francia',      away_flag:'🇫🇷', kickoff:'2026-06-26T16:00', phase:'Grupo I', city:'Los Ángeles' },
  { home_team:'Senegal',      home_flag:'🇸🇳', away_team:'Irak',         away_flag:'🇮🇶', kickoff:'2026-06-26T16:00', phase:'Grupo I', city:'Toronto' },
  // ── GRUPO J: Argentina, Argelia, Austria, Jordania ──
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Argelia',      away_flag:'🇩🇿', kickoff:'2026-06-17T12:00', phase:'Grupo J', city:'Miami' },
  { home_team:'Austria',      home_flag:'🇦🇹', away_team:'Jordania',     away_flag:'🇯🇴', kickoff:'2026-06-17T15:00', phase:'Grupo J', city:'Houston' },
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Austria',      away_flag:'🇦🇹', kickoff:'2026-06-21T19:00', phase:'Grupo J', city:'Dallas' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argelia',      away_flag:'🇩🇿', kickoff:'2026-06-21T22:00', phase:'Grupo J', city:'San Francisco' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argentina',    away_flag:'🇦🇷', kickoff:'2026-06-25T16:00', phase:'Grupo J', city:'Atlanta' },
  { home_team:'Argelia',      home_flag:'🇩🇿', away_team:'Austria',      away_flag:'🇦🇹', kickoff:'2026-06-25T16:00', phase:'Grupo J', city:'Kansas City' },
  // ── GRUPO K: Portugal, RD Congo, Uzbekistán, Colombia ──
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'RD Congo',     away_flag:'🇨🇩', kickoff:'2026-06-18T12:00', phase:'Grupo K', city:'Boston' },
  { home_team:'Uzbekistán',   home_flag:'🇺🇿', away_team:'Colombia',     away_flag:'🇨🇴', kickoff:'2026-06-18T19:00', phase:'Grupo K', city:'Vancouver' },
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'Uzbekistán',   away_flag:'🇺🇿', kickoff:'2026-06-23T12:00', phase:'Grupo K', city:'Nueva York' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'RD Congo',     away_flag:'🇨🇩', kickoff:'2026-06-23T19:00', phase:'Grupo K', city:'Seattle' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'Portugal',     away_flag:'🇵🇹', kickoff:'2026-06-27T16:00', phase:'Grupo K', city:'Los Ángeles' },
  { home_team:'RD Congo',     home_flag:'🇨🇩', away_team:'Uzbekistán',   away_flag:'🇺🇿', kickoff:'2026-06-27T16:00', phase:'Grupo K', city:'Filadelfia' },
  // ── GRUPO L: Inglaterra, Croacia, Ghana, Panamá ──
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Panamá',       away_flag:'🇵🇦', kickoff:'2026-06-19T12:00', phase:'Grupo L', city:'Miami' },
  { home_team:'Ghana',        home_flag:'🇬🇭', away_team:'Croacia',      away_flag:'🇭🇷', kickoff:'2026-06-19T16:00', phase:'Grupo L', city:'Kansas City' },
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Ghana',        away_flag:'🇬🇭', kickoff:'2026-06-24T12:00', phase:'Grupo L', city:'Toronto' },
  { home_team:'Croacia',      home_flag:'🇭🇷', away_team:'Panamá',       away_flag:'🇵🇦', kickoff:'2026-06-24T16:00', phase:'Grupo L', city:'Atlanta' },
  { home_team:'Croacia',      home_flag:'🇭🇷', away_team:'Inglaterra',   away_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', kickoff:'2026-06-27T20:00', phase:'Grupo L', city:'San Francisco' },
  { home_team:'Panamá',       home_flag:'🇵🇦', away_team:'Ghana',        away_flag:'🇬🇭', kickoff:'2026-06-27T20:00', phase:'Grupo L', city:'Houston' },
];

export async function bulkLoadMatches(onProgress) {
  const matchesRef = collection(db, 'matches');
  let inserted = 0;
  let skipped  = 0;

  for (const m of ALL_MATCHES) {
    // Verificar si ya existe el partido
    const q = query(matchesRef,
      where('home_team', '==', m.home_team),
      where('away_team', '==', m.away_team),
      where('phase',     '==', m.phase)
    );
    const existing = await getDocs(q);
    if (!existing.empty) { skipped++; continue; }

    const kickoff = new Date(m.kickoff);
    await addDoc(matchesRef, {
      home_team:  m.home_team,
      home_flag:  m.home_flag,
      away_team:  m.away_team,
      away_flag:  m.away_flag,
      kickoff:    kickoff,
      phase:      m.phase,
      city:       m.city || '',
    });
    inserted++;
    if (onProgress) onProgress(inserted, ALL_MATCHES.length);
  }
  return { inserted, skipped };
}
