// streams-manager.js — Gestor de links en vivo (manual)
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const DOCREF = () => doc(db, 'app_config', 'live_streams');

function getEls() {
  return {
    editor:    document.getElementById('streamsJsonEditor'),
    msgEl:     document.getElementById('streamsMsg'),
    previewEl: document.getElementById('streamsPreview'),
    statusEl:  document.getElementById('streamsCurrentStatus'),
  };
}

function showMsg(text, ok = true) {
  const { msgEl } = getEls();
  msgEl.innerHTML = `<span style="color:${ok ? '#34d399' : '#f5a0ac'}">${text}</span>`;
  setTimeout(() => { msgEl.innerHTML = ''; }, 5000);
}

function renderPreview(data) {
  const { previewEl } = getEls();
  if (!Array.isArray(data) || data.length === 0) {
    previewEl.innerHTML = '<span style="color:var(--text-muted)">Array vacío — se mostrará "Sin transmisiones disponibles".</span>';
    return;
  }
  previewEl.innerHTML = data.map(item => {
    const links = (item.streams || []).map(s =>
      `<a class="streams-preview-link" href="${s.url}" target="_blank">🔗 ${s.label}</a>`
    ).join('');
    return `<div class="streams-preview-item">
      <div class="streams-preview-match">⚽ ${item.match || '(sin título)'}</div>
      <div>${links || '<span style="color:var(--text-muted);font-size:12px">Sin links</span>'}</div>
    </div>`;
  }).join('');
}

async function loadCurrentStreams() {
  const { editor, statusEl } = getEls();
  statusEl.innerHTML = '<span style="color:#4aafd4">⏳ Cargando desde Firestore...</span>';
  try {
    const snap = await getDoc(DOCREF());
    if (!snap.exists()) {
      statusEl.innerHTML = '<span style="color:var(--text-muted)">⚠️ No hay JSON guardado aún.</span>';
      editor.value = '[]';
      return;
    }
    const data = snap.data();
    const streams = data.streams || [];
    const updatedAt = data.updated_at?.toDate?.();
    const fmt = updatedAt
      ? updatedAt.toLocaleString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
      : 'fecha desconocida';
    editor.value = JSON.stringify(streams, null, 2);
    statusEl.innerHTML = `<span style="color:#34d399">✅ ${streams.length} partido(s) cargados</span> <span style="color:var(--text-muted);font-size:11px">— guardado el ${fmt}</span>`;
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#f5a0ac">❌ Error: ${e.message}</span>`;
  }
}

async function saveStreams() {
  const { editor } = getEls();
  const raw = editor.value.trim();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    showMsg('❌ JSON inválido: ' + e.message, false);
    return;
  }
  if (!Array.isArray(data)) {
    showMsg('❌ El JSON debe ser un array [ ... ]', false);
    return;
  }
  const btn = document.getElementById('btnSaveStreams');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    await setDoc(DOCREF(), { streams: data, updated_at: Timestamp.now() });
    showMsg(`✅ ${data.length} partido(s) guardados en Firestore`, true);
    await loadCurrentStreams();
  } catch (e) {
    showMsg('❌ Error al guardar: ' + e.message, false);
  }
  btn.disabled = false; btn.textContent = '💾 Guardar en Firestore';
}

function previewStreams() {
  const { editor } = getEls();
  try {
    const data = JSON.parse(editor.value.trim());
    renderPreview(data);
  } catch (e) {
    const { previewEl } = getEls();
    previewEl.innerHTML = `<span style="color:#f5a0ac">❌ JSON inválido: ${e.message}</span>`;
  }
}

function clearEditor() {
  const { editor, previewEl } = getEls();
  editor.value = '';
  previewEl.innerHTML = '<span style="color:var(--text-muted)">Pulsa «Vista previa» para ver cómo quedará.</span>';
}

export function initStreamsManager() {
  document.getElementById('btnLoadStreams')?.addEventListener('click', loadCurrentStreams);
  document.getElementById('btnSaveStreams')?.addEventListener('click', saveStreams);
  document.getElementById('btnPreviewStreams')?.addEventListener('click', previewStreams);
  document.getElementById('btnClearStreams')?.addEventListener('click', clearEditor);

  // Cargar estado actual automáticamente cuando se abre el tab
  const streamsTab = document.getElementById('atab-streams');
  if (streamsTab) {
    let loaded = false;
    new MutationObserver(() => {
      if (!streamsTab.classList.contains('d-none') && !loaded) {
        loaded = true;
        loadCurrentStreams();
      }
    }).observe(streamsTab, { attributes: true, attributeFilter: ['class'] });
  }
}
