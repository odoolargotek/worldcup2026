// admin-kickoffs.js — Editar fechas y horas de partidos
import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const matchList = document.getElementById('matchList');
const filterBar = document.getElementById('filterBar');
const statsBar  = document.getElementById('statsBar');
const globalMsg = document.getElementById('globalMsg');

let allMatches  = [];   // { id, ...data, originalKickoff }
let activeGroup = 'all';

// ── Helpers
function toLocalInput(ts) {
  // Convierte Timestamp o Date a string 'YYYY-MM-DDTHH:MM' en hora Bolivia (UTC-4)
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  // Ajuste manual UTC-4
  const offset = -4 * 60;
  const local  = new Date(d.getTime() + offset * 60000);
  const yyyy   = local.getUTCFullYear();
  const mm     = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd     = String(local.getUTCDate()).padStart(2, '0');
  const hh     = String(local.getUTCHours()).padStart(2, '0');
  const min    = String(local.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromLocalInput(val) {
  // Interpreta el string como hora Bolivia (UTC-4) y devuelve Date UTC
  if (!val) return null;
  const local = new Date(val + ':00');  // sin timezone = local del navegador
  // Si el navegador está en UTC-4 (Bolivia), no hace falta ajustar
  // Para ser seguros, tratamos el valor como hora Bolivia explícita
  const [date, time] = val.split('T');
  const [y, mo, day] = date.split('-').map(Number);
  const [h, mi]      = time.split(':').map(Number);
  // UTC = Bolivia + 4h
  return new Date(Date.UTC(y, mo - 1, day, h + 4, mi));
}

function fmtDisplay(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
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
  allMatches = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    originalKickoff: d.data().kickoff,
  }));

  // Construir filtros de grupo
  const groups = [...new Set(allMatches.map(m => m.phase))].sort();
  filterBar.innerHTML = '<button class="filter-btn active" data-group="all">Todos (' + allMatches.length + ')</button>' +
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

// ── Renderizar lista
function renderList() {
  const filtered = activeGroup === 'all'
    ? allMatches
    : allMatches.filter(m => m.phase === activeGroup);

  if (!filtered.length) {
    matchList.innerHTML = '<p style="color:var(--text-muted)">Sin partidos.</p>';
    return;
  }

  // Agrupar por phase
  const byPhase = {};
  filtered.forEach(m => {
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m);
  });

  let html = '';
  for (const phase of Object.keys(byPhase).sort()) {
    if (activeGroup === 'all') {
      html += `<div class="group-header">${phase}</div>`;
    }
    for (const m of byPhase[phase]) {
      const ko     = toLocalInput(m.kickoff);
      const badge  = m.finished === true
        ? '<span style="font-size:10px;background:rgba(52,211,153,0.12);color:#34d399;border-radius:20px;padding:2px 8px;font-weight:700">FINAL</span>'
        : m.home_score != null
          ? '<span style="font-size:10px;background:rgba(74,175,212,0.12);color:#4aafd4;border-radius:20px;padding:2px 8px;font-weight:700">EN JUEGO</span>'
          : '';
      html += `
        <div class="match-row" id="row-${m.id}">
          <div class="match-info">
            <div class="match-name">${m.home_flag||''}${m.home_team} vs ${m.away_team}${m.away_flag||''} ${badge}</div>
            <div class="match-meta">${m.phase} · ${m.city||''} · <span id="display-${m.id}">${fmtDisplay(m.kickoff)}</span></div>
          </div>
          <input
            type="datetime-local"
            class="dt-input"
            id="input-${m.id}"
            value="${ko}"
            data-original="${ko}"
            data-mid="${m.id}"
          >
          <button class="save-btn" id="btn-${m.id}" data-mid="${m.id}">💾 Guardar</button>
        </div>`;
    }
  }

  matchList.innerHTML = html;

  // Listeners de inputs
  matchList.querySelectorAll('.dt-input').forEach(input => {
    input.addEventListener('change', () => {
      const mid = input.dataset.mid;
      const isDirty = input.value !== input.dataset.original;
      input.classList.toggle('dirty', isDirty);
      document.getElementById('row-' + mid)?.classList.toggle('modified', isDirty);
    });
  });

  // Listeners de botones individuales
  matchList.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveOne(btn.dataset.mid));
  });
}

// ── Guardar un partido
async function saveOne(mid) {
  const input = document.getElementById('input-' + mid);
  const btn   = document.getElementById('btn-' + mid);
  const row   = document.getElementById('row-' + mid);
  if (!input || !input.value) return;

  const newDate = fromLocalInput(input.value);
  if (!newDate || isNaN(newDate.getTime())) {
    showToast('❌ Fecha inválida', '#dc2626');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    await updateDoc(doc(db, 'matches', mid), {
      kickoff: Timestamp.fromDate(newDate)
    });

    // Actualizar estado local
    const m = allMatches.find(x => x.id === mid);
    if (m) m.kickoff = Timestamp.fromDate(newDate);

    input.dataset.original = input.value;
    input.classList.remove('dirty');
    row?.classList.remove('modified');
    row?.classList.add('saved');
    setTimeout(() => row?.classList.remove('saved'), 2000);

    // Actualizar texto de display
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
  const dirty = matchList.querySelectorAll('.dt-input.dirty');
  if (!dirty.length) { showToast('ℹ️ Sin cambios pendientes', '#1d90c6'); return; }

  const btn = document.getElementById('btnSaveAll');
  btn.disabled = true;
  btn.textContent = `⏳ Guardando ${dirty.length}...`;

  let ok = 0;
  for (const input of dirty) {
    await saveOne(input.dataset.mid);
    ok++;
  }

  btn.disabled = false;
  btn.textContent = '💾 Guardar todos los cambios';
  showToast(`✅ ${ok} partido(s) actualizados`);
});

// ── Init
loadMatches();
