// news.js — Noticias del Mundial 2026
// IMPORTANTE: Para activar noticias reales ejecutar:
//   firebase deploy --only functions:newsProxy
// y luego cambiar USE_CF = true

const USE_CF = false;
const CF_URL = 'https://us-central1-worldcup2026-8f27b.cloudfunctions.net/newsProxy';

async function fetchViaCloudFunction() {
  try {
    const res  = await fetch(CF_URL, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    return json.ok ? json.items : [];
  } catch (_) { return []; }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function renderCard(item) {
  const title = item.title.replace(/ - [^-]+$/, '').replace(/ \| [^|]+$/, '');
  return `
    <a href="${item.link}" target="_blank" rel="noopener" class="news-card-link">
      <div class="news-card">
        ${item.thumb
          ? `<img src="${item.thumb}" class="news-thumb" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="news-thumb-placeholder">⚽</div>`}
        <div class="news-body">
          <div class="news-title">${title}</div>
          <div class="news-meta">
            <span class="news-source">📡 ${item.source}</span>
            <span class="news-ago">${timeAgo(item.pubDate)}</span>
          </div>
        </div>
        <span class="news-ext">↗️</span>
      </div>
    </a>`;
}

function renderSkeleton() {
  return [1,2,3].map(() => `
    <div class="news-card news-skeleton">
      <div class="news-thumb-placeholder skeleton-box"></div>
      <div class="news-body">
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w95"></div>
        <div class="skeleton-line w55"></div>
      </div>
    </div>`).join('');
}

function renderFallback() {
  const sources = [
    { name: 'FIFA — Sitio oficial Mundial 2026', url: 'https://www.fifa.com/fifaplus/es/tournaments/mens/worldcup/canadamexicousa2026', icon: '🏆' },
    { name: 'ESPN Deportes — Fútbol', url: 'https://www.espndeportes.espn.com/futbol', icon: '📺' },
    { name: 'Marca — Mundial 2026', url: 'https://www.marca.com/futbol/mundial/', icon: '📰' },
    { name: 'AS — Copa del Mundo', url: 'https://as.com/futbol/mundial/', icon: '⚽' },
    { name: 'BBC Sport — World Cup 2026', url: 'https://www.bbc.com/sport/football/world-cup', icon: '🎥' },
    { name: 'Goal.com — Noticias', url: 'https://www.goal.com/es', icon: '🌟' },
  ];
  return `
    <div style="background:linear-gradient(135deg,rgba(74,175,212,0.06),rgba(245,158,11,0.04));border:1px solid rgba(74,175,212,0.2);border-radius:14px;padding:20px;margin-bottom:16px;text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">📰</div>
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:6px">Noticias en tiempo real</div>
      <div style="font-size:12px;color:var(--text-muted);max-width:300px;margin:0 auto;line-height:1.6">
        Para activar noticias automáticas ejecuta<br>
        <code style="background:var(--bg-card2);padding:2px 8px;border-radius:4px;font-size:11px">firebase deploy --only functions:newsProxy</code>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🔗 Fuentes del Mundial 2026</div>
    ${sources.map(s => `
      <a href="${s.url}" target="_blank" rel="noopener" class="news-card-link">
        <div class="news-card" style="padding:14px 16px">
          <div class="news-thumb-placeholder" style="font-size:1.4rem">${s.icon}</div>
          <div class="news-body">
            <div class="news-title" style="-webkit-line-clamp:1">${s.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">Abrir en nueva pestaña</div>
          </div>
          <span class="news-ext">↗️</span>
        </div>
      </a>`).join('')}`;
}

function injectStyles() {
  if (document.getElementById('news-styles')) return;
  const s = document.createElement('style');
  s.id = 'news-styles';
  s.textContent = `
    .news-card-link{text-decoration:none;color:inherit;display:block;margin-bottom:10px}
    .news-card{display:flex;gap:12px;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;transition:border-color .2s,background .2s;overflow:hidden}
    .news-card:hover{border-color:rgba(74,175,212,.45);background:rgba(74,175,212,.04)}
    .news-thumb{width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--bg-card2)}
    .news-thumb-placeholder{width:64px;height:64px;border-radius:8px;flex-shrink:0;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;font-size:1.6rem}
    .news-body{flex:1;min-width:0}
    .news-title{font-size:.88rem;font-weight:700;line-height:1.4;margin-bottom:6px;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .news-meta{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px}
    .news-source{font-size:11px;color:#4aafd4;font-weight:600}
    .news-ago{font-size:11px;color:var(--text-muted)}
    .news-ext{font-size:14px;color:var(--text-muted);flex-shrink:0;margin-left:4px}
    .news-skeleton{pointer-events:none}
    .skeleton-box{background:var(--bg-card2)!important;animation:sk 1.6s infinite}
    .skeleton-line{height:11px;background:var(--bg-card2);border-radius:4px;margin-bottom:7px;animation:sk 1.6s infinite}
    .skeleton-line.w80{width:80%}.skeleton-line.w95{width:95%}.skeleton-line.w55{width:55%}
    @keyframes sk{0%{opacity:1}50%{opacity:.35}100%{opacity:1}}
  `;
  document.head.appendChild(s);
}

export async function renderNews() {
  const el = document.getElementById('newsTab');
  if (!el) return;
  injectStyles();

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:1.1rem;font-weight:800">📰 Noticias del Mundial</div>
        <div style="font-size:12px;color:var(--text-muted)" id="newsLastUpdate">${USE_CF ? 'Cargando...' : 'Links directos'}</div>
      </div>
      ${USE_CF ? '<button id="refreshNewsBtn" class="btn btn-outline-light btn-sm" style="font-size:11px">🔄 Actualizar</button>' : ''}
    </div>
    <div id="newsListEl">${USE_CF ? renderSkeleton() : renderFallback()}</div>`;

  if (!USE_CF) return; // modo fallback: solo links, no hay que cargar nada

  async function load() {
    const listEl = document.getElementById('newsListEl');
    const updateEl = document.getElementById('newsLastUpdate');
    const btn = document.getElementById('refreshNewsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    if (listEl) listEl.innerHTML = renderSkeleton();
    const items = await fetchViaCloudFunction();
    if (!listEl) return;
    listEl.innerHTML = items.length
      ? items.map(renderCard).join('')
      : renderFallback();
    const now = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    if (updateEl) updateEl.textContent = items.length ? `${items.length} noticias · ${now}` : 'Sin datos';
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar'; }
  }

  document.getElementById('refreshNewsBtn')?.addEventListener('click', load);
  await load();
}
