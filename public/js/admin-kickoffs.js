// admin-kickoffs.js — Editar y eliminar partidos
import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const matchList = document.getElementById('matchList');
const filterBar = document.getElementById('filterBar');
const statsBar  = document.getElementById('statsBar');
const globalMsg = document.getElementById('globalMsg');

// Modal de confirmación
const modal        = document.getElementById('confirmModal');
const modalMsg     = document.getElementById('modalMsg');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel  = document.getElementById('modalCancel');

let allMatches  = [];
let activeGroup = 'all';

// ── Modal de confirmación
function confirm(msg) {
  return new Promise(resolve => {
    modalMsg.textContent = msg;
    modal.style.display = 'flex';
    const ok  = () => { cleanup(); resolve(true);  };
    const no  = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      modal.style.display = 'none';
      modalConfirm.removeEventListener('click', ok);
      modalCancel.removeEventListener('click', no);
    };
    modalConfirm.addEventListener('click', ok);
    modalCancel.addEventListener('click', no);
  });
}

// ── Helpers de fecha
function toLocalInput(ts) {
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  const local = new Date(d.getTime() + (-4 * 60) * 60000);
  return [
    local.getUTCFullYear(),
    String(local.getUTCMonth()+1).padStart(2,'0'),
    String(local.getUTCDate()).padStart(2,'0')
  ].join('-') + 'T' + [
    String(local.getUTCHours()).padStart(2,'0'),
    String(local.getUTCMinutes()).padStart(2,'0')
  ].join(':');
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
  const local = new Date(d.getTime() + (-4 * 60) * 60000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth()+1).padStart(2,'0')}-${String(local.getUTCDate()).padStart(2,'0')}`;
}

function showToast(msg, color = '#059669') {
  globalMsg.textContent = msg;
  globalMsg.style.background = color;
  globalMsg.style.display = 'block';
  setTimeout(() => globalMsg.style.display = 'none', 2800);
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
        ? '<span class="badge-status badge-final">FINAL</span>'
        : m.home_score != null
          ? '<span class="badge-status badge-live">EN JUEGO</span>'
          : '<span class="badge-status badge-pending">Pendiente</span>';

      html += `
      <div class="match-row" id="row-${m.id}">

        <div class="match-info">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <input type="text" class="team-flag-input" id="hflag-${m.id}" value="${m.home_flag||''}" placeholder="🏁" data-mid="${m.id}" title="Bandera local">
            <input type="text" class="team-name-input" id="hname-${m.id}" value="${m.home_team||''}" placeholder="Local" data-mid="${m.id}">
            <span style="color:var(--text-muted);font-size:0.85rem">vs</span>
            <input type="text" class="team-name-input" id="aname-${m.id}" value="${m.away_team||''}" placeholder="Visita" data-mid="${m.id}">
            <input type="text" class="team-flag-input" id="aflag-${m.id}" value="${m.away_flag||''}" placeholder="🏁" data-mid="${m.id}" title="Bandera visita">
            ${badge}
          </div>
          <div class="match-meta">${m.phase} · ${m.city||''} · <span id="display-${m.id}">${fmtDisplay(m.kickoff)}</span></div>
        </div>

        <input type="datetime-local" class="dt-input" id="input-${m.id}"
          value="${ko}" data-original="${ko}" data-mid="${m.id}">

        <div class="action-btns">
          <button class="save-btn"  id="btn-${m.id}"  data-mid="${m.id}">💾 Guardar</button>
          <button class="del-btn"   id="del-${m.id}"  data-mid="${m.id}" title="Eliminar partido">🗑️</button>
        </div>
      </div>`;
    }
  }

  matchList.innerHTML = html;
  attachListeners();
}

// ── Listeners
function attachListeners() {
  matchList.querySelectorAll('.dt-input').forEach(input => {
    input.addEventListener('change', () => markDirty(input.dataset.mid));
  });
  matchList.querySelectorAll('.team-name-input, .team-flag-input').forEach(input => {
    input.addEventListener('input', () => markDirty(input.dataset.mid));
  });
  matchList.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveOne(btn.dataset.mid));
  });
  matchList.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteOne(btn.dataset.mid));
  });
}

function markDirty(mid) {
  const dtInput = document.getElementById('input-' + mid);
  const row     = document.getElementById('row-' + mid);
  const m       = allMatches.find(x => x.id === mid);
  const dtDirty = dtInput && dtInput.value !== dtInput.dataset.original;
  const hnDirty = m && document.getElementById('hname-' + mid)?.value !== m.home_team;
  const anDirty = m && document.getElementById('aname-' + mid)?.value !== m.away_team;
  const hfDirty = m && document.getElementById('hflag-' + mid)?.value !== (m.home_flag||'');
  const afDirty = m && document.getElementById('aflag-' + mid)?.value !== (m.away_flag||'');
  dtInput?.classList.toggle('dirty', dtDirty);
  row?.classList.toggle('modified', dtDirty || hnDirty || anDirty || hfDirty || afDirty);
}

// ── Guardar un partido
async function saveOne(mid) {
  const dtInput = document.getElementById('input-' + mid);
  const btn     = document.getElementById('btn-' + mid);
  const row     = document.getElementById('row-' + mid);
  if (!dtInput) return;

  const newDate = fromLocalInput(dtInput.value);
  if (!newDate || isNaN(newDate.getTime())) { showToast('❌ Fecha inválida', '#dc2626'); return; }

  const newHomeTeam = document.getElementById('hname-' + mid)?.value.trim() || '';
  const newAwayTeam = document.getElementById('aname-' + mid)?.value.trim() || '';
  const newHomeFlag = document.getElementById('hflag-' + mid)?.value.trim() || '';
  const newAwayFlag = document.getElementById('aflag-' + mid)?.value.trim() || '';

  if (!newHomeTeam || !newAwayTeam) { showToast('❌ Nombres de equipo vacíos', '#dc2626'); return; }

  btn.disabled = true; btn.textContent = '⏳';

  try {
    await updateDoc(doc(db, 'matches', mid), {
      kickoff: Timestamp.fromDate(newDate),
      home_team: newHomeTeam, away_team: newAwayTeam,
      home_flag: newHomeFlag, away_flag: newAwayFlag,
    });
    const m = allMatches.find(x => x.id === mid);
    if (m) Object.assign(m, { kickoff: Timestamp.fromDate(newDate), home_team: newHomeTeam, away_team: newAwayTeam, home_flag: newHomeFlag, away_flag: newAwayFlag });
    dtInput.dataset.original = dtInput.value;
    dtInput.classList.remove('dirty');
    row?.classList.remove('modified');
    row?.classList.add('saved');
    setTimeout(() => row?.classList.remove('saved'), 2000);
    const disp = document.getElementById('display-' + mid);
    if (disp) disp.textContent = fmtDisplay(newDate);
    showToast('✅ Guardado');
  } catch(e) {
    showToast('❌ ' + e.message, '#dc2626');
  }
  btn.disabled = false; btn.textContent = '💾 Guardar';
}

// ── Eliminar un partido
async function deleteOne(mid) {
  const m = allMatches.find(x => x.id === mid);
  const name = m ? `${m.home_flag||''}${m.home_team} vs ${m.away_team}${m.away_flag||''}` : mid;

  const ok = await confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`);
  if (!ok) return;

  const btn = document.getElementById('del-' + mid);
  const row = document.getElementById('row-' + mid);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    await deleteDoc(doc(db, 'matches', mid));
    allMatches = allMatches.filter(x => x.id !== mid);
    row?.remove();
    statsBar.textContent = `${allMatches.length} partidos cargados`;
    // Limpiar encabezados de día vacíos
    matchList.querySelectorAll('.group-header').forEach(header => {
      const next = header.nextElementSibling;
      if (!next || next.classList.contains('group-header')) header.remove();
    });
    showToast(`🗑️ Partido eliminado`);
  } catch(e) {
    showToast('❌ ' + e.message, '#dc2626');
    if (btn) { btn.disabled = false; btn.textContent = '🗑️'; }
  }
}

// ── Guardar TODOS los modificados
document.getElementById('btnSaveAll').addEventListener('click', async () => {
  const dirty = matchList.querySelectorAll('.match-row.modified');
  if (!dirty.length) { showToast('ℹ️ Sin cambios pendientes', '#1d90c6'); return; }
  const btn = document.getElementById('btnSaveAll');
  btn.disabled = true; btn.textContent = `⏳ Guardando ${dirty.length}...`;
  let ok = 0;
  for (const row of dirty) { await saveOne(row.id.replace('row-', '')); ok++; }
  btn.disabled = false; btn.textContent = '💾 Guardar todos los cambios';
  showToast(`✅ ${ok} partido(s) actualizados`);
});

// ── Init
loadMatches();
