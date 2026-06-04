// load-matches.js — Carga masiva de los 72 partidos de grupos Mundial 2026
// Todos los kickoffs están en UTC real (fuente: kickoffclock.com)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const MATCHES = [
  // ── GRUPO A ──
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Sudáfrica',          away_flag:'🇿🇦', kickoff:'2026-06-11T19:00:00Z', phase:'Grupo A', city:'Ciudad de México' },
  { home_team:'Corea del Sur',home_flag:'🇰🇷', away_team:'Chequia',             away_flag:'🇨🇿', kickoff:'2026-06-12T02:00:00Z', phase:'Grupo A', city:'Guadalajara' },
  { home_team:'Chequia',      home_flag:'🇨🇿', away_team:'Sudáfrica',           away_flag:'🇿🇦', kickoff:'2026-06-18T16:00:00Z', phase:'Grupo A', city:'Atlanta' },
  { home_team:'México',       home_flag:'🇲🇽', away_team:'Corea del Sur',       away_flag:'🇰🇷', kickoff:'2026-06-19T01:00:00Z', phase:'Grupo A', city:'Guadalajara' },
  { home_team:'Chequia',      home_flag:'🇨🇿', away_team:'México',              away_flag:'🇲🇽', kickoff:'2026-06-25T01:00:00Z', phase:'Grupo A', city:'Ciudad de México' },
  { home_team:'Sudáfrica',    home_flag:'🇿🇦', away_team:'Corea del Sur',       away_flag:'🇰🇷', kickoff:'2026-06-25T01:00:00Z', phase:'Grupo A', city:'Monterrey' },
  // ── GRUPO B ──
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Bosnia y Herzegovina',away_flag:'🇧🇦', kickoff:'2026-06-12T19:00:00Z', phase:'Grupo B', city:'Toronto' },
  { home_team:'Catar',        home_flag:'🇶🇦', away_team:'Suiza',               away_flag:'🇨🇭', kickoff:'2026-06-13T19:00:00Z', phase:'Grupo B', city:'Santa Clara' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Bosnia y Herzegovina',away_flag:'🇧🇦', kickoff:'2026-06-18T19:00:00Z', phase:'Grupo B', city:'Inglewood' },
  { home_team:'Canadá',       home_flag:'🇨🇦', away_team:'Catar',               away_flag:'🇶🇦', kickoff:'2026-06-18T22:00:00Z', phase:'Grupo B', city:'Vancouver' },
  { home_team:'Suiza',        home_flag:'🇨🇭', away_team:'Canadá',              away_flag:'🇨🇦', kickoff:'2026-06-24T19:00:00Z', phase:'Grupo B', city:'Vancouver' },
  { home_team:'Bosnia y Herzegovina',home_flag:'🇧🇦', away_team:'Catar',        away_flag:'🇶🇦', kickoff:'2026-06-24T19:00:00Z', phase:'Grupo B', city:'Seattle' },
  // ── GRUPO C ──
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Marruecos',           away_flag:'🇲🇦', kickoff:'2026-06-13T22:00:00Z', phase:'Grupo C', city:'East Rutherford' },
  { home_team:'Haití',        home_flag:'🇭🇹', away_team:'Escocia',             away_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', kickoff:'2026-06-14T01:00:00Z', phase:'Grupo C', city:'Foxborough' },
  { home_team:'Escocia',      home_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', away_team:'Marruecos',        away_flag:'🇲🇦', kickoff:'2026-06-19T22:00:00Z', phase:'Grupo C', city:'Foxborough' },
  { home_team:'Brasil',       home_flag:'🇧🇷', away_team:'Haití',               away_flag:'🇭🇹', kickoff:'2026-06-20T00:30:00Z', phase:'Grupo C', city:'Philadelphia' },
  { home_team:'Escocia',      home_flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', away_team:'Brasil',           away_flag:'🇧🇷', kickoff:'2026-06-24T22:00:00Z', phase:'Grupo C', city:'Miami Gardens' },
  { home_team:'Marruecos',    home_flag:'🇲🇦', away_team:'Haití',               away_flag:'🇭🇹', kickoff:'2026-06-24T22:00:00Z', phase:'Grupo C', city:'Atlanta' },
  // ── GRUPO D ──
  { home_team:'Estados Unidos',home_flag:'🇺🇸', away_team:'Paraguay',           away_flag:'🇵🇾', kickoff:'2026-06-13T01:00:00Z', phase:'Grupo D', city:'Inglewood' },
  { home_team:'Australia',    home_flag:'🇦🇺', away_team:'Türkiye',             away_flag:'🇹🇷', kickoff:'2026-06-14T16:00:00Z', phase:'Grupo D', city:'Vancouver' },
  { home_team:'Estados Unidos',home_flag:'🇺🇸', away_team:'Australia',          away_flag:'🇦🇺', kickoff:'2026-06-19T19:00:00Z', phase:'Grupo D', city:'Seattle' },
  { home_team:'Türkiye',      home_flag:'🇹🇷', away_team:'Paraguay',            away_flag:'🇵🇾', kickoff:'2026-06-20T03:00:00Z', phase:'Grupo D', city:'Santa Clara' },
  { home_team:'Türkiye',      home_flag:'🇹🇷', away_team:'Estados Unidos',      away_flag:'🇺🇸', kickoff:'2026-06-26T02:00:00Z', phase:'Grupo D', city:'Inglewood' },
  { home_team:'Paraguay',     home_flag:'🇵🇾', away_team:'Australia',           away_flag:'🇦🇺', kickoff:'2026-06-26T02:00:00Z', phase:'Grupo D', city:'Santa Clara' },
  // ── GRUPO E ──
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Curazao',             away_flag:'🇨🇼', kickoff:'2026-06-14T17:00:00Z', phase:'Grupo E', city:'Houston' },
  { home_team:'Costa de Marfil',home_flag:'🇨🇮', away_team:'Ecuador',           away_flag:'🇪🇨', kickoff:'2026-06-14T23:00:00Z', phase:'Grupo E', city:'Philadelphia' },
  { home_team:'Alemania',     home_flag:'🇩🇪', away_team:'Costa de Marfil',     away_flag:'🇨🇮', kickoff:'2026-06-20T20:00:00Z', phase:'Grupo E', city:'Toronto' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Curazao',             away_flag:'🇨🇼', kickoff:'2026-06-21T00:00:00Z', phase:'Grupo E', city:'Kansas City' },
  { home_team:'Curazao',      home_flag:'🇨🇼', away_team:'Costa de Marfil',     away_flag:'🇨🇮', kickoff:'2026-06-25T20:00:00Z', phase:'Grupo E', city:'Philadelphia' },
  { home_team:'Ecuador',      home_flag:'🇪🇨', away_team:'Alemania',            away_flag:'🇩🇪', kickoff:'2026-06-25T20:00:00Z', phase:'Grupo E', city:'East Rutherford' },
  // ── GRUPO F ──
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Japón',               away_flag:'🇯🇵', kickoff:'2026-06-14T20:00:00Z', phase:'Grupo F', city:'Arlington' },
  { home_team:'Suecia',       home_flag:'🇸🇪', away_team:'Túnez',               away_flag:'🇹🇳', kickoff:'2026-06-15T02:00:00Z', phase:'Grupo F', city:'Monterrey' },
  { home_team:'Países Bajos', home_flag:'🇳🇱', away_team:'Suecia',              away_flag:'🇸🇪', kickoff:'2026-06-20T17:00:00Z', phase:'Grupo F', city:'Houston' },
  { home_team:'Túnez',        home_flag:'🇹🇳', away_team:'Japón',               away_flag:'🇯🇵', kickoff:'2026-06-21T04:00:00Z', phase:'Grupo F', city:'Monterrey' },
  { home_team:'Japón',        home_flag:'🇯🇵', away_team:'Suecia',              away_flag:'🇸🇪', kickoff:'2026-06-25T23:00:00Z', phase:'Grupo F', city:'Arlington' },
  { home_team:'Túnez',        home_flag:'🇹🇳', away_team:'Países Bajos',        away_flag:'🇳🇱', kickoff:'2026-06-25T23:00:00Z', phase:'Grupo F', city:'Kansas City' },
  // ── GRUPO G ──
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Egipto',              away_flag:'🇪🇬', kickoff:'2026-06-15T19:00:00Z', phase:'Grupo G', city:'Seattle' },
  { home_team:'Irán',         home_flag:'🇮🇷', away_team:'Nueva Zelanda',       away_flag:'🇳🇿', kickoff:'2026-06-16T01:00:00Z', phase:'Grupo G', city:'Inglewood' },
  { home_team:'Bélgica',      home_flag:'🇧🇪', away_team:'Irán',                away_flag:'🇮🇷', kickoff:'2026-06-21T19:00:00Z', phase:'Grupo G', city:'Inglewood' },
  { home_team:'Nueva Zelanda',home_flag:'🇳🇿', away_team:'Egipto',              away_flag:'🇪🇬', kickoff:'2026-06-22T01:00:00Z', phase:'Grupo G', city:'Vancouver' },
  { home_team:'Egipto',       home_flag:'🇪🇬', away_team:'Irán',                away_flag:'🇮🇷', kickoff:'2026-06-27T03:00:00Z', phase:'Grupo G', city:'Seattle' },
  { home_team:'Nueva Zelanda',home_flag:'🇳🇿', away_team:'Bélgica',             away_flag:'🇧🇪', kickoff:'2026-06-27T03:00:00Z', phase:'Grupo G', city:'Vancouver' },
  // ── GRUPO H ──
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Cabo Verde',          away_flag:'🇨🇻', kickoff:'2026-06-15T16:00:00Z', phase:'Grupo H', city:'Atlanta' },
  { home_team:'Arabia Saudita',home_flag:'🇸🇦', away_team:'Uruguay',            away_flag:'🇺🇾', kickoff:'2026-06-15T22:00:00Z', phase:'Grupo H', city:'Miami Gardens' },
  { home_team:'España',       home_flag:'🇪🇸', away_team:'Arabia Saudita',      away_flag:'🇸🇦', kickoff:'2026-06-21T16:00:00Z', phase:'Grupo H', city:'Atlanta' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'Cabo Verde',          away_flag:'🇨🇻', kickoff:'2026-06-21T22:00:00Z', phase:'Grupo H', city:'Miami Gardens' },
  { home_team:'Cabo Verde',   home_flag:'🇨🇻', away_team:'Arabia Saudita',      away_flag:'🇸🇦', kickoff:'2026-06-27T00:00:00Z', phase:'Grupo H', city:'Houston' },
  { home_team:'Uruguay',      home_flag:'🇺🇾', away_team:'España',              away_flag:'🇪🇸', kickoff:'2026-06-27T00:00:00Z', phase:'Grupo H', city:'Guadalajara' },
  // ── GRUPO I ──
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Senegal',             away_flag:'🇸🇳', kickoff:'2026-06-16T19:00:00Z', phase:'Grupo I', city:'East Rutherford' },
  { home_team:'Irak',         home_flag:'🇮🇶', away_team:'Noruega',             away_flag:'🇳🇴', kickoff:'2026-06-16T22:00:00Z', phase:'Grupo I', city:'Foxborough' },
  { home_team:'Francia',      home_flag:'🇫🇷', away_team:'Irak',                away_flag:'🇮🇶', kickoff:'2026-06-22T21:00:00Z', phase:'Grupo I', city:'Philadelphia' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Senegal',             away_flag:'🇸🇳', kickoff:'2026-06-23T00:00:00Z', phase:'Grupo I', city:'East Rutherford' },
  { home_team:'Noruega',      home_flag:'🇳🇴', away_team:'Francia',             away_flag:'🇫🇷', kickoff:'2026-06-26T19:00:00Z', phase:'Grupo I', city:'Foxborough' },
  { home_team:'Senegal',      home_flag:'🇸🇳', away_team:'Irak',                away_flag:'🇮🇶', kickoff:'2026-06-26T19:00:00Z', phase:'Grupo I', city:'Toronto' },
  // ── GRUPO J ──
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Argelia',             away_flag:'🇩🇿', kickoff:'2026-06-17T01:00:00Z', phase:'Grupo J', city:'Kansas City' },
  { home_team:'Austria',      home_flag:'🇦🇹', away_team:'Jordania',            away_flag:'🇯🇴', kickoff:'2026-06-17T04:00:00Z', phase:'Grupo J', city:'Santa Clara' },
  { home_team:'Argentina',    home_flag:'🇦🇷', away_team:'Austria',             away_flag:'🇦🇹', kickoff:'2026-06-22T17:00:00Z', phase:'Grupo J', city:'Arlington' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argelia',             away_flag:'🇩🇿', kickoff:'2026-06-23T03:00:00Z', phase:'Grupo J', city:'Santa Clara' },
  { home_team:'Jordania',     home_flag:'🇯🇴', away_team:'Argentina',           away_flag:'🇦🇷', kickoff:'2026-06-28T02:00:00Z', phase:'Grupo J', city:'Arlington' },
  { home_team:'Argelia',      home_flag:'🇩🇿', away_team:'Austria',             away_flag:'🇦🇹', kickoff:'2026-06-28T02:00:00Z', phase:'Grupo J', city:'Kansas City' },
  // ── GRUPO K ──
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'RD Congo',            away_flag:'🇨🇩', kickoff:'2026-06-17T17:00:00Z', phase:'Grupo K', city:'Houston' },
  { home_team:'Uzbekistán',   home_flag:'🇺🇿', away_team:'Colombia',            away_flag:'🇨🇴', kickoff:'2026-06-18T02:00:00Z', phase:'Grupo K', city:'Ciudad de México' },
  { home_team:'Portugal',     home_flag:'🇵🇹', away_team:'Uzbekistán',          away_flag:'🇺🇿', kickoff:'2026-06-23T17:00:00Z', phase:'Grupo K', city:'Houston' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'RD Congo',            away_flag:'🇨🇩', kickoff:'2026-06-24T02:00:00Z', phase:'Grupo K', city:'Guadalajara' },
  { home_team:'Colombia',     home_flag:'🇨🇴', away_team:'Portugal',            away_flag:'🇵🇹', kickoff:'2026-06-27T23:30:00Z', phase:'Grupo K', city:'Miami Gardens' },
  { home_team:'RD Congo',     home_flag:'🇨🇩', away_team:'Uzbekistán',          away_flag:'🇺🇿', kickoff:'2026-06-27T23:30:00Z', phase:'Grupo K', city:'Atlanta' },
  // ── GRUPO L ──
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Croacia',           away_flag:'🇭🇷', kickoff:'2026-06-17T20:00:00Z', phase:'Grupo L', city:'Arlington' },
  { home_team:'Ghana',        home_flag:'🇬🇭', away_team:'Panamá',              away_flag:'🇵🇦', kickoff:'2026-06-17T23:00:00Z', phase:'Grupo L', city:'Toronto' },
  { home_team:'Inglaterra',   home_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', away_team:'Ghana',            away_flag:'🇬🇭', kickoff:'2026-06-23T20:00:00Z', phase:'Grupo L', city:'Foxborough' },
  { home_team:'Panamá',       home_flag:'🇵🇦', away_team:'Croacia',             away_flag:'🇭🇷', kickoff:'2026-06-23T23:00:00Z', phase:'Grupo L', city:'Toronto' },
  { home_team:'Panamá',       home_flag:'🇵🇦', away_team:'Inglaterra',          away_flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', kickoff:'2026-06-27T21:00:00Z', phase:'Grupo L', city:'East Rutherford' },
  { home_team:'Croacia',      home_flag:'🇭🇷', away_team:'Ghana',               away_flag:'🇬🇭', kickoff:'2026-06-27T21:00:00Z', phase:'Grupo L', city:'Philadelphia' },
];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  renderGrid();
});

let selected = new Set();

function renderGrid() {
  const grid = document.getElementById('matchesGrid');
  grid.innerHTML = '';
  MATCHES.forEach((m, i) => {
    const kickoff = new Date(m.kickoff);
    const label = kickoff.toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      weekday:'short', day:'2-digit', month:'short',
      hour:'numeric', minute:'2-digit', hour12:true
    });
    const card = document.createElement('div');
    card.className = 'col-12 col-md-6';
    card.innerHTML = `
      <div class="p-2 rounded border match-card" data-idx="${i}"
        style="cursor:pointer;border-color:var(--border)!important;background:var(--bg-card2);font-size:13px">
        <div style="font-weight:700;color:var(--gold);font-size:11px;margin-bottom:2px">${m.phase}</div>
        <div>${m.home_flag} ${m.home_team} vs ${m.away_team} ${m.away_flag}</div>
        <div style="color:var(--text-muted);font-size:11px">📅 ${label} · 📍 ${m.city}</div>
      </div>`;
    card.querySelector('.match-card').addEventListener('click', () => toggleSelect(i, card.querySelector('.match-card')));
    grid.appendChild(card);
  });
  updateCount();
}

function toggleSelect(i, el) {
  if (selected.has(i)) {
    selected.delete(i);
    el.style.borderColor = 'var(--border)';
    el.style.background  = 'var(--bg-card2)';
  } else {
    selected.add(i);
    el.style.borderColor = 'var(--gold)';
    el.style.background  = 'rgba(245,158,11,0.1)';
  }
  updateCount();
}

function updateCount() {
  document.getElementById('selectedCount').textContent = `${selected.size} seleccionados`;
  document.getElementById('loadSelectedBtn').disabled = selected.size === 0;
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.match-card').forEach((el, i) => {
    selected.add(i);
    el.style.borderColor = 'var(--gold)';
    el.style.background  = 'rgba(245,158,11,0.1)';
  });
  updateCount();
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  selected.clear();
  document.querySelectorAll('.match-card').forEach(el => {
    el.style.borderColor = 'var(--border)';
    el.style.background  = 'var(--bg-card2)';
  });
  updateCount();
});

document.getElementById('loadSelectedBtn').addEventListener('click', async () => {
  const btn = document.getElementById('loadSelectedBtn');
  const msg = document.getElementById('loadMsg');
  btn.disabled = true;
  btn.textContent = 'Cargando...';

  let ok = 0, skip = 0, err = 0;
  for (const i of selected) {
    const m = MATCHES[i];
    try {
      // Verificar duplicado por home_team + kickoff
      const existing = await getDocs(query(
        collection(db, 'matches'),
        where('home_team', '==', m.home_team),
        where('kickoff',   '==', new Date(m.kickoff))
      ));
      if (!existing.empty) { skip++; continue; }
      await addDoc(collection(db, 'matches'), {
        home_team: m.home_team, home_flag: m.home_flag,
        away_team: m.away_team, away_flag: m.away_flag,
        kickoff:   new Date(m.kickoff),
        phase:     m.phase,
        city:      m.city
      });
      ok++;
    } catch(e) { err++; }
  }

  msg.innerHTML = `<div class="mt-3 p-3 rounded" style="background:rgba(22,163,74,0.1);border:1px solid var(--green);color:var(--green-light)">
    ✅ ${ok} partido(s) cargado(s) · ⏭️ ${skip} ya existía(n) · ❌ ${err} error(es)
  </div>`;
  btn.disabled = false;
  btn.textContent = '⚽ Cargar seleccionados';
  selected.clear();
  renderGrid();
});
