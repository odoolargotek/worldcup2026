// rules.js — Contenido estático de instrucciones y sistema de puntos
export function renderRules() {
  const el = document.getElementById('rulesTab');
  if (!el) return;

  el.innerHTML = `

    <!-- Hero -->
    <div style="text-align:center;padding:24px 0 16px">
      <div style="font-size:3rem">⚽</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--gold);margin-top:6px">Cómo jugar</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">Polla Mundialera WC2026 — Reglas oficiales</div>
    </div>

    <!-- Sistema de puntos -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,var(--green-dark),var(--green));padding:12px 18px">
        <div style="font-weight:700;font-size:0.95rem">🔮 Sistema de puntos — Pronósticos</div>
      </div>
      <div style="padding:16px 18px">
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:2rem;min-width:44px;text-align:center">🎯</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--gold);font-size:1rem">Score exacto &nbsp;= 6 puntos</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Aciertas el marcador exacto del partido (ej: 2–1)</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:2rem;min-width:44px;text-align:center">✅</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--green-light);font-size:1rem">Resultado correcto = 3 puntos</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Aciertas quién gana o que empata, pero no el marcador exacto</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0">
          <div style="font-size:2rem;min-width:44px;text-align:center">❌</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--danger);font-size:1rem">Fallo = 0 puntos</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Ningún acierto en resultado ni marcador</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Favoritos -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#78350f,#d97706);padding:12px 18px">
        <div style="font-weight:700;font-size:0.95rem">🏆 Sistema de puntos — Equipos favoritos</div>
      </div>
      <div style="padding:16px 18px">
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">
          Puedes elegir <strong style="color:var(--text)">un equipo favorito por cada uno de los 12 grupos</strong> de la fase de grupos. Cada vez que tu favorito juegue en ese grupo, sumas:
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px">
          <div style="flex:1;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:1.6rem;font-weight:800;color:var(--gold)">+3</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">pts si tu favorito <strong style="color:var(--text)">gana</strong></div>
          </div>
          <div style="flex:1;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:1.6rem;font-weight:800;color:var(--green-light)">+1</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">pt si tu favorito <strong style="color:var(--text)">empata</strong></div>
          </div>
          <div style="flex:1;background:rgba(100,100,100,0.1);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:1.6rem;font-weight:800;color:var(--text-muted)">0</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">pts si tu favorito <strong style="color:var(--text)">pierde</strong></div>
          </div>
        </div>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;font-size:0.82rem;color:#fca5a5">
          <strong>⚠️ Cambio de favorito:</strong> Puedes cambiar tu equipo favorito en cualquier momento,
          pero cada cambio aplica una penalidad de <strong>-6 puntos</strong> en ese grupo.
        </div>
      </div>
    </div>

    <!-- Pasos para empezar -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);padding:12px 18px">
        <div style="font-weight:700;font-size:0.95rem">🚀 Cómo empezar</div>
      </div>
      <div style="padding:16px 18px">
        ${[
          ['👤','Crea o únete a una comparsa','Crea tu comparsa desde el Dashboard e invita amigos con el código de 6 letras.'],
          ['🏆','Elige tus favoritos','Ve a “Gestionar favoritos” y elige un equipo para cada uno de los 12 grupos.'],
          ['🔮','Pronostica los partidos','Antes de cada partido, entra y escribe el marcador que crees que será el resultado.'],
          ['⏰','Respeta el plazo','El pronóstico cierra en el momento exacto del pitazo inicial. ¡No te quedes sin pronosticar!'],
          ['🏦','Acumula puntos','Los puntos se calculan automáticamente al cargarse el resultado. Sigue el ranking en tiempo real.'],
        ].map(([icon,title,desc],i) => `
          <div style="display:flex;gap:12px;padding:10px 0;${i>0?'border-top:1px solid var(--border)':''}">
            <div style="font-size:1.6rem;min-width:36px;text-align:center;padding-top:2px">${icon}</div>
            <div>
              <div style="font-weight:700;font-size:0.9rem">${title}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:3px">${desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Preguntas frecuentes -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:24px">
      <div style="background:linear-gradient(135deg,#164e63,#0e7490);padding:12px 18px">
        <div style="font-weight:700;font-size:0.95rem">❓ Preguntas frecuentes</div>
      </div>
      <div style="padding:16px 18px">
        ${[
          ['¿Puedo cambiar mi pronóstico?','¡Sí! Puedes editarlo cuantas veces quieras hasta que el partido empiece.'],
          ['¿Qué pasa si no pronostico un partido?','No sumas ni restas puntos. Simplemente quedas en 0 para ese partido.'],
          ['¿El favorito vale en toda la fase de grupos?','Sí, tu favorito por grupo aplica a todos los partidos de ese grupo mientras dure la fase.'],
          ['¿Cuándo se calculan los puntos?','El administrador carga el resultado y el sistema calcula automáticamente todos los puntos.'],
          ['¿Puedo estar en varias comparsas?','¡Sí! Puedes unirte a tantas comparsas como quieras desde el Dashboard.'],
        ].map(([q,a],i) => `
          <details style="${i>0?'border-top:1px solid var(--border)':''}">
            <summary style="padding:12px 0;cursor:pointer;font-weight:600;font-size:0.88rem;list-style:none;display:flex;justify-content:space-between;align-items:center">
              ${q} <span style="color:var(--gold);font-size:1rem">▼</span>
            </summary>
            <div style="font-size:0.82rem;color:var(--text-muted);padding:0 0 12px;line-height:1.6">${a}</div>
          </details>`).join('')}
      </div>
    </div>

    <!-- Footer reglas -->
    <div style="text-align:center;padding:8px 0 40px">
      <div style="font-size:12px;color:var(--text-muted)">⚽ WC2026 Polla Mundialera · Desarrollado por <a href="https://www.largotek.com" target="_blank" style="color:#818cf8">Largotek</a></div>
    </div>
  `;
}
