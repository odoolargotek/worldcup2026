// favorite.js — Favorito por grupo de fase (A-L), uno por grupo
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

const PHASES = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

const TEAMS_BY_PHASE = {
  'Grupo A': [{name:'México',flag:'🇲🇽'},{name:'Sudafrica',flag:'🇿🇦'},{name:'Canadá',flag:'🇨🇦'},{name:'Playoff CONMEBOL',flag:'🏁'}],
  'Grupo B': [{name:'Argentina',flag:'🇦🇷'},{name:'Argelia',flag:'🇩🇿'},{name:'Ucrania',flag:'🇺🇦'},{name:'Ecuador',flag:'🇪🇨'}],
  'Grupo C': [{name:'USA',flag:'🇺🇸'},{name:'Panamá',flag:'🇵🇦'},{name:'Uruguay',flag:'🇺🇾'},{name:'Irak',flag:'🇮🇶'}],
  'Grupo D': [{name:'Francia',flag:'🇫🇷'},{name:'Arabia Saudita',flag:'🇸🇦'},{name:'Perú',flag:'🇵🇪'},{name:'Escocia',flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿'}],
  'Grupo E': [{name:'Alemania',flag:'🇩🇪'},{name:'Japón',flag:'🇯🇵'},{name:'Chile',flag:'🇨🇱'},{name:'Ecuador',flag:'🇪🇨'}],
  'Grupo F': [{name:'Portugal',flag:'🇵🇹'},{name:'Marruecos',flag:'🇲🇦'},{name:'Croacia',flag:'🇭🇷'},{name:'Mozambique',flag:'🇲🇿'}],
  'Grupo G': [{name:'España',flag:'🇪🇸'},{name:'Bélgica',flag:'🇧🇪'},{name:'Egipto',flag:'🇪🇬'},{name:'Tunisia',flag:'🇹🇳'}],
  'Grupo H': [{name:'Inglaterra',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},{name:'Senegal',flag:'🇸🇳'},{name:'Serbia',flag:'🇷🇸'},{name:'Guinea',flag:'🇬🇳'}],
  'Grupo I': [{name:'Brasil',flag:'🇧🇷'},{name:'Noruega',flag:'🇳🇴'},{name:'Ghana',flag:'🇬🇭'},{name:'Cuba',flag:'🇨🇺'}],
  'Grupo J': [{name:'Países Bajos',flag:'🇳🇱'},{name:'Suiza',flag:'🇨🇭'},{name:'Colombia',flag:'🇨🇴'},{name:'Uzbekistán',flag:'🇺🇿'}],
  'Grupo K': [{name:'Australia',flag:'🇦🇺'},{name:'Kenia',flag:'🇰🇪'},{name:'Costa Rica',flag:'🇨🇷'},{name:'Qatar',flag:'🇶🇦'}],
  'Grupo L': [{name:'Italia',flag:'🇮🇹'},{name:'Irán',flag:'🇮🇷'},{name:"C\u00f4te d'Ivoire",flag:'🇨🇮'},{name:'Nueva Zelanda',flag:'🇳🇿'}],
};

const PENALTY_PTS = 3; // Penalidad por cambiar favorito

let favsModal, pickModal;
let currentPhase = null;
let memberRef, memberData;

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;

  favsModal = new bootstrap.Modal(document.getElementById('favsModal'));
  pickModal = new bootstrap.Modal(document.getElementById('pickTeamModal'));

  memberRef  = doc(db, 'group_members', `${GROUP_ID}_${user.uid}`);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) return;
  memberData = snap.data();

  renderFavsSummary();

  document.getElementById('manageFavsBtn')?.addEventListener('click', () => {
    renderFavsGroupList();
    favsModal.show();
  });
});

const getFavorites  = () => memberData.favorites     || {};
const getFavPts     = () => memberData.favorites_pts  || {};
const getPenalties  = () => memberData.penalties      || {};

function renderFavsSummary() {
  const el = document.getElementById('myFavsSummary');
  if (!el) return;
  const favs    = getFavorites();
  const chosen  = PHASES.filter(p => favs[p]);
  const missing = PHASES.filter(p => !favs[p]);
  if (chosen.length === 0) {
    el.innerHTML = `<span style="color:var(--gold)">⚠️ Aún no elegiste ningún favorito</span>`;
  } else {
    const flags = chosen.slice(0,4).map(p => {
      const t = TEAMS_BY_PHASE[p]?.find(t => t.name === favs[p]);
      return `<span style="font-size:1.4rem">${t?.flag||''}</span>`;
    }).join('');
    el.innerHTML = `<div style="margin-bottom:4px">${flags}${chosen.length>4?`<span style="color:var(--text-muted);font-size:12px"> +${chosen.length-4} más</span>`:''}</div>`
      + `<span style="color:var(--green-light);font-size:12px">✅ ${chosen.length}/12 elegidos</span>`
      + (missing.length ? `<span style="color:var(--gold);font-size:12px"> · ⚠️ ${missing.length} pendientes</span>` : ` <span style="font-size:14px">🎉</span>`);
  }
}

function renderFavsGroupList() {
  const container = document.getElementById('favsGroupList');
  if (!container) return;
  const favs      = getFavorites();
  const favPts    = getFavPts();
  const penalties = getPenalties();
  container.innerHTML = '';

  PHASES.forEach(phase => {
    const fav     = favs[phase];
    const pts     = favPts[phase]  || 0;
    const pen     = penalties[phase] || 0;
    const teams   = TEAMS_BY_PHASE[phase];
    const teamObj = fav ? teams.find(t => t.name === fav) : null;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <div style="min-width:70px;font-weight:700;color:var(--gold);font-size:0.85rem">${phase}</div>
      <div style="flex:1;display:flex;align-items:center;gap:8px">
        ${fav
          ? `<span style="font-size:1.9rem;line-height:1">${teamObj?.flag||''}</span>
             <div>
               <div style="font-weight:600;font-size:0.9rem">${fav}</div>
               <div style="font-size:11px">
                 <span style="color:var(--green-light)">+${pts} pts</span>
                 ${pen ? `<span style="color:var(--danger)"> · -${pen} pen</span>` : ''}
               </div>
             </div>`
          : `<span style="color:var(--text-muted);font-style:italic;font-size:0.85rem">Sin elegir</span>`
        }
      </div>
      <button class="btn btn-sm px-3" style="${fav
        ? 'background:transparent;color:var(--danger);border:1px solid var(--danger);font-size:11px;white-space:nowrap'
        : 'background:var(--gold);color:#000;border:none;font-weight:700;font-size:12px;white-space:nowrap'}">
        ${fav ? '⚠ Cambiar' : '⚽ Elegir'}
      </button>`;

    row.querySelector('button').addEventListener('click', () => openPickModal(phase, !!fav));
    container.appendChild(row);
  });
}

function openPickModal(phase, isChange) {
  currentPhase = phase;
  const teams  = TEAMS_BY_PHASE[phase] || [];

  document.getElementById('pickTeamTitle').textContent =
    isChange ? `⚠️ Cambiar favorito — ${phase}` : `🏆 Elegir favorito — ${phase}`;
  document.getElementById('pickPenaltyWarn')?.classList.toggle('d-none', !isChange);
  document.getElementById('pickFirstInfo')?.classList.toggle('d-none',  isChange);

  const confirmBtn = document.getElementById('confirmPickBtn');
  confirmBtn.textContent = isChange ? `⚠️ Confirmar cambio (-${PENALTY_PTS} pts)` : '🏆 Confirmar favorito';
  confirmBtn.className   = isChange ? 'btn btn-danger w-100' : 'btn btn-warning w-100';
  confirmBtn.disabled    = true;

  document.getElementById('pickSelectedTeam').value = '';
  document.getElementById('pickSearch').value = '';
  renderPickGrid(teams);

  document.getElementById('pickSearch').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderPickGrid(teams.filter(t => t.name.toLowerCase().includes(q)));
  };

  confirmBtn.onclick = async () => {
    const team = document.getElementById('pickSelectedTeam').value;
    if (!team || !currentPhase) return;
    const penalties = getPenalties();
    const updates   = { [`favorites.${currentPhase}`]: team };
    if (isChange) updates[`penalties.${currentPhase}`] = (penalties[currentPhase] || 0) + PENALTY_PTS;
    await updateDoc(memberRef, updates);
    if (!memberData.favorites) memberData.favorites = {};
    memberData.favorites[currentPhase] = team;
    if (isChange) {
      if (!memberData.penalties) memberData.penalties = {};
      memberData.penalties[currentPhase] = (memberData.penalties[currentPhase] || 0) + PENALTY_PTS;
    }
    pickModal.hide();
    renderFavsSummary();
    renderFavsGroupList();
  };

  pickModal.show();
}

function renderPickGrid(teams) {
  const grid = document.getElementById('pickGrid');
  if (!grid) return;
  grid.innerHTML = '';
  teams.forEach(team => {
    const col = document.createElement('div');
    col.className = 'col-6';
    col.innerHTML = `
      <button class="btn w-100 pick-btn"
        style="background:var(--bg-card2);border:2px solid var(--border);color:var(--text);
               padding:16px 8px;border-radius:12px;transition:all 0.15s;display:flex;
               flex-direction:column;align-items:center;gap:6px"
        data-team="${team.name}">
        <span style="font-size:2.8rem;line-height:1">${team.flag}</span>
        <span style="font-size:0.85rem;font-weight:600;text-align:center;line-height:1.2">${team.name}</span>
      </button>`;
    col.querySelector('button').addEventListener('click', (e) => {
      document.querySelectorAll('.pick-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background  = 'var(--bg-card2)';
        b.style.color       = 'var(--text)';
      });
      const btn = e.currentTarget;
      btn.style.borderColor = 'var(--gold)';
      btn.style.background  = 'rgba(245,158,11,0.15)';
      btn.style.color       = 'var(--gold)';
      document.getElementById('pickSelectedTeam').value = team.name;
      document.getElementById('confirmPickBtn').disabled = false;
    });
    grid.appendChild(col);
  });
}
