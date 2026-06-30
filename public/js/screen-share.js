/**
 * screen-share.js
 * WebRTC screen sharing usando Firestore como canal de señalización.
 * FIX: el código se genera y muestra ANTES de llamar a getDisplayMedia
 * para que el emisor pueda copiarlo antes de que Chrome cambie el foco.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, collection, setDoc, getDoc, updateDoc,
  onSnapshot, addDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

let currentUser = null;
let pc          = null;
let localStream = null;
let sessionCode = null;
let unsubOffer  = null;
let unsubAnswer = null;
let unsubIce    = null;

// --- UI helpers ---

function log(area, msg) {
  const el = document.getElementById(area);
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setStatus(area, type, text) {
  const el = document.getElementById(area);
  if (!el) return;
  el.className = `status-badge ${type}`;
  el.innerHTML = `<span class="status-dot"></span>${text}`;
}

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- Tabs (screen-share.html standalone) ---

window.switchTab = function(tab) {
  const tabEmit  = document.getElementById('tabEmit');
  const tabWatch = document.getElementById('tabWatch');
  if (tabEmit)  tabEmit.style.display  = tab === 'emit'  ? 'block' : 'none';
  if (tabWatch) tabWatch.style.display = tab === 'watch' ? 'block' : 'none';
  document.getElementById('tabEmitBtn')?.classList.toggle('active',  tab === 'emit');
  document.getElementById('tabWatchBtn')?.classList.toggle('active', tab === 'watch');
};

window.copyCode = function() {
  if (!sessionCode) return;
  navigator.clipboard.writeText(sessionCode).then(() => {
    document.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.textContent = '✅ Copiado';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800);
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EMISOR: Compartir pantalla
// FLUJO CORREGIDO:
//   1. Generar código y mostrarlo en UI   ← usuario puede copiarlo AHORA
//   2. Crear doc de sesión en Firestore
//   3. Llamar a getDisplayMedia           ← Chrome cambia de ventana AQUÍ
//   4. Crear PeerConnection, offer, ICE
// ─────────────────────────────────────────────────────────────────────────────

window.startSharing = async function() {
  const startBtn = document.getElementById('startShareBtn');
  const stopBtn  = document.getElementById('stopShareBtn');

  try {
    setStatus('emitStatus', 'waiting', '⏳ Preparando sesión...');

    // PASO 1 — Generar código y mostrarlo ANTES de capturar pantalla
    sessionCode = randomCode();
    const codeDisplays = document.querySelectorAll('.session-code-display');
    codeDisplays.forEach(el => el.textContent = sessionCode);
    document.querySelectorAll('.session-code-block').forEach(el => el.style.display = 'block');
    log('emitLog', `Código de sesión: ${sessionCode} — cópialo ahora antes de continuar.`);

    // PASO 2 — Crear doc en Firestore
    const sessionRef = doc(db, 'screen_sessions', sessionCode);
    await setDoc(sessionRef, {
      host_uid:   currentUser.uid,
      created_at: new Date(),
      status:     'waiting'
    });

    setStatus('emitStatus', 'waiting', '⏳ Abre el selector de pantalla...');
    log('emitLog', 'Selecciona la ventana o pantalla a compartir.');

    // PASO 3 — AHORA sí, capturar pantalla (Chrome cambia el foco aquí)
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1280 } },
      audio: false
    });

    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = localStream;
      document.getElementById('localPreview').style.display = 'block';
    }
    localStream.getVideoTracks()[0].onended = () => stopSharing();

    // PASO 4 — RTCPeerConnection
    pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'screen_sessions', sessionCode, 'hostCandidates'), event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      log('emitLog', `Estado: ${s}`);
      if (s === 'connected')                     setStatus('emitStatus', 'active',  '🟢 Transmitiendo');
      if (s === 'disconnected' || s === 'failed') setStatus('emitStatus', 'error',   'Conexión perdida');
    };

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await updateDoc(sessionRef, { offer: { type: offer.type, sdp: offer.sdp } });
    log('emitLog', 'Oferta SDP publicada. Esperando receptor...');
    setStatus('emitStatus', 'waiting', '⏳ Esperando receptor...');

    unsubAnswer = onSnapshot(sessionRef, async (snap) => {
      const data = snap.data();
      if (data?.answer && pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        log('emitLog', 'Receptor conectado.');
      }
    });

    unsubIce = onSnapshot(collection(db, 'screen_sessions', sessionCode, 'guestCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch(e) {}
        }
      });
    });

    if (startBtn) startBtn.disabled = true;
    if (stopBtn)  stopBtn.disabled  = false;

  } catch(err) {
    log('emitLog', `Error: ${err.message}`);
    setStatus('emitStatus', 'error', `⚠️ ${err.message}`);
    // Limpiar si falla
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (pc) { pc.close(); pc = null; }
    if (sessionCode) {
      try { await updateDoc(doc(db, 'screen_sessions', sessionCode), { status: 'ended' }); } catch(e) {}
      sessionCode = null;
    }
    document.querySelectorAll('.session-code-block').forEach(el => el.style.display = 'none');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn)  stopBtn.disabled  = true;
  }
};

window.stopSharing = async function() {
  if (unsubAnswer) { unsubAnswer(); unsubAnswer = null; }
  if (unsubIce)    { unsubIce();    unsubIce    = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (pc)          { pc.close(); pc = null; }
  if (sessionCode) {
    try { await updateDoc(doc(db, 'screen_sessions', sessionCode), { status: 'ended' }); } catch(e) {}
    sessionCode = null;
  }
  const localVideo = document.getElementById('localVideo');
  if (localVideo) localVideo.srcObject = null;
  document.getElementById('localPreview')?.style && (document.getElementById('localPreview').style.display = 'none');
  document.querySelectorAll('.session-code-block').forEach(el => el.style.display = 'none');
  document.getElementById('startShareBtn') && (document.getElementById('startShareBtn').disabled = false);
  document.getElementById('stopShareBtn')  && (document.getElementById('stopShareBtn').disabled  = true);
  setStatus('emitStatus', 'idle', 'Inactivo');
  log('emitLog', 'Transmisión detenida.');
};

// ─────────────────────────────────────────────────────────────────────────────
// RECEPTOR: Ver pantalla (usable tanto en screen-share.html como en dashboard)
// ─────────────────────────────────────────────────────────────────────────────

// Referencia al código de sesión del receptor (puede ser diferente al del emisor)
let viewCode    = null;
let pcView      = null;
let unsubOfferV = null;
let unsubIceV   = null;

window.joinSession = async function() {
  const inputEl = document.getElementById('joinCodeInput') || document.getElementById('dashJoinCodeInput');
  const code = (inputEl?.value || '').trim().toUpperCase();
  if (code.length !== 6) { alert('El código debe tener 6 caracteres.'); return; }

  const logArea    = document.getElementById('watchLog')    || document.getElementById('dashWatchLog');
  const statusArea = document.getElementById('watchStatus') || document.getElementById('dashWatchStatus');
  const remoteVid  = document.getElementById('remoteVideo') || document.getElementById('dashRemoteVideo');
  const joinBlock  = document.getElementById('joinBlock')   || document.getElementById('dashJoinBlock');
  const leaveBlock = document.getElementById('leaveBlock')  || document.getElementById('dashLeaveBlock');
  const remPrev    = document.getElementById('remotePreview') || document.getElementById('dashRemotePreview');

  function wLog(msg) {
    if (!logArea) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  }
  function wStatus(type, text) {
    if (!statusArea) return;
    statusArea.className = `status-badge ${type}`;
    statusArea.innerHTML = `<span class="status-dot"></span>${text}`;
  }

  try {
    wLog(`Conectando a sesión ${code}...`);
    wStatus('waiting', '⏳ Conectando...');

    const sessionRef = doc(db, 'screen_sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists())                  throw new Error('Sesión no encontrada. Verifica el código.');
    if (snap.data().status === 'ended')  throw new Error('Esta sesión ya finalizó.');
    if (!snap.data().offer)              throw new Error('El emisor aún no publicó oferta. Espera un momento.');

    pcView = new RTCPeerConnection(ICE_SERVERS);

    pcView.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'screen_sessions', code, 'guestCandidates'), event.candidate.toJSON());
      }
    };

    pcView.onconnectionstatechange = () => {
      const s = pcView.connectionState;
      wLog(`Estado: ${s}`);
      if (s === 'connected')                     wStatus('active', '🟢 Viendo en vivo');
      if (s === 'disconnected' || s === 'failed') wStatus('error',  'Conexión perdida');
    };

    pcView.ontrack = (event) => {
      if (remoteVid) remoteVid.srcObject = event.streams[0];
      if (remPrev)   remPrev.style.display = 'block';
      wLog('Stream recibido.');
    };

    await pcView.setRemoteDescription(new RTCSessionDescription(snap.data().offer));
    const answer = await pcView.createAnswer();
    await pcView.setLocalDescription(answer);
    await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });
    wLog('Conectado al emisor.');

    unsubIceV = onSnapshot(collection(db, 'screen_sessions', code, 'hostCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          try { await pcView.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch(e) {}
        }
      });
    });

    unsubOfferV = onSnapshot(sessionRef, (snap) => {
      if (snap.data()?.status === 'ended') {
        wLog('El emisor detuvo la transmisión.');
        wStatus('idle', 'Sesión terminada');
        leaveSession();
      }
    });

    viewCode = code;
    if (joinBlock)  joinBlock.style.display  = 'none';
    if (leaveBlock) leaveBlock.style.display = 'block';

  } catch(err) {
    wLog(`Error: ${err.message}`);
    wStatus('error', `⚠️ ${err.message}`);
    if (pcView) { pcView.close(); pcView = null; }
  }
};

window.leaveSession = function() {
  if (unsubOfferV) { unsubOfferV(); unsubOfferV = null; }
  if (unsubIceV)   { unsubIceV();   unsubIceV   = null; }
  if (pcView)      { pcView.close(); pcView = null; }

  ['remoteVideo','dashRemoteVideo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.srcObject = null;
  });
  ['remotePreview','dashRemotePreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['joinBlock','dashJoinBlock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });
  ['leaveBlock','dashLeaveBlock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['watchStatus','dashWatchStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = 'status-badge idle'; el.innerHTML = '<span class="status-dot"></span>Inactivo'; }
  });
  viewCode = null;
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH GUARD (solo aplica en screen-share.html standalone)
// ─────────────────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => { auth.signOut(); window.location.href = 'index.html'; };

  // Si no hay mainContent en la página, este módulo se usa embebido en el dashboard — no hacer nada más
  if (!document.getElementById('mainContent') && !document.getElementById('accessDenied')) return;

  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    if (data.tv_access === true) {
      document.getElementById('mainContent') && (document.getElementById('mainContent').style.display = 'block');
    } else {
      document.getElementById('accessDenied') && (document.getElementById('accessDenied').style.display = 'block');
    }
  } catch(e) {
    document.getElementById('accessDenied') && (document.getElementById('accessDenied').style.display = 'block');
  }
});

// Exportar para uso en dashboard
export function initDashboardViewer(user) {
  currentUser = user;
}
