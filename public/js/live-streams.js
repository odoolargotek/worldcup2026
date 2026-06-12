// live-streams.js — Carga streams manuales desde Firestore app_config/live_streams
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

/**
 * Obtiene el array de streams guardado manualmente en Firestore.
 * Formato: [{ match: "...", streams: [{ label: "🇪🇸 Español", url: "..." }] }]
 * @returns {Promise<Array>}
 */
export async function getLiveStreams() {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'live_streams'));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.streams) ? data.streams : [];
  } catch (e) {
    console.warn('[live-streams] Error al cargar streams:', e.message);
    return [];
  }
}

/**
 * Renderiza el tab "Ver en vivo" dentro de un contenedor.
 * @param {HTMLElement} container — elemento donde se inyecta el HTML
 */
export async function renderLiveStreams(container) {
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:12px">📡</div>
      <div>Cargando transmisiones...</div>
    </div>`;

  const streams = await getLiveStreams();

  if (!streams.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:16px">📺</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--text)">Sin transmisiones disponibles</div>
        <div style="font-size:0.85rem">El administrador aún no ha cargado links para hoy.<br>Vuelve a revisar cuando comiencen los partidos.</div>
      </div>`;
    return;
  }

  const html = streams.map(item => {
    const matchName = item.match || 'Partido';
    const links = (item.streams || []).map(s => `
      <a href="${s.url}"
         target="_blank"
         rel="noopener noreferrer"
         class="stream-link-btn">
        ${s.label || 'Ver stream'}
        <span style="font-size:10px;opacity:0.6">↗</span>
      </a>
    `).join('');

    return `
      <div class="stream-match-card">
        <div class="stream-match-title">⚽ ${matchName}</div>
        <div class="stream-links-row">${links || '<span style="color:var(--text-muted);font-size:12px">Sin links disponibles</span>'}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom:12px">
      <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">
        📡 ${streams.length} partido(s) con transmisión disponible
      </span>
    </div>
    ${html}`;
}
