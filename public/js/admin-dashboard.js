// admin-dashboard.js — Dashboard de métricas para el panel admin
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy, limit, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

export async function loadAdminDashboard() {
  const el = document.getElementById('atab-dashboard');
  if (!el) return;
  el.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px">⏳ Cargando dashboard...</div>`;

  try {
    const [matchesSnap, predsSnap, usersSnap, groupsSnap] = await Promise.all([
      getDocs(query(collection(db, 'matches'), orderBy('kickoff'))),
      getDocs(collection(db, 'predictions')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groups')),
    ]);

    const now = new Date();
    const matches   = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const preds     = predsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const users     = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const groups    = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const played    = matches.filter(m => m.home_score !== undefined && m.home_score !== null && m.finished);
    const pending   = matches.filter(m => !m.finished && (m.home_score === undefined || m.home_score === null));
    const closingSoon = pending.filter(m => {
      const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
      const diff = (ko - now) / 36e5;
      return diff >= 0 && diff <= 3;
    });
    const noResult = matches.filter(m => {
      const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
      return ko < now && (m.home_score === undefined || m.home_score === null);
    });

    // ── Ranking global de usuarios por puntos ──
    const userPoints = {};
    const userNames  = {};
    users.forEach(u => {
      userNames[u.id] = u.display_name || u.email || 'Anónimo';
      userPoints[u.id] = 0;
    });
    preds.forEach(p => {
      if (p.user_uid && p.points) userPoints[p.user_uid] = (userPoints[p.user_uid] || 0) + p.points;
    });
    const ranking = Object.entries(userPoints)
      .map(([uid, pts]) => ({ uid, pts, name: userNames[uid] || uid }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 10);

    // ── Actividad reciente: últimos 8 pronósticos ──
    const recentPreds = [...preds]
      .filter(p => p.created_at)
      .sort((a, b) => {
        const ta = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
        const tb = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
        return tb - ta;
      })
      .slice(0, 8);
    const matchMap = {};
    matches.forEach(m => { matchMap[m.id] = m; });

    // ── Progreso por grupo ──
    const groupProgress = {};
    matches.filter(m => m.phase?.startsWith('Grupo')).forEach(m => {
      const g = m.phase;
      if (!groupProgress[g]) groupProgress[g] = { total: 0, played: 0 };
      groupProgress[g].total++;
      if (m.finished) groupProgress[g].played++;
    });

    // ── Comparsas: miembros y pronósticos ──
    const membersSnap = await getDocs(collection(db, 'group_members'));
    const memberCount = {}, predCount = {};
    membersSnap.docs.forEach(d => {
      const gid = d.data().group_id;
      memberCount[gid] = (memberCount[gid] || 0) + 1;
    });
    preds.forEach(p => {
      if (p.group_id) predCount[p.group_id] = (predCount[p.group_id] || 0) + 1;
    });

    // ══════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════
    el.innerHTML = `

      <!-- KPIs -->
      <div class="row g-3 mb-4">
        ${kpi('🏟️', matches.length, 'Partidos totales', '#4aafd4')}
        ${kpi('✅', played.length, 'Jugados', '#34d399')}
        ${kpi('⏳', pending.length, 'Pendientes', '#f59e0b')}
        ${kpi('🔮', preds.length, 'Pronósticos', '#a78bfa')}
        ${kpi('👥', users.length, 'Usuarios', '#4aafd4')}
        ${kpi('🏆', groups.length, 'Comparsas', '#f59e0b')}
      </div>

      <!-- Alertas -->
      ${noResult.length || closingSoon.length ? `
      <div style="margin-bottom:20px">
        <div class="section-title">⚠️ Alertas</div>
        ${noResult.length ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);border-radius:12px;padding:14px 16px;margin-bottom:10px">
          <div style="font-weight:700;color:#f87171;margin-bottom:8px">🔴 ${noResult.length} partido(s) jugado(s) sin resultado cargado</div>
          ${noResult.map(m => `
            <div style="font-size:12px;color:var(--text-muted);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              ${m.home_flag||'⚽'} ${m.home_team} vs ${m.away_team} ${m.away_flag||''}
              <span style="color:var(--gold)"> · ${m.phase}</span>
              <span style="color:#f87171"> · ${fmtDate(m.kickoff)}</span>
            </div>`).join('')}
        </div>` : ''}
        ${closingSoon.length ? `
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);border-radius:12px;padding:14px 16px">
          <div style="font-weight:700;color:#f59e0b;margin-bottom:8px">⏰ ${closingSoon.length} partido(s) cierran en las próximas 3 horas</div>
          ${closingSoon.map(m => {
            const ko = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
            const hrs = ((ko - now) / 36e5).toFixed(1);
            return `<div style="font-size:12px;color:var(--text-muted);padding:3px 0">
              ${m.home_flag||'⚽'} ${m.home_team} vs ${m.away_team} · en ${hrs}h
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>` : `
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:12px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#34d399;font-weight:600">
        ✅ Sin alertas — todo al día
      </div>`}

      <div class="row g-4">

        <!-- Actividad reciente -->
        <div class="col-md-6">
          <div class="card p-3">
            <div class="section-title mb-3">🕐 Últimos pronósticos</div>
            ${recentPreds.length ? recentPreds.map(p => {
              const m = matchMap[p.match_id];
              const name = userNames[p.user_uid] || p.user_uid;
              const ts = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.created_at);
              const timeAgo = fmtAgo(ts);
              return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="width:32px;height:32px;border-radius:50%;background:rgba(167,139,250,0.15);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🔮</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${m ? `${m.home_team} vs ${m.away_team}` : p.match_id}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:13px;font-weight:800;color:var(--gold)">${p.home_score} - ${p.away_score}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${timeAgo}</div>
                </div>
              </div>`;
            }).join('') : '<p style="color:var(--text-muted);font-size:13px">Sin pronósticos aún.</p>'}
          </div>
        </div>

        <!-- Ranking global -->
        <div class="col-md-6">
          <div class="card p-3">
            <div class="section-title mb-3">🥇 Ranking global (todas las comparsas)</div>
            ${ranking.length ? ranking.map((u, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
              const bar = Math.round((u.pts / (ranking[0].pts || 1)) * 100);
              return `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="width:28px;text-align:center;font-size:14px;flex-shrink:0">${medal}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name}</div>
                  <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:4px;margin-top:4px">
                    <div style="height:4px;background:${i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#4aafd4'};border-radius:4px;width:${bar}%"></div>
                  </div>
                </div>
                <span style="font-size:13px;font-weight:800;color:var(--gold);flex-shrink:0">${u.pts} pts</span>
              </div>`;
            }).join('') : '<p style="color:var(--text-muted);font-size:13px">Sin puntos aún.</p>'}
          </div>
        </div>

      </div>

      <!-- Progreso por grupo -->
      <div class="card p-3 mt-4">
        <div class="section-title mb-3">📊 Progreso fase de grupos</div>
        <div class="row g-2">
          ${Object.entries(groupProgress).sort().map(([g, v]) => {
            const pct = Math.round((v.played / v.total) * 100);
            const color = pct === 100 ? '#34d399' : pct > 0 ? '#4aafd4' : 'rgba(255,255,255,0.15)';
            return `
            <div class="col-6 col-md-3 col-lg-2">
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
                <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">${g}</div>
                <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:6px;margin-bottom:6px">
                  <div style="height:6px;background:${color};border-radius:6px;width:${pct}%;transition:width 0.5s"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted)">${v.played}/${v.total} <span style="color:${color};font-weight:700">${pct}%</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Comparsas resumen -->
      <div class="card p-3 mt-4 mb-4">
        <div class="section-title mb-3">🏆 Comparsas activas</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px">
                <th style="padding:6px 8px;text-align:left">Comparsa</th>
                <th style="padding:6px 8px;text-align:center">Código</th>
                <th style="padding:6px 8px;text-align:center">👥 Miembros</th>
                <th style="padding:6px 8px;text-align:center">🔮 Pronósticos</th>
                <th style="padding:6px 8px;text-align:center">🏆 Premio</th>
              </tr>
            </thead>
            <tbody>
              ${groups.sort((a,b) => (memberCount[b.id]||0)-(memberCount[a.id]||0)).map(g => `
              <tr style="border-top:1px solid var(--border)">
                <td style="padding:8px;font-weight:600">${g.name}</td>
                <td style="padding:8px;text-align:center"><span style="background:rgba(245,158,11,0.1);color:var(--gold);border-radius:6px;padding:2px 8px;font-weight:700;letter-spacing:2px;font-size:12px">${g.code}</span></td>
                <td style="padding:8px;text-align:center;color:#4aafd4;font-weight:700">${memberCount[g.id]||0}</td>
                <td style="padding:8px;text-align:center;color:#a78bfa;font-weight:700">${predCount[g.id]||0}</td>
                <td style="padding:8px;text-align:center;color:#34d399;font-weight:700">${g.prize ? '$'+g.prize : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div style="text-align:right;font-size:11px;color:rgba(148,163,184,0.35);margin-bottom:16px">
        Actualizado: ${now.toLocaleString('es-BO', {timeZone:'America/La_Paz', day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true})}
        &nbsp;·&nbsp;
        <button onclick="loadAdminDashboard()" style="background:none;border:none;color:#4aafd4;cursor:pointer;font-size:11px;padding:0">🔄 Actualizar</button>
      </div>
    `;

    // Exponer para el botón de refresh
    window.loadAdminDashboard = loadAdminDashboard;

  } catch(e) {
    el.innerHTML = `<div style="color:#f5a0ac;padding:20px">❌ Error cargando dashboard: ${e.message}</div>`;
  }
}

function kpi(icon, value, label, color) {
  return `
    <div class="col-6 col-md-4 col-lg-2">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:16px 12px;text-align:center">
        <div style="font-size:1.8rem">${icon}</div>
        <div style="font-size:1.6rem;font-weight:800;color:${color};line-height:1.1;margin:4px 0">${value}</div>
        <div style="font-size:11px;color:var(--text-muted)">${label}</div>
      </div>
    </div>`;
}

function fmtDate(kickoff) {
  const d = kickoff?.toDate ? kickoff.toDate() : new Date(kickoff);
  return d.toLocaleString('es-BO', { timeZone:'America/La_Paz', day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true });
}

function fmtAgo(date) {
  const diff = (new Date() - date) / 1000;
  if (diff < 60)   return 'ahora';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}
