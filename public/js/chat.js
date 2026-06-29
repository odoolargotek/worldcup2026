// chat.js — Chat flotante: canal grupal + DMs
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, getDocs, where, setDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params  = new URLSearchParams(location.search);
const GID     = params.get('gid') || '';

let currentUser   = null;
let currentName   = 'Anónimo';
let activeChannel = 'group'; // 'group' | uid del otro usuario
let activeDmName  = '';
let activeDmUid   = '';
let unsubMessages = null;
let groupMembers  = []; // [{uid, name}]

// Caché en memoria: evita releer users/ por la misma sesión
const _nameCache = {};

// ── Estructura Firestore:
//   chats/{channelId}/messages/{msgId}
//   channelId para grupo:  "group_{GID}"
//   channelId para DM:     "dm_{sorted(uid1,uid2).join('_')}"

function channelId(type, otherUid) {
  if (type === 'group') return `group_${GID}`;
  const pair = [currentUser.uid, otherUid].sort();
  return `dm_${pair[0]}_${pair[1]}`;
}

// ──────────────────────────────────────────
// OBTENER NOMBRE — con caché en memoria
// Lee users/ SOLO si el doc de group_members no trae nombre embebido
// ──────────────────────────────────────────
async function resolveName(uid, embeddedName) {
  if (embeddedName && embeddedName !== 'Sin nombre') return embeddedName;
  if (_nameCache[uid]) return _nameCache[uid];
  try {
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (uSnap.exists()) {
      const d = uSnap.data();
      const n = (d.display_name || d.displayName || d.name || '').trim()
             || (d.email ? d.email.split('@')[0] : uid.slice(0, 8));
      _nameCache[uid] = n;
      return n;
    }
  } catch { /* sin acceso al doc */ }
  return uid.slice(0, 8);
}

// ──────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────
export function initChat() {
  injectHTML();
  injectStyles();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) return;

    // Nombre propio — intenta campo embebido primero, luego users/
    currentName = await resolveName(user.uid, user.displayName);

    // ── Estrategia lectura eficiente de miembros ────────────────────────
    // 1. Una sola query sobre group_members filtrando por group_id.
    // 2. Datos embebidos (display_name en el doc de membresía) evitan
    //    llamadas N a users/. Si no hay nombre embebido, se resuelve con
    //    caché en memoria (_nameCache) para no repetir lecturas.
    // 3. limit(50) evita leer grupos muy grandes de golpe.
    // ────────────────────────────────────────────────────────────────────
    await loadGroupMembers();
    renderChannelList();
    openChannel('group');
  });

  document.getElementById('chatFab').addEventListener('click', toggleChat);
  document.getElementById('chatClose').addEventListener('click', () => setVisible(false));
  document.getElementById('chatSendBtn').addEventListener('click', sendMessage);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

function toggleChat() {
  const wrap = document.getElementById('chatWrap');
  const visible = wrap.style.display !== 'none' && wrap.style.display !== '';
  setVisible(!visible);
  if (!visible) clearUnread();
}

function setVisible(v) {
  document.getElementById('chatWrap').style.display = v ? 'flex' : 'none';
  if (v) {
    clearUnread();
    scrollToBottom();
    document.getElementById('chatInput').focus();
  }
}

function clearUnread() {
  const badge = document.getElementById('chatBadge');
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
}

function scrollToBottom() {
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

// ──────────────────────────────────────────
// MIEMBROS DEL GRUPO
// Una query → group_members where group_id == GID, limit 50
// Los nombres vienen embebidos (display_name) o se resuelven con caché
// ──────────────────────────────────────────
async function loadGroupMembers() {
  if (!GID) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'group_members'),
        where('group_id', '==', GID),
        limit(50)
      )
    );
    groupMembers = [];
    const resolveAll = snap.docs
      .filter(d => d.data().user_uid !== currentUser.uid)
      .map(async d => {
        const m = d.data();
        // Campos embebidos tienen prioridad: evitan leer users/
        const name = await resolveName(m.user_uid, m.display_name || m.name || '');
        groupMembers.push({ uid: m.user_uid, name });
      });
    await Promise.all(resolveAll);
    // Orden alfabético para el sidebar
    groupMembers.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } catch(e) { console.warn('[chat] loadGroupMembers error', e); }
}

// ──────────────────────────────────────────
// LISTA DE CANALES (sidebar izquierdo)
// ──────────────────────────────────────────
function renderChannelList() {
  const list = document.getElementById('chatChannelList');
  if (!list) return;
  list.innerHTML = '';

  const grpBtn = document.createElement('button');
  grpBtn.className = 'chat-ch-btn' + (activeChannel === 'group' ? ' active' : '');
  grpBtn.innerHTML = `<span class="chat-ch-icon">👥</span><span class="chat-ch-label">Grupo</span>`;
  grpBtn.addEventListener('click', () => openChannel('group'));
  list.appendChild(grpBtn);

  const sep = document.createElement('div');
  sep.className = 'chat-ch-sep';
  sep.textContent = 'Mensajes directos';
  list.appendChild(sep);

  groupMembers.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'chat-ch-btn' + (activeChannel === m.uid ? ' active' : '');
    btn.dataset.uid = m.uid;
    const initials = m.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    btn.innerHTML = `<span class="chat-ch-avatar">${initials}</span><span class="chat-ch-label">${m.name}</span>`;
    btn.addEventListener('click', () => openChannel('dm', m.uid, m.name));
    list.appendChild(btn);
  });
}

// ──────────────────────────────────────────
// ABRIR CANAL
// ──────────────────────────────────────────
function openChannel(type, otherUid, otherName) {
  activeChannel = type === 'group' ? 'group' : otherUid;
  activeDmUid   = otherUid || '';
  activeDmName  = otherName || '';

  const header = document.getElementById('chatHeader');
  if (header) header.textContent = type === 'group' ? '💬 Canal del Grupo' : `💬 ${otherName}`;

  document.querySelectorAll('.chat-ch-btn').forEach(b => {
    b.classList.toggle('active',
      type === 'group' ? !b.dataset.uid : b.dataset.uid === otherUid
    );
  });

  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  const cid = channelId(type, otherUid);
  document.getElementById('chatMessages').innerHTML = '<div class="chat-loading">⏳ Cargando...</div>';

  const q = query(
    collection(db, 'chats', cid, 'messages'),
    orderBy('ts', 'asc'),
    limit(80)
  );

  unsubMessages = onSnapshot(q, snap => {
    renderMessages(snap);
  }, err => console.error('[chat] snapshot error', err));
}

// ──────────────────────────────────────────
// RENDERIZAR MENSAJES
// ──────────────────────────────────────────
function renderMessages(snap) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  container.innerHTML = '';

  if (snap.empty) {
    container.innerHTML = '<div class="chat-empty">Sin mensajes aún. ¡Sé el primero! 🎉</div>';
    return;
  }

  let lastDate = '';
  snap.forEach(d => {
    const msg = d.data();
    const ts  = msg.ts?.toDate ? msg.ts.toDate() : new Date();
    const dateKey = ts.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short' });
    const timeStr = ts.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' });
    const isMe = msg.uid === currentUser?.uid;

    if (dateKey !== lastDate) {
      lastDate = dateKey;
      const dateSep = document.createElement('div');
      dateSep.className = 'chat-date-sep';
      dateSep.textContent = dateKey;
      container.appendChild(dateSep);
    }

    const row = document.createElement('div');
    row.className = `chat-msg-row ${isMe ? 'me' : 'them'}`;

    const initials = (msg.name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    row.innerHTML = `
      ${!isMe ? `<div class="chat-avatar" title="${msg.name || ''}">${initials}</div>` : ''}
      <div class="chat-bubble">
        ${!isMe ? `<div class="chat-sender">${msg.name || 'Anónimo'}</div>` : ''}
        <div class="chat-text">${escHtml(msg.text)}</div>
        <div class="chat-time">${timeStr}</div>
      </div>
      ${isMe ? `<div class="chat-avatar me" title="Tú">${initials}</div>` : ''}
    `;
    container.appendChild(row);
  });

  const wrap = document.getElementById('chatWrap');
  const isVisible = wrap.style.display === 'flex';
  if (!isVisible) {
    const badge = document.getElementById('chatBadge');
    if (badge) { badge.style.display = 'flex'; badge.textContent = '●'; }
  }

  if (wasAtBottom || isVisible) scrollToBottom();
}

// ──────────────────────────────────────────
// ENVIAR MENSAJE
// ──────────────────────────────────────────
async function sendMessage() {
  if (!currentUser) return;
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.disabled = true;

  try {
    const type = activeChannel === 'group' ? 'group' : 'dm';
    const cid  = channelId(type, activeDmUid);
    await addDoc(collection(db, 'chats', cid, 'messages'), {
      uid:  currentUser.uid,
      name: currentName,
      text,
      ts:   serverTimestamp(),
      gid:  GID
    });
  } catch(e) {
    console.error('[chat] send error', e);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// ──────────────────────────────────────────
// HTML DEL FLOTANTE
// ──────────────────────────────────────────
function injectHTML() {
  if (document.getElementById('chatFab')) return;

  const html = `
    <!-- FAB -->
    <button id="chatFab" aria-label="Abrir chat">
      💬
      <span id="chatBadge"></span>
    </button>

    <!-- Chat Wrap -->
    <div id="chatWrap" style="display:none">
      <!-- Sidebar canales -->
      <div id="chatSidebar">
        <div class="chat-sidebar-title">Canales</div>
        <div id="chatChannelList"></div>
      </div>
      <!-- Panel mensajes -->
      <div id="chatPanel">
        <div id="chatTopBar">
          <span id="chatHeader">💬 Canal del Grupo</span>
          <button id="chatClose">✕</button>
        </div>
        <div id="chatMessages"></div>
        <div id="chatInputArea">
          <textarea id="chatInput" placeholder="Escribe un mensaje..." rows="1" maxlength="500"></textarea>
          <button id="chatSendBtn">➤</button>
        </div>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
}

// ──────────────────────────────────────────
// ESTILOS INLINE
// ──────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('chatStyles')) return;
  const style = document.createElement('style');
  style.id = 'chatStyles';
  style.textContent = `
    /* FAB */
    #chatFab {
      position: fixed;
      bottom: 24px;
      right: 20px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--gold, #fabd00);
      border: none;
      font-size: 22px;
      cursor: pointer;
      z-index: 999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .2s;
    }
    #chatFab:hover { transform: scale(1.1); }
    #chatBadge {
      position: absolute;
      top: 2px; right: 2px;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      border-radius: 50%;
      width: 14px; height: 14px;
      display: none;
      align-items: center;
      justify-content: center;
    }

    /* Wrap */
    #chatWrap {
      position: fixed;
      bottom: 84px;
      right: 20px;
      width: min(680px, 96vw);
      height: min(520px, 80vh);
      background: var(--bg-card, #1e293b);
      border: 1.5px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 16px;
      z-index: 998;
      display: flex;
      flex-direction: row;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    }

    /* Sidebar */
    #chatSidebar {
      width: 140px;
      min-width: 140px;
      background: rgba(0,0,0,0.2);
      border-right: 1px solid var(--border, rgba(255,255,255,0.08));
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .chat-sidebar-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted, #94a3b8);
      padding: 12px 10px 6px;
    }
    .chat-ch-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 8px 10px;
      color: var(--text-muted, #94a3b8);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 6px;
      margin: 1px 4px;
      transition: background .15s;
    }
    .chat-ch-btn:hover { background: rgba(255,255,255,0.06); color: var(--text, #f1f5f9); }
    .chat-ch-btn.active { background: rgba(250,189,0,0.15); color: var(--gold, #fabd00); }
    .chat-ch-icon { font-size: 15px; }
    .chat-ch-avatar {
      width: 22px; height: 22px;
      background: rgba(52,211,153,0.25);
      color: #34d399;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 800;
      flex-shrink: 0;
    }
    .chat-ch-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chat-ch-sep {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted, #475569);
      padding: 10px 10px 4px;
      border-top: 1px solid var(--border, rgba(255,255,255,0.06));
      margin-top: 4px;
    }

    /* Panel */
    #chatPanel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    #chatTopBar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      background: rgba(0,0,0,0.15);
    }
    #chatHeader {
      font-size: 13px;
      font-weight: 700;
      color: var(--text, #f1f5f9);
    }
    #chatClose {
      background: transparent;
      border: none;
      color: var(--text-muted, #94a3b8);
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    #chatClose:hover { background: rgba(255,255,255,0.08); }

    /* Mensajes */
    #chatMessages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 12px 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .chat-loading, .chat-empty {
      text-align: center;
      color: var(--text-muted, #94a3b8);
      font-size: 12px;
      margin: auto;
    }
    .chat-date-sep {
      text-align: center;
      font-size: 10px;
      color: var(--text-muted, #94a3b8);
      font-weight: 600;
      margin: 8px 0 4px;
      letter-spacing: 0.5px;
    }
    .chat-msg-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      max-width: 85%;
    }
    .chat-msg-row.me { align-self: flex-end; flex-direction: row; }
    .chat-msg-row.them { align-self: flex-start; }
    .chat-avatar {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: rgba(74,175,212,0.25);
      color: #4aafd4;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 800;
      flex-shrink: 0;
    }
    .chat-avatar.me { background: rgba(250,189,0,0.2); color: var(--gold,#fabd00); }
    .chat-bubble {
      background: rgba(255,255,255,0.06);
      border-radius: 12px 12px 12px 3px;
      padding: 6px 10px;
      max-width: 100%;
    }
    .chat-msg-row.me .chat-bubble {
      background: rgba(250,189,0,0.18);
      border-radius: 12px 12px 3px 12px;
    }
    .chat-sender {
      font-size: 10px;
      font-weight: 700;
      color: #4aafd4;
      margin-bottom: 2px;
    }
    .chat-text {
      font-size: 13px;
      color: var(--text, #f1f5f9);
      line-height: 1.4;
      word-break: break-word;
    }
    .chat-time {
      font-size: 9px;
      color: var(--text-muted, #64748b);
      text-align: right;
      margin-top: 2px;
    }

    /* Input */
    #chatInputArea {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--border, rgba(255,255,255,0.08));
      background: rgba(0,0,0,0.1);
    }
    #chatInput {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 10px;
      color: var(--text, #f1f5f9);
      font-size: 13px;
      padding: 8px 12px;
      resize: none;
      outline: none;
      line-height: 1.4;
      max-height: 80px;
      overflow-y: auto;
    }
    #chatInput:focus { border-color: var(--gold, #fabd00); }
    #chatSendBtn {
      background: var(--gold, #fabd00);
      border: none;
      color: #000;
      border-radius: 10px;
      width: 36px; height: 36px;
      font-size: 16px;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform .15s;
    }
    #chatSendBtn:hover { transform: scale(1.08); }

    /* Mobile */
    @media (max-width: 500px) {
      #chatWrap {
        right: 0; left: 0; bottom: 0;
        width: 100vw;
        height: 70vh;
        border-radius: 16px 16px 0 0;
      }
      #chatSidebar { width: 110px; min-width: 110px; }
      #chatFab { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);
}
