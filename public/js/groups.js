// groups.js — Crear comparsa, unirse, listar
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, doc, addDoc, getDoc, getDocs,
  query, where, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const TEAMS = [
  "Argentina","Francia","Brasil","Inglaterra","España","Portugal","Alemania",
  "Países Bajos","Croacia","Marruecos","Senegal","México","USA","Canadá",
  "Colombia","Ecuador","Uruguay","Chile","Japón","Corea del Sur","Australia",
  "Arabia Saudita","Irán","Qatar","Suiza","Bélgica","Dinamarca","Polonia",
  "Serbia","Ucrania","Türkiye","Rumania","Austria","Escocia","Hungría",
  "Rep. Checa","Albania","Eslovenia","Eslovaquia","Georgia","Venezuela",
  "Paraguay","Bolivia","Perú","Costa Rica","Panamá","Honduras","Jamaica",
];

let pendingGroupId = null;

function genCode(len = 6) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadGroups(user);
  setupFavoriteModal(user);
});

async function loadGroups(user) {
  const q = query(collection(db, 'group_members'), where('user_uid', '==', user.uid));
  const snap = await getDocs(q);
  const container = document.getElementById('groupList');
  if (!container) return;
  container.innerHTML = '';
  if (snap.empty) {
    container.innerHTML = '<div class="col-12"><p style="color:var(--text-muted)">¡Aún no perteneces a ninguna comparsa! Crea una o únete con un código.</p></div>';
    return;
  }
  for (const memberDoc of snap.docs) {
    const gid = memberDoc.data().group_id;
    const gSnap = await getDoc(doc(db, 'groups', gid));
    if (gSnap.exists()) renderGroupCard(gSnap, memberDoc.data(), container);
  }
}

function renderGroupCard(gSnap, memberData, container) {
  const g = gSnap.data();
  const col = document.createElement('div');
  col.className = 'col-md-4';
  const prize = g.prize ? `<span style="color:var(--green-light)">🏆 $${g.prize}</span>` : '';
  const fee   = g.fee   ? `<span style="color:var(--text-muted)"> &middot; Cuota $${g.fee}</span>` : '';
  const stage = g.stage ? `<div style="font-size:11px;color:var(--gold);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${g.stage}</div>` : '';
  const fav   = memberData.favorite ? `<div style="font-size:12px;color:var(--green-light);margin-top:4px">⚽ ${memberData.favorite}</div>` : '<div style="font-size:12px;color:var(--danger);margin-top:4px">⚠ Sin favorito</div>';
  col.innerHTML = `
    <div class="group-card" onclick="window.location='group.html?gid=${gSnap.id}'">
      ${stage}
      <h6 style="margin-bottom:2px">${g.name}</h6>
      <small>${prize}${fee}</small>
      ${fav}
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Código: <strong style="color:var(--gold);letter-spacing:2px">${g.code}</strong></div>
    </div>`;
  container.appendChild(col);
}

// --- Crear comparsa ---
document.getElementById('createGroupBtn')?.addEventListener('click', async () => {
  const user  = auth.currentUser;
  const name  = document.getElementById('newGroupName').value.trim();
  const stage = document.getElementById('newGroupStage').value;
  const prize = document.getElementById('newGroupPrize').value;
  const fee   = document.getElementById('newGroupFee').value;
  if (!name || !stage || !user) { alert('Completa al menos el nombre y la etapa'); return; }
  const code = genCode();
  const ref = await addDoc(collection(db, 'groups'), {
    name, code, stage,
    prize: prize ? parseFloat(prize) : null,
    fee:   fee   ? parseFloat(fee)   : null,
    owner_uid: user.uid,
    created_at: serverTimestamp()
  });
  pendingGroupId = ref.id;
  await setDoc(doc(db, 'group_members', `${ref.id}_${user.uid}`), {
    group_id: ref.id, user_uid: user.uid, role: 'admin',
    favorite: null, penalty_pts: 0, favorite_pts: 0
  });
  ['newGroupName','newGroupPrize','newGroupFee'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newGroupStage').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('favoriteModal')).show();
});

// --- Unirse a comparsa ---
document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code || !user) return;
  const q = query(collection(db, 'groups'), where('code', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) { alert('Código no encontrado. Verifica e intenta de nuevo.'); return; }
  const gSnap = snap.docs[0];
  pendingGroupId = gSnap.id;
  const memberId = `${gSnap.id}_${user.uid}`;
  const existing = await getDoc(doc(db, 'group_members', memberId));
  if (existing.exists()) { alert('Ya eres miembro de esta comparsa.'); return; }
  await setDoc(doc(db, 'group_members', memberId), {
    group_id: gSnap.id, user_uid: user.uid, role: 'member',
    favorite: null, penalty_pts: 0, favorite_pts: 0
  });
  document.getElementById('joinCode').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('favoriteModal')).show();
});

// --- Modal elegir favorito ---
function setupFavoriteModal(user) {
  const grid    = document.getElementById('teamGrid');
  const search  = document.getElementById('favoriteSearch');
  const hidden  = document.getElementById('selectedTeam');
  const saveBtn = document.getElementById('saveFavoriteBtn');
  if (!grid) return;

  function renderTeams(filter = '') {
    grid.innerHTML = '';
    TEAMS.filter(t => t.toLowerCase().includes(filter.toLowerCase())).forEach(team => {
      const div = document.createElement('div');
      div.className = 'col-6';
      div.innerHTML = `<button class="btn w-100 team-btn" style="background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px">⚽ ${team}</button>`;
      div.querySelector('button').addEventListener('click', () => {
        grid.querySelectorAll('.team-btn').forEach(b => {
          b.style.cssText = 'background:var(--bg-card2);color:var(--text);border:1px solid var(--border);font-size:0.85rem;padding:8px 4px';
        });
        div.querySelector('button').style.cssText = 'background:rgba(22,163,74,0.2);color:var(--green-light);border:1px solid var(--green);font-size:0.85rem;padding:8px 4px;font-weight:700';
        hidden.value    = team;
        saveBtn.disabled = false;
      });
      grid.appendChild(div);
    });
  }

  renderTeams();
  search?.addEventListener('input', e => renderTeams(e.target.value));

  saveBtn?.addEventListener('click', async () => {
    const team = hidden.value;
    if (!team || !pendingGroupId || !user) return;
    await setDoc(doc(db, 'group_members', `${pendingGroupId}_${user.uid}`),
      { favorite: team }, { merge: true });
    bootstrap.Modal.getInstance(document.getElementById('favoriteModal')).hide();
    pendingGroupId = null;
    await loadGroups(user);
  });
}
