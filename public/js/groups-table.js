// groups-table.js — Tablas de posiciones por grupo calculadas desde Firestore
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const PHASES = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

export async function renderGroupsTables() {
  const container = document.getElementById('groupsTab');
  if (!container) return;
  container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:30px">Cargando tablas...</div>`;

  // Cargar todos los partidos
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const allMatches = [];
  snap.forEach(d => allMatches.push({ id: d.id, ...d.data() }));

  // Agrupar partidos por fase
  const byPhase = {};
  PHASES.forEach(p => { byPhase[p] = []; });
  allMatches.forEach(m => {
    if (byPhase[m.phase]) byPhase[m.phase].push(m);
  });

  container.innerHTML = '';

  PHASES.forEach(phase => {
    const matches = byPhase[phase] || [];

    // Construir tabla de posiciones
    const table = {}; // { teamName: { pj,g,e,p,gf,gc,pts,flag } }

    // Registrar todos los equipos del grupo
    matches.forEach(m => {
      if (!table[m.home_team]) table[m.home_team] = { pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0,flag:m.home_flag||'⚽' };
      if (!table[m.away_team]) table[m.away_team] = { pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0,flag:m.away_flag||'⚽' };
    });

    // Calcular solo partidos con resultado
    const played   = matches.filter(m => m.home_score !== undefined);
    const pending  = matches.filter(m => m.home_score === undefined);

    played.forEach(m => {
      const h = table[m.home_team];
      const a = table[m.away_team];
      const hs = m.home_score, as_ = m.away_score;

      h.pj++; h.gf += hs; h.gc += as_;
      a.pj++; a.gf += as_; a.gc += hs;

      if (hs > as_)       { h.g++; h.pts+=3; a.p++; }
      else if (hs === as_) { h.e++; h.pts+=1; a.e++; a.pts+=1; }
      else                 { a.g++; a.pts+=3; h.p++; }
    });

    // Ordenar: pts DESC, DG DESC, GF DESC, nombre ASC
    const rows = Object.entries(table)
      .map(([name, s]) => ({ name, ...s, dg: s.gf - s.gc }))
      .sort((a,b) =>
        b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
      );

    // Porcentaje de partidos jugados para el encabezado
    const playedCount = played.length;
    const totalCount  = matches.length;

    // HTML de la tabla
    const phaseBlock = document.createElement('div');
    phaseBlock.className = 'mb-4';

    // Encabezado del grupo
    phaseBlock.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700;font-size:0.95rem;color:var(--gold)">⚽ ${phase}</div>
        <div style="font-size:11px;color:var(--text-muted)">${playedCount}/${totalCount} partidos jugados</div>
      </div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <!-- Header tabla -->
        <div style="display:grid;grid-template-columns:1fr 28px 28px 28px 28px 28px 28px 36px;
                    gap:0;padding:7px 12px;background:linear-gradient(135deg,var(--green-dark),var(--green));
                    font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px">
          <div>Equipo</div>
          <div style="text-align:center">PJ</div>
          <div style="text-align:center">G</div>
          <div style="text-align:center">E</div>
          <div style="text-align:center">P</div>
          <div style="text-align:center">GF</div>
          <div style="text-align:center">GC</div>
          <div style="text-align:center">Pts</div>
        </div>
        <!-- Filas -->
        ${rows.map((r, i) => {
          const isTop2   = i < 2;
          const isTop4   = i < 4; // clasifican 3ros mejor
          const rowBg    = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
          const leftBorder = isTop2
            ? '3px solid var(--green-light)'
            : isTop4
              ? '3px solid rgba(245,158,11,0.5)'
              : '3px solid transparent';
          const ptsColor = r.pts > 0 ? 'color:var(--gold);font-weight:800' : 'color:var(--text-muted)';
          const dgStr    = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;

          return `
          <div style="display:grid;grid-template-columns:1fr 28px 28px 28px 28px 28px 28px 36px;
                      gap:0;padding:9px 12px;background:${rowBg};border-left:${leftBorder};
                      border-top:1px solid var(--border);align-items:center">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:1.3rem;line-height:1">${r.flag}</span>
              <span style="font-size:0.82rem;font-weight:${isTop2?'700':'500'};color:${isTop2?'var(--text)':'var(--text-muted)'}">${r.name}</span>
            </div>
            <div style="text-align:center;font-size:0.82rem;color:var(--text-muted)">${r.pj}</div>
            <div style="text-align:center;font-size:0.82rem;color:var(--green-light)">${r.g}</div>
            <div style="text-align:center;font-size:0.82rem;color:var(--text-muted)">${r.e}</div>
            <div style="text-align:center;font-size:0.82rem;color:var(--danger)">${r.p}</div>
            <div style="text-align:center;font-size:0.82rem;color:var(--text-muted)">${r.gf}</div>
            <div style="text-align:center;font-size:0.82rem;color:var(--text-muted)">${r.gc}</div>
            <div style="text-align:center;font-size:0.9rem;${ptsColor}">${r.pts}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Partidos pendientes del grupo -->
      ${pending.length > 0 ? `
        <div style="margin-top:8px">
          ${pending.slice(0,3).map(m => {
            const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
            return `<div style="font-size:11px;color:var(--text-muted);padding:3px 0;display:flex;gap:6px;align-items:center">
              <span>📅 ${kickoff.toLocaleDateString('es-BO',{day:'2-digit',month:'short'})}</span>
              <span>${m.home_flag||''} ${m.home_team} vs ${m.away_team} ${m.away_flag||''}</span>
            </div>`;
          }).join('')}
          ${pending.length > 3 ? `<div style="font-size:11px;color:var(--text-muted);padding:2px 0">+ ${pending.length-3} partidos más...</div>` : ''}
        </div>` : `<div style="font-size:11px;color:var(--green-light);margin-top:6px;text-align:center">✅ Fase de grupo completada</div>`
      }`;

    container.appendChild(phaseBlock);
  });

  // Leyenda
  const legend = document.createElement('div');
  legend.className = 'mb-4';
  legend.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--text-muted);padding:8px 0">
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--green-light);border-radius:2px;margin-right:4px"></span>Clasifican directamente</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,158,11,0.5);border-radius:2px;margin-right:4px"></span>Posible 3ro mejor</span>
    </div>`;
  container.appendChild(legend);
}
