// admin-report.js — Reporte global y por comparsa de pronósticos vs resultado real
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ── Estado
let DATA = {};
let activeGroup = null;

// ── Helpers
function calcPoints(ah, aa, ph, pa) {
  if (ph == null || pa == null || ah == null || aa == null) return null;
  if (ph === ah && pa === aa) return 6;
  const pOut = ph > pa ? 'H' : pa > ph ? 'A' : 'D';
  const aOut = ah > aa ? 'H' : aa > ah ? 'A' : 'D';
  return pOut === aOut ? 3 : 0;
}

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-BO', {
    timeZone:'America/La_Paz', day:'2-digit', month:'short',
    hour:'numeric', minute:'2-digit', hour12:true
  });
}

function pctColor(pct) {
  if (pct >= 66) return '#34d399';
  if (pct >= 33) return '#f59e0b';
  return '#f87171';
}

function pctBar(pct, color) {
  return `<div class="pct-bar"><div class="pct-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

// ── Cargar datos
async function loadData() {
  document.getElementById('loader').style.display = 'block';
  document.getElementById('reportContent').style.display = 'none';

  const [matchSnap, predSnap, userSnap, groupSnap, memberSnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), orderBy('kickoff'))),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'groups')),
    getDocs(collection(db, 'group_members')),
  ]);

  const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const preds   = predSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const users   = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const groups  = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const members = memberSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Mapas rápidos
  const userMap  = {};  users.forEach(u => { userMap[u.id] = u.display_name || u.displayName || u.email || u.id; });
  const matchMap = {};  matches.forEach(m => { matchMap[m.id] = m; });

  // Solo partidos con resultado final
  const played = matches.filter(m => m.finished === true && m.home_score != null);

  // Para cada partido jugado: stats de pronósticos
  const matchStats = played.map(m => {
    const mPreds = preds.filter(p => p.match_id === m.id);
    let exact = 0, result = 0, miss = 0;
    mPreds.forEach(p => {
      const pts = calcPoints(m.home_score, m.away_score, p.home_score, p.away_score);
      if (pts === 6) exact++;
      else if (pts === 3) result++;
      else miss++;
    });
    const total = mPreds.length;
    const hitPct = total ? Math.round(((exact + result) / total) * 100) : 0;
    return { match: m, total, exact, result, miss, hitPct };
  });

  // Totales globales
  let gTotal=0, gExact=0, gResult=0, gMiss=0;
  matchStats.forEach(s => {
    gTotal  += s.total;
    gExact  += s.exact;
    gResult += s.result;
    gMiss   += s.miss;
  });
  const gHit = gTotal ? Math.round(((gExact + gResult) / gTotal) * 100) : 0;

  // Miembros por grupo
  const membersByGroup = {}; // gid -> [uid]
  members.forEach(m => {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
    membersByGroup[m.group_id].push(m.user_uid);
  });

  DATA = { matches, preds, users, groups, members, userMap, matchMap, played,
           matchStats, membersByGroup, gTotal, gExact, gResult, gMiss, gHit };

  render();
}

// ── Render principal
function render() {
  const { matchStats, groups, gTotal, gExact, gResult, gMiss, gHit, played } = DATA;

  document.getElementById('loader').style.display = 'none';
  document.getElementById('reportContent').style.display = 'block';

  // ─ KPIs globales
  const hitColor = pctColor(gHit);
  document.getElementById('kpiGlobal').innerHTML = [
    kpi('⚽', played.length,    'Partidos jugados',   '#4aafd4'),
    kpi('🔮', gTotal,            'Total pronósticos',  '#a78bfa'),
    kpi('🟡', gExact,            'Exactos (6 pts)',    '#f59e0b'),
    kpi('🟢', gResult,           'Ganador (3 pts)',    '#34d399'),
    kpi('🔴', gMiss,             'Fallos (0 pts)',     '#f87171'),
    kpi('📊', gHit + '%',        'Tasa de acierto',   hitColor),
  ].join('');

  // ─ Tabla por partido
  const tbody = document.getElementById('tblMatchesBody');
  if (!matchStats.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted);text-align:center;padding:30px">No hay partidos jugados aún.</td></tr>`;
  } else {
    tbody.innerHTML = matchStats.map(s => {
      const m = s.match;
      const c = pctColor(s.hitPct);
      return `
      <tr>
        <td style="font-weight:700">${m.home_flag||''}${m.home_team} vs ${m.away_team}${m.away_flag||''}</td>
        <td style="color:var(--text-muted);font-size:11px">${m.phase}</td>
        <td style="text-align:center;font-weight:800;font-size:1rem;color:#f1f5f9">${m.home_score} – ${m.away_score}</td>
        <td style="text-align:center;color:var(--text-muted)">${s.total}</td>
        <td style="text-align:center"><span class="badge-exact">🟡 ${s.exact}</span></td>
        <td style="text-align:center"><span class="badge-result">🟢 ${s.result}</span></td>
        <td style="text-align:center"><span class="badge-miss">🔴 ${s.miss}</span></td>
        <td style="min-width:80px">
          <div style="font-size:12px;font-weight:700;color:${c}">${s.hitPct}%</div>
          ${pctBar(s.hitPct, c)}
        </td>
      </tr>`;
    }).join('');
  }

  // ─ Tabs de comparsa
  const tabs = document.getElementById('groupTabs');
  tabs.innerHTML = DATA.groups
    .sort((a,b) => a.name.localeCompare(b.name))
    .map(g => `<button class="gtab" data-gid="${g.id}">${g.name}</button>`)
    .join('');

  tabs.querySelectorAll('.gtab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.gtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeGroup = btn.dataset.gid;
      renderGroupReport(activeGroup);
    });
  });

  // Auto-seleccionar la primera comparsa
  const first = tabs.querySelector('.gtab');
  if (first) { first.classList.add('active'); activeGroup = first.dataset.gid; renderGroupReport(activeGroup); }
}

// ── Reporte por comparsa
function renderGroupReport(gid) {
  const { preds, userMap, matchMap, membersByGroup, played, matches } = DATA;
  const group = DATA.groups.find(g => g.id === gid);
  if (!group) return;

  const memberUids = membersByGroup[gid] || [];
  const groupPreds = preds.filter(p => p.group_id === gid);

  // Datos por jugador
  const playerStats = memberUids.map(uid => {
    const myPreds = groupPreds.filter(p => p.user_uid === uid);
    let exact=0, result=0, miss=0, totalPts=0;
    const rows = [];

    played.forEach(m => {
      const pred = myPreds.find(p => p.match_id === m.id);
      if (!pred) {
        rows.push({ match: m, pred: null, pts: null, status: 'sin' });
        return;
      }
      const pts = calcPoints(m.home_score, m.away_score, pred.home_score, pred.away_score);
      if (pts === 6) exact++;
      else if (pts === 3) result++;
      else miss++;
      totalPts += pts;
      rows.push({ match: m, pred, pts, status: pts === 6 ? 'exact' : pts === 3 ? 'result' : 'miss' });
    });

    const played2 = rows.filter(r => r.pred);
    const hitPct  = played2.length ? Math.round(((exact+result)/played2.length)*100) : 0;
    return { uid, name: userMap[uid] || uid, exact, result, miss, totalPts, hitPct, rows };
  }).sort((a,b) => b.totalPts - a.totalPts);

  const el = document.getElementById('groupReport');

  if (!memberUids.length) {
    el.innerHTML = `<p style="color:var(--text-muted)">Esta comparsa no tiene miembros registrados.</p>`;
    return;
  }

  // Tabla resumen de jugadores
  let html = `
  <div class="card p-3 mb-4">
    <div style="font-weight:800;font-size:1rem;color:var(--gold);margin-bottom:16px">
      🏆 ${group.name} <span style="font-size:13px;color:var(--text-muted);font-weight:400">(${memberUids.length} jugadores)</span>
    </div>
    <div style="overflow-x:auto">
    <table class="rpt-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Jugador</th>
          <th style="text-align:center">Pronósticos</th>
          <th style="text-align:center">🟡 Exacto</th>
          <th style="text-align:center">🟢 Ganador</th>
          <th style="text-align:center">🔴 Fallo</th>
          <th style="text-align:center">📊 Acierto</th>
          <th style="text-align:center">🏅 Puntos</th>
        </tr>
      </thead>
      <tbody>
        ${playerStats.map((p, i) => {
          const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
          const c = pctColor(p.hitPct);
          const done = p.exact + p.result + p.miss;
          return `<tr>
            <td style="color:var(--text-muted);width:30px">${medal||i+1}</td>
            <td style="font-weight:700">${p.name}</td>
            <td style="text-align:center;color:var(--text-muted)">${done} / ${played.length}</td>
            <td style="text-align:center"><span class="badge-exact">${p.exact}</span></td>
            <td style="text-align:center"><span class="badge-result">${p.result}</span></td>
            <td style="text-align:center"><span class="badge-miss">${p.miss}</span></td>
            <td style="min-width:80px">
              <div style="font-size:12px;font-weight:700;color:${c}">${p.hitPct}%</div>
              ${pctBar(p.hitPct, c)}
            </td>
            <td style="text-align:center;font-size:1.1rem;font-weight:800;color:var(--gold)">${p.totalPts}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
  </div>`;

  // Detalle partido por partido por jugador
  html += `<div class="section-hdr">📃 Detalle partido por partido</div>`;

  if (!played.length) {
    html += `<p style="color:var(--text-muted)">No hay partidos jugados aún.</p>`;
  } else {
    played.forEach(m => {
      const mPreds = playerStats.map(p => ({
        name: p.name,
        pred: p.rows.find(r => r.match.id === m.id)
      }));

      const stats = { exact:0, result:0, miss:0, sin:0 };
      mPreds.forEach(({ pred }) => {
        if (!pred || !pred.pred) stats.sin++;
        else if (pred.status === 'exact')  stats.exact++;
        else if (pred.status === 'result') stats.result++;
        else stats.miss++;
      });
      const total = mPreds.filter(x => x.pred?.pred).length;
      const hitPct = total ? Math.round(((stats.exact+stats.result)/total)*100) : 0;
      const c = pctColor(hitPct);

      html += `
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px;margin-bottom:12px">
        <!-- Cabecera del partido -->
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
          <div style="flex:1;min-width:180px">
            <div style="font-weight:800;font-size:0.95rem">${m.home_flag||''}${m.home_team} <span style="color:#f1f5f9;font-size:1.1rem;background:rgba(255,255,255,0.07);padding:2px 10px;border-radius:8px">${m.home_score} – ${m.away_score}</span> ${m.away_team}${m.away_flag||''}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${m.phase} · ${fmtDate(m.kickoff)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;align-items:center">
            <span class="badge-exact">🟡 ${stats.exact}</span>
            <span class="badge-result">🟢 ${stats.result}</span>
            <span class="badge-miss">🔴 ${stats.miss}</span>
            ${stats.sin ? `<span class="badge-pend">∅ ${stats.sin} sin pred</span>` : ''}
            <span style="font-size:13px;font-weight:800;color:${c}">${hitPct}%</span>
          </div>
        </div>
        <!-- Fila por jugador -->
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${mPreds.map(({ name, pred }) => {
            if (!pred || !pred.pred) {
              return `<div style="background:rgba(148,163,184,0.06);border:1px solid rgba(148,163,184,0.12);border-radius:8px;padding:6px 12px;font-size:12px">
                <span style="color:var(--text-muted);font-weight:700">${name}</span>
                <span style="color:rgba(148,163,184,0.4);margin-left:6px">— sin pronóstico</span>
              </div>`;
            }
            const bgMap = { exact:'rgba(245,158,11,0.1)', result:'rgba(52,211,153,0.08)', miss:'rgba(239,68,68,0.08)' };
            const brMap = { exact:'rgba(245,158,11,0.35)', result:'rgba(52,211,153,0.25)', miss:'rgba(239,68,68,0.25)' };
            const ptMap = { exact:'#f59e0b', result:'#34d399', miss:'#f87171' };
            const ic   = { exact:'🟡', result:'🟢', miss:'🔴' };
            const s    = pred.status;
            return `<div style="background:${bgMap[s]};border:1px solid ${brMap[s]};border-radius:8px;padding:6px 12px;font-size:12px">
              <span style="font-weight:700;color:#f1f5f9">${name}</span>
              <span style="color:var(--text-muted);margin:0 4px">→</span>
              <span style="font-weight:800">${pred.pred.home_score} – ${pred.pred.away_score}</span>
              <span style="margin-left:6px">${ic[s]}</span>
              <span style="color:${ptMap[s]};font-weight:800;margin-left:4px">${pred.pts}pts</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });
  }

  el.innerHTML = html;
}

function kpi(icon, value, label, color) {
  return `
  <div class="col-6 col-md-4 col-lg-2">
    <div class="kpi-box">
      <div style="font-size:1.6rem">${icon}</div>
      <div class="kpi-val" style="color:${color}">${value}</div>
      <div class="kpi-lbl">${label}</div>
    </div>
  </div>`;
}

// ── Init
loadData();
document.getElementById('btnRefresh').addEventListener('click', loadData);
