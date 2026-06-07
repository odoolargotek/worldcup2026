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
  if (!user) {
    // Usuario no autenticado: ocultar skeleton igual
    hideLoading();
    return;
  }
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
    const q    = query(collection(db, 'group_members'), where('user_uid', '==', user.uid));
    const snap = await getDocs(q);

    const validDocs = [];
    for (const memberDoc of snap.docs) {
      const gid   = memberDoc.data().group_id;
      const gSnap = await getDoc(doc(db, 'groups', gid));
      if (gSnap.exists()) validDocs.push({ gSnap, memberData: memberDoc.data() });
    }

    if (validDocs.length === 0) {
      container.innerHTML = '<div class="col-12"><p style="color:var(--text-muted)">\u00a1A\u00fan no perteneces a ninguna comparsa! Crea una o \u00fanete con un c\u00f3digo.</p></div>';
      return;
    }

    for (const { gSnap, memberData } of validDocs) {
      const membersSnap = await getDocs(
        query(collection(db, 'group_members'), where('group_id', '==', gSnap.id))
      );
      renderGroupCard(gSnap, memberData, container, user, membersSnap.size);
    }

  } catch (err) {
    console.error('[loadGroups] Error:', err);
    container.innerHTML = `<div class="col-12"><p style="color:var(--accent)">\u274c Error al cargar comparsas. Recarga la p\u00e1gina.</p></div>`;
  } finally {
    // Siempre ocultar el skeleton, pase lo que pase
    hideLoading();
  }
}

function renderGroupCard(gSnap, memberData, container, user, memberCount) {
  const g    = gSnap.data();
  const gid  = gSnap.id;
  const code = g.code || '';
  const sym  = currencySymbol(g);
  const isAdmin = (memberData.role === 'admin') || (g.owner_uid === user.uid);

  const typeBadge = g.type === 'closed'
    ? `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(201,52,75,0.15);color:#f5a0ac;border:1px solid rgba(201,52,75,0.3)">${g.is_open === false ? '\ud83d\udd34 Cerrada' : '\ud83d\udd12 Cupo lim.'}</span>`
    : `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(29,144,198,0.15);color:#4aafd4;border:1px solid rgba(29,144,198,0.3)">\ud83c\udf10 Abierta</span>`;

  const appUrl    = `${location.origin}/dashboard.html?join=${code}`;
  const waMessage = encodeURIComponent(
    `\u26bd \u00a1\u00danete a mi comparsa del Mundial 2026! \ud83c\udfc6\n*${g.name}*\n\nEntra aqu\u00ed y usa el c\u00f3digo *${code}*:\n${appUrl}\n\n_Polla Mundialera WC2026 by Largotek_`
  );
  const waLink = `https://wa.me/?text=${waMessage}`;

  const col = document.createElement('div');
  col.className = 'col-md-4';

  const stage = g.stage
    ? `<div style="font-size:11px;color:var(--gold);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${g.stage}</div>`
    : '';
  const fav = memberData.favorite
    ? `<div style="font-size:12px;color:var(--primary-light);margin-top:4px">\u26bd ${memberData.favorite}</div>`
    : '<div style="font-size:12px;color:var(--accent);margin-top:4px">\u26a0 Sin favorito</div>';

  const prizeText = g.prize ? `\ud83c\udfc6 ${sym}${g.prize}` : g.fee ? `\ud83d\udcb0 Cuota ${sym}${g.fee}` : '';
  const currencyBadge = g.currency
    ? `<span style="font-size:10px;padding:2px 6px;border-radius:20px;background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.25);margin-left:4px">${g.currency}</span>`
    : '';

  const maxLabel  = (g.type === 'closed' && g.max_members) ? `/${g.max_members}` : '';
  const isFull    = g.type === 'closed' && g.max_members && memberCount >= g.max_members;
  const membColor = isFull ? '#f5a0ac' : '#34d399';
  const memberBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;
    background:rgba(52,211,153,0.1);color:${membColor};
    border:1px solid rgba(52,211,153,0.25);display:inline-flex;align-items:center;gap:3px">
    \ud83d\udc65 ${memberCount}${maxLabel} participante${memberCount !== 1 ? 's' : ''}
  </span>`;

  col.innerHTML = `
    <div class="group-card" style="cursor:default">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        ${stage || '<div></div>'}
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">${typeBadge}${currencyBadge}</div>
      </div>
      <div style="cursor:pointer" onclick="window.location='group.html?gid=${gid}'">
        <h6 style="margin-bottom:2px">${g.name}</h6>
        <small style="color:var(--primary-light)">${prizeText}</small>
        <div style="margin-top:6px">${memberBadge}</div>
        ${fav}
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">C\u00f3digo: <strong style="color:var(--gold);letter-spacing:2px">${code}</strong></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success btn-sm" style="flex:1;font-size:12px;font-weight:700"
          onclick="event.stopPropagation();window.location='group.html?gid=${gid}'">\ud83c\udfc6 Ver</button>
        <a href="${waLink}" target="_blank" rel="noopener"
          class="btn btn-sm"
          style="flex:1;font-size:12px;font-weight:700;background:#1D90C6;color:#fff;border:none;border-radius:8px">
          \ud83d\udce4 Invitar</a>
        <button class="btn btn-outline-light btn-sm" style="font-size:12px;padding:4px 10px"
          onclick="event.stopPropagation();copyInviteLink('${appUrl}',this)" title="Copiar link">\ud83d\udccb</button>
      </div>
      ${isAdmin ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,52,75,0.15)">
        <button class="del-btn" style="width:100%;padding:7px 12px;font-size:12px;font-weight:600;
          background:rgba(201,52,75,0.1);color:#f5a0ac;border:1px solid rgba(201,52,75,0.35);
          border-radius:8px;cursor:pointer">
          \ud83d\uddd1\ufe0f Eliminar comparsa
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
    btn.textContent = '\u2705';
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
      document.getElementById('distError').textContent = '\u26a0\ufe0f Los porcentajes deben sumar 100%';
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
    showMsg('createMsg', '\u2705 \u00a1Comparsa creada!', 'success');
    openFavoriteOverlay();
  } catch(err) {
    showMsg('createMsg', '\u274c Error: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '\u26bd Crear comparsa';
  }
});

// ── Unirse a comparsa ──────────────────────────────────────────────────────────────────────────────
document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code || !user) return;

  const q    = query(collection(db, 'groups'), where('code', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) { showMsg('joinMsg', '\u274c C\u00f3digo no encontrado.', 'danger'); return; }

  const gSnap = snap.docs[0];
  const g     = gSnap.data();
  if (g.is_open === false) { showMsg('joinMsg', '\ud83d\udd34 Esta comparsa ya est\u00e1 cerrada.', 'danger'); return; }

  const memberId = `${gSnap.id}_${user.uid}`;
  const existing = await getDoc(doc(db, 'group_members', memberId));
  if (existing.exists()) { showMsg('joinMsg', '\u26a0\ufe0f Ya eres miembro de esta comparsa.', 'warning'); return; }

  if (g.type === 'closed' && g.max_members) {
    const membersSnap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', gSnap.id)));
    if (membersSnap.size >= g.max_members) {
      showMsg('joinMsg', `\ud83d\udd34 La comparsa est\u00e1 llena (m\u00e1x. ${g.max_members}).`, 'danger');
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
  showMsg('joinMsg', '\u2705 \u00a1Te uniste!', 'success');
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
    div.innerHTML = `<button class="btn w-100 team-btn" style="background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px">\u26bd ${team}</button>`;
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
      saveBtn.textContent = '\u2705 Confirmar favorito';
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
        btn.textContent = '\ud83d\uddd1\ufe0f S\u00ed, eliminar definitivamente';
        return;
      }
    }
    hideOverlay('deleteOverlay');
    _deleteGid = null;
    await loadGroups(_deleteUser);
    btn.textContent = '\ud83d\uddd1\ufe0f S\u00ed, eliminar definitivamente';
  });
}

function showMsg(id, text, type) {
  const colors = { success: '#4aafd4', danger: '#f5a0ac', warning: 'var(--gold)' };
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<span style="color:${colors[type]||'#fff'};font-size:0.85rem">${text}</span>`;
  if (el) setTimeout(() => { el.innerHTML = ''; }, 4000);
}
