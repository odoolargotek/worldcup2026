// favorite.js — Elegir favorito (primera vez gratis) o cambiar (-6 pts)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

// 48 selecciones con emojis
const TEAMS = [
  { name: 'Alemania',        flag: '🇩🇪' },
  { name: 'Arabia Saudita',  flag: '🇸🇦' },
  { name: 'Argelia',         flag: '🇩🇿' },
  { name: 'Argentina',       flag: '🇦🇷' },
  { name: 'Australia',       flag: '🇦🇺' },
  { name: 'Bélgica',          flag: '🇧🇪' },
  { name: 'Brasil',          flag: '🇧🇷' },
  { name: 'Canadá',           flag: '🇨🇦' },
  { name: 'Chile',           flag: '🇨🇱' },
  { name: 'Colombia',        flag: '🇨🇴' },
  { name: 'Costa Rica',      flag: '🇨🇷' },
  { name: 'Croacia',         flag: '🇭🇷' },
  { name: 'Cuba',            flag: '🇨🇺' },
  { name: "Côte d'Ivoire",   flag: '🇨🇮' },
  { name: 'Ecuador',         flag: '🇪🇨' },
  { name: 'Egipto',          flag: '🇪🇬' },
  { name: 'Escocia',         flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'España',           flag: '🇪🇸' },
  { name: 'Francia',         flag: '🇫🇷' },
  { name: 'Ghana',           flag: '🇬🇭' },
  { name: 'Guinea',          flag: '🇬🇳' },
  { name: 'Inglaterra',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Irán',            flag: '🇮🇷' },
  { name: 'Irak',            flag: '🇮🇶' },
  { name: 'Italia',          flag: '🇮🇹' },
  { name: 'Japón',            flag: '🇯🇵' },
  { name: 'Kenia',           flag: '🇰🇪' },
  { name: 'Marruecos',       flag: '🇲🇦' },
  { name: 'México',           flag: '🇲🇽' },
  { name: 'Mozambique',      flag: '🇲🇿' },
  { name: 'Noruega',         flag: '🇳🇴' },
  { name: 'Nueva Zelanda',   flag: '🇳🇿' },
  { name: 'Países Bajos',     flag: '🇳🇱' },
  { name: 'Panamá',           flag: '🇵🇦' },
  { name: 'Perú',             flag: '🇵🇪' },
  { name: 'Portugal',        flag: '🇵🇹' },
  { name: 'Qatar',           flag: '🇶🇦' },
  { name: 'Serbia',          flag: '🇷🇸' },
  { name: 'Senegal',         flag: '🇸🇳' },
  { name: 'Sudafrica',       flag: '🇿🇦' },
  { name: 'Suiza',           flag: '🇨🇭' },
  { name: 'Tunisia',         flag: '🇹🇳' },
  { name: 'Ucrania',         flag: '🇺🇦' },
  { name: 'Uruguay',         flag: '🇺🇾' },
  { name: 'USA',             flag: '🇺🇸' },
  { name: 'Uzbekistán',       flag: '🇺🇿' },
  { name: 'Playoff CONMEBOL',flag: '🏁' },
  { name: 'Haití',           flag: '🇭🇹' },
];

let favModal, isFirstTime = false;

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;

  favModal = new bootstrap.Modal(document.getElementById('favModal'));
  const memberRef  = doc(db, 'group_members', `${GROUP_ID}_${user.uid}`);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return;

  const memberData = memberSnap.data();
  const hasFav = memberData.favorite && memberData.favorite !== '';
  isFirstTime  = !hasFav;

  // Mostrar/ocultar banner y botón cambiar
  const banner     = document.getElementById('noFavBanner');
  const changeBtn  = document.getElementById('changeFavoriteBtn');
  const chooseFavBtn = document.getElementById('chooseFavBtn');

  if (!hasFav) {
    banner?.classList.remove('d-none');
    changeBtn?.classList.add('d-none');
  } else {
    banner?.classList.add('d-none');
    changeBtn?.classList.remove('d-none');
  }

  // Abrir modal desde banner (primera vez, sin penalidad)
  chooseFavBtn?.addEventListener('click', () => openFavModal(true));

  // Abrir modal desde botón cambiar (con penalidad)
  changeBtn?.addEventListener('click', () => openFavModal(false));

  // Confirmar selección
  document.getElementById('confirmFavBtn')?.addEventListener('click', async () => {
    const team = document.getElementById('favSelectedTeam').value;
    if (!team) return;

    const updates = { favorite: team };
    if (!isFirstTime) {
      // Penalidad por cambio
      updates.penalty_pts = (memberData.penalty_pts || 0) + 6;
    }
    await updateDoc(memberRef, updates);

    favModal.hide();

    // Actualizar UI
    const favDisplay = document.getElementById('myFavoriteDisplay');
    const t = TEAMS.find(t => t.name === team);
    if (favDisplay) favDisplay.textContent = `${t?.flag || ''} ${team}`;

    if (isFirstTime) {
      banner?.classList.add('d-none');
      changeBtn?.classList.remove('d-none');
      isFirstTime = false;
    }
  });
});

function openFavModal(firstTime) {
  isFirstTime = firstTime;

  // Mostrar/ocultar advertencia de penalidad
  document.getElementById('favPenaltyWarning')?.classList.toggle('d-none', firstTime);
  document.getElementById('favFirstInfo')?.classList.toggle('d-none', !firstTime);

  const title = document.getElementById('favModalTitle');
  if (title) title.textContent = firstTime ? '🏆 Elige tu equipo favorito' : '⚠️ Cambiar equipo favorito';

  const confirmBtn = document.getElementById('confirmFavBtn');
  if (confirmBtn) {
    confirmBtn.textContent = firstTime ? '🏆 Confirmar equipo favorito' : '⚠️ Confirmar cambio (-6 pts)';
    confirmBtn.className   = firstTime ? 'btn btn-warning w-100' : 'btn btn-danger w-100';
    confirmBtn.disabled    = true;
  }

  // Reset búsqueda y selección
  const searchInput = document.getElementById('favSearch');
  if (searchInput) { searchInput.value = ''; }
  document.getElementById('favSelectedTeam').value = '';
  renderTeamGrid(TEAMS);

  // Filtro de búsqueda
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    renderTeamGrid(TEAMS.filter(t => t.name.toLowerCase().includes(q)));
  });

  favModal.show();
}

function renderTeamGrid(teams) {
  const grid = document.getElementById('favGrid');
  if (!grid) return;
  grid.innerHTML = '';
  teams.forEach(team => {
    const btn = document.createElement('div');
    btn.className = 'col-6 col-sm-4';
    btn.innerHTML = `
      <button class="btn btn-sm w-100 team-btn"
        style="background:var(--bg-card2);border:1px solid var(--border);color:var(--text);padding:8px;font-size:0.82rem;border-radius:8px;transition:all 0.15s"
        data-team="${team.name}">
        <div style="font-size:1.4rem">${team.flag}</div>
        <div>${team.name}</div>
      </button>`;
    btn.querySelector('button').addEventListener('click', (e) => {
      document.querySelectorAll('.team-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background  = 'var(--bg-card2)';
        b.style.color       = 'var(--text)';
      });
      e.currentTarget.style.borderColor = 'var(--gold)';
      e.currentTarget.style.background  = 'rgba(245,158,11,0.15)';
      e.currentTarget.style.color       = 'var(--gold)';
      document.getElementById('favSelectedTeam').value = team.name;
      document.getElementById('confirmFavBtn').disabled = false;
    });
    grid.appendChild(btn);
  });
}
