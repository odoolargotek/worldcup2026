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
// MAPA R32 → OCTAVOS
// =============================================
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

const R32_TO_OCTAVOS = [
  { r32home:'Alemania',        r32away:'Paraguay',              octSlot:'home' },
  { r32home:'Francia',         r32away:'Suecia',                octSlot:'away', octPeer:'Alemania' },
  { r32home:'Sudáfrica',       r32away:'Canadá',                octSlot:'home' },
  { r32home:'Países Bajos',    r32away:'Marruecos',             octSlot:'away', octPeer:'Sudáfrica' },
  { r32home:'Portugal',        r32away:'Croacia',               octSlot:'home' },
  { r32home:'España',          r32away:'Austria',               octSlot:'away', octPeer:'Portugal' },
  { r32home:'Estados Unidos',  r32away:'Bosnia y Herzegovina',  octSlot:'home' },
  { r32home:'Bélgica',         r32away:'Senegal',               octSlot:'away', octPeer:'Estados Unidos' },
  { r32home:'Brasil',          r32away:'Japón',                 octSlot:'home' },
  { r32home:'Costa de Marfil', r32away:'Noruega',               octSlot:'away', octPeer:'Brasil' },
  { r32home:'México',          r32away:'Ecuador',               octSlot:'home' },
  { r32home:'Inglaterra',      r32away:'RD Congo',              octSlot:'away', octPeer:'México' },
  { r32home:'Argentina',       r32away:'Cabo Verde',            octSlot:'home' },
  { r32home:'Australia',       r32away:'Egipto',                octSlot:'away', octPeer:'Argentina' },
  { r32home:'Suiza',           r32away:'Argelia',               octSlot:'home' },
  { r32home:'Colombia',        r32away:'Ghana',                 octSlot:'away', octPeer:'Suiza' },
];

async function propagateWinnerToOctavos(matchData, mid) {
  const hs = matchData.home_score;
  const as_ = matchData.away_score;
  if (hs == null || as_ == null) return null;

  const entry = R32_TO_OCTAVOS.find(e =>
    norm(e.r32home) === norm(matchData.home_team) &&
    norm(e.r32away) === norm(matchData.away_team)
  );
  if (!entry) return null;

  const penWinner = matchData.penalties_winner || null;
  const winner     = penWinner || (hs > as_ ? matchData.home_team : matchData.away_team);
  const winnerFlag = penWinner
    ? (norm(penWinner) === norm(matchData.home_team) ? matchData.home_flag : matchData.away_flag)
    : (hs > as_ ? matchData.home_flag : matchData.away_flag);

  const snap = await getDocs(collection(db, 'matches'));
  const octavos = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => {
      const t = norm(m.type || ''); const p = norm(m.phase || '');
      return t.includes('octavo') || t.includes('ronda_16') || t.includes('ronda16') ||
             p.includes('octavo') || p === '8vos';
    });

  if (!octavos.length) return '⚠️ No hay partidos de Octavos en Firestore aún';

  let octMatch = null;
  if (entry.octPeer) {
    octMatch = octavos.find(m => norm(m.home_team||'').includes(norm(entry.octPeer)));
  } else {
    octMatch = octavos.find(m => {
      const ht = norm(m.home_team || '');
      return !ht || ht === 'tbc' || ht === 'por definir';
    });
  }

  if (!octMatch) {
    return `⚠️ No se encontró partido de Octavos para ${winner} — agrégalo manualmente`;
  }

  const update = entry.octSlot === 'home'
    ? { home_team: winner, home_flag: winnerFlag || '' }
    : { away_team: winner, away_flag: winnerFlag || '' };

  await updateDoc(doc(db, 'matches', octMatch.id), update);
  return `✅ ${winner} asignado a Octavos (${entry.octSlot === 'home' ? 'local' : 'visitante'} en partido ${octMatch.id})`;
}

// =============================================
// MAPA CUARTOS → SEMIFINALES (por slot)
// QF1 local  → SF1 local
// QF2 local  → SF1 visitante
// QF3 local  → SF2 local
// QF4 local  → SF2 visitante
// =============================================
const QF_TO_SF = {
  QF1: { targetSlot: 'SF1', side: 'home' },
  QF2: { targetSlot: 'SF1', side: 'away' },
  QF3: { targetSlot: 'SF2', side: 'home' },
  QF4: { targetSlot: 'SF2', side: 'away' },
};

async function propagateWinnerToSemis(matchData) {
  const slot = matchData.slot;
  if (!slot || !QF_TO_SF[slot]) return null;

  const hs  = matchData.home_score;
  const as_ = matchData.away_score;
  if (hs == null || as_ == null) return null;

  const penWinner  = matchData.penalties_winner || null;
  const winner     = penWinner || (hs > as_ ? matchData.home_team : matchData.away_team);
  const winnerFlag = penWinner
    ? (norm(penWinner) === norm(matchData.home_team) ? matchData.home_flag : matchData.away_flag)
    : (hs > as_ ? matchData.home_flag : matchData.away_flag);

  const { targetSlot, side } = QF_TO_SF[slot];

  const snap = await getDocs(collection(db, 'matches'));
  const target = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                          .find(m => m.slot === targetSlot);

  if (!target) return `⚠️ No se encontró el partido ${targetSlot} en Firestore`;

  const update = side === 'home'
    ? { home_team: winner, home_flag: winnerFlag || '' }
    : { away_team: winner, away_flag: winnerFlag || '' };

  await updateDoc(doc(db, 'matches', target.id), update);
  return `🏆 ${winner} asignado a ${targetSlot} (${side === 'home' ? 'local' : 'visitante'})`;
}

// =============================================
// MAPA SEMIFINALES → FINAL + TERCER PUESTO
// SF1 ganador → FIN local   | SF1 perdedor → 3P local
// SF2 ganador → FIN visitante | SF2 perdedor → 3P visitante
// =============================================
const SF_TO_FINAL = {
  SF1: { winnerSlot: 'FIN', winnerSide: 'home', loserSlot: '3P', loserSide: 'home' },
  SF2: { winnerSlot: 'FIN', winnerSide: 'away', loserSlot: '3P', loserSide: 'away' },
};

async function propagateWinnerToFinal(matchData) {
  const slot = matchData.slot;
  if (!slot || !SF_TO_FINAL[slot]) return null;

  const hs  = matchData.home_score;
  const as_ = matchData.away_score;
  if (hs == null || as_ == null) return null;

  const penWinner   = matchData.penalties_winner || null;
  const winner      = penWinner || (hs > as_ ? matchData.home_team : matchData.away_team);
  const winnerFlag  = penWinner
    ? (norm(penWinner) === norm(matchData.home_team) ? matchData.home_flag : matchData.away_flag)
    : (hs > as_ ? matchData.home_flag : matchData.away_flag);

  // Perdedor = el que no es el ganador
  const loser      = norm(winner) === norm(matchData.home_team) ? matchData.away_team : matchData.home_team;
  const loserFlag  = norm(winner) === norm(matchData.home_team) ? matchData.away_flag : matchData.home_flag;

  const { winnerSlot, winnerSide, loserSlot, loserSide } = SF_TO_FINAL[slot];

  const snap = await getDocs(collection(db, 'matches'));
  const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const finalMatch = allMatches.find(m => m.slot === winnerSlot);
  const thirdMatch = allMatches.find(m => m.slot === loserSlot);

  const msgs = [];

  if (finalMatch) {
    const upd = winnerSide === 'home'
      ? { home_team: winner, home_flag: winnerFlag || '' }
      : { away_team: winner, away_flag: winnerFlag || '' };
    await updateDoc(doc(db, 'matches', finalMatch.id), upd);
    msgs.push(`🥇 ${winner} → Final (${winnerSide === 'home' ? 'local' : 'visitante'})`);
  } else {
    msgs.push(`⚠️ No se encontró partido ${winnerSlot}`);
  }

  if (thirdMatch) {
    const upd = loserSide === 'home'
      ? { home_team: loser, home_flag: loserFlag || '' }
      : { away_team: loser, away_flag: loserFlag || '' };
    await updateDoc(doc(db, 'matches', thirdMatch.id), upd);
    msgs.push(`🥉 ${loser} → 3er Puesto (${loserSide === 'home' ? 'local' : 'visitante'})`);
  } else {
    msgs.push(`⚠️ No se encontró partido ${loserSlot}`);
  }

  return msgs.join(' · ');
}

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

  if (typeof updatePenOptions === 'function') updatePenOptions();
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
          return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + badge + ' — ' + m.phase + '</option>';
        }).join('')
      : '<option>Sin partidos con marcador</option>';
  }

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
          return '<option value="' + d.id + '">' + (m.home_flag||'') + ' ' + m.home_team + ' ' + m.home_score + '-' + m.away_score + ' ' + m.away_team + badge2 + ' — ' + m.phase + '</option>';
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

function calcFavPts(favTeam, homeTeam, awayTeam, hs, as_) {
  if (!favTeam) return 0;
  const normL = s => String(s).trim().toLowerCase();
  const fav  = normL(favTeam);
  const home = normL(homeTeam);
  const away = normL(awayTeam);
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
document.getElementById('closeMatchBtn')?.addEventListener('click', async () => {
  const mid = document.getElementById('matchSelectClose').value;
  const msg = document.getElementById('closeMatchMsg');
  if (!mid) { msg.innerHTML = badge('Selecciona un partido', 'danger'); return; }
  if (!confirm('¿Cerrar este partido como FINAL? Ya no aparecerá en la lista de abiertos.')) return;

  const matchSnap = await getDoc(doc(db, 'matches', mid));
  const matchData = matchSnap.data();
  const hs    = matchData.home_score;
  const as_   = matchData.away_score;

  // ── Leer campos ET / Penales ──
  const hasET  = document.getElementById('chkET')?.checked  || false;
  const hasPEN = document.getElementById('chkPEN')?.checked || false;
  const etHome = hasET ? (parseInt(document.getElementById('etHome')?.value) || null) : null;
  const etAway = hasET ? (parseInt(document.getElementById('etAway')?.value) || null) : null;
  const penWinner = hasPEN ? (document.getElementById('penWinner')?.value || null) : null;

  if (hasET && (etHome === null || etAway === null)) {
    msg.innerHTML = badge('⚠️ Completa el marcador de Tiempo Extra', 'warning');
    return;
  }
  if (hasPEN && !penWinner) {
    msg.innerHTML = badge('⚠️ Selecciona el equipo ganador en penales', 'warning');
    return;
  }

  const updateData = {
    finished: true,
    match_status: hasPEN ? 'PEN' : (hasET ? 'AET' : 'FT'),
  };
  if (hasET) {
    updateData.extra_time      = true;
    updateData.et_home_score   = etHome;
    updateData.et_away_score   = etAway;
  }
  if (hasPEN) {
    updateData.penalties         = true;
    updateData.penalties_winner  = penWinner;
  }

  await updateDoc(doc(db, 'matches', mid), updateData);

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('match_id', '==', mid)));
  const batch = writeBatch(db);
  predsSnap.forEach(predDoc => {
    const p   = predDoc.data();
    const pts = calcPoints(hs, as_, p.home_score, p.away_score);
    batch.update(predDoc.ref, { points: pts, points_synced: true });
  });

  const enrichedMatch = { ...matchData, ...updateData };
  const { favCount } = await recalcFavoritesForMatch(enrichedMatch, mid, batch);
  await batch.commit();

  // ── Propagación en cadena: R32→Octavos, QF→SF, SF→Final+3P ──
  const propagMsgs = [];

  try {
    const r = await propagateWinnerToOctavos(enrichedMatch, mid);
    if (r) propagMsgs.push(r);
  } catch(e) {
    propagMsgs.push('⚠️ Octavos: ' + e.message);
  }

  try {
    const r = await propagateWinnerToSemis(enrichedMatch);
    if (r) propagMsgs.push(r);
  } catch(e) {
    propagMsgs.push('⚠️ Semis: ' + e.message);
  }

  try {
    const r = await propagateWinnerToFinal(enrichedMatch);
    if (r) propagMsgs.push(r);
  } catch(e) {
    propagMsgs.push('⚠️ Final/3P: ' + e.message);
  }

  let propagHtml = '';
  if (propagMsgs.length) {
    propagHtml = '<br>' + propagMsgs.map(m =>
      '<span style="font-size:12px;color:#86efac;display:block;margin-top:2px">' + m + '</span>'
    ).join('');
  }

  let extra = '';
  if (hasET)  extra += ' ⏱️ ET ' + etHome + '–' + etAway;
  if (hasPEN) extra += ' 🎯 Penales → ' + penWinner;

  msg.innerHTML = '<div class="mt-2 p-2 rounded" style="background:rgba(22,163,74,0.15);border:1px solid var(--green);color:var(--green-light)">' +
    '✅ Partido cerrado' + extra + ' — ' + predsSnap.size + ' pronósticos calculados — ' + favCount + ' favoritos actualizados' +
    propagHtml + '</div>';

  const chkET  = document.getElementById('chkET');
  const chkPEN = document.getElementById('chkPEN');
  if (chkET)  { chkET.checked  = false; document.getElementById('etScoreRow')?.classList.add('d-none'); }
  if (chkPEN) { chkPEN.checked = false; document.getElementById('penWinnerRow')?.classList.add('d-none'); }

  await loadMatchesAdmin();
  await loadMatchesInProgress();
  await loadMatchesDone();
});

async function recalcFavoritesForMatch(matchData, mid, existingBatch) {
  const hs    = matchData.home_score;
  const as_   = matchData.away_score;
  const phase = matchData.phase || '';

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
    const ptsThisMatch = calcFavPts(favTeam, matchData.home_team, matchData.away_team, hs, as_);
    byMatch[mid] = ptsThisMatch;

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

// ── RECALCULAR FAVORITOS ──
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
  await updateDoc(doc(db, 'matches', mid), {
    home_score: null, away_score: null, finished: false, match_status: '',
    extra_time: false, et_home_score: null, et_away_score: null,
    penalties: false, penalties_winner: null,
  });

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
    const slotTag = m.slot ? ' <span style="font-size:10px;color:#a5b4fc;background:rgba(99,102,241,0.15);border-radius:20px;padding:1px 6px">' + m.slot + '</span>' : '';
    const etTag  = m.extra_time ? ' <span style="font-size:10px;color:#fb923c">(ET)</span>'  : '';
    const penTag = m.penalties  ? ' <span style="font-size:10px;color:#f59e0b">(PEN)</span>' : '';
    const statusBadge = isDone
      ? '<span style="font-size:0.75rem;background:rgba(52,211,153,0.12);color:#34d399;border-radius:20px;padding:2px 8px;font-weight:700">FINAL ' + m.home_score + '-' + m.away_score + etTag + penTag + '</span>'
      : hasScore
        ? '<span style="font-size:0.75rem;background:rgba(74,175,212,0.12);color:#4aafd4;border-radius:20px;padding:2px 8px;font-weight:700">EN JUEGO ' + m.home_score + '-' + m.away_score + '</span>'
        : '<span style="font-size:0.75rem;color:var(--text-muted)">Pendiente</span>';
    html +=
      '<div id="matchrow-' + d.id + '" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">' +
        '<span style="font-size:1.2rem">' + (m.home_flag||'⚽') + '</span>' +
        '<span style="flex:1;font-size:0.85rem;font-weight:600">' + m.home_team + ' vs ' + m.away_team + ' ' + (m.away_flag||'') + slotTag + '</span>' +
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
