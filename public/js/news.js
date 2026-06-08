// news.js — Noticias del Mundial 2026 via Google News RSS
const RSS_QUERIES = [
  'Mundial+2026+FIFA',
  'Copa+del+Mundo+2026',
  'World+Cup+2026'
];
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

function rssUrl(q) {
  return `https://news.google.com/rss/search?q=${q}&hl=es-419&gl=US&ceid=US:es-419`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h/24)}d`;
}

function parseItems(xmlStr) {
  const parser = new DOMParser();
  const xml    = parser.parseFromString(xmlStr, 'text/xml');
  const items  = [...xml.querySelectorAll('item')].slice(0, 20);
  return items.map(item => ({
    title:   item.querySelector('title')?.textContent || '',
    link:    item.querySelector('link')?.textContent  || '#',
    source:  item.querySelector('source')?.textContent || 'Google News',
    pubDate: item.querySelector('pubDate')?.textContent || '',
    desc:    item.querySelector('description')?.textContent || '',
  }));
}

function extractThumb(desc) {
  const match = desc.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

function renderCard(item) {
  const thumb = extractThumb(item.desc);
  const ago   = timeAgo(item.pubDate);
  const title = item.title.replace(/ - [^-]+$/, ''); // quitar "- Fuente" del título
  return `
    <a href="${item.link}" target="_blank" rel="noopener" class="news-card-link">
      <div class="news-card">
        ${thumb ? `<img src="${thumb}" class="news-thumb" alt="" loading="lazy" onerror="this.style.display='none'">` : `<div class="news-thumb-placeholder">📰</div>`}
        <div class="news-body">
          <div class="news-title">${title}</div>
          <div class="news-meta">
            <span class="news-source">📡 ${item.source}</span>
            <span class="news-ago">${ago}</span>
          </div>
        </div>
      </div>
    </a>`;
}

function renderSkeleton() {
  return [1,2,3,4].map(() => `
    <div class="news-card news-skeleton">
      <div class="news-thumb-placeholder skeleton-box"></div>
      <div class="news-body">
        <div class="skeleton-line w75"></div>
        <div class="skeleton-line w95"></div>
        <div class="skeleton-line w50"></div>
      </div>
    </div>`).join('');
}

async function fetchNews() {
  for (const q of RSS_QUERIES) {
    try {
      const res  = await fetch(CORS_PROXY + encodeURIComponent(rssUrl(q)));
      const json = await res.json();
      const items = parseItems(json.contents);
      if (items.length > 0) return items;
    } catch(_) {}
  }
  return [];
}

export async function renderNews() {
  const el = document.getElementById('newsTab');
  if (!el) return;

  // Inyectar estilos una sola vez
  if (!document.getElementById('news-styles')) {
    const style = document.createElement('style');
    style.id = 'news-styles';
    style.textContent = `
      .news-card-link { text-decoration:none;color:inherit;display:block;margin-bottom:10px; }
      .news-card { display:flex;gap:12px;align-items:flex-start;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;transition:border-color 0.2s,background 0.2s;position:relative;overflow:hidden; }
      .news-card:hover { border-color:rgba(74,175,212,0.45);background:rgba(74,175,212,0.04); }
      .news-thumb { width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--bg-card2); }
      .news-thumb-placeholder { width:64px;height:64px;border-radius:8px;flex-shrink:0;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;font-size:1.6rem; }
      .news-body { flex:1;min-width:0; }
      .news-title { font-size:0.88rem;font-weight:700;line-height:1.4;margin-bottom:6px;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
      .news-meta { display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px; }
      .news-source { font-size:11px;color:#4aafd4;font-weight:600; }
      .news-ago { font-size:11px;color:var(--text-muted); }
      .news-skeleton { pointer-events:none; }
      .skeleton-box { background:var(--bg-card2)!important; animation:shimmer 1.6s infinite; }
      .skeleton-line { height:11px;background:var(--bg-card2);border-radius:4px;margin-bottom:7px;animation:shimmer 1.6s infinite; }
      .skeleton-line.w75 { width:75%; }
      .skeleton-line.w95 { width:95%; }
      .skeleton-line.w50 { width:50%; }
      @keyframes shimmer { 0%{opacity:1}50%{opacity:0.4}100%{opacity:1} }
    `;
    document.head.appendChild(style);
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:1.1rem;font-weight:800">📰 Noticias del Mundial</div>
        <div style="font-size:12px;color:var(--text-muted)" id="newsLastUpdate">Cargando...</div>
      </div>
      <button id="refreshNewsBtn" class="btn btn-outline-light btn-sm" style="font-size:11px">🔄 Actualizar</button>
    </div>
    <div id="newsListEl">${renderSkeleton()}</div>`;

  async function load() {
    const listEl  = document.getElementById('newsListEl');
    const updateEl = document.getElementById('newsLastUpdate');
    const btn     = document.getElementById('refreshNewsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Cargando...'; }
    if (listEl) listEl.innerHTML = renderSkeleton();

    const items = await fetchNews();

    if (items.length === 0) {
      if (listEl) listEl.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">😕</div>
          <div>No se pudieron cargar las noticias.</div>
          <div style="font-size:12px;margin-top:4px">Revisa tu conexión e intenta de nuevo.</div>
        </div>`;
    } else {
      if (listEl) listEl.innerHTML = items.map(renderCard).join('');
    }

    const now = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    if (updateEl) updateEl.textContent = `Actualizado a las ${now} · ${items.length} noticias`;
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar'; }
  }

  document.getElementById('refreshNewsBtn')?.addEventListener('click', load);
  await load();
}
