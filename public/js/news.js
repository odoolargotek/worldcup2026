// news.js — Noticias del Mundial (placeholder listo para API)
// TODO: integrar con API de noticias (NewsAPI, football-data.org, RapidAPI Sports, etc.)

export function renderNews() {
  const el = document.getElementById('newsTab');
  if (!el) return;

  // Placeholder visual profesional — listo para reemplazar con datos reales de API
  el.innerHTML = `

    <!-- Header noticias -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:1.1rem;font-weight:800">📰 Noticias del Mundial</div>
        <div style="font-size:12px;color:var(--text-muted)">Actualizado en tiempo real</div>
      </div>
      <button id="refreshNewsBtn" class="btn btn-outline-light btn-sm" style="font-size:11px">🔄 Actualizar</button>
    </div>

    <!-- Banner próximamente -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a);border:1px solid rgba(99,102,241,0.35);border-radius:14px;padding:32px 20px;text-align:center;margin-bottom:20px">
      <div style="font-size:3rem;margin-bottom:12px">📰</div>
      <div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:6px">Noticias en camino</div>
      <div style="font-size:0.85rem;color:var(--text-muted);max-width:320px;margin:0 auto;line-height:1.6">
        Pronto integraremos noticias en vivo del Mundial 2026 directamente aquí —
        resultados, lesiones, alineaciones y más.
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <span style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:11px;padding:4px 12px;border-radius:20px">⚽ Resultados en vivo</span>
        <span style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:var(--gold);font-size:11px;padding:4px 12px;border-radius:20px">📊 Estadísticas</span>
        <span style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:var(--green-light);font-size:11px;padding:4px 12px;border-radius:20px">🩹 Lesiones y bajas</span>
        <span style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:11px;padding:4px 12px;border-radius:20px">🏆 Clasificación</span>
      </div>
    </div>

    <!-- Skeleton cards (placeholders animados) -->
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Vista previa del formato</div>
    ${[1,2,3].map(() => `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;overflow:hidden;position:relative">
        <div style="position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);animation:shimmer 1.8s infinite"></div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="width:56px;height:56px;background:var(--bg-card2);border-radius:8px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="height:13px;background:var(--bg-card2);border-radius:4px;width:75%;margin-bottom:8px"></div>
            <div style="height:11px;background:var(--bg-card2);border-radius:4px;width:95%;margin-bottom:6px"></div>
            <div style="height:11px;background:var(--bg-card2);border-radius:4px;width:60%"></div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <div style="height:18px;width:60px;background:var(--bg-card2);border-radius:20px"></div>
              <div style="height:18px;width:80px;background:var(--bg-card2);border-radius:20px"></div>
            </div>
          </div>
        </div>
      </div>`).join('')}

    <!-- Links útiles mientras tanto -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">🔗 Fuentes oficiales</div>
      ${[
        ['🌐 FIFA.com — Sitio oficial del Mundial','https://www.fifa.com/fifaplus/es/tournaments/mens/worldcup/canadamexicousa2026'],
        ['📺 ESPN Deportes — Cobertura completa','https://www.espndeportes.espn.com'],
        ['📱 Goal.com — Noticias y resultados','https://www.goal.com/es'],
      ].map(([label, url]) => `
        <a href="${url}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);color:var(--text);text-decoration:none;font-size:0.85rem;transition:color 0.2s"
          onmouseover="this.style.color='#818cf8'" onmouseout="this.style.color='var(--text)'">
          ${label} <span style="color:var(--text-muted)">↗️</span>
        </a>`).join('')}
      <div style="font-size:11px;color:var(--text-muted);margin-top:10px;text-align:center">Pronto mostraremos las noticias directamente aquí</div>
    </div>
  `;

  document.getElementById('refreshNewsBtn')?.addEventListener('click', () => {
    // TODO: llamar a la API cuando esté integrada
    const btn = document.getElementById('refreshNewsBtn');
    if (btn) { btn.textContent = '⏳ Cargando...'; setTimeout(() => { btn.textContent = '🔄 Actualizar'; }, 1500); }
  });
}
