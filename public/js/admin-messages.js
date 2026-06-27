import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
  query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

let allUsers = [];

async function init() {
  // Cargar usuarios para el selector
  const snap = await getDocs(collection(db, 'users'));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) =>
    (a.display_name||a.email||'').localeCompare(b.display_name||b.email||'')
  );
  const sel = document.getElementById('newUser');
  sel.innerHTML = '<option value="">— Selecciona un usuario —</option>' +
    allUsers.map(u => `<option value="${u.id}">${u.display_name || u.email}</option>`).join('');

  await loadMessages();
}

async function loadMessages() {
  document.getElementById('loader').style.display = 'block';
  document.getElementById('msgList').innerHTML = '';

  const snap = await getDocs(query(collection(db, 'welcome_messages'), orderBy('created_at', 'desc')));
  const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.getElementById('loader').style.display = 'none';

  if (!msgs.length) {
    document.getElementById('msgList').innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:30px">No hay mensajes configurados aún.</div>`;
    return;
  }

  document.getElementById('msgList').innerHTML = msgs.map(m => {
    const user    = m.type === 'user' ? allUsers.find(u => u.id === m.user_uid) : null;
    const userName = user ? (user.display_name || user.email) : null;
    const expiry  = m.expires_at ? new Date(m.expires_at.seconds * 1000).toLocaleDateString('es-BO') : null;
    const isActive = m.active !== false && (!m.expires_at || new Date(m.expires_at.seconds * 1000) > new Date());

    return `
    <div class="msg-card" id="msg-${m.id}" style="border-left:3px solid ${m.type==='user'?'#a78bfa':'#4aafd4'}">
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            ${m.emoji ? `<span style="font-size:1.4rem">${m.emoji}</span>` : ''}
            <span style="font-weight:800;font-size:0.95rem;color:#f1f5f9">${m.title || '(sin título)'}</span>
            <span class="${isActive?'badge-active':'badge-inactive'}">${isActive?'✅ Activo':'⏸ Inactivo'}</span>
            <span class="${m.type==='user'?'badge-user':'badge-global'}">${m.type==='user'?'👤 '+userName:'🌐 Global'}</span>
            ${expiry ? `<span style="font-size:11px;color:var(--text-muted)">Hasta: ${expiry}</span>` : ''}
          </div>
          <div style="font-size:14px;color:#cbd5e1;line-height:1.5;white-space:pre-wrap">${m.body}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;margin-top:4px">
          <button class="toggle-btn ${isActive?'':'off'}" onclick="toggleMsg('${m.id}', ${!isActive})">
            ${isActive ? '⏸ Desactivar' : '▶️ Activar'}
          </button>
          <button class="del-btn" onclick="deleteMsg('${m.id}')">
            🗑️ Eliminar
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.toggleMsg = async (id, active) => {
  await updateDoc(doc(db, 'welcome_messages', id), { active });
  await loadMessages();
};

window.deleteMsg = async (id) => {
  if (!confirm('¿Eliminar este mensaje?')) return;
  await deleteDoc(doc(db, 'welcome_messages', id));
  await loadMessages();
};

document.getElementById('btnCreate').addEventListener('click', async () => {
  const title  = document.getElementById('newTitle').value.trim();
  const body   = document.getElementById('newBody').value.trim();
  const type   = document.getElementById('newType').value;
  const uid    = document.getElementById('newUser').value;
  const emoji  = document.getElementById('newEmoji').value.trim();
  const expiry = document.getElementById('newExpiry').value;
  const log    = document.getElementById('createLog');

  if (!body) { log.innerHTML = '<span style="color:#f87171">⚠️ El mensaje no puede estar vacío</span>'; return; }
  if (type === 'user' && !uid) { log.innerHTML = '<span style="color:#f87171">⚠️ Selecciona un usuario</span>'; return; }

  const btn = document.getElementById('btnCreate');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  const id = `msg_${Date.now()}`;
  const payload = {
    title:      title || null,
    body,
    type,
    emoji:      emoji || null,
    active:     true,
    created_at: Timestamp.now(),
    expires_at: expiry ? Timestamp.fromDate(new Date(expiry + 'T23:59:59')) : null,
    user_uid:   type === 'user' ? uid : null,
    seen_by:    [],
  };

  await setDoc(doc(db, 'welcome_messages', id), payload);

  log.innerHTML = '<span style="color:#34d399">✅ Mensaje guardado correctamente</span>';
  document.getElementById('newTitle').value = '';
  document.getElementById('newBody').value  = '';
  document.getElementById('newEmoji').value = '';
  document.getElementById('newExpiry').value = '';
  document.getElementById('newType').value   = 'global';
  document.getElementById('userSelectWrap').style.display = 'none';

  btn.disabled = false; btn.textContent = '💾 Guardar mensaje';
  await loadMessages();
  setTimeout(() => { log.innerHTML = ''; }, 3000);
});

init();
