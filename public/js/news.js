// news.js — Noticias del Mundial 2026 via RSS feeds deportivos
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Feeds RSS públicos de medios deportivos que rss2json acepta
const FEEDS = [
  { url: 'https://www.espn.com/espn/rss/soccer/news', label: 'ESPN' },
  { url: 'https://e00-marca.uecdn.es/rss/futbol/mundial.xml', label: 'Marca' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', label: 'BBC Sport' },
  { url: 'https://www.skysports.com/rss/12040', label: 'Sky Sports' },
];

// Keywords para filtrar noticias del Mundial 2026
const KEYWORDS = ['world cup','mundial','2026','fifa','wc2026','copa del mundo'];

function isWorldCup(item) {
  const text = (item.title + ' ' + (item.description || '')).toLowerCase();
  return KEYWORDS.some(k => text.includes(k));
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

async function fetchFeed(feed) {
  try {
    const res  = await fetch(RSS2JSON + encodeURIComponent(feed.url) + '&count=30');
    const json = await res.json();
    if (json.status === 'ok' && json.items?.length > 0) {
      return json.items.map(item => ({
        title:   item.title || '',
        link:    item.link  || '#',
        source:  feed.label,
        pubDate: item.pubDate || '',
        thumb:   item.thumbnail || item.enclosure?.link || null,
      }));
    }
  } catch (_) {}
  return [];
}

async function fetchNews() {
  // Intentar todos los feeds en paralelo
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)));
  let all = [];
  results.forEach(r => { if (r.status === 'fulfilled') all = all.concat(r.value); });

  // Filtrar Mundial 2026 si hay suficientes; si no, mostrar todo (fútbol)
  const filtered = all.filter(isWorldCup);
  const items = filtered.length >= 3 ? filtered : all;

  // Ordenar por fecha más reciente y deduplicar por título
  const seen = new Set();
  return items
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .filter(item => {
      const key = item.title.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 25);
}

function renderCard(item) {
  const ago   = timeAgo(item.pubDate);
  const title = item.title.replace(/ - [^-]+$/, '');
  return `
    <a href="${item.link}" target="_blank" rel="noopener" class="news-card-link">
      <div class="news-card">
        ${item.thumb
          ? `<img src="${item.thumb}" class="news-thumb" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="news-thumb-placeholder">⚽</div>`
        }
        <div class="news-body">
          <div class="news-title">${title}</div>
          <div class="news-meta">
            <span class="news-source">📡 ${item.source}</span>
            <span class="news-ago">${ago}</span>
          </div>
        </div>
        <span class="news-ext">↗️</span>
      </div>
    </a>`;
}

function renderSkeleton() {
  return [1,2,3,4,5].map(() => `
    <div class="news-card news-skeleton">
      <div class="news-thumb-placeholder skeleton-box"></div>
      <div class="news-body">
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w95"></div>
        <div class="skeleton-line w55"></div>
      </div>
    </div>`).join('');
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
        <div style="font-size:12px;color:var(--text-muted)" id="newsLastUpdate">Cargando...</div>
      </div>
      <button id="refreshNewsBtn" class="btn btn-outline-light btn-sm" style="font-size:11px">🔄 Actualizar</button>
    </div>
    <div id="newsListEl">${renderSkeleton()}</div>`;

  async function load() {
    const listEl   = document.getElementById('newsListEl');
    const updateEl = document.getElementById('newsLastUpdate');
    const btn      = document.getElementById('refreshNewsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    if (listEl) listEl.innerHTML = renderSkeleton();

    const items = await fetchNews();

    if (!listEl) return;
    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
          <div style="font-size:2.5rem;margin-bottom:10px">😕</div>
          <div style="font-weight:600">No se pudieron cargar las noticias</div>
          <div style="font-size:12px;margin-top:6px">Revisa tu conexión e intenta de nuevo</div>
        </div>`;
    } else {
      listEl.innerHTML = items.map(renderCard).join('');
    }

    const now = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    if (updateEl) updateEl.textContent = `${items.length} noticias · ${now}`;
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar'; }
  }

  document.getElementById('refreshNewsBtn')?.addEventListener('click', load);
  await load();
}
