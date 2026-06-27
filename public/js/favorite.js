// favorite.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

const PHASES = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

// Retorna true si el stage del grupo es de fase de grupos
// Acepta cualquier variante de mayusculas/minusculas y valores nulos
function isGroupStage(stage) {
  if (!stage) return true; // null, undefined, '' → fase de grupos
  const s = String(stage).trim().toLowerCase();
  return s === 'fase de grupos' || s === 'grupos' || s === 'fase grupos';
}

// ───────────────────────────────────────────────────────────────────────────────
const TEAMS_BY_PHASE = {
  'Grupo A': [
    { name: 'México',          flag: '🇲🇽' },
    { name: 'Sudáfrica',       flag: '🇿🇦' },
    { name: 'Corea del Sur',   flag: '🇰🇷' },
    { name: 'Chequia',         flag: '🇨🇿' },
  ],
  'Grupo B': [
    { name: 'Canadá',          flag: '🇨🇦' },
    { name: 'Bosnia y Herzegovina', flag: '🇧🇦' },
    { name: 'Qatar',           flag: '🇶🇦' },
    { name: 'Suiza',           flag: '🇨🇭' },
  ],
  'Grupo C': [
    { name: 'Brasil',          flag: '🇧🇷' },
    { name: 'Marruecos',       flag: '🇲🇦' },
    { name: 'Haití',           flag: '🇭🇹' },
    { name: 'Escocia',         flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  ],
  'Grupo D': [
    { name: 'USA',             flag: '🇺🇸' },
    { name: 'Paraguay',        flag: '🇵🇾' },
    { name: 'Australia',       flag: '🇦🇺' },
    { name: 'Turquía',         flag: '🇹🇷' },
  ],
  'Grupo E': [
    { name: 'Alemania',        flag: '🇩🇪' },
    { name: 'Curazao',         flag: '🇨🇼' },
    { name: 'Costa de Marfil', flag: '🇨🇮' },
    { name: 'Ecuador',         flag: '🇪🇨' },
  ],
  'Grupo F': [
    { name: 'Países Bajos',    flag: '🇳🇱' },
    { name: 'Japón',           flag: '🇯🇵' },
    { name: 'Suecia',          flag: '🇸🇪' },
    { name: 'Túnez',           flag: '🇹🇳' },
  ],
  'Grupo G': [
    { name: 'Bélgica',         flag: '🇧🇪' },
    { name: 'Egipto',          flag: '🇪🇬' },
    { name: 'Irán',            flag: '🇮🇷' },
    { name: 'Nueva Zelanda',   flag: '🇳🇿' },
  ],
  'Grupo H': [
    { name: 'España',          flag: '🇪🇸' },
    { name: 'Cabo Verde',      flag: '🇨🇻' },
    { name: 'Arabia Saudita',  flag: '🇸🇦' },
    { name: 'Uruguay',         flag: '🇺🇾' },
  ],
  'Grupo I': [
    { name: 'Francia',         flag: '🇫🇷' },
    { name: 'Senegal',         flag: '🇸🇳' },
    { name: 'Irak',            flag: '🇮🇶' },
    { name: 'Noruega',         flag: '🇳🇴' },
  ],
  'Grupo J': [
    { name: 'Argentina',       flag: '🇦🇷' },
    { name: 'Argelia',         flag: '🇩🇿' },
    { name: 'Austria',         flag: '🇦🇹' },
    { name: 'Jordania',        flag: '🇯🇴' },
  ],
  'Grupo K': [
    { name: 'Portugal',        flag: '🇵🇹' },
    { name: 'RD Congo',        flag: '🇨🇩' },
    { name: 'Uzbekistán',      flag: '🇺🇿' },
    { name: 'Colombia',        flag: '🇨🇴' },
  ],
  'Grupo L': [
    { name: 'Inglaterra',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Panamá',          flag: '🇵🇦' },
    { name: 'Ghana',           flag: '🇬🇭' },
    { name: 'Croacia',         flag: '🇭🇷' },
  ],
};

const PENALTY_PTS = 3;
let memberRef, memberData;
const pendingSelects = {};

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;
  memberRef  = doc(db, 'group_members', `${GROUP_ID}_${user.uid}`);

  // Leer el stage del grupo para decidir si mostrar favoritos
  const groupSnap  = await getDoc(doc(db, 'groups', GROUP_ID));
  const groupStage = groupSnap.exists() ? (groupSnap.data().stage ?? null) : null;

  // Si NO es fase de grupos, ocultar todo el widget de favoritos
  if (!isGroupStage(groupStage)) {
    hideFavsWidget();
    return;
  }

  const snap = await getDoc(memberRef);
  if (!snap.exists()) return;
  memberData = snap.data();
  renderFavsSummary();
  renderFavsInline();
  document.getElementById('manageFavsBtn')?.addEventListener('click', () => {
    expandFavsSection();
    setTimeout(() => {
      document.getElementById('favsInlineSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  });
});

function hideFavsWidget() {
  const summaryCard = document.getElementById('myFavsSummary');
  const manageBtn   = document.getElementById('manageFavsBtn');
  const favsSection = document.getElementById('favsInlineSection');
  if (summaryCard) summaryCard.closest('.col-6, .col-md-3')?.style && (summaryCard.closest('[class*="col"]').style.display = 'none');
  if (manageBtn)   manageBtn.style.display   = 'none';
  if (favsSection) favsSection.style.display = 'none';
}

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
      + `<span style="color:var(--primary-light);font-size:12px">✅ ${chosen.length}/12 elegidos</span>`
      + (missing ? `<span style="color:var(--gold);font-size:12px"> · ⚠️ ${missing} pendientes</span>` : ' <span>🎉</span>');
  }
}

function expandFavsSection() {
  const body = document.getElementById('favsBody');
  const tog  = document.getElementById('favsToggleBtn');
  if (body && body.style.display === 'none') {
    body.style.display = 'block';
    if (tog) tog.textContent = '▲ Ocultar favoritos';
  }
}

function renderFavsInline() {
  const section = document.getElementById('favsInlineSection');
  if (!section) return;

  const favs   = getFavorites();
  const favPts = getFavPts();
  const pens   = getPenalties();
  const chosen  = PHASES.filter(p => favs[p]);
  const missing = PHASES.length - chosen.length;

  const startCollapsed = missing === 0;

  PHASES.forEach(p => delete pendingSelects[p]);

  section.innerHTML = `
    <div style="margin:16px 0 8px;border-radius:14px;border:1px solid var(--border);overflow:hidden">

      <!-- CABECERA siempre visible -->
      <div id="favsHeader" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px;
        background:var(--bg-card2);
        cursor:pointer;
        user-select:none;
      ">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1rem">🏆</span>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--gold)">Favoritos por grupo</div>
            <div id="favsHeaderSub" style="font-size:11px;color:var(--text-muted);margin-top:1px">
              ${missing === 0
                ? `<span style="color:var(--primary-light)">✅ Todos elegidos</span>`
                : `<span style="color:var(--gold)">⚠️ ${missing} grupo${missing>1?'s':''} sin elegir</span>`
              }
            </div>
          </div>
        </div>
        <button id="favsToggleBtn" style="
          background:none;border:1px solid var(--border);color:var(--text-muted);
          border-radius:20px;padding:3px 12px;font-size:12px;cursor:pointer;
          white-space:nowrap;
        ">${startCollapsed ? '▼ Ver / cambiar' : '▲ Ocultar'}</button>
      </div>

      <!-- CUERPO colapsable -->
      <div id="favsBody" style="display:${startCollapsed ? 'none' : 'block'};padding:16px;background:var(--bg-card)">
        <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:14px">
          Elige tus equipos y pulsa <strong style="color:var(--primary-light)">Guardar</strong> al final.
          Cambiar uno ya guardado aplica <strong style="color:var(--accent)">-${PENALTY_PTS} pts</strong>.
        </p>
        <div id="favsRows"></div>
        <div id="favsWarning" style="display:none;margin-top:12px;padding:10px 12px;border-radius:8px;
          background:rgba(201,52,75,0.12);border:1px solid rgba(201,52,75,0.3);
          color:#f5a0ac;font-size:0.82rem"></div>
        <button id="saveAllFavsBtn" style="display:none;margin-top:14px;width:100%;padding:12px;
          border-radius:10px;border:none;font-size:0.9rem;font-weight:700;cursor:pointer;
          background:var(--gold);color:#000">
          💾 Guardar favoritos
        </button>
        <div id="favsSavedMsg" style="display:none;margin-top:10px;padding:12px;border-radius:10px;
          background:rgba(29,144,198,0.15);border:1px solid rgba(29,144,198,0.3);
          text-align:center;color:var(--primary-light);font-size:0.9rem;font-weight:600">
          ✅ ¡Favoritos guardados! Redirigiendo a partidos...
        </div>
      </div>
    </div>`;

  document.getElementById('favsHeader').addEventListener('click', () => {
    const body = document.getElementById('favsBody');
    const tog  = document.getElementById('favsToggleBtn');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    tog.textContent    = open ? '▼ Ver / cambiar' : '▲ Ocultar';
  });

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

    const phaseCol = document.createElement('div');
    phaseCol.style.cssText = 'min-width:68px;font-weight:700;color:var(--gold);font-size:0.82rem';
    phaseCol.textContent = phase;

    const currentCol = document.createElement('div');
    currentCol.style.cssText = 'flex:1;min-width:90px;display:flex;align-items:center;gap:6px';
    if (fav) {
      currentCol.innerHTML = `
        <span style="font-size:1.5rem">${teamObj?.flag||''}</span>
        <div>
          <div style="font-size:0.85rem;font-weight:600">${fav}</div>
          <div style="font-size:11px">
            <span style="color:var(--primary-light)">+${pts} pts</span>
            ${pen ? `<span style="color:var(--accent)"> · -${pen} pen</span>` : ''}
          </div>
        </div>`;
    } else {
      currentCol.innerHTML = `<span style="color:var(--text-muted);font-size:0.82rem;font-style:italic">Sin elegir</span>`;
    }

    const sel = document.createElement('select');
    sel.style.cssText = `padding:6px 10px;border-radius:8px;
      border:1px solid ${fav ? 'var(--accent)' : 'var(--gold)'};
      background:var(--bg-card);color:var(--text);font-size:0.82rem;cursor:pointer;max-width:155px`;
    sel.innerHTML = `<option value="">${fav ? '⚠ Cambiar...' : '⚽ Elegir...'}</option>`
      + teams.map(t => `<option value="${t.name}">${t.flag} ${t.name}</option>`).join('');

    sel.addEventListener('change', () => {
      if (sel.value) {
        pendingSelects[phase] = sel.value;
        sel.style.borderColor = 'var(--primary-light)';
      } else {
        delete pendingSelects[phase];
        sel.style.borderColor = fav ? 'var(--accent)' : 'var(--gold)';
      }
      updateSaveBtn(favs, pens, saveBtn, warning);
    });

    row.appendChild(phaseCol);
    row.appendChild(currentCol);
    row.appendChild(sel);
    container.appendChild(row);
  });

  saveBtn.addEventListener('click', async () => {
    const phases = Object.keys(pendingSelects);
    if (phases.length === 0) return;
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Guardando...';
    const updates = {};
    phases.forEach(phase => {
      const newTeam = pendingSelects[phase];
      const hadFav  = !!favs[phase];
      updates[`favorites.${phase}`] = newTeam;
      if (hadFav && newTeam !== favs[phase])
        updates[`penalties.${phase}`] = (pens[phase] || 0) + PENALTY_PTS;
    });
    try {
      await updateDoc(memberRef, updates);
      if (!memberData.favorites) memberData.favorites = {};
      if (!memberData.penalties) memberData.penalties = {};
      phases.forEach(phase => {
        const hadFav  = !!favs[phase];
        const newTeam = pendingSelects[phase];
        memberData.favorites[phase] = newTeam;
        if (hadFav && newTeam !== favs[phase])
          memberData.penalties[phase] = (memberData.penalties[phase] || 0) + PENALTY_PTS;
      });
      saveBtn.style.display  = 'none';
      warning.style.display  = 'none';
      savedMsg.style.display = 'block';
      setTimeout(() => {
        window.location.href = `group.html?gid=${GROUP_ID}&tab=matches`;
      }, 1400);
    } catch(err) {
      alert('Error: ' + err.message);
      saveBtn.disabled    = false;
      saveBtn.textContent = '💾 Guardar favoritos';
    }
  });
}

function updateSaveBtn(favs, pens, saveBtn, warning) {
  const phases = Object.keys(pendingSelects);
  if (phases.length === 0) { saveBtn.style.display = 'none'; warning.style.display = 'none'; return; }
  saveBtn.style.display = 'block';
  saveBtn.textContent   = `💾 Guardar favoritos (${phases.length} cambio${phases.length > 1 ? 's' : ''})`;
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
