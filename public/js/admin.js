// admin.js — Panel admin ampliado
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, doc, addDoc, updateDoc, getDoc, deleteDoc,
  query, orderBy, writeBatch, where
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ---- TABS ----
document.querySelectorAll('[data-atab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['overview','results','matches','groupsmgr','tvaccess','streams'].forEach(t => {
      document.getElementById('atab-' + t)?.classList.toggle('d-none', btn.dataset.atab !== t);
    });
    if (btn.dataset.atab === 'matches')   loadAllMatchesList();
    if (btn.dataset.atab === 'groupsmgr') loadGroupsMgr();
  });
});

// =============================================
// TAB RESULTADOS
// =============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

async function loadMatchesAdmin() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const sel  = document.getElementById('matchSelect');
  if (!sel) return;
  const open = snap.docs.filter(d => !d.data().finished);
  sel.innerHTML = open.length
    ? open.map(d => {
        const m = d.data();
        const hasScore = m.home_score !== undefined && m.home_score !== null;
        const scoreLabel = hasScore ? ' [' + m.home_score + '-' + m.away_score + ']' : '';
        return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + scoreLabel + ' vs ' + m.away_team + ' ' + (m.away_flag||'') + ' — ' + m.phase + '</option>';
      }).join('')
    : '<option>No hay partidos abiertos</option>';
}

async function loadMatchesInProgress() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const sel  = document.getElementById('matchSelectClose');
  if (!sel) return;
  const inProgress = snap.docs.filter(d => {
    const m = d.data();
    return !m.finished && m.home_score !== undefined && m.home_score !== null;
  });
  sel.innerHTML = inProgress.length
    ? inProgress.map(d => {
        const m = d.data();
        return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + ' ' + (m.away_flag||'') + ' — ' + m.phase + '</option>';
      }).join('')
    : '<option value="">Sin partidos listos para cerrar</option>';
}

async function loadMatchesDone() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));

  const sel = document.getElementById('matchSelectDone');
  if (sel) {
    const done = snap.docs.filter(d => d.data().finished === true);
    sel.innerHTML = done.length
      ? done.map(d => {
          const m = d.data();
          return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + ' ' + (m.away_flag||'') + ' — ' + m.phase + '</option>';
        }).join('')
      : '<option>Sin partidos cerrados</option>';
  }

  const selRecalc = document.getElementById('matchSelectRecalc');
  if (selRecalc) {
    const withScore = snap.docs.filter(d => {
      const m = d.data();
      return m.home_score !== undefined && m.home_score !== null;
    });
    selRecalc.innerHTML = withScore.length
      ? withScore.map(d => {
          const m = d.data();
          const badge = m.finished ? ' ✅' : ' 🔴';
          return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + ' ' + (m.away_flag||'') + badge + ' — ' + m.phase + '</option>';
        }).join('')
      : '<option>Sin partidos con marcador</option>';
  }

  // Selector para recalc-favs
  const selFavs = document.getElementById('matchSelectRecalcFavs');
  if (selFavs) {
    const withScore = snap.docs.filter(d => {
      const m = d.data();
      return m.home_score !== undefined && m.home_score !== null;
    });
    selFavs.innerHTML = withScore.length
      ? withScore.map(d => {
          const m = d.data();
          const badge2 = m.finished ? ' ✅' : ' 🔴';
          return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + ' ' + (m.away_flag||'') + badge2 + ' — ' + m.phase + '</option>';
        }).join('')
      : '<option>Sin partidos con marcador</option>';
  }
}

// ── HELPER: calcula puntos de pronósticos ──
function calcPoints(actualH, actualA, predH, predA) {
  if (predH === undefined || predH === null || predA === undefined || predA === null) return 0;
  if (predH === actualH && predA === actualA) return 6;
  const predOut   = predH > predA ? 'H' : predA > predH ? 'A' : 'D';
  const actualOut = actualH > actualA ? 'H' : actualA > actualH ? 'A' : 'D';
  return predOut === actualOut ? 3 : 0;
}

/**
 * FIX: Calcula puntos de favorito normalizando nombres (trim + lowercase).
 * Evita que diferencias de espacios o tildes rompan el match.
 * Retorna 0, 1 o 3.
 */
function calcFavPts(favTeam, homeTeam, awayTeam, hs, as_) {
  if (!favTeam) return 0;
  const norm = s => String(s).trim().toLowerCase();
  const fav  = norm(favTeam);
  const home = norm(homeTeam);
  const away = norm(awayTeam);
  if (fav === home) return hs > as_ ? 3 : hs === as_ ? 1 : 0;
  if (fav === away) return as_ > hs ? 3 : hs === as_ ? 1 : 0;
  return 0;
}

// ── GUARDAR RESULTADO PARCIAL ──
document.getElementById('saveResultBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelect').value;
  const hs  = parseInt(document.getElementById('resultHome').value);
  const as_ = parseInt(document.getElementById('resultAway').value);
  const msg = document.getElementById('adminMsg');
  if (!mid || isNaN(hs) || isNaN(as_)) { msg.innerHTML = badge('Completa el resultado', 'danger'); return; }

  await updateDoc(doc(db, 'matches', mid), { home_score: hs, away_score: as_ });

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => {
    const p   = predDoc.data();
    const pts = calcPoints(hs, as_, p.home_score, p.away_score);
    batch.update(predDoc.ref, { points: pts });
  });
  await batch.commit();

  msg.innerHTML = '<div class="mt-2 p-2 rounded" style="background:rgba(74,175,212,0.12);border:1px solid #4aafd4;color:#4aafd4">' +
    '📊 Marcador actualizado — ' + predsSnap.size + ' pronósticos recalculados (partido aún abierto)</div>';
  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

// ── CERRAR PARTIDO (finished = true) ──
// FIX: ahora usa recalcFavoritesForMatch() que es idempotente — nunca suma doble.
document.getElementById('closeMatchBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectClose').value;
  const msg = document.getElementById('closeMatchMsg');
  if (!mid) { msg.innerHTML = badge('Selecciona un partido', 'danger'); return; }
  if (!confirm('¿Cerrar este partido como FINAL? Ya no aparecerá en la lista de abiertos.')) return;

  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();
  const hs    = matchData.home_score;
  const as_   = matchData.away_score;

  await updateDoc(doc(db, 'matches', mid), { finished: true, match_status: 'FT' });

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => {
    const p   = predDoc.data();
    const pts = calcPoints(hs, as_, p.home_score, p.away_score);
    batch.update(predDoc.ref, { points: pts, points_synced: true });
  });

  // ✅ FIX: recalcular favoritos de forma IDEMPOTENTE
  const { favCount } = await recalcFavoritesForMatch(matchData, mid, batch);
  await batch.commit();

  msg.innerHTML = '<div class="mt-2 p-2 rounded" style="background:rgba(22,163,74,0.15);border:1px solid var(--green);color:var(--green-light)">' +
    '✅ Partido cerrado — ' + predsSnap.size + ' pronósticos calculados — ' + favCount + ' favoritos actualizados</div>';
  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

/**
 * FIX PRINCIPAL: Recalcula favorites_pts[phase] de forma IDEMPOTENTE.
 * - Guarda los puntos por partido en favorites_pts_by_match[matchId]
 * - Recalcula el total del grupo sumando TODOS los partidos con resultado
 * - Nunca acumula doble aunque se llame varias veces
 */
async function recalcFavoritesForMatch(matchData, mid, existingBatch) {
  const hs    = matchData.home_score;
  const as_   = matchData.away_score;
  const phase = matchData.phase || '';

  // Todos los partidos del mismo grupo con resultado para recalcular el acumulado
  const allMatchesSnap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  const phaseMatches   = allMatchesSnap.docs
    .filter(d => d.data().phase === phase && d.data().home_score != null)
    .map(d => ({ id: d.id, ...d.data() }));

  const allMembersSnap = await getDocs(collection(db, 'group_members'));
  const useBatch = existingBatch || writeBatch(db);
  let favCount = 0;

  allMembersSnap.forEach(mDoc => {
    const m       = mDoc.data();
    const favTeam = (m.favorites || {})[phase];
    if (!favTeam) return;

    const byMatch = { ...(m.favorites_pts_by_match || {}) };

    // Puntos del partido actual
    const ptsThisMatch = calcFavPts(favTeam, matchData.home_team, matchData.away_team, hs, as_);
    byMatch[mid] = ptsThisMatch;

    // Total del grupo = suma de TODOS los partidos del grupo con resultado
    let phaseTotal = 0;
    phaseMatches.forEach(pm => {
      if (pm.id === mid) {
        phaseTotal += ptsThisMatch;
      } else {
        const stored = byMatch[pm.id];
        phaseTotal += stored !== undefined
          ? stored
          : calcFavPts(favTeam, pm.home_team, pm.away_team, pm.home_score, pm.away_score);
      }
    });

    useBatch.update(mDoc.ref, {
      ['favorites_pts.' + phase]:        phaseTotal,
      ['favorites_pts_by_match.' + mid]: ptsThisMatch,
    });
    favCount++;
  });

  if (!existingBatch) await useBatch.commit();
  return { favCount };
}

// ── RECALCULAR PUNTOS DE PRONÓSTICOS ──
document.getElementById('recalcPtsBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectRecalc').value;
  const msg = document.getElementById('recalcMsg');
  if (!mid) { msg.innerHTML = badge('Selecciona un partido', 'danger'); return; }

  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();
  const hs  = matchData.home_score;
  const as_ = matchData.away_score;

  if (hs === null || hs === undefined) {
    msg.innerHTML = badge('El partido no tiene marcador aún', 'danger');
    return;
  }

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const batch = writeBatch(db);
  let recalcCount = 0;

  predsSnap.forEach(predDoc => {
    const p   = predDoc.data();
    const pts = calcPoints(hs, as_, p.home_score, p.away_score);
    batch.update(predDoc.ref, { points: pts, points_synced: true });
    recalcCount++;
  });
  await batch.commit();

  const estado = matchData.finished ? '✅ FINAL' : '🔴 EN JUEGO';
  msg.innerHTML = '<div class="mt-2 p-2 rounded" style="background:rgba(167,139,250,0.12);border:1px solid #a78bfa;color:#a78bfa">' +
    '✅ ' + recalcCount + ' pronósticos recalculados — ' +
    matchData.home_team + ' ' + hs + '-' + as_ + ' ' + matchData.away_team +
    ' <span style="font-size:11px;opacity:0.7">(' + estado + ')</span></div>';
  await loadMatchesDone();
});

// ── RECALCULAR FAVORITOS (botón nuevo) ──
document.getElementById('recalcFavsBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectRecalcFavs').value;
  const msg = document.getElementById('recalcFavsMsg');
  if (!mid) { msg.innerHTML = badge('Selecciona un partido', 'danger'); return; }

  const btn = document.getElementById('recalcFavsBtn');
  btn.disabled = true; btn.textContent = '⏳ Recalculando...';

  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();

  if (matchData.home_score == null) {
    msg.innerHTML = badge('El partido no tiene marcador aún', 'danger');
    btn.disabled = false; btn.textContent = '🏆 Recalcular favoritos';
    return;
  }

  const { favCount } = await recalcFavoritesForMatch(matchData, mid, null);

  const hs  = matchData.home_score;
  const as_ = matchData.away_score;
  const estado = matchData.finished ? '✅ FINAL' : '🔴 EN JUEGO';
  msg.innerHTML = '<div class="mt-2 p-2 rounded" style="background:rgba(52,211,153,0.12);border:1px solid #34d399;color:#34d399">' +
    '✅ Favoritos recalculados — ' + favCount + ' jugadores actualizados — ' +
    matchData.home_team + ' ' + hs + '-' + as_ + ' ' + matchData.away_team +
    ' (' + matchData.phase + ') <span style="font-size:11px;opacity:0.7">(' + estado + ')</span></div>';

  btn.disabled = false; btn.textContent = '🏆 Recalcular favoritos';
  await loadMatchesDone();
});

// ── RESETEAR RESULTADO ──
document.getElementById('resetResultBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectDone').value;
  const msg = document.getElementById('resetMsg');
  if (!mid) return;
  if (!confirm('¿Resetear resultado? Se revertirán puntos y el partido quedará como pendiente.')) return;

  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();
  const phase = matchData.phase || '';

  const predsSnap      = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const allMembersSnap = await getDocs(collection(db, 'group_members'));
  const batch = writeBatch(db);

  predsSnap.forEach(predDoc => batch.update(predDoc.ref, { points: 0, points_synced: false }));

  // FIX: usar el valor guardado en favorites_pts_by_match para restar exactamente lo correcto
  allMembersSnap.forEach(mDoc => {
    const m       = mDoc.data();
    const favTeam = (m.favorites || {})[phase];
    if (!favTeam) return;
    const byMatch  = m.favorites_pts_by_match || {};
    const ptsToRem = byMatch[mid] || 0;
    if (ptsToRem > 0) {
      const current = (m.favorites_pts || {})[phase] || 0;
      batch.update(mDoc.ref, {
        ['favorites_pts.' + phase]:        Math.max(0, current - ptsToRem),
        ['favorites_pts_by_match.' + mid]: 0,
      });
    }
  });

  await batch.commit();
  await updateDoc(doc(db, 'matches', mid), { home_score: null, away_score: null, finished: false, match_status: '' });

  msg.innerHTML = '<div style="color:#fbbf24">🔄 Resultado reseteado — partido vuelve a pendiente</div>';
  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

// =============================================
// TAB PARTIDOS
// =============================================
async function loadAllMatchesList() {
  const container = document.getElementById('allMatchesList');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted)">Cargando...</div>';

  const snap = await getDocs(query(collection(db, 'matches'), orderBy('kickoff')));
  if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Sin partidos.</p>'; return; }

  let html = '';
  snap.docs.forEach(d => {
    const m = d.data();
    const kickoff  = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    const isDone   = m.finished === true;
    const hasScore = m.home_score !== undefined && m.home_score !== null;
    const label = kickoff.toLocaleString('es-BO', {
      timeZone: 'America/La_Paz', day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12: true
    });
    const safeLabel = (m.home_team + ' vs ' + m.away_team).replace(/'/g, "\\'");
    const statusBadge = isDone
      ? '<span style="font-size:0.75rem;background:rgba(52,211,153,0.12);color:#34d399;border-radius:20px;padding:2px 8px;font-weight:700">FINAL ' + m.home_score + '-' + m.away_score + '</span>'
      : hasScore
        ? '<span style="font-size:0.75rem;background:rgba(74,175,212,0.12);color:#4aafd4;border-radius:20px;padding:2px 8px;font-weight:700">EN JUEGO ' + m.home_score + '-' + m.away_score + '</span>'
        : '<span style="font-size:0.75rem;color:var(--text-muted)">Pendiente</span>';
    html +=
      '<div id="matchrow-' + d.id + '" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">' +
        '<span style="font-size:1.2rem">' + (m.home_flag||'⚽') + '</span>' +
        '<span style="flex:1;font-size:0.85rem;font-weight:600">' + m.home_team + ' vs ' + m.away_team + ' ' + (m.away_flag||'') + '</span>' +
        '<span style="font-size:0.78rem;color:var(--text-muted)">' + m.phase + '</span>' +
        '<span style="font-size:0.78rem;color:var(--gold)">' + label + '</span>' +
        statusBadge +
        '<button class="btn btn-sm btn-outline-danger" style="font-size:11px;padding:2px 10px" data-mid="' + d.id + '" data-label="' + safeLabel + '">🗑️</button>' +
      '</div>';
  });
  container.innerHTML = html;

  container.querySelectorAll('button[data-mid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mid   = btn.dataset.mid;
      const label = btn.dataset.label;
      if (!confirm('¿Eliminar partido "' + label + '"? Se borrarán sus pronósticos.')) return;
      btn.disabled = true; btn.textContent = '⏳';
      try {
        const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
        for (const p of predsSnap.docs) await deleteDoc(p.ref);
        await deleteDoc(doc(db, 'matches', mid));
        document.getElementById('matchrow-' + mid)?.remove();
        await loadMatchesAdmin();
        await loadMatchesInProgress();
        await loadMatchesDone();
      } catch (err) {
        alert('❌ Error al eliminar: ' + err.message);
        btn.disabled = false; btn.textContent = '🗑️';
      }
    });
  });
}

document.getElementById('addMatchBtn')?.addEventListener('click', async () => {
  const home     = document.getElementById('newHomeTeam').value.trim();
  const homeFlag = document.getElementById('newHomeFlag').value.trim();
  const away     = document.getElementById('newAwayTeam').value.trim();
  const awayFlag = document.getElementById('newAwayFlag').value.trim();
  const kickoff  = document.getElementById('newKickoff').value;
  const phase    = document.getElementById('newPhase').value;
  const city     = document.getElementById('newCity').value.trim();
  const msg      = document.getElementById('addMatchMsg');
  if (!home || !away || !kickoff) { msg.innerHTML = badge('Completa los campos obligatorios', 'danger'); return; }
  await addDoc(collection(db, 'matches'), {
    home_team: home, home_flag: homeFlag,
    away_team: away, away_flag: awayFlag,
    kickoff: new Date(kickoff), phase, city, finished: false
  });
  msg.innerHTML = badge('✅ Partido agregado', 'success');
  ['newHomeTeam','newHomeFlag','newAwayTeam','newAwayFlag','newKickoff','newCity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  await loadMatchesAdmin();
});

// =============================================
// BORRAR TODOS
// =============================================
document.getElementById('deleteAllMatchesBtn')?.addEventListener('click', async () => {
  if (!confirm('⚠️ ¿Borrar TODOS los partidos y sus pronósticos? Esta acción es irreversible.')) return;
  const btn  = document.getElementById('deleteAllMatchesBtn');
  const list = document.getElementById('allMatchesList');
  btn.disabled = true; btn.textContent = '⏳ Borrando...';
  const matchesSnap = await getDocs(collection(db, 'matches'));
  let total = matchesSnap.size, done = 0;
  for (const mDoc of matchesSnap.docs) {
    const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mDoc.id)));
    for (const p of predsSnap.docs) await deleteDoc(p.ref);
    await deleteDoc(mDoc.ref);
    done++;
    list.innerHTML = '<p style="color:var(--text-muted)">⏳ Borrando ' + done + '/' + total + '...</p>';
  }
  btn.disabled = false; btn.textContent = '🗑️ Borrar todos los partidos';
  list.innerHTML = '<p style="color:var(--green-light)">✅ ' + total + ' partidos eliminados.</p>';
  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

// =============================================
// TAB COMPARSAS
// =============================================
async function loadGroupsMgr() {
  const container = document.getElementById('groupsMgrList');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted)">Cargando comparsas...</div>';

  const snap = await getDocs(query(collection(db, 'groups'), orderBy('created_at', 'desc')));
  if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Sin comparsas.</p>'; return; }

  const membersSnap = await getDocs(collection(db, 'group_members'));
  const memberCount = {};
  membersSnap.forEach(d => { const gid = d.data().group_id; memberCount[gid] = (memberCount[gid] || 0) + 1; });

  const predsSnap = await getDocs(collection(db, 'predictions'));
  const predCount = {};
  predsSnap.forEach(d => { const gid = d.data().group_id; predCount[gid] = (predCount[gid] || 0) + 1; });

  container.innerHTML = '';

  const totalGroups  = snap.size;
  const totalMembers = Object.values(memberCount).reduce((a, b) => a + b, 0);
  const totalPreds   = Object.values(predCount).reduce((a, b) => a + b, 0);

  const summary = document.createElement('div');
  summary.className = 'row g-3 mb-4';
  summary.innerHTML =
    '<div class="col-4"><div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px;text-align:center">' +
      '<div style="font-size:1.6rem;font-weight:800;color:var(--gold)">' + totalGroups + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">Comparsas</div></div></div>' +
    '<div class="col-4"><div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:12px;text-align:center">' +
      '<div style="font-size:1.6rem;font-weight:800;color:var(--green-light)">' + totalMembers + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">Participantes</div></div></div>' +
    '<div class="col-4"><div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:12px;text-align:center">' +
      '<div style="font-size:1.6rem;font-weight:800;color:#a5b4fc">' + totalPreds + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">Pronósticos</div></div></div>';
  container.appendChild(summary);

  snap.docs.forEach(gDoc => {
    const g   = gDoc.data();
    const gid = gDoc.id;
    const members = memberCount[gid] || 0;
    const preds   = predCount[gid]   || 0;
    const created = g.created_at?.toDate ? g.created_at.toDate() : null;
    const row = document.createElement('div');
    row.style.cssText = 'background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px';
    row.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.95rem">👥 ' + g.name + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">Cód: <strong style="color:var(--gold);letter-spacing:2px">' + g.code + '</strong>' +
            ' &nbsp;·&nbsp; 👥 ' + members + ' miembros' +
            ' &nbsp;·&nbsp; 🔮 ' + preds + ' pronósticos' +
            (g.prize ? ' &nbsp;·&nbsp; 🏆 $' + g.prize : '') +
            (created ? ' &nbsp;·&nbsp; 📅 ' + created.toLocaleDateString('es-BO') : '') +
          '</div>' +
        '</div>' +
        '<button class="btn btn-sm btn-outline-danger" style="font-size:11px;white-space:nowrap" data-gid="' + gid + '" data-gname="' + g.name.replace(/"/g, '&quot;') + '">🗑 Eliminar</button>' +
      '</div>';
    container.appendChild(row);
  });

  container.querySelectorAll('button[data-gid]').forEach(btn => {
    btn.addEventListener('click', () => {
      _deleteGroupId = btn.dataset.gid;
      document.getElementById('confirmDeleteMsg').textContent =
        '¿Eliminar la comparsa "' + btn.dataset.gname + '" con todos sus miembros y pronósticos?';
      if (!_deleteModal) _deleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
      _deleteModal.show();
    });
  });
}

let _deleteGroupId = null;
let _deleteModal   = null;

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  if (!_deleteGroupId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true; btn.textContent = 'Eliminando...';
  const batch = writeBatch(db);
  const memSnap  = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', _deleteGroupId)));
  memSnap.forEach(d => batch.delete(d.ref));
  const predSnap = await getDocs(query(collection(db, 'predictions'),   where('group_id', '==', _deleteGroupId)));
  predSnap.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'groups', _deleteGroupId));
  await batch.commit();
  _deleteModal.hide();
  btn.disabled = false; btn.textContent = '🗑️ Eliminar definitivamente';
  _deleteGroupId = null;
  await loadGroupsMgr();
});

function badge(text, type) {
  const colors = { success: 'var(--green)', danger: 'var(--danger)', warning: 'var(--gold)' };
  return '<span style="color:' + (colors[type] || '#fff') + ';font-size:0.85rem;font-weight:600">' + text + '</span>';
}
