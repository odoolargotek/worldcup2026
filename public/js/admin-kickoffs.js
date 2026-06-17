// admin-kickoffs.js — Editar fechas, horas y equipos de partidos
import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const matchList = document.getElementById('matchList');
const filterBar = document.getElementById('filterBar');
const statsBar  = document.getElementById('statsBar');
const globalMsg = document.getElementById('globalMsg');

let allMatches  = [];
let activeGroup = 'all';

// ── Helpers de fecha
function toLocalInput(ts) {
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  const offset = -4 * 60;
  const local  = new Date(d.getTime() + offset * 60000);
  const yyyy = local.getUTCFullYear();
  const mm   = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(local.getUTCDate()).padStart(2, '0');
  const hh   = String(local.getUTCHours()).padStart(2, '0');
  const min  = String(local.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromLocalInput(val) {
  if (!val) return null;
  const [date, time] = val.split('T');
  const [y, mo, day] = date.split('-').map(Number);
  const [h, mi]      = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, day, h + 4, mi));
}

function fmtDateHeader(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function fmtDisplay(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function dayKey(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  // clave YYYY-MM-DD en hora Bolivia
  const offset = -4 * 60;
  const local  = new Date(d.getTime() + offset * 60000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth()+1).padStart(2,'0')}-${String(local.getUTCDate()).padStart(2,'0')}`;
}

function showToast(msg, color = '#059669') {
  globalMsg.textContent = msg;
  globalMsg.style.background = color;
  globalMsg.style.display = 'block';
  setTimeout(() => globalMsg.style.display = 'none', 2500);
}

// ── Cargar partidos
async function loadMatches() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const groups = [...new Set(allMatches.map(m => m.phase))].sort();
  filterBar.innerHTML =
    `<button class="filter-btn active" data-group="all">Todos (${allMatches.length})</button>` +
    groups.map(g => `<button class="filter-btn" data-group="${g}">${g}</button>`).join('');

  filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeGroup = btn.dataset.group;
      renderList();
    });
  });

  statsBar.textContent = `${allMatches.length} partidos cargados`;
  renderList();
}

// ── Renderizar lista agrupada por fecha
function renderList() {
  const filtered = activeGroup === 'all'
    ? allMatches
    : allMatches.filter(m => m.phase === activeGroup);

  if (!filtered.length) {
    matchList.innerHTML = '<p style="color:var(--text-muted)">Sin partidos.</p>';
    return;
  }

  // Agrupar por día (hora Bolivia)
  const byDay = {};
  filtered.forEach(m => {
    const key = dayKey(m.kickoff);
    if (!byDay[key]) byDay[key] = { label: fmtDateHeader(m.kickoff), matches: [] };
    byDay[key].matches.push(m);
  });

  let html = '';
  for (const key of Object.keys(byDay).sort()) {
    const { label, matches } = byDay[key];
    html += `<div class="group-header">📅 ${label.charAt(0).toUpperCase() + label.slice(1)}</div>`;

    for (const m of matches) {
      const ko = toLocalInput(m.kickoff);
      const badge = m.finished === true
        ? '<span style="font-size:10px;background:rgba(52,211,153,0.12);color:#34d399;border-radius:20px;padding:2px 8px;font-weight:700">FINAL</span>'
        : m.home_score != null
          ? '<span style="font-size:10px;background:rgba(74,175,212,0.12);color:#4aafd4;border-radius:20px;padding:2px 8px;font-weight:700">EN JUEGO</span>'
          : '<span style="font-size:10px;color:var(--text-muted)">Pendiente</span>';

      html += `
      <div class="match-row" id="row-${m.id}">

        <!-- Equipos editables -->
        <div class="match-info">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <input type="text" class="team-flag-input" id="hflag-${m.id}" value="${m.home_flag||''}" placeholder="🏁" data-mid="${m.id}" title="Bandera local">
            <input type="text" class="team-name-input" id="hname-${m.id}" value="${m.home_team||''}" placeholder="Local" data-mid="${m.id}">
            <span style="color:var(--text-muted);font-size:0.9rem">vs</span>
            <input type="text" class="team-name-input" id="aname-${m.id}" value="${m.away_team||''}" placeholder="Visita" data-mid="${m.id}">
            <input type="text" class="team-flag-input" id="aflag-${m.id}" value="${m.away_flag||''}" placeholder="🏁" data-mid="${m.id}" title="Bandera visita">
            ${badge}
          </div>
          <div class="match-meta">${m.phase} · ${m.city||''} · <span id="display-${m.id}">${fmtDisplay(m.kickoff)}</span></div>
        </div>

        <!-- Fecha/hora -->
        <input
          type="datetime-local"
          class="dt-input"
          id="input-${m.id}"
          value="${ko}"
          data-original="${ko}"
          data-mid="${m.id}"
        >

        <!-- Guardar -->
        <button class="save-btn" id="btn-${m.id}" data-mid="${m.id}">💾 Guardar</button>
      </div>`;
    }
  }

  matchList.innerHTML = html;
  attachListeners();
}

// ── Listeners
function attachListeners() {
  // Detectar cambios en fecha
  matchList.querySelectorAll('.dt-input').forEach(input => {
    input.addEventListener('change', () => markDirty(input.dataset.mid));
  });

  // Detectar cambios en equipos
  matchList.querySelectorAll('.team-name-input, .team-flag-input').forEach(input => {
    input.addEventListener('input', () => markDirty(input.dataset.mid));
  });

  // Botones individuales
  matchList.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveOne(btn.dataset.mid));
  });
}

function markDirty(mid) {
  const dtInput = document.getElementById('input-' + mid);
  const row     = document.getElementById('row-' + mid);
  const dtDirty = dtInput && dtInput.value !== dtInput.dataset.original;

  const m = allMatches.find(x => x.id === mid);
  const hnDirty = m && document.getElementById('hname-' + mid)?.value !== m.home_team;
  const anDirty = m && document.getElementById('aname-' + mid)?.value !== m.away_team;
  const hfDirty = m && document.getElementById('hflag-' + mid)?.value !== (m.home_flag||'');
  const afDirty = m && document.getElementById('aflag-' + mid)?.value !== (m.away_flag||'');

  const anyDirty = dtDirty || hnDirty || anDirty || hfDirty || afDirty;
  dtInput?.classList.toggle('dirty', dtDirty);
  row?.classList.toggle('modified', anyDirty);
}

// ── Guardar un partido
async function saveOne(mid) {
  const dtInput = document.getElementById('input-' + mid);
  const btn     = document.getElementById('btn-' + mid);
  const row     = document.getElementById('row-' + mid);
  if (!dtInput) return;

  const newDate = fromLocalInput(dtInput.value);
  if (!newDate || isNaN(newDate.getTime())) {
    showToast('❌ Fecha inválida', '#dc2626');
    return;
  }

  const newHomeTeam = document.getElementById('hname-' + mid)?.value.trim() || '';
  const newAwayTeam = document.getElementById('aname-' + mid)?.value.trim() || '';
  const newHomeFlag = document.getElementById('hflag-' + mid)?.value.trim() || '';
  const newAwayFlag = document.getElementById('aflag-' + mid)?.value.trim() || '';

  if (!newHomeTeam || !newAwayTeam) {
    showToast('❌ Los nombres de equipo no pueden estar vacíos', '#dc2626');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    await updateDoc(doc(db, 'matches', mid), {
      kickoff:   Timestamp.fromDate(newDate),
      home_team: newHomeTeam,
      away_team: newAwayTeam,
      home_flag: newHomeFlag,
      away_flag: newAwayFlag,
    });

    // Actualizar estado local
    const m = allMatches.find(x => x.id === mid);
    if (m) {
      m.kickoff    = Timestamp.fromDate(newDate);
      m.home_team  = newHomeTeam;
      m.away_team  = newAwayTeam;
      m.home_flag  = newHomeFlag;
      m.away_flag  = newAwayFlag;
    }

    dtInput.dataset.original = dtInput.value;
    dtInput.classList.remove('dirty');
    row?.classList.remove('modified');
    row?.classList.add('saved');
    setTimeout(() => row?.classList.remove('saved'), 2000);

    const disp = document.getElementById('display-' + mid);
    if (disp) disp.textContent = fmtDisplay(newDate);

    showToast('✅ Guardado');
  } catch(e) {
    showToast('❌ Error: ' + e.message, '#dc2626');
  }

  btn.disabled = false;
  btn.textContent = '💾 Guardar';
}

// ── Guardar TODOS los modificados
document.getElementById('btnSaveAll').addEventListener('click', async () => {
  const dirty = matchList.querySelectorAll('.match-row.modified');
  if (!dirty.length) { showToast('ℹ️ Sin cambios pendientes', '#1d90c6'); return; }

  const btn = document.getElementById('btnSaveAll');
  btn.disabled = true;
  btn.textContent = `⏳ Guardando ${dirty.length}...`;

  let ok = 0;
  for (const row of dirty) {
    const mid = row.id.replace('row-', '');
    await saveOne(mid);
    ok++;
  }

  btn.disabled = false;
  btn.textContent = '💾 Guardar todos los cambios';
  showToast(`✅ ${ok} partido(s) actualizados`);
});

// ── Init
loadMatches();
