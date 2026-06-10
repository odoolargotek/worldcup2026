// perplexity-suggest.js — Sugerencia de pronóstico basada en deep research de Perplexity

const PERPLEXITY_DATA_URL = './data/mundial_2026_fase_grupos.json';

let _cache = null;

async function loadPerplexityData() {
  if (_cache) return _cache;
  try {
    const res = await fetch(PERPLEXITY_DATA_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    _cache = await res.json();
    return _cache;
  } catch (e) {
    return null;
  }
}

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

export async function findPerplexitySuggestion(homeTeam, awayTeam) {
  const data = await loadPerplexityData();
  if (!data || !data.fase_grupos) return null;

  const nh = normalize(homeTeam);
  const na = normalize(awayTeam);

  for (const grupo of Object.values(data.fase_grupos)) {
    if (!grupo.partidos) continue;
    for (const partido of grupo.partidos) {
      if (normalize(partido.local) === nh && normalize(partido.visitante) === na) {
        const [hs, as] = (partido.resultado_probable || '0-0').split('-').map(Number);
        return {
          home_score:     hs,
          away_score:     as,
          resultado:      partido.resultado_probable,
          justificacion:  partido.justificacion,
          dato_historico: partido.dato_historico
        };
      }
    }
  }
  return null;
}

export function renderPerplexityButton(homeTeam, awayTeam, suggestion) {
  const container = document.getElementById('perplexitySuggestContainer');
  if (!container) return;

  if (!suggestion) {
    container.innerHTML = '';
    return;
  }

  const homeShort = homeTeam.split(' ')[0];
  const awayShort = awayTeam.split(' ')[0];

  container.innerHTML = `
    <div id="pxPanel" style="
      background: rgba(29,144,198,0.08);
      border: 1px solid rgba(29,144,198,0.3);
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 16px;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1.1rem">🤖</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#4aafd4">Sugerencia Perplexity AI</div>
            <div style="font-size:10px;color:var(--text-muted)">Basada en deep research — no es una apuesta</div>
          </div>
        </div>
        <div style="background:rgba(29,144,198,0.15);border:1px solid rgba(29,144,198,0.35);border-radius:10px;padding:4px 14px;font-size:1.3rem;font-weight:800;color:#4aafd4;letter-spacing:3px">
          ${homeShort} ${suggestion.home_score} — ${suggestion.away_score} ${awayShort}
        </div>
      </div>

      <button id="pxApplyBtn" style="
        width:100%;padding:9px 0;border-radius:8px;
        background:rgba(29,144,198,0.2);color:#4aafd4;
        border:1px solid rgba(29,144,198,0.45);
        font-size:13px;font-weight:700;cursor:pointer;
        margin-bottom:8px;transition:background 0.15s;
      ">✅ Aplicar esta sugerencia</button>

      <button id="pxDetailsBtn" style="
        width:100%;padding:7px 0;border-radius:8px;
        background:transparent;color:var(--text-muted);
        border:1px solid rgba(255,255,255,0.08);
        font-size:12px;cursor:pointer;
      ">📖 Ver justificación y dato histórico ▼</button>

      <div id="pxDetails" style="display:none;margin-top:12px">
        <div style="
          background:rgba(0,0,0,0.2);border-radius:10px;
          padding:12px 14px;margin-bottom:8px;
          font-size:12px;color:var(--text-muted);line-height:1.6
        ">
          <div style="font-size:10px;font-weight:700;color:#4aafd4;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📊 Análisis</div>
          ${suggestion.justificacion}
        </div>
        <div style="
          background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);
          border-radius:10px;padding:12px 14px;
          font-size:12px;color:var(--text-muted);line-height:1.6
        ">
          <div style="font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📜 Dato histórico</div>
          ${suggestion.dato_historico}
        </div>
        <div style="margin-top:6px;font-size:10px;color:rgba(148,163,184,0.35);text-align:right">
          Fuente: Perplexity deep research — Jun 2026
        </div>
      </div>
    </div>
  `;

  document.getElementById('pxApplyBtn').addEventListener('click', () => {
    document.getElementById('homeScore').value = suggestion.home_score;
    document.getElementById('awayScore').value = suggestion.away_score;
    const btn = document.getElementById('pxApplyBtn');
    btn.textContent = '✅ ¡Aplicado! Puedes editarlo antes de guardar';
    btn.style.background = 'rgba(52,211,153,0.15)';
    btn.style.borderColor = 'rgba(52,211,153,0.4)';
    btn.style.color = '#34d399';
    btn.disabled = true;
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '✅ Aplicar esta sugerencia';
      btn.style.background = 'rgba(29,144,198,0.2)';
      btn.style.borderColor = 'rgba(29,144,198,0.45)';
      btn.style.color = '#4aafd4';
    }, 3000);
  });

  let detailsOpen = false;
  document.getElementById('pxDetailsBtn').addEventListener('click', () => {
    detailsOpen = !detailsOpen;
    document.getElementById('pxDetails').style.display = detailsOpen ? 'block' : 'none';
    document.getElementById('pxDetailsBtn').textContent =
      detailsOpen ? '📖 Ocultar detalles ▲' : '📖 Ver justificación y dato histórico ▼';
  });
}
