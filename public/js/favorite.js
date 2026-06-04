// favorite.js — Cambiar equipo favorito con penalidad -6pts
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { doc, getDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

const TEAMS = [
  "Argentina","Francia","Brasil","Inglaterra","España","Portugal","Alemania",
  "Países Bajos","Croacia","Marruecos","Senegal","México","USA","Canadá",
  "Colombia","Ecuador","Uruguay","Chile","Japón","Corea del Sur","Australia",
  "Arabia Saudita","Irán","Qatar","Suiza","Bélgica","Dinamarca","Polonia",
  "Serbia","Ucrania","Türkiye","Rumania","Austria","Escocia","Hungría",
  "Rep. Checa","Albania","Eslovenia","Eslovaquia","Georgia","Venezuela",
  "Paraguay","Bolivia","Perú","Costa Rica","Panamá","Honduras","Jamaica",
];

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  setupChangeFavoriteModal(user);
});

function setupChangeFavoriteModal(user) {
  const btn     = document.getElementById('changeFavoriteBtn');
  const grid    = document.getElementById('changeFavGrid');
  const search  = document.getElementById('changeFavSearch');
  const hidden  = document.getElementById('newFavoriteTeam');
  const confirm = document.getElementById('confirmChangeFav');
  if (!btn || !grid) return;

  btn.addEventListener('click', () => {
    renderTeams('');
    hidden.value     = '';
    confirm.disabled = true;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('changeFavModal')).show();
  });

  function renderTeams(filter) {
    grid.innerHTML = '';
    TEAMS.filter(t => t.toLowerCase().includes(filter.toLowerCase())).forEach(team => {
      const div = document.createElement('div');
      div.className = 'col-6';
      div.innerHTML = `<button class="btn w-100 cfav-btn" style="background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px">⚽ ${team}</button>`;
      div.querySelector('button').addEventListener('click', () => {
        grid.querySelectorAll('.cfav-btn').forEach(b => {
          b.style.cssText = 'background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px';
        });
        div.querySelector('button').style.cssText = 'background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid var(--danger);font-size:0.85rem;padding:8px 4px;font-weight:700';
        hidden.value     = team;
        confirm.disabled = false;
      });
      grid.appendChild(div);
    });
  }

  search?.addEventListener('input', e => renderTeams(e.target.value));

  confirm?.addEventListener('click', async () => {
    const newTeam = hidden.value;
    if (!newTeam || !GROUP_ID) return;
    const memberRef = doc(db, 'group_members', `${GROUP_ID}_${user.uid}`);
    await updateDoc(memberRef, { favorite: newTeam, penalty_pts: increment(6) });
    bootstrap.Modal.getInstance(document.getElementById('changeFavModal')).hide();
    document.getElementById('myFavoriteDisplay').textContent = newTeam;
    alert(`⚠️ Favorito cambiado a "${newTeam}". Se aplicaron -6 puntos de penalidad.`);
  });
}
