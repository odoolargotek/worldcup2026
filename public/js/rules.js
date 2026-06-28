// rules.js — Instrucciones y sistema de puntos
export function renderRules() {
  const el = document.getElementById('rulesTab');
  if (!el) return;

  el.innerHTML = `

    <!-- ★ BANNER NUEVA FASE: RONDA DE 32 ★ -->
    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(29,144,198,0.12));border:1.5px solid rgba(245,158,11,0.5);border-radius:16px;padding:18px 20px;margin-bottom:22px;position:relative;overflow:hidden">
      <div style="position:absolute;top:-10px;right:-10px;font-size:5rem;opacity:0.07;pointer-events:none">🏆</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:1.4rem">🎉</span>
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--gold)">¡Nueva fase! Ronda de 32</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px">Primera eliminatoria directa del Mundial 2026</div>
        </div>
        <span style="margin-left:auto;background:rgba(245,158,11,0.2);color:var(--gold);border:1px solid rgba(245,158,11,0.4);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap">🆕 ACTIVA</span>
      </div>
      <div style="font-size:0.83rem;color:var(--text-muted);margin-bottom:14px;line-height:1.65">
        La fase de grupos terminó. Ahora jugamos un <strong style="color:var(--text)">nuevo torneo independiente</strong> con los 16 cruces de la Ronda de 32 — todos los participantes empiezan desde <strong style="color:var(--gold)">0 puntos</strong>.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px 14px">
          <span style="font-size:1.1rem;min-width:24px">1️⃣</span>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.55">
            <strong style="color:var(--text)">Únete al grupo nuevo</strong> — Pide el <strong style="color:var(--gold)">código de 6 letras</strong> al organizador y entra desde "Mis comparsas". No uses el grupo de la fase de grupos.
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px 14px">
          <span style="font-size:1.1rem;min-width:24px">2️⃣</span>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.55">
            <strong style="color:var(--text)">Paga la inscripción</strong> — Escanea el <strong style="color:var(--primary-light)">QR de pago</strong> del grupo. El admin confirma tu pago y te habilita.
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px 14px">
          <span style="font-size:1.1rem;min-width:24px">3️⃣</span>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.55">
            <strong style="color:var(--text)">Pronostica los 16 cruces</strong> — Los partidos ya están cargados. <strong style="color:#f5a0ac">¡El primer partido es el Dom 28 Jun!</strong> Entra antes del pitazo.
          </div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:8px 14px;text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:var(--gold)">+6</div>
          <div style="font-size:10px;color:var(--text-muted)">Score exacto 90'</div>
        </div>
        <div style="background:rgba(74,175,212,0.1);border:1px solid rgba(74,175,212,0.3);border-radius:10px;padding:8px 14px;text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:#4aafd4">+3</div>
          <div style="font-size:10px;color:var(--text-muted)">Resultado correcto</div>
        </div>
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:8px 14px;text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:#f87171">0</div>
          <div style="font-size:10px;color:var(--text-muted)">Resultado fallado</div>
        </div>
      </div>
    </div>

    <!-- HERO -->
    <div style="text-align:center;padding:20px 0 20px">
      <div style="font-size:3.2rem">⚽</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--gold);margin-top:8px;letter-spacing:1px">Cómo jugar</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px">Polla Mundialera WC2026 — Todo lo que necesitas saber</div>
    </div>

    <!-- RESUMEN RÁPIDO -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${
        [
          ['🎯','Score exacto (90\')','6 pts','#f59e0b'],
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
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">Predice el marcador exacto antes del pitazo — siempre sobre los 90 minutos</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        ${
          [
            ['🎯','Score exacto (90\')','6 puntos','#f59e0b','Aciertas el marcador exacto a los 90 min (ej: Argentina 2–1 Francia). ¡La máxima recompensa!'],
            ['✅','Resultado correcto','3 puntos','#4aafd4','Aciertas quién gana o que hay empate a los 90 min, pero el marcador es diferente al exacto.'],
            ['❌','Resultado incorrecto','0 puntos','#94a3b8','No aciertas ni el resultado ni el marcador a los 90 min. Sin puntos, pero tampoco se restan.'],
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

    <!-- FASE DE ELIMINACIÓN -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#1e1040,#7c3aed);padding:14px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.3rem">⚔️</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">Fase de eliminación</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">Ronda de 32, Octavos, Cuartos, Semis y Final</div>
        </div>
      </div>
      <div style="padding:16px 18px">
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;line-height:1.65">
          El sistema de puntos es <strong style="color:var(--text)">exactamente el mismo</strong> que en grupos:
          pronosticas el marcador y los puntos se calculan siempre sobre los <strong style="color:#4aafd4">90 minutos reglamentarios</strong>.
          La prórroga y los penales solo deciden quién avanza, pero <strong style="color:var(--text)">no afectan tus puntos</strong>.
        </div>

        <!-- Tabla de ejemplos eliminación -->
        <div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1px;margin-bottom:10px">📌 EJEMPLO — Argentina vs Francia</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Resultado a 90 min: <strong style="color:var(--text)">2 – 2</strong> · Francia gana en penales</div>
          ${
            [
              ['2 – 2','🟡 Score exacto','6 pts','#f59e0b','Acertaste el empate Y el marcador exacto'],
              ['3 – 3','🟢 Resultado correcto','3 pts','#34d399','Acertaste que empatan, pero el marcador era otro'],
              ['1 – 3','🔴 Resultado incorrecto','0 pts','#f87171','Pronosticaste que ganaba Francia (en 90\'), pero empataron'],
              ['2 – 1','🔴 Resultado incorrecto','0 pts','#f87171','Pronosticaste que ganaba Argentina (en 90\'), pero empataron'],
            ].map(([score, label, pts, color, desc]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.05)">
              <div style="font-size:1rem;font-weight:800;color:var(--text);min-width:48px">${score}</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700">${label} <span style="color:${color};font-weight:800">${pts}</span></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${desc}</div>
              </div>
            </div>`).join('')}
        </div>

        <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.25);border-radius:10px;padding:12px 14px">
          <div style="font-size:0.82rem;color:#c4b5fd;line-height:1.6">
            <strong>🔍 Score 90' vs Score Final:</strong> En cada partido de eliminación verás <strong>dos marcadores</strong>:
            el de los 90 minutos reglamentarios (el que cuenta para tus puntos) y el resultado final
            incluyendo prórroga/penales (solo informativo).
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
          ${
            [
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
        ${
          [
            ['🥇','1er lugar','Color dorado — Se lleva el premio mayor (configurable por el admin)'],
            ['🥈','2do lugar','Solo si la comparsa tiene distribución Top 2 o Top 3'],
            ['🥉','3er lugar','Solo si la comparsa tiene distribución Top 3'],
            ['🔢','Desempate','En caso de empate de puntos, gana quien tiene más scores exactos (6 pts)'],
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
        ${
          [
            ['1','🏠','Únete a la comparsa','Pide el código de 6 letras al organizador y entra desde "Mis comparsas". O crea la tuya e invita amigos.'],
            ['2','🏆','Elige tus 12 favoritos','En la sección "Favoritos por grupo" elige un equipo para cada grupo. Solo lo haces una vez (solo fase de grupos).'],
            ['3','🔮','Pronostica antes de cada partido','Abre la app, entra a "Partidos", escribe el marcador que predices a 90 min y guarda. ¡Antes del pitazo!'],
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
        ${
          [
            ['¿Puedo cambiar mi pronóstico?','¡Sí! Puedes editarlo cuantas veces quieras hasta que empiece el partido. Una vez iniciado ya no es posible modificarlo.'],
            ['¿Qué pasa si no pronostico un partido?','No sumas ni restas puntos. Simplemente obtienes 0 para ese partido.'],
            ['¿Los puntos se calculan sobre 90 min o sobre el resultado final?','Siempre sobre los 90 minutos reglamentarios. Si pronosticas 2–2 y el partido termina 2–2 en 90 min (aunque haya prórroga o penales), obtienes 6 puntos.'],
            ['¿Qué es el score final vs score 90\'?','El score 90\' son los goles en tiempo reglamentario — ese es el que cuenta para puntos. El score final incluye los goles en prórroga y penales, y aparece solo como información.'],
            ['¿El favorito aplica a toda la fase de grupos?','Sí, tu favorito elegido para un grupo aplica a todos los partidos de ese grupo.'],
            ['¿Cuándo se calculan los puntos?','El administrador carga el resultado oficial y el sistema calcula automáticamente todos los puntos de todos los participantes.'],
            ['¿Puedo estar en varias comparsas?','¡Sí! Puedes unirte a tantas comparsas como quieras. Cada comparsa tiene su propio ranking y premios.'],
            ['¿Qué pasa si empato en puntos con otro jugador?','Gana quien tenga más scores exactos (pronósticos de 6 puntos). Si siguen empatados, decide el admin.'],
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
