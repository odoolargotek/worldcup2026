// favorite.js — Favorito por grupo, guarda solo al confirmar
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

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

const PENALTY_PTS = 3;
let memberRef, memberData;

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;
  memberRef  = doc(db, 'group_members', `${GROUP_ID}_${user.uid}`);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) return;
  memberData = snap.data();
  renderFavsSummary();
  renderFavsInline();
  document.getElementById('manageFavsBtn')?.addEventListener('click', () => {
    document.getElementById('favsInlineSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

function getFavorites() { return memberData.favorites     || {}; }
function getPenalties() { return memberData.penalties     || {}; }
function getFavPts()    { return memberData.favorites_pts || {}; }

function renderFavsSummary() {
  const el = document.getElementById('myFavsSummary');
  if (!el) return;
  const favs    = getFavorites();
  const chosen  = PHASES.filter(p => favs[p]);
  const missing = PHASES.length - chosen.length;
  if (chosen.length === 0) {
    el.innerHTML = `<span style="color:var(--gold)">⚠️ Aún no elegiste ningún favorito — úsalos para ganar puntos extra</span>`;
  } else {
    const flags = chosen.slice(0,6).map(p => {
      const t = TEAMS_BY_PHASE[p]?.find(t => t.name === favs[p]);
      return `<span style="font-size:1.3rem">${t?.flag||''}</span>`;
    }).join(' ');
    el.innerHTML = `<div style="margin-bottom:4px">${flags}</div>`
      + `<span style="color:var(--green-light);font-size:12px">✅ ${chosen.length}/12 elegidos</span>`
      + (missing ? `<span style="color:var(--gold);font-size:12px"> · ⚠️ ${missing} pendientes</span>` : ' <span>🎉</span>');
  }
}

function renderFavsInline() {
  const section = document.getElementById('favsInlineSection');
  if (!section) return;

  const favs   = getFavorites();
  const favPts = getFavPts();
  const pens   = getPenalties();

  section.innerHTML = `
    <div style="margin:24px 0 8px;padding:16px;background:var(--bg-card2);border-radius:14px;border:1px solid var(--border)">
      <h6 style="color:var(--gold);margin-bottom:6px">🏆 Mis equipos favoritos por grupo</h6>
      <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:14px">
        Elige un favorito por grupo y pulsa <strong style="color:var(--green-light)">Confirmar</strong>.
        Cambiar uno ya guardado cuesta <strong style="color:var(--danger)">-${PENALTY_PTS} pts</strong> de penalidad.
      </p>
      <div id="favsRows"></div>
    </div>`;

  const container = document.getElementById('favsRows');

  PHASES.forEach(phase => {
    const fav     = favs[phase];
    const pts     = favPts[phase] || 0;
    const pen     = pens[phase]   || 0;
    const teams   = TEAMS_BY_PHASE[phase] || [];
    const teamObj = fav ? teams.find(t => t.name === fav) : null;

    // Wrapper de la fila
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--border)';

    // Línea superior: fase | equipo actual | select
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';

    // Fase
    const phaseCol = document.createElement('div');
    phaseCol.style.cssText = 'min-width:68px;font-weight:700;color:var(--gold);font-size:0.82rem';
    phaseCol.textContent = phase;

    // Equipo actual guardado
    const currentCol = document.createElement('div');
    currentCol.style.cssText = 'flex:1;min-width:90px;display:flex;align-items:center;gap:6px';
    if (fav) {
      currentCol.innerHTML = `
        <span style="font-size:1.5rem">${teamObj?.flag||''}</span>
        <div>
          <div style="font-size:0.85rem;font-weight:600">${fav}</div>
          <div style="font-size:11px">
            <span style="color:var(--green-light)">+${pts} pts</span>
            ${pen ? `<span style="color:var(--danger)"> · -${pen} pen</span>` : ''}
          </div>
        </div>`;
    } else {
      currentCol.innerHTML = `<span style="color:var(--text-muted);font-size:0.82rem;font-style:italic">Sin elegir</span>`;
    }

    // Select
    const sel = document.createElement('select');
    sel.style.cssText = `padding:6px 10px;border-radius:8px;
      border:1px solid ${fav ? 'var(--danger)' : 'var(--gold)'};
      background:var(--bg-card);color:var(--text);font-size:0.82rem;cursor:pointer;max-width:155px`;
    sel.innerHTML = `<option value="">${fav ? '⚠ Cambiar...' : '⚽ Elegir...'}</option>`
      + teams.map(t => `<option value="${t.name}">${t.flag} ${t.name}</option>`).join('');

    top.appendChild(phaseCol);
    top.appendChild(currentCol);
    top.appendChild(sel);
    row.appendChild(top);

    // Botón confirmar (oculto hasta que se elige algo)
    const confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = `display:none;margin-top:8px;width:100%;padding:8px;
      border-radius:8px;border:none;font-size:0.82rem;font-weight:700;cursor:pointer`;

    row.appendChild(confirmBtn);
    container.appendChild(row);

    // Al cambiar el select → mostrar botón confirmar (sin guardar todavía)
    sel.addEventListener('change', () => {
      const newTeam = sel.value;
      if (!newTeam) {
        confirmBtn.style.display = 'none';
        return;
      }
      const isChange = !!fav;
      confirmBtn.style.display = 'block';
      if (isChange) {
        confirmBtn.textContent = `⚠️ Confirmar cambio a "${newTeam}" (−${PENALTY_PTS} pts de penalidad)`;
        confirmBtn.style.background = 'rgba(239,68,68,0.2)';
        confirmBtn.style.color      = '#fca5a5';
        confirmBtn.style.border     = '1px solid rgba(239,68,68,0.5)';
      } else {
        confirmBtn.textContent = `✅ Confirmar favorito: "${newTeam}"`;
        confirmBtn.style.background = 'rgba(22,163,74,0.2)';
        confirmBtn.style.color      = 'var(--green-light)';
        confirmBtn.style.border     = '1px solid rgba(22,163,74,0.4)';
      }
    });

    // Al confirmar → guardar en Firestore
    confirmBtn.addEventListener('click', async () => {
      const newTeam  = sel.value;
      if (!newTeam) return;
      const isChange = !!fav;
      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Guardando...';
      sel.disabled = true;

      const updates = { [`favorites.${phase}`]: newTeam };
      if (isChange) updates[`penalties.${phase}`] = (pens[phase] || 0) + PENALTY_PTS;

      try {
        await updateDoc(memberRef, updates);
        if (!memberData.favorites) memberData.favorites = {};
        memberData.favorites[phase] = newTeam;
        if (isChange) {
          if (!memberData.penalties) memberData.penalties = {};
          memberData.penalties[phase] = (memberData.penalties[phase] || 0) + PENALTY_PTS;
        }
        renderFavsSummary();
        renderFavsInline();
      } catch(err) {
        alert('Error: ' + err.message);
        confirmBtn.disabled = false;
        sel.disabled = false;
      }
    });
  });
}
