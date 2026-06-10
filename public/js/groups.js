// groups.js — Crear comparsa, unirse, listar + invitar por WhatsApp
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, where, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const TEAMS = [
  "Canadá", "México", "USA",
  "Argentina", "Brasil", "Uruguay", "Paraguay", "Ecuador", "Colombia",
  "España", "Francia", "Alemania", "Inglaterra", "Portugal", "Países Bajos",
  "Bélgica", "Austria", "Suiza", "Croacia", "Noruega", "Escocia",
  "Bosnia y Herzegovina", "Suecia", "Turquía", "Rep. Checa",
  "Japón", "Corea del Sur", "Irán", "Australia", "Arabia Saudita",
  "Uzbekistán", "Jordania", "Qatar",
  "Marruecos", "Túnez", "Egipto", "Argelia", "Ghana",
  "Senegal", "Costa de Marfil", "Sudáfrica", "Cabo Verde",
  "Panamá", "Haití", "Curazao",
  "Nueva Zelanda",
  "RD Congo", "Irak",
];

const DIST_PRESETS = {
  winner: { p1:100, p2:0,  p3:0  },
  top2:   { p1:70,  p2:30, p3:0  },
  top3:   { p1:60,  p2:30, p3:10 },
};

export function currencySymbol(g) {
  return (g?.currency === 'BOB') ? 'Bs.' : '$';
}

let pendingGroupId = null;

function genCode(len = 6) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}
function showOverlay(id) { document.getElementById(id)?.classList.add('show'); }
function hideOverlay(id)  { document.getElementById(id)?.classList.remove('show'); }
function hideLoading()    {
  if (typeof window.hideGroupsLoading === 'function') window.hideGroupsLoading();
}

const urlParams  = new URLSearchParams(window.location.search);
const inviteCode = urlParams.get('join');
if (inviteCode) {
  window.addEventListener('DOMContentLoaded', () => {
    const joinInput = document.getElementById('joinCode');
    if (joinInput) joinInput.value = inviteCode.toUpperCase();
    setTimeout(() => {
      document.getElementById('joinGroupBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 600);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { hideLoading(); return; }
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = user.email;
  await loadGroups(user);
  setupFavoriteOverlay(user);
  setupDeleteOverlay(user);
});

async function loadGroups(user) {
  const container = document.getElementById('groupList');
  if (!container) { hideLoading(); return; }
  container.innerHTML = '';

  try {
    const snap = await getDocs(
      query(collection(db, 'group_members'), where('user_uid', '==', user.uid))
    );

    if (snap.empty) {
      container.innerHTML = '<div class="col-12"><p style="color:var(--text-muted)">¡Aún no perteneces a ninguna comparsa! Crea una o únete con un código.</p></div>';
      return;
    }

    const memberDocs = snap.docs;
    // Traer grupos + todos los miembros de cada grupo EN PARALELO
    const [gSnaps, memberListSnaps] = await Promise.all([
      Promise.all(memberDocs.map(m => getDoc(doc(db, 'groups', m.data().group_id)))),
      Promise.all(memberDocs.map(m =>
        getDocs(query(collection(db, 'group_members'), where('group_id', '==', m.data().group_id)))
      ))
    ]);

    let rendered = 0;
    memberDocs.forEach((memberDoc, i) => {
      const gSnap = gSnaps[i];
      if (!gSnap.exists()) return;
      const allMembers  = memberListSnaps[i].docs.map(d => d.data());
      const memberCount = allMembers.length;
      const paidCount   = allMembers.filter(m => m.payment?.status === 'confirmed').length;
      renderGroupCard(gSnap, memberDoc.data(), container, user, memberCount, paidCount);
      rendered++;
    });

    if (rendered === 0) {
      container.innerHTML = '<div class="col-12"><p style="color:var(--text-muted)">¡Aún no perteneces a ninguna comparsa! Crea una o únete con un código.</p></div>';
    }

  } catch (err) {
    console.error('[loadGroups] Error:', err);
    container.innerHTML = `<div class="col-12"><p style="color:var(--accent)">❌ Error al cargar comparsas. Recarga la página.<br><small style="opacity:0.6">${err.message}</small></p></div>`;
  } finally {
    hideLoading();
  }
}

function buildPotBadge(g, memberCount, paidCount, sym) {
  const hasFee   = g.fee && memberCount > 0;
  const hasPrize = g.type === 'closed' && g.prize;

  // Badge de pagos confirmados
  const showPayBadge = (hasFee || hasPrize) && memberCount > 0;
  const allPaid   = paidCount === memberCount;
  const payColor  = allPaid ? '#34d399' : paidCount > 0 ? '#f59e0b' : '#94a3b8';
  const payBg     = allPaid ? 'rgba(52,211,153,0.12)' : paidCount > 0 ? 'rgba(245,158,11,0.10)' : 'rgba(148,163,184,0.07)';
  const payBorder = allPaid ? 'rgba(52,211,153,0.3)'  : paidCount > 0 ? 'rgba(245,158,11,0.3)'  : 'rgba(148,163,184,0.2)';
  const payIcon   = allPaid ? '✅' : '⏳';

  const payBadgeHtml = showPayBadge ? `
    <span style="
      display:inline-flex;align-items:center;gap:4px;
      font-size:11px;padding:2px 9px;border-radius:20px;
      background:${payBg};color:${payColor};
      border:1px solid ${payBorder};font-weight:700;
      margin-left:6px;
    ">${payIcon} ${paidCount}/${memberCount} pagado${memberCount !== 1 ? 's' : ''}</span>` : '';

  // Grupos abiertos con cuota
  if (hasFee && g.type !== 'closed') {
    const confirmedPot = g.fee * paidCount;
    const totalPot     = g.fee * memberCount;
    const potStr  = totalPot.toLocaleString('es', { minimumFractionDigits:0, maximumFractionDigits:2 });
    const confStr = confirmedPot.toLocaleString('es', { minimumFractionDigits:0, maximumFractionDigits:2 });
    const dist = g.prize_pct || DIST_PRESETS[g.prize_distribution] || DIST_PRESETS.winner;
    const p1    = Math.round(totalPot * dist.p1 / 100);
    const p1Str = p1.toLocaleString('es', { minimumFractionDigits:0, maximumFractionDigits:2 });

    return `
      <div style="
        background:linear-gradient(135deg,rgba(52,211,153,0.10),rgba(29,144,198,0.08));
        border:1px solid rgba(52,211,153,0.25);
        border-radius:10px;padding:8px 12px;margin-top:8px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div>
            <div style="font-size:9px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">💰 Pozo proyectado</div>
            <div style="font-size:1.1rem;font-weight:800;color:#34d399;letter-spacing:1px">${sym}${potStr}</div>
          </div>
          ${dist.p1 > 0 ? `<div style="text-align:right">
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:1px">🥇 1° lugar</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--gold)">${sym}${p1Str}</div>
          </div>` : ''}
        </div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(52,211,153,0.12);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">
          <div style="font-size:11px;color:var(--text-muted)">
            Recaudado: <strong style="color:#34d399">${sym}${confStr}</strong>
            <span style="color:var(--text-muted)"> de ${sym}${potStr}</span>
          </div>
          ${payBadgeHtml}
        </div>
      </div>`;
  }

  // Grupos cerrados con premio fijo
  if (hasPrize) {
    const prizeStr = Number(g.prize).toLocaleString('es', { minimumFractionDigits:0, maximumFractionDigits:2 });
    return `
      <div style="
        background:linear-gradient(135deg,rgba(245,158,11,0.10),rgba(201,52,75,0.06));
        border:1px solid rgba(245,158,11,0.25);
        border-radius:10px;padding:8px 12px;margin-top:8px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div>
            <div style="font-size:9px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">🏆 Premio fijo</div>
            <div style="font-size:1.1rem;font-weight:800;color:#f59e0b;letter-spacing:1px">${sym}${prizeStr}</div>
          </div>
          ${payBadgeHtml}
        </div>
      </div>`;
  }

  return payBadgeHtml ? `<div style="margin-top:6px">${payBadgeHtml}</div>` : '';
}

function renderGroupCard(gSnap, memberData, container, user, memberCount, paidCount) {
  const g    = gSnap.data();
  const gid  = gSnap.id;
  const code = g.code || '';
  const sym  = currencySymbol(g);
  const isAdmin = (memberData.role === 'admin') || (g.owner_uid === user.uid);

  const typeBadge = g.type === 'closed'
    ? `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(201,52,75,0.15);color:#f5a0ac;border:1px solid rgba(201,52,75,0.3)">${g.is_open === false ? '🔴 Cerrada' : '🔒 Cupo lim.'}</span>`
    : `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(29,144,198,0.15);color:#4aafd4;border:1px solid rgba(29,144,198,0.3)">🌐 Abierta</span>`;

  const appUrl    = `${location.origin}/dashboard.html?join=${code}`;
  const waMessage = encodeURIComponent(
    `⚽ ¡Únete a mi comparsa del Mundial 2026! 🏆\n*${g.name}*\n\nEntra aquí y usa el código *${code}*:\n${appUrl}\n\n_Polla Mundialera WC2026 by Largotek_`
  );
  const waLink = `https://wa.me/?text=${waMessage}`;

  const col = document.createElement('div');
  col.className = 'col-md-4';

  const stage = g.stage
    ? `<div style="font-size:11px;color:var(--gold);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${g.stage}</div>`
    : '';
  const fav = memberData.favorite
    ? `<div style="font-size:12px;color:var(--primary-light);margin-top:4px">⚽ ${memberData.favorite}</div>`
    : '<div style="font-size:12px;color:var(--accent);margin-top:4px">⚠ Sin favorito</div>';

  const currencyBadge = g.currency
    ? `<span style="font-size:10px;padding:2px 6px;border-radius:20px;background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.25);margin-left:4px">${g.currency}</span>`
    : '';

  const maxLabel  = (g.type === 'closed' && g.max_members) ? `/${g.max_members}` : '';
  const isFull    = g.type === 'closed' && g.max_members && memberCount >= g.max_members;
  const membColor = isFull ? '#f5a0ac' : '#34d399';
  const memberBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;
    background:rgba(52,211,153,0.1);color:${membColor};
    border:1px solid rgba(52,211,153,0.25);display:inline-flex;align-items:center;gap:3px">
    👥 ${memberCount}${maxLabel} participante${memberCount !== 1 ? 's' : ''}
  </span>`;

  const potBadge = buildPotBadge(g, memberCount, paidCount, sym);

  col.innerHTML = `
    <div class="group-card" style="cursor:default">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        ${stage || '<div></div>'}
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">${typeBadge}${currencyBadge}</div>
      </div>
      <div style="cursor:pointer" onclick="window.location='group.html?gid=${gid}'">
        <h6 style="margin-bottom:2px">${g.name}</h6>
        <div style="margin-top:6px">${memberBadge}</div>
        ${potBadge}
        ${fav}
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Código: <strong style="color:var(--gold);letter-spacing:2px">${code}</strong></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success btn-sm" style="flex:1;font-size:12px;font-weight:700"
          onclick="event.stopPropagation();window.location='group.html?gid=${gid}'">🏆 Ver</button>
        <a href="${waLink}" target="_blank" rel="noopener"
          class="btn btn-sm"
          style="flex:1;font-size:12px;font-weight:700;background:#1D90C6;color:#fff;border:none;border-radius:8px">
          📤 Invitar</a>
        <button class="btn btn-outline-light btn-sm" style="font-size:12px;padding:4px 10px"
          onclick="event.stopPropagation();copyInviteLink('${appUrl}',this)" title="Copiar link">📋</button>
      </div>
      ${isAdmin ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,52,75,0.15)">
        <button class="del-btn" style="width:100%;padding:7px 12px;font-size:12px;font-weight:600;
          background:rgba(201,52,75,0.1);color:#f5a0ac;border:1px solid rgba(201,52,75,0.35);
          border-radius:8px;cursor:pointer">
          🗑️ Eliminar comparsa
        </button>
      </div>` : ''}
    </div>`;

  if (isAdmin) {
    col.querySelector('.del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteOverlay(gid, g.name, user);
    });
  }
  container.appendChild(col);
}

window.copyInviteLink = function(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✅';
    btn.style.color = '#4aafd4';
    setTimeout(() => { btn.textContent = orig; btn.style = ''; }, 2000);
  });
};

// ── Crear comparsa ───────────────────────────────────────────────────────────────────────────────────
document.getElementById('createGroupBtn')?.addEventListener('click', async () => {
  const user     = auth.currentUser;
  const name     = document.getElementById('newGroupName').value.trim();
  const stage    = document.getElementById('newGroupStage').value;
  const type     = document.getElementById('newGroupType').value;
  const dist     = document.getElementById('newGroupDist').value;
  const currency = document.getElementById('newGroupCurrency')?.value || 'USD';

  if (!name || !stage || !user) { showMsg('createMsg', 'Completa al menos el nombre y la etapa', 'danger'); return; }

  let prize = null, fee = null, max_members = null;
  if (type === 'closed') {
    prize       = parseFloat(document.getElementById('newGroupPrizeClosed').value) || null;
    fee         = parseFloat(document.getElementById('newGroupFee').value)         || null;
    max_members = parseInt(document.getElementById('newGroupMax').value)           || null;
  } else {
    fee = parseFloat(document.getElementById('newGroupFeeOpen').value) || null;
  }

  let prize_pct;
  if (dist === 'custom') {
    const p1 = parseInt(document.getElementById('distP1').value) || 0;
    const p2 = parseInt(document.getElementById('distP2').value) || 0;
    const p3 = parseInt(document.getElementById('distP3').value) || 0;
    if (p1 + p2 + p3 !== 100) {
      document.getElementById('distError').textContent = '⚠️ Los porcentajes deben sumar 100%';
      return;
    }
    document.getElementById('distError').textContent = '';
    prize_pct = { p1, p2, p3 };
  } else {
    prize_pct = DIST_PRESETS[dist];
  }

  const btn = document.getElementById('createGroupBtn');
  btn.disabled = true;
  btn.textContent = 'Creando...';

  try {
    const code = genCode();
    const ref  = await addDoc(collection(db, 'groups'), {
      name, code, stage, type, prize, fee, max_members,
      prize_distribution: dist, prize_pct, currency,
      is_open: true, owner_uid: user.uid, created_at: serverTimestamp()
    });
    pendingGroupId = ref.id;
    await setDoc(doc(db, 'group_members', `${ref.id}_${user.uid}`), {
      group_id: ref.id, user_uid: user.uid, role: 'admin',
      favorite: null, penalty_pts: 0, favorite_pts: 0
    });
    ['newGroupName','newGroupPrizeClosed','newGroupFee','newGroupFeeOpen','newGroupMax','distP1','distP2','distP3']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('newGroupStage').value    = '';
    document.getElementById('newGroupType').value     = 'open';
    document.getElementById('newGroupDist').value     = 'winner';
    document.getElementById('newGroupCurrency').value = 'USD';
    document.getElementById('openFields').classList.remove('d-none');
    document.getElementById('closedFields').classList.add('d-none');
    document.getElementById('customDistFields').classList.add('d-none');
    showMsg('createMsg', '✅ ¡Comparsa creada!', 'success');
    openFavoriteOverlay();
  } catch(err) {
    showMsg('createMsg', '❌ Error: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚽ Crear comparsa';
  }
});

// ── Unirse a comparsa ──────────────────────────────────────────────────────────────────────────────
document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code || !user) return;

  const q    = query(collection(db, 'groups'), where('code', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) { showMsg('joinMsg', '❌ Código no encontrado.', 'danger'); return; }

  const gSnap = snap.docs[0];
  const g     = gSnap.data();
  if (g.is_open === false) { showMsg('joinMsg', '🔴 Esta comparsa ya está cerrada.', 'danger'); return; }

  const memberId = `${gSnap.id}_${user.uid}`;
  const existing = await getDoc(doc(db, 'group_members', memberId));
  if (existing.exists()) { showMsg('joinMsg', '⚠️ Ya eres miembro de esta comparsa.', 'warning'); return; }

  if (g.type === 'closed' && g.max_members) {
    const membersSnap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', gSnap.id)));
    if (membersSnap.size >= g.max_members) {
      showMsg('joinMsg', `🔴 La comparsa está llena (máx. ${g.max_members}).`, 'danger');
      return;
    }
  }

  await setDoc(doc(db, 'group_members', memberId), {
    group_id: gSnap.id, user_uid: user.uid, role: 'member',
    favorite: null, penalty_pts: 0, favorite_pts: 0
  });
  pendingGroupId = gSnap.id;
  document.getElementById('joinCode').value = '';
  window.history.replaceState({}, '', location.pathname);
  showMsg('joinMsg', '✅ ¡Te uniste!', 'success');
  openFavoriteOverlay();
});

// ── Overlay favorito ──────────────────────────────────────────────────────────────────────────────
function openFavoriteOverlay() {
  document.getElementById('selectedTeam').value = '';
  document.getElementById('saveFavoriteBtn').disabled = true;
  document.getElementById('favoriteSearch').value = '';
  renderTeams('', document.getElementById('teamGrid'));
  showOverlay('favoriteOverlay');
}

function renderTeams(filter, grid) {
  if (!grid) return;
  grid.innerHTML = '';
  const saveBtn = document.getElementById('saveFavoriteBtn');
  const hidden  = document.getElementById('selectedTeam');
  TEAMS.filter(t => t.toLowerCase().includes(filter.toLowerCase())).forEach(team => {
    const div = document.createElement('div');
    div.className = 'col-6';
    div.innerHTML = `<button class="btn w-100 team-btn" style="background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px">⚽ ${team}</button>`;
    div.querySelector('button').addEventListener('click', () => {
      grid.querySelectorAll('.team-btn').forEach(b => {
        b.style.cssText = 'background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px';
      });
      div.querySelector('button').style.cssText = 'background:rgba(29,144,198,0.2);color:#4aafd4;border:1px solid #1D90C6;font-size:0.85rem;padding:8px 4px;font-weight:700';
      hidden.value = team;
      if (saveBtn) saveBtn.disabled = false;
    });
    grid.appendChild(div);
  });
}

function setupFavoriteOverlay(user) {
  const grid    = document.getElementById('teamGrid');
  const search  = document.getElementById('favoriteSearch');
  const hidden  = document.getElementById('selectedTeam');
  const saveBtn = document.getElementById('saveFavoriteBtn');
  const skipBtn = document.getElementById('skipFavoriteBtn');
  if (!grid) return;
  renderTeams('', grid);
  search?.addEventListener('input', e => renderTeams(e.target.value, grid));
  saveBtn?.addEventListener('click', async () => {
    const team = hidden.value;
    if (!team || !pendingGroupId || !user) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    try {
      await setDoc(doc(db, 'group_members', `${pendingGroupId}_${user.uid}`),
        { favorite: team }, { merge: true });
      hideOverlay('favoriteOverlay');
      pendingGroupId = null;
      await loadGroups(user);
    } catch(e) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Confirmar favorito';
    }
  });
  skipBtn?.addEventListener('click', async () => {
    hideOverlay('favoriteOverlay');
    pendingGroupId = null;
    await loadGroups(user);
  });
}

// ── Overlay eliminar ──────────────────────────────────────────────────────────────────────────────
let _deleteGid = null;
let _deleteUser = null;

function openDeleteOverlay(gid, name, user) {
  _deleteGid  = gid;
  _deleteUser = user;
  document.getElementById('deleteGroupName').textContent = name;
  document.getElementById('deleteConfirmInput').value    = '';
  document.getElementById('confirmDeleteBtn').disabled   = true;
  showOverlay('deleteOverlay');
}

function setupDeleteOverlay(user) {
  const input = document.getElementById('deleteConfirmInput');
  const btn   = document.getElementById('confirmDeleteBtn');
  if (!input || !btn) return;
  input.addEventListener('input', () => {
    const expected = document.getElementById('deleteGroupName').textContent;
    btn.disabled = input.value.trim() !== expected;
  });
  btn.addEventListener('click', async () => {
    if (!_deleteGid || !_deleteUser) return;
    btn.disabled = true;
    btn.textContent = 'Eliminando...';
    try {
      await deleteDoc(doc(db, 'groups', _deleteGid));
      await deleteDoc(doc(db, 'group_members', _deleteGid + '_' + _deleteUser.uid)).catch(() => {});
    } catch(err) {
      if (!err.message?.includes('permission')) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = '🗑️ Sí, eliminar definitivamente';
        return;
      }
    }
    hideOverlay('deleteOverlay');
    _deleteGid = null;
    await loadGroups(_deleteUser);
    btn.textContent = '🗑️ Sí, eliminar definitivamente';
  });
}

function showMsg(id, text, type) {
  const colors = { success: '#4aafd4', danger: '#f5a0ac', warning: 'var(--gold)' };
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<span style="color:${colors[type]||'#fff'};font-size:0.85rem">${text}</span>`;
  if (el) setTimeout(() => { el.innerHTML = ''; }, 4000);
}
