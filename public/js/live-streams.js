// live-streams.js — Carga streams manuales desde Firestore (app_config/live_streams)
// Formato: [{ match: string, streams: [{ label: string, url: string }] }]
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

/**
 * Devuelve el array de streams manuales guardado en Firestore.
 * Si no existe o falla, devuelve [].
 */
export async function getLiveStreams() {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'live_streams'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.streams)) return data.streams;
    }
  } catch (err) {
    console.warn('[live-streams] No se pudo cargar desde Firestore:', err.message);
  }
  // Fallback: intentar desde el archivo estático del repo
  try {
    const resp = await fetch('/data/live-streams.json');
    if (resp.ok) return await resp.json();
  } catch (_) {}
  return [];
}

/**
 * Renderiza la lista de streams en un contenedor dado.
 * @param {HTMLElement} container
 * @param {Array} streams - resultado de getLiveStreams()
 */
export function renderLiveStreams(container, streams) {
  if (!container) return;
  if (!streams || streams.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:12px">📺</div>
        <div style="font-weight:700;margin-bottom:6px">No hay streams disponibles</div>
        <div style="font-size:0.83rem">El administrador aún no ha publicado links para hoy.</div>
      </div>`;
    return;
  }

  container.innerHTML = streams.map((item, idx) => {
    const streamBtns = item.streams.map((s, si) => `
      <a href="${s.url}" target="_blank" rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
               background:rgba(74,175,212,0.1);border:1px solid rgba(74,175,212,0.3);
               border-radius:20px;font-size:0.8rem;font-weight:600;color:#4aafd4;
               text-decoration:none;transition:background 0.15s;"
        onmouseover="this.style.background='rgba(74,175,212,0.22)'"
        onmouseout="this.style.background='rgba(74,175,212,0.1)'">
        ${s.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>`).join('');

    return `
      <div style="background:var(--bg-card2,rgba(255,255,255,0.04));
                  border:1px solid var(--border,rgba(255,255,255,0.08));
                  border-radius:12px;padding:16px 18px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:1.3rem">📺</span>
          <span style="font-weight:700;font-size:0.95rem">${item.match}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${item.streams.length} enlace${item.streams.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${streamBtns}</div>
      </div>`;
  }).join('');
}
