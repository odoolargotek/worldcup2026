// favorite.js — Un solo botón Guardar para todos los grupos
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
// Mapa phase -> valor seleccionado en el select (pendiente de guardar)
const pendingSelects = {};

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

  // Limpiar selecciones pendientes al redibujar
  PHASES.forEach(p => delete pendingSelects[p]);

  section.innerHTML = `
    <div style="margin:24px 0 8px;padding:16px;background:var(--bg-card2);border-radius:14px;border:1px solid var(--border)">
      <h6 style="color:var(--gold);margin-bottom:6px">🏆 Mis equipos favoritos por grupo</h6>
      <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:14px">
        Elige tus equipos y pulsa <strong style="color:var(--green-light)">Guardar favoritos</strong> al final.
        Cambiar uno ya guardado aplica <strong style="color:var(--danger)">-${PENALTY_PTS} pts</strong> de penalidad.
      </p>
      <div id="favsRows"></div>
      <div id="favsWarning" style="display:none;margin-top:12px;padding:10px 12px;border-radius:8px;
        background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:0.82rem">
      </div>
      <button id="saveAllFavsBtn" style="display:none;margin-top:14px;width:100%;padding:12px;
        border-radius:10px;border:none;font-size:0.9rem;font-weight:700;cursor:pointer;
        background:var(--gold);color:#000">
        💾 Guardar favoritos
      </button>
      <div id="favsSavedMsg" style="display:none;margin-top:10px;text-align:center;
        color:var(--green-light);font-size:0.85rem;font-weight:600">
        ✅ ¡Guardado correctamente!
      </div>
    </div>`;

  const container = document.getElementById('favsRows');
  const saveBtn   = document.getElementById('saveAllFavsBtn');
  const warning   = document.getElementById('favsWarning');
  const savedMsg  = document.getElementById('favsSavedMsg');

  PHASES.forEach(phase => {
    const fav     = favs[phase];
    const pts     = favPts[phase] || 0;
    const pen     = pens[phase]   || 0;
    const teams   = TEAMS_BY_PHASE[phase] || [];
    const teamObj = fav ? teams.find(t => t.name === fav) : null;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap';

    // Fase
    const phaseCol = document.createElement('div');
    phaseCol.style.cssText = 'min-width:68px;font-weight:700;color:var(--gold);font-size:0.82rem';
    phaseCol.textContent = phase;

    // Equipo actual
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

    sel.addEventListener('change', () => {
      if (sel.value) {
        pendingSelects[phase] = sel.value;
        sel.style.borderColor = 'var(--green-light)';
      } else {
        delete pendingSelects[phase];
        sel.style.borderColor = fav ? 'var(--danger)' : 'var(--gold)';
      }
      updateSaveBtn(favs, pens, saveBtn, warning);
    });

    row.appendChild(phaseCol);
    row.appendChild(currentCol);
    row.appendChild(sel);
    container.appendChild(row);
  });

  // Botón guardar todo
  saveBtn.addEventListener('click', async () => {
    const phases = Object.keys(pendingSelects);
    if (phases.length === 0) return;

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Guardando...';

    const updates = {};
    phases.forEach(phase => {
      const newTeam  = pendingSelects[phase];
      const hadFav   = !!favs[phase];
      updates[`favorites.${phase}`] = newTeam;
      if (hadFav && newTeam !== favs[phase]) {
        updates[`penalties.${phase}`] = (pens[phase] || 0) + PENALTY_PTS;
      }
    });

    try {
      await updateDoc(memberRef, updates);
      // Actualizar memberData local
      if (!memberData.favorites) memberData.favorites = {};
      if (!memberData.penalties) memberData.penalties = {};
      phases.forEach(phase => {
        const hadFav  = !!favs[phase];
        const newTeam = pendingSelects[phase];
        memberData.favorites[phase] = newTeam;
        if (hadFav && newTeam !== favs[phase]) {
          memberData.penalties[phase] = (memberData.penalties[phase] || 0) + PENALTY_PTS;
        }
      });
      savedMsg.style.display = 'block';
      setTimeout(() => {
        savedMsg.style.display = 'none';
        renderFavsSummary();
        renderFavsInline();
      }, 1200);
    } catch(err) {
      alert('Error: ' + err.message);
      saveBtn.disabled    = false;
      saveBtn.textContent = '💾 Guardar favoritos';
    }
  });
}

function updateSaveBtn(favs, pens, saveBtn, warning) {
  const phases = Object.keys(pendingSelects);
  if (phases.length === 0) {
    saveBtn.style.display   = 'none';
    warning.style.display   = 'none';
    return;
  }
  saveBtn.style.display = 'block';
  saveBtn.textContent   = `💾 Guardar favoritos (${phases.length} cambio${phases.length > 1 ? 's' : ''})`;

  // Calcular penalidades pendientes
  const penalties = phases.filter(p => !!favs[p] && pendingSelects[p] !== favs[p]);
  if (penalties.length > 0) {
    warning.style.display = 'block';
    warning.innerHTML = `⚠️ <strong>${penalties.length} grupo${penalties.length>1?'s':''} con favorito ya elegido</strong> — 
      cambiarlos aplicará <strong>-${penalties.length * PENALTY_PTS} pts</strong> en total.
      <div style="margin-top:4px;font-size:11px">${penalties.map(p=>`${p} → ${pendingSelects[p]}`).join(' · ')}</div>`;
  } else {
    warning.style.display = 'none';
  }
}
