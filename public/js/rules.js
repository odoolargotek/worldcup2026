// rules.js — Instrucciones y sistema de puntos
export function renderRules() {
  const el = document.getElementById('rulesTab');
  if (!el) return;

  el.innerHTML = `
    <!-- HERO -->
    <div style="text-align:center;padding:28px 0 20px">
      <div style="font-size:3.2rem">⚽</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--gold);margin-top:8px;letter-spacing:1px">Cómo jugar</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px">Polla Mundialera WC2026 — Todo lo que necesitas saber</div>
    </div>

    <!-- RESUMEN RÁPIDO -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${[
        ['🎯','Score exacto','6 pts','#f59e0b'],
        ['✅','Resultado correcto','3 pts','#4aafd4'],
        ['⚠️','Cambio de favorito','−3 pts','#C9344B'],
      ].map(([icon,label,val,color]) => `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.6rem">${icon}</div>
          <div style="font-size:1.4rem;font-weight:800;color:${color};margin:4px 0">${val}</div>
          <div style="font-size:11px;color:var(--text-muted)">${label}</div>
        </div>`).join('')}
    </div>

    <!-- PRONÓSTICOS -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#0f2035,#1D90C6);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">🔮</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Pronósticos de partidos</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">Predice el marcador exacto antes del pitazo</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        ${[
          ['🎯','Score exacto','6 puntos','#f59e0b','Aciertas el marcador exacto (ej: Argentina 2 – Francia 1). ¡La máxima recompensa!'],
          ['✅','Resultado correcto','3 puntos','#4aafd4','Aciertas quién gana o que hay empate, pero el marcador es diferente al exacto.'],
          ['❌','Resultado incorrecto','0 puntos','#94a3b8','No aciertas ni el resultado ni el marcador. Sin puntos, pero tampoco se restan.'],
        ].map(([icon,title,pts,color,desc],i) => `
          <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;${i>0?'border-top:1px solid var(--border)':''}">
            <div style="font-size:2rem;min-width:44px;text-align:center;line-height:1">${icon}</div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-weight:700;font-size:0.95rem">${title}</span>
                <span style="font-size:0.85rem;font-weight:800;color:${color};background:${color}22;padding:2px 10px;border-radius:20px">${pts}</span>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;line-height:1.5">${desc}</div>
            </div>
          </div>`).join('')}
        <div style="background:rgba(29,144,198,0.08);border:1px solid rgba(29,144,198,0.2);border-radius:10px;padding:12px 14px;margin-top:4px">
          <div style="font-size:0.82rem;color:#4aafd4;line-height:1.6">
            <strong>⏰ Plazo de pronóstico:</strong> El pronóstico cierra automáticamente en el momento del pitazo inicial.
            Después del inicio del partido <strong>ya no puedes pronosticar</strong> ese partido. ¡Entra antes del partido!
          </div>
        </div>
      </div>
    </div>

    <!-- FAVORITOS -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#78350f,#d97706);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">🏆</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Equipos favoritos por grupo</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">12 grupos = 12 favoritos = puntos extra automáticos</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;line-height:1.6">
          Elige <strong style="color:var(--text)">un equipo favorito</strong> para cada uno de los 12 grupos de la fase de grupos.
          Cada vez que tu favorito juegue en ese grupo, ganas puntos <strong style="color:var(--gold)">automáticamente</strong> — sin hacer nada más.
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          ${[
            ['🏆','Tu favorito gana','+3 pts','#f59e0b'],
            ['🤝','Tu favorito empata','+1 pt','#4aafd4'],
            ['😞','Tu favorito pierde','0 pts','#94a3b8'],
          ].map(([icon,label,pts,color]) => `
            <div style="background:${color}11;border:1px solid ${color}33;border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:1.4rem">${icon}</div>
              <div style="font-size:1.3rem;font-weight:800;color:${color};margin:4px 0">${pts}</div>
              <div style="font-size:11px;color:var(--text-muted);line-height:1.3">${label}</div>
            </div>`).join('')}
        </div>
        <div style="background:rgba(201,52,75,0.1);border:1px solid rgba(201,52,75,0.3);border-radius:10px;padding:12px 14px">
          <div style="font-size:0.82rem;color:#f5a0ac;line-height:1.6">
            <strong>⚠️ Penalidad por cambio:</strong> Puedes cambiar tu favorito en cualquier momento,
            pero cada cambio aplica <strong>−3 puntos</strong> en ese grupo. ¡Elige bien desde el principio!
          </div>
        </div>
      </div>
    </div>

    <!-- RANKING Y PREMIOS -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#3b1c6e,#7c3aed);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">🥇</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Ranking y premios</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">¿Cómo se decide el ganador?</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        ${[
          ['🥇','1er lugar','Color dorado — Se lleva el premio mayor (configurable por el admin)'],
          ['🥈','2do lugar','Solo si la comparsa tiene distribución Top 2 o Top 3'],
          ['🥉','3er lugar','Solo si la comparsa tiene distribución Top 3'],
          ['🔢','Desempate','En caso de empate de puntos, gana quien tiene más score exactos'],
        ].map(([icon,title,desc],i) => `
          <div style="display:flex;gap:12px;padding:11px 0;${i>0?'border-top:1px solid var(--border)':''}">
            <div style="font-size:1.5rem;min-width:36px;text-align:center">${icon}</div>
            <div>
              <div style="font-weight:700;font-size:0.88rem">${title}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:3px;line-height:1.5">${desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- PASOS PARA EMPEZAR -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#064e3b,#059669);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">🚀</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Guía rápida de inicio</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">3 pasos para estar listo</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        ${[
          ['1','🏠','Únete a la comparsa','Pide el código de 6 letras al organizador y entra desde "Mis comparsas". O crea la tuya e invita amigos.'],
          ['2','🏆','Elige tus 12 favoritos','En la sección "Favoritos por grupo" elige un equipo para cada grupo. Solo lo haces una vez.'],
          ['3','🔮','Pronostica antes de cada partido','Abre la app, entra a "Partidos", escribe el marcador que predices y guarda. ¡Antes del pitazo!'],
        ].map(([num,icon,title,desc],i) => `
          <div style="display:flex;gap:14px;padding:14px 0;${i>0?'border-top:1px solid var(--border)':''}">
            <div style="min-width:36px;height:36px;border-radius:50%;background:rgba(5,150,105,0.2);border:1px solid rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;font-weight:800;color:#34d399;font-size:0.95rem;flex-shrink:0">${num}</div>
            <div>
              <div style="font-weight:700;font-size:0.9rem">${icon} ${title}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;line-height:1.55">${desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- FAQ -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#164e63,#0e7490);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">❓</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Preguntas frecuentes</div>
        </div>
      </div>
      <div style="padding:4px 18px 8px">
        ${[
          ['¿Puedo cambiar mi pronóstico?','¡Sí! Puedes editarlo cuantas veces quieras hasta que empiece el partido. Una vez iniciado ya no es posible modificarlo.'],
          ['¿Qué pasa si no pronostico un partido?','No sumas ni restas puntos. Simplemente obtienes 0 para ese partido.'],
          ['¿El favorito aplica a toda la fase de grupos?','Sí, tu favorito elegido para un grupo aplica a todos los partidos de ese grupo.'],
          ['¿Cuándo se calculan los puntos?','El administrador carga el resultado oficial y el sistema calcula automáticamente todos los puntos de todos los participantes.'],
          ['¿Puedo estar en varias comparsas?','¡Sí! Puedes unirte a tantas comparsas como quieras. Cada comparsa tiene su propio ranking y premios.'],
          ['¿Qué pasa si empato en puntos con otro jugador?','Gana quien tenga más scores exactos (pronósticos de marcador exacto). Si siguen empatados, decide el admin.'],
          ['¿Cuándo cierran los pronósticos?','Exactamente al minuto del inicio del partido según el horario oficial. El sistema los cierra automáticamente.'],
        ].map(([q,a],i) => `
          <details style="${i>0?'border-top:1px solid var(--border)':''}">
            <summary style="padding:13px 0;cursor:pointer;font-weight:600;font-size:0.88rem;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px">
              <span>${q}</span> <span style="color:var(--gold);font-size:0.8rem;flex-shrink:0">▼</span>
            </summary>
            <div style="font-size:0.82rem;color:var(--text-muted);padding:0 0 13px;line-height:1.65">${a}</div>
          </details>`).join('')}
      </div>
    </div>
  `;
}
