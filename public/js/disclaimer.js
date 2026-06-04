// disclaimer.js — Renderiza la pestaña Aviso Legal dentro de group.html
export function renderDisclaimer() {
  const el = document.getElementById('disclaimerTab');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:20px 0 20px">
      <div style="font-size:2.5rem">⚖️</div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--gold);margin-top:6px">Aviso Legal</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">WC2026 Polla Mundialera — Largotek</div>
    </div>

    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <div style="font-weight:700;color:#fca5a5;margin-bottom:6px">⚠️ Aviso importante</div>
      <p style="color:#fca5a5;font-size:0.85rem;line-height:1.6;margin:0">
        Esta plataforma es un <strong style="color:#fff">juego de entretenimiento recreativo y social</strong> entre 
        amigos o familiares. <strong style="color:#fff">No es un sitio de apuestas, loterías ni concursos públicos.</strong> 
        Largotek no recauda, administra ni garantiza ningún premio en dinero. Cualquier acuerdo económico 
        entre participantes es exclusivamente privado entre ellos.
      </p>
    </div>

    ${[
      ['🎮','Entretenimiento privado','Aplicación lúdica entre grupos privados. Los pronósticos son solo por diversión.'],
      ['💰','Sin intermediación de dinero','Los campos de premio/cuota son referenciales. Largotek no interviene en ningún pago.'],
      ['🔒','Sin apuestas','No somos casa de apuestas ni operador de juegos de azar regulados.'],
      ['👤','Responsabilidad del usuario','Cada participante es responsable de sus acuerdos privados y de cumplir las leyes locales.'],
      ['🛡️','Tus datos están seguros','Solo guardamos tu email y datos de juego. Nunca los compartimos con terceros.'],
    ].map(([icon,title,desc]) => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:1.5rem;min-width:36px;text-align:center">${icon}</div>
        <div>
          <div style="font-weight:700;font-size:0.9rem;color:var(--text)">${title}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px;line-height:1.5">${desc}</div>
        </div>
      </div>`).join('')}

    <div style="margin-top:20px;text-align:center">
      <a href="legal.html" target="_blank" class="btn btn-outline-light btn-sm" style="font-size:12px">
        📄 Ver aviso legal completo
      </a>
    </div>

    <div style="margin-top:24px;text-align:center;font-size:11px;color:var(--text-muted);line-height:1.6">
      &copy; 2026 <strong style="color:#818cf8">Largotek Transformación Digital</strong> — Todos los derechos reservados.<br>
      Esta plataforma es un juego de entretenimiento privado. No es un sitio de apuestas.
    </div>
  `;
}
