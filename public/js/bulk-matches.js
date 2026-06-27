// bulk-matches.js — Carga masiva del calendario fase de grupos Mundial 2026
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const ALL_MATCHES = [
  // ── GRUPO A
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Sudáfrica',    away_flag:'🇿🇦', kickoff:'2026-06-11T15:00', phase:'Grupo A', city:'Ciudad de México', type:'fase_grupos' },
  { home_team:'Corea del Sur',home_flag:'🇰🇷', away_team:'Chequia',      away_flag:'🇨🇿', kickoff:'2026-06-11T22:00', phase:'Grupo A', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Corea del Sur',away_flag:'🇰🇷', kickoff:'2026-06-15T22:00', phase:'Grupo A', city:'Ciudad de México', type:'fase_grupos' },
  { home_team:'Sudáfrica',    home_flag:'🇿🇦', away_team:'Chequia',      away_flag:'🇨🇿', kickoff:'2026-06-16T19:00', phase:'Grupo A', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Sudáfrica',    home_flag:'🇿🇦', away_team:'Corea del Sur',away_flag:'🇰🇷', kickoff:'2026-06-20T20:00', phase:'Grupo A', city:'Dallas',            type:'fase_grupos' },
  { home_team:'Chequia',      home_flag:'🇨🇿', away_team:'México',       away_flag:'🇲🇽', kickoff:'2026-06-20T20:00', phase:'Grupo A', city:'Ciudad de México', type:'fase_grupos' },
  // ── GRUPO B
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Bosnia y Herzegovina', away_flag:'🇧🇦', kickoff:'2026-06-12T15:00', phase:'Grupo B', city:'Toronto',   type:'fase_grupos' },
  { home_team:'Qatar',        home_flag:'🇶🇦', away_team:'Suiza',        away_flag:'🇨🇭', kickoff:'2026-06-12T19:00', phase:'Grupo B', city:'Miami',             type:'fase_grupos' },
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Qatar',        away_flag:'🇶🇦', kickoff:'2026-06-16T15:00', phase:'Grupo B', city:'Toronto',           type:'fase_grupos' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Bosnia y Herzegovina', away_flag:'🇧🇦', kickoff:'2026-06-16T22:00', phase:'Grupo B', city:'Boston',   type:'fase_grupos' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Canadá',       away_flag:'🇨🇦', kickoff:'2026-06-21T16:00', phase:'Grupo B', city:'Vancouver',         type:'fase_grupos' },
  { home_team:'Bosnia y Herzegovina', home_flag:'🇧🇦', away_team:'Qatar', away_flag:'🇶🇦', kickoff:'2026-06-21T16:00', phase:'Grupo B', city:'Seattle',   type:'fase_grupos' },
  // ── GRUPO C
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Marruecos',    away_flag:'🇲🇦', kickoff:'2026-06-13T16:00', phase:'Grupo C', city:'San Francisco',     type:'fase_grupos' },
  { home_team:'Haití',        home_flag:'🇭🇹', away_team:'Escocia',      away_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', kickoff:'2026-06-13T22:00', phase:'Grupo C', city:'Nueva York',        type:'fase_grupos' },
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Haití',        away_flag:'🇭🇹', kickoff:'2026-06-17T16:00', phase:'Grupo C', city:'Houston',           type:'fase_grupos' },
  { home_team:'Marruecos',    home_flag:'🇲🇦', away_team:'Escocia',      away_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', kickoff:'2026-06-17T22:00', phase:'Grupo C', city:'Filadelfia',        type:'fase_grupos' },
  { home_team:'Marruecos',    home_flag:'🇲🇦', away_team:'Haití',        away_flag:'🇭🇹', kickoff:'2026-06-22T20:00', phase:'Grupo C', city:'Dallas',            type:'fase_grupos' },
  { home_team:'Escocia',      home_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', away_team:'Brasil',      away_flag:'🇧🇷', kickoff:'2026-06-22T20:00', phase:'Grupo C', city:'San Francisco',     type:'fase_grupos' },
  // ── GRUPO D
  { home_team:'USA',          home_flag:'🇺🇸', away_team:'Paraguay',     away_flag:'🇵🇾', kickoff:'2026-06-12T21:00', phase:'Grupo D', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'Australia',    home_flag:'🇦🇺', away_team:'Turquía',      away_flag:'🇹🇷', kickoff:'2026-06-13T12:00', phase:'Grupo D', city:'Kansas City',       type:'fase_grupos' },
  { home_team:'USA',          home_flag:'🇺🇸', away_team:'Australia',    away_flag:'🇦🇺', kickoff:'2026-06-17T19:00', phase:'Grupo D', city:'Dallas',            type:'fase_grupos' },
  { home_team:'Turquía',      home_flag:'🇹🇷', away_team:'Paraguay',     away_flag:'🇵🇾', kickoff:'2026-06-17T22:00', phase:'Grupo D', city:'Boston',            type:'fase_grupos' },
  { home_team:'Turquía',      home_flag:'🇹🇷', away_team:'USA',          away_flag:'🇺🇸', kickoff:'2026-06-22T16:00', phase:'Grupo D', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Paraguay',     home_flag:'🇵🇾', away_team:'Australia',    away_flag:'🇦🇺', kickoff:'2026-06-22T16:00', phase:'Grupo D', city:'Miami',             type:'fase_grupos' },
  // ── GRUPO E
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Curazao',      away_flag:'🇨🇼', kickoff:'2026-06-13T19:00', phase:'Grupo E', city:'Nueva York',        type:'fase_grupos' },
  { home_team:'Costa de Marfil', home_flag:'🇨🇮', away_team:'Ecuador',   away_flag:'🇪🇨', kickoff:'2026-06-14T15:00', phase:'Grupo E', city:'Seattle',          type:'fase_grupos' },
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Costa de Marfil', away_flag:'🇨🇮', kickoff:'2026-06-18T15:00', phase:'Grupo E', city:'Filadelfia',    type:'fase_grupos' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Curazao',      away_flag:'🇨🇼', kickoff:'2026-06-18T19:00', phase:'Grupo E', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Alemania',     away_flag:'🇩🇪', kickoff:'2026-06-23T20:00', phase:'Grupo E', city:'Houston',           type:'fase_grupos' },
  { home_team:'Curazao',      home_flag:'🇨🇼', away_team:'Costa de Marfil', away_flag:'🇨🇮', kickoff:'2026-06-23T20:00', phase:'Grupo E', city:'Dallas',        type:'fase_grupos' },
  // ── GRUPO F
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Japón',        away_flag:'🇯🇵', kickoff:'2026-06-14T12:00', phase:'Grupo F', city:'Vancouver',         type:'fase_grupos' },
  { home_team:'Suecia',       home_flag:'🇸🇪', away_team:'Túnez',        away_flag:'🇹🇳', kickoff:'2026-06-14T19:00', phase:'Grupo F', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Suecia',       away_flag:'🇸🇪', kickoff:'2026-06-18T22:00', phase:'Grupo F', city:'Kansas City',       type:'fase_grupos' },
  { home_team:'Japón',        home_flag:'🇯🇵', away_team:'Túnez',        away_flag:'🇹🇳', kickoff:'2026-06-19T15:00', phase:'Grupo F', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'Japón',        home_flag:'🇯🇵', away_team:'Suecia',       away_flag:'🇸🇪', kickoff:'2026-06-23T16:00', phase:'Grupo F', city:'Seattle',           type:'fase_grupos' },
  { home_team:'Túnez',        home_flag:'🇹🇳', away_team:'Países Bajos', away_flag:'🇳🇱', kickoff:'2026-06-23T16:00', phase:'Grupo F', city:'Boston',            type:'fase_grupos' },
  // ── GRUPO G
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Egipto',       away_flag:'🇪🇬', kickoff:'2026-06-14T22:00', phase:'Grupo G', city:'Miami',             type:'fase_grupos' },
  { home_team:'Irán',         home_flag:'🇮🇷', away_team:'Nueva Zelanda',away_flag:'🇳🇿', kickoff:'2026-06-15T15:00', phase:'Grupo G', city:'Houston',           type:'fase_grupos' },
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Irán',         away_flag:'🇮🇷', kickoff:'2026-06-19T19:00', phase:'Grupo G', city:'Nueva York',        type:'fase_grupos' },
  { home_team:'Egipto',       home_flag:'🇪🇬', away_team:'Nueva Zelanda',away_flag:'🇳🇿', kickoff:'2026-06-19T22:00', phase:'Grupo G', city:'Toronto',           type:'fase_grupos' },
  { home_team:'Egipto',       home_flag:'🇪🇬', away_team:'Irán',         away_flag:'🇮🇷', kickoff:'2026-06-24T20:00', phase:'Grupo G', city:'San Francisco',     type:'fase_grupos' },
  { home_team:'Nueva Zelanda',home_flag:'🇳🇿', away_team:'Bélgica',      away_flag:'🇧🇪', kickoff:'2026-06-24T20:00', phase:'Grupo G', city:'Vancouver',         type:'fase_grupos' },
  // ── GRUPO H
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Cabo Verde',   away_flag:'🇨🇻', kickoff:'2026-06-15T12:00', phase:'Grupo H', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'Arabia Saudita', home_flag:'🇸🇦', away_team:'Uruguay',   away_flag:'🇺🇾', kickoff:'2026-06-15T19:00', phase:'Grupo H', city:'Kansas City',       type:'fase_grupos' },
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Arabia Saudita', away_flag:'🇸🇦', kickoff:'2026-06-20T15:00', phase:'Grupo H', city:'Dallas',        type:'fase_grupos' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'Cabo Verde',   away_flag:'🇨🇻', kickoff:'2026-06-20T19:00', phase:'Grupo H', city:'Seattle',           type:'fase_grupos' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'España',       away_flag:'🇪🇸', kickoff:'2026-06-25T20:00', phase:'Grupo H', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Cabo Verde',   home_flag:'🇨🇻', away_team:'Arabia Saudita', away_flag:'🇸🇦', kickoff:'2026-06-25T20:00', phase:'Grupo H', city:'Boston',        type:'fase_grupos' },
  // ── GRUPO I
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Senegal',      away_flag:'🇸🇳', kickoff:'2026-06-16T12:00', phase:'Grupo I', city:'Filadelfia',        type:'fase_grupos' },
  { home_team:'Irak',         home_flag:'🇮🇶', away_team:'Noruega',      away_flag:'🇳🇴', kickoff:'2026-06-16T19:00', phase:'Grupo I', city:'Miami',             type:'fase_grupos' },
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Irak',         away_flag:'🇮🇶', kickoff:'2026-06-22T12:00', phase:'Grupo I', city:'Nueva York',        type:'fase_grupos' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Senegal',      away_flag:'🇸🇳', kickoff:'2026-06-22T19:00', phase:'Grupo I', city:'Houston',           type:'fase_grupos' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Francia',      away_flag:'🇫🇷', kickoff:'2026-06-26T16:00', phase:'Grupo I', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'Senegal',      home_flag:'🇸🇳', away_team:'Irak',         away_flag:'🇮🇶', kickoff:'2026-06-26T16:00', phase:'Grupo I', city:'Toronto',           type:'fase_grupos' },
  // ── GRUPO J
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Argelia',      away_flag:'🇩🇿', kickoff:'2026-06-17T12:00', phase:'Grupo J', city:'Miami',             type:'fase_grupos' },
  { home_team:'Austria',      home_flag:'🇦🇹', away_team:'Jordania',     away_flag:'🇯🇴', kickoff:'2026-06-17T15:00', phase:'Grupo J', city:'Houston',           type:'fase_grupos' },
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Austria',      away_flag:'🇦🇹', kickoff:'2026-06-21T19:00', phase:'Grupo J', city:'Dallas',            type:'fase_grupos' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argelia',      away_flag:'🇩🇿', kickoff:'2026-06-21T22:00', phase:'Grupo J', city:'San Francisco',     type:'fase_grupos' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argentina',    away_flag:'🇦🇷', kickoff:'2026-06-25T16:00', phase:'Grupo J', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Argelia',      home_flag:'🇩🇿', away_team:'Austria',      away_flag:'🇦🇹', kickoff:'2026-06-25T16:00', phase:'Grupo J', city:'Kansas City',       type:'fase_grupos' },
  // ── GRUPO K
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'RD Congo',     away_flag:'🇨🇩', kickoff:'2026-06-18T12:00', phase:'Grupo K', city:'Boston',            type:'fase_grupos' },
  { home_team:'Uzbekistán',   home_flag:'🇺🇿', away_team:'Colombia',     away_flag:'🇨🇴', kickoff:'2026-06-18T19:00', phase:'Grupo K', city:'Vancouver',         type:'fase_grupos' },
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'Uzbekistán',   away_flag:'🇺🇿', kickoff:'2026-06-23T12:00', phase:'Grupo K', city:'Nueva York',        type:'fase_grupos' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'RD Congo',     away_flag:'🇨🇩', kickoff:'2026-06-23T19:00', phase:'Grupo K', city:'Seattle',           type:'fase_grupos' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'Portugal',     away_flag:'🇵🇹', kickoff:'2026-06-27T16:00', phase:'Grupo K', city:'Los Ángeles',       type:'fase_grupos' },
  { home_team:'RD Congo',     home_flag:'🇨🇩', away_team:'Uzbekistán',   away_flag:'🇺🇿', kickoff:'2026-06-27T16:00', phase:'Grupo K', city:'Filadelfia',        type:'fase_grupos' },
  // ── GRUPO L
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Panamá',       away_flag:'🇵🇦', kickoff:'2026-06-19T12:00', phase:'Grupo L', city:'Miami',             type:'fase_grupos' },
  { home_team:'Ghana',        home_flag:'🇬🇭', away_team:'Croacia',      away_flag:'🇭🇷', kickoff:'2026-06-19T16:00', phase:'Grupo L', city:'Kansas City',       type:'fase_grupos' },
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Ghana',        away_flag:'🇬🇭', kickoff:'2026-06-24T12:00', phase:'Grupo L', city:'Toronto',           type:'fase_grupos' },
  { home_team:'Croacia',      home_flag:'🇭🇷', away_team:'Panamá',       away_flag:'🇵🇦', kickoff:'2026-06-24T16:00', phase:'Grupo L', city:'Atlanta',           type:'fase_grupos' },
  { home_team:'Croacia',      home_flag:'🇭🇷', away_team:'Inglaterra',   away_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', kickoff:'2026-06-27T20:00', phase:'Grupo L', city:'San Francisco',     type:'fase_grupos' },
  { home_team:'Panamá',       home_flag:'🇵🇦', away_team:'Ghana',        away_flag:'🇬🇭', kickoff:'2026-06-27T20:00', phase:'Grupo L', city:'Houston',           type:'fase_grupos' },
];

export async function bulkLoadMatches(onProgress) {
  const matchesRef = collection(db, 'matches');
  let inserted = 0, skipped = 0;
  for (const m of ALL_MATCHES) {
    const q = query(matchesRef,
      where('home_team', '==', m.home_team),
      where('away_team', '==', m.away_team),
      where('phase',     '==', m.phase)
    );
    const existing = await getDocs(q);
    if (!existing.empty) { skipped++; continue; }
    const kickoff = new Date(m.kickoff);
    await addDoc(matchesRef, {
      home_team: m.home_team, home_flag: m.home_flag,
      away_team: m.away_team, away_flag: m.away_flag,
      kickoff, phase: m.phase, city: m.city || '',
      type: m.type,
    });
    inserted++;
    if (onProgress) onProgress(inserted, ALL_MATCHES.length);
  }
  return { inserted, skipped };
}
