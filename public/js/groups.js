// ====================================================
// groups.js — Crear grupo, unirse, listar grupos
// ====================================================
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, doc, addDoc, getDoc, getDocs,
  query, where, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

function genCode(len = 6) {
  return Math.random().toString(36).toUpperCase().slice(2, 2 + len);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadGroups(user);
});

async function loadGroups(user) {
  const q = query(collection(db, 'group_members'), where('user_uid', '==', user.uid));
  const snap = await getDocs(q);
  const container = document.getElementById('groupList');
  if (!container) return;
  container.innerHTML = '';
  snap.forEach(async (memberDoc) => {
    const gid = memberDoc.data().group_id;
    const gSnap = await getDoc(doc(db, 'groups', gid));
    if (gSnap.exists()) renderGroupCard(gSnap, container);
  });
}

function renderGroupCard(gSnap, container) {
  const g = gSnap.data();
  const col = document.createElement('div');
  col.className = 'col-md-4';
  col.innerHTML = `
    <div class="card bg-secondary text-light group-card p-3"
         onclick="window.location='group.html?gid=${gSnap.id}'">
      <h6>🏆 ${g.name}</h6>
      <small class="text-muted">Código: <strong>${g.code}</strong></small>
    </div>`;
  container.appendChild(col);
}

// --- Crear grupo ---
document.getElementById('createGroupBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const name = document.getElementById('newGroupName').value.trim();
  if (!name || !user) return;
  const code = genCode();
  const ref = await addDoc(collection(db, 'groups'), {
    name, code, owner_uid: user.uid, created_at: serverTimestamp()
  });
  await setDoc(doc(db, 'group_members', `${ref.id}_${user.uid}`), {
    group_id: ref.id, user_uid: user.uid, role: 'admin'
  });
  document.getElementById('newGroupName').value = '';
  await loadGroups(user);
});

// --- Unirse a grupo ---
document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code || !user) return;
  const q = query(collection(db, 'groups'), where('code', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) { alert('Código no encontrado'); return; }
  const gSnap = snap.docs[0];
  const memberId = `${gSnap.id}_${user.uid}`;
  await setDoc(doc(db, 'group_members', memberId), {
    group_id: gSnap.id, user_uid: user.uid, role: 'member'
  });
  document.getElementById('joinCode').value = '';
  await loadGroups(user);
});
