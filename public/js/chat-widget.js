/**
 * chat-widget.js
 * Chat flotante: canal de grupo + mensajes individuales
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, addDoc, query, orderBy, limit, where,
  onSnapshot, serverTimestamp, doc, getDoc, getDocs
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params = new URLSearchParams(location.search);
const GID    = params.get('gid') || '';

// ── Estilos ────────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
#cw-fab {
  position: fixed; bottom: 22px; right: 22px; z-index: 9998;
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg,#2563eb,#4aafd4);
  border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; transition: transform .2s;
}
#cw-fab:hover { transform: scale(1.1); }
#cw-badge {
  position: absolute; top: -4px; right: -4px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 800;
  border-radius: 50%; min-width: 18px; height: 18px;
  display: none; align-items: center; justify-content: center; padding: 0 3px;
}
#cw-panel {
  position: fixed; bottom: 84px; right: 22px; z-index: 9999;
  width: 330px; max-width: calc(100vw - 32px);
  background: #0f1a2d; border: 1.5px solid #1e3a5f;
  border-radius: 16px; display: none; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden;
  font-family: system-ui, sans-serif;
}
#cw-header {
  display: flex; align-items: center; gap: 8px;
  background: #1a2d4a; padding: 10px 14px;
  font-size: 13px; font-weight: 700; color: #f1f5f9;
  border-bottom: 1px solid #1e3a5f;
}
#cw-header .cw-back { cursor: pointer; font-size: 16px; opacity: .7; flex-shrink: 0; display: none; }
#cw-header .cw-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#cw-header .cw-close { cursor: pointer; font-size: 16px; opacity: .7; flex-shrink: 0; }
#cw-tabs { display: flex; border-bottom: 1px solid #1e3a5f; }
.cw-tab {
  flex: 1; padding: 8px 0; text-align: center;
  font-size: 12px; font-weight: 600; color: #94a3b8;
  cursor: pointer; transition: background .15s; position: relative;
}
.cw-tab.active { color: #4aafd4; border-bottom: 2px solid #4aafd4; }
.cw-tab .cw-tab-badge {
  position: absolute; top: 4px; right: 20%;
  background: #ef4444; color: #fff; font-size: 9px; font-weight: 800;
  border-radius: 50%; min-width: 15px; height: 15px;
  display: none; align-items: center; justify-content: center;
}
#cw-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
#cw-view-group, #cw-view-dms, #cw-view-chat {
  display: none; flex-direction: column; flex: 1; min-height: 0;
}
#cw-view-group.active, #cw-view-dms.active, #cw-view-chat.active { display: flex; }
.cw-messages {
  flex: 1; overflow-y: auto; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; min-height: 160px;
  scrollbar-width: thin; scrollbar-color: #1e3a5f transparent;
}
.cw-msg { display: flex; flex-direction: column; max-width: 80%; }
.cw-msg.mine { align-self: flex-end; align-items: flex-end; }
.cw-msg.theirs { align-self: flex-start; }
.cw-msg .cw-name { font-size: 10px; color: #64748b; margin-bottom: 2px; }
.cw-msg .cw-bubble {
  padding: 7px 11px; border-radius: 12px; font-size: 12px; line-height: 1.4; word-break: break-word;
}
.cw-msg.mine .cw-bubble { background: #2563eb; color: #fff; border-bottom-right-radius: 3px; }
.cw-msg.theirs .cw-bubble { background: #1e3a5f; color: #e2e8f0; border-bottom-left-radius: 3px; }
.cw-msg .cw-time { font-size: 9px; color: #475569; margin-top: 2px; }
.cw-input-row {
  display: flex; gap: 6px; padding: 8px 10px;
  border-top: 1px solid #1e3a5f; background: #0f1a2d;
}
.cw-input {
  flex: 1; background: #1e3a5f; border: 1px solid #2563eb;
  border-radius: 8px; padding: 7px 10px; font-size: 12px;
  color: #f1f5f9; outline: none; resize: none; max-height: 80px;
}
.cw-input::placeholder { color: #64748b; }
.cw-send {
  background: #2563eb; border: none; border-radius: 8px;
  padding: 7px 12px; color: #fff; font-size: 14px; cursor: pointer; flex-shrink: 0;
}
.cw-send:hover { background: #1d4ed8; }
.cw-dm-list { flex: 1; overflow-y: auto; max-height: 340px; }
.cw-dm-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  border-bottom: 1px solid #1a2d4a; transition: background .15s;
}
.cw-dm-item:hover { background: #1a2d4a; }
.cw-dm-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg,#2563eb,#4aafd4);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.cw-dm-info { flex: 1; overflow: hidden; }
.cw-dm-name { font-size: 12px; font-weight: 600; color: #f1f5f9; }
.cw-dm-preview { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cw-no-gid { padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
.cw-loading { padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
`;
document.head.appendChild(style);

// ── HTML del widget ──────────────────────────────────────────────────────────────────
const wrap = document.createElement('div');
wrap.innerHTML = `
<button id="cw-fab">
  <span>💬</span>
  <span id="cw-badge"></span>
</button>
<div id="cw-panel">
  <div id="cw-header">
    <span class="cw-back" id="cw-back">←</span>
    <span class="cw-title" id="cw-title">Chat</span>
    <span class="cw-close" id="cw-close">✕</span>
  </div>
  <div id="cw-tabs">
    <div class="cw-tab active" data-tab="group">
      📢 Grupo
      <span class="cw-tab-badge" id="cw-tab-badge-group"></span>
    </div>
    <div class="cw-tab" data-tab="dms">
      💬 Privado
      <span class="cw-tab-badge" id="cw-tab-badge-dms"></span>
    </div>
  </div>
  <div id="cw-body">
    <div id="cw-view-group" class="active">
      <div class="cw-messages" id="cw-group-msgs"><div class="cw-loading">⏳ Cargando...</div></div>
      <div class="cw-input-row">
        <textarea class="cw-input" id="cw-group-input" placeholder="Escribe un mensaje..." rows="1"></textarea>
        <button class="cw-send" id="cw-group-send">➤</button>
      </div>
    </div>
    <div id="cw-view-dms">
      <div class="cw-dm-list" id="cw-dm-list"><div class="cw-loading">⏳ Cargando miembros...</div></div>
    </div>
    <div id="cw-view-chat">
      <div class="cw-messages" id="cw-chat-msgs"></div>
      <div class="cw-input-row">
        <textarea class="cw-input" id="cw-chat-input" placeholder="Escribe un mensaje..." rows="1"></textarea>
        <button class="cw-send" id="cw-chat-send">➤</button>
      </div>
    </div>
  </div>
</div>
`;
document.body.appendChild(wrap);

// ── DOM refs ─────────────────────────────────────────────────────────────────────────
const fab        = document.getElementById('cw-fab');
const badge      = document.getElementById('cw-badge');
const panel      = document.getElementById('cw-panel');
const closeBtn   = document.getElementById('cw-close');
const backBtn    = document.getElementById('cw-back');
const titleEl    = document.getElementById('cw-title');
const tabs       = document.querySelectorAll('.cw-tab');
const tabBadgeG  = document.getElementById('cw-tab-badge-group');
const tabBadgeD  = document.getElementById('cw-tab-badge-dms');
const viewGroup  = document.getElementById('cw-view-group');
const viewDms    = document.getElementById('cw-view-dms');
const viewChat   = document.getElementById('cw-view-chat');
const groupMsgs  = document.getElementById('cw-group-msgs');
const groupInput = document.getElementById('cw-group-input');
const groupSend  = document.getElementById('cw-group-send');
const dmList     = document.getElementById('cw-dm-list');
const chatMsgs   = document.getElementById('cw-chat-msgs');
const chatInput  = document.getElementById('cw-chat-input');
const chatSend   = document.getElementById('cw-chat-send');

// ── Estado ───────────────────────────────────────────────────────────────────────────
let currentUser  = null;
let currentView  = 'group';
let activeDmUid  = null;
let activeDmName = '';
let groupUnsub   = null;
let dmUnsub      = null;
let groupUnread  = 0;
let dmUnread     = 0;
let panelOpen    = false;
let groupMembers = [];
let lastGroupRead = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────────
const dmChannelId = (a, b) => [a, b].sort().join('__');

function tsToStr(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

function scrollBottom(el) {
  setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}

function setBadge(el, n) {
  if (n > 0) { el.style.display = 'flex'; el.textContent = n > 9 ? '9+' : n; }
  else { el.style.display = 'none'; }
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMessages(container, docs, myUid, showName = true) {
  container.innerHTML = '';
  if (!docs.length) {
    container.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:#475569">Sin mensajes aún. ¡Sé el primero! 👋</div>';
    return;
  }
  docs.forEach(d => {
    const isMine = d.uid === myUid;
    const div = document.createElement('div');
    div.className = `cw-msg ${isMine ? 'mine' : 'theirs'}`;
    div.innerHTML = `
      ${!isMine && showName ? `<div class="cw-name">${escHtml(d.name || d.email || 'Usuario')}</div>` : ''}
      <div class="cw-bubble">${escHtml(d.text)}</div>
      <div class="cw-time">${tsToStr(d.createdAt)}</div>
    `;
    container.appendChild(div);
  });
  scrollBottom(container);
}

// ── Auth ─────────────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user && GID) {
    await loadMembers();
    subscribeGroup();
  }
});

// ── Cargar miembros desde group_members (igual que groups.js) ──────────────────────
async function loadMembers() {
  groupMembers = [];
  if (!GID || !currentUser) return;
  try {
    // Leer todos los miembros del grupo desde la coleccion group_members
    const snap = await getDocs(
      query(collection(db, 'group_members'), where('group_id', '==', GID))
    );
    // Para cada miembro (excepto yo), buscar su perfil en 'users'
    const otherDocs = snap.docs.filter(d => d.data().user_uid !== currentUser.uid);
    await Promise.all(otherDocs.map(async memberDoc => {
      const mData = memberDoc.data();
      const uid   = mData.user_uid;
      let name    = mData.email?.split('@')[0] || uid.slice(0, 8);
      let email   = mData.email || '';
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          const u = uSnap.data();
          // El campo correcto en tu app es display_name (ver groups.js / welcome-message.js)
          name  = u.display_name || u.displayName || u.name || email.split('@')[0] || uid.slice(0, 8);
          email = u.email || email;
        }
      } catch { /* usa fallback */ }
      groupMembers.push({ uid, name, email });
    }));
  } catch(e) {
    console.warn('[chat] loadMembers error', e);
  }
  renderDmList();
}

function renderDmList() {
  if (!GID) {
    dmList.innerHTML = '<div class="cw-no-gid">Abrí un grupo para chatear con sus miembros.</div>';
    return;
  }
  if (!groupMembers.length) {
    dmList.innerHTML = '<div class="cw-no-gid">No hay otros miembros en este grupo aún.</div>';
    return;
  }
  dmList.innerHTML = '';
  groupMembers.forEach(m => {
    const item = document.createElement('div');
    item.className = 'cw-dm-item';
    const initials = (m.name||'?').slice(0,2).toUpperCase();
    item.innerHTML = `
      <div class="cw-dm-avatar">${initials}</div>
      <div class="cw-dm-info">
        <div class="cw-dm-name">${escHtml(m.name)}</div>
        <div class="cw-dm-preview">${escHtml(m.email)}</div>
      </div>
    `;
    item.addEventListener('click', () => openDm(m));
    dmList.appendChild(item);
  });
}

// ── Suscripción canal grupo ────────────────────────────────────────────────────────────
function subscribeGroup() {
  if (!GID || !currentUser) return;
  if (groupUnsub) groupUnsub();
  const q = query(
    collection(db, 'chats', GID, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(60)
  );
  groupUnsub = onSnapshot(q, snap => {
    const docs = snap.docs.map(d => d.data());
    if (currentView === 'group' && panelOpen) {
      renderMessages(groupMsgs, docs, currentUser.uid, true);
      lastGroupRead = docs.length;
      groupUnread = 0;
    } else {
      groupUnread = Math.max(0, docs.length - lastGroupRead);
    }
    updateBadges();
    groupUnsub._cachedDocs = docs;
  });
}

function renderGroupFromCache() {
  if (groupUnsub?._cachedDocs) {
    renderMessages(groupMsgs, groupUnsub._cachedDocs, currentUser.uid, true);
    lastGroupRead = groupUnsub._cachedDocs.length;
    groupUnread = 0;
    updateBadges();
  } else {
    groupMsgs.innerHTML = '<div class="cw-loading">⏳ Cargando...</div>';
  }
}

function updateBadges() {
  const total = groupUnread + dmUnread;
  setBadge(badge, total);
  setBadge(tabBadgeG, groupUnread);
  setBadge(tabBadgeD, dmUnread);
}

// ── Panel abrir/cerrar ────────────────────────────────────────────────────────────────
fab.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'flex' : 'none';
  if (panelOpen) {
    if (!GID) {
      groupMsgs.innerHTML = '<div class="cw-no-gid">Abrí un grupo para chatear.</div>';
    } else {
      renderGroupFromCache();
    }
  }
});

closeBtn.addEventListener('click', () => { panelOpen = false; panel.style.display = 'none'; });

// ── Tabs ─────────────────────────────────────────────────────────────────────────────
tabs.forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.tab)));

function showView(v) {
  currentView = v;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === v));
  backBtn.style.display = 'none';
  viewGroup.classList.toggle('active', v === 'group');
  viewDms.classList.toggle('active',   v === 'dms');
  viewChat.classList.toggle('active',  v === 'chat');

  if (v === 'group') {
    titleEl.textContent = GID ? '📢 Canal del grupo' : '📢 Grupo';
    renderGroupFromCache();
  } else if (v === 'dms') {
    titleEl.textContent = '💬 Mensajes privados';
    dmUnread = 0;
    updateBadges();
    renderDmList();
  } else if (v === 'chat') {
    titleEl.textContent = `💬 ${activeDmName}`;
    backBtn.style.display = 'block';
  }
}

backBtn.addEventListener('click', () => showView('dms'));

// ── DM ────────────────────────────────────────────────────────────────────────────────
function openDm(member) {
  activeDmUid  = member.uid;
  activeDmName = member.name;
  showView('chat');
  subscribeDm();
}

function subscribeDm() {
  if (!currentUser || !activeDmUid) return;
  if (dmUnsub) dmUnsub();
  const cid = dmChannelId(currentUser.uid, activeDmUid);
  const q = query(
    collection(db, 'dms', cid, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(60)
  );
  dmUnsub = onSnapshot(q, snap => {
    renderMessages(chatMsgs, snap.docs.map(d => d.data()), currentUser.uid, false);
  });
}

// ── Enviar mensaje grupo ──────────────────────────────────────────────────────────────
async function sendGroupMsg() {
  const text = groupInput.value.trim();
  if (!text || !currentUser || !GID) return;
  groupInput.value = '';
  try {
    await addDoc(collection(db, 'chats', GID, 'messages'), {
      uid:       currentUser.uid,
      name:      currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      email:     currentUser.email || '',
      text,
      createdAt: serverTimestamp()
    });
  } catch(e) { console.error('[chat] sendGroup', e); }
}

groupSend.addEventListener('click', sendGroupMsg);
groupInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMsg(); }
});

// ── Enviar mensaje privado ────────────────────────────────────────────────────────────
async function sendDmMsg() {
  const text = chatInput.value.trim();
  if (!text || !currentUser || !activeDmUid) return;
  chatInput.value = '';
  const cid = dmChannelId(currentUser.uid, activeDmUid);
  try {
    await addDoc(collection(db, 'dms', cid, 'messages'), {
      uid:       currentUser.uid,
      name:      currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      email:     currentUser.email || '',
      text,
      createdAt: serverTimestamp()
    });
  } catch(e) { console.error('[chat] sendDm', e); }
}

chatSend.addEventListener('click', sendDmMsg);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDmMsg(); }
});
