/**
 * screen-share.js
 * WebRTC screen sharing con Firestore como señalización.
 * MEJORAS:
 *  - Audio del sistema (getDisplayMedia con audio:true)
 *  - Botón pantalla completa en el video del receptor
 *  - Botón Cast / AirPlay para enviar a TV
 *  - Código generado ANTES de getDisplayMedia
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
let unsubAnswer = null;
let unsubIce    = null;

// ─── UI helpers ───────────────────────────────────────────────────────────────

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

// ─── Tabs (screen-share.html standalone) ─────────────────────────────────────

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

// ─── Pantalla completa ────────────────────────────────────────────────────────
// Funciona con el elemento <video> del receptor

window.toggleFullscreen = function(videoId) {
  const vid = document.getElementById(videoId);
  if (!vid) return;
  if (!document.fullscreenElement) {
    (vid.requestFullscreen || vid.webkitRequestFullscreen || vid.mozRequestFullScreen).call(vid);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
  }
};

// ─── Cast / AirPlay al televisor ─────────────────────────────────────────────
// Chrome: Presentation API (Chromecast / Smart TV)
// Safari: webkitShowPlaybackTargetPicker (AirPlay)

window.castToTV = function(videoId) {
  const vid = document.getElementById(videoId);
  if (!vid) return;

  // AirPlay (Safari / iOS)
  if (vid.webkitShowPlaybackTargetPicker) {
    vid.webkitShowPlaybackTargetPicker();
    return;
  }

  // Chromecast / Presentation API (Chrome)
  if (window.PresentationRequest) {
    // Abre el diálogo de Cast nativo del navegador
    const req = new PresentationRequest([location.href]);
    req.start().catch(() => {});
    return;
  }

  // Fallback: sugerencia al usuario
  alert(
    '📺 Para ver en tu TV:\n\n' +
    '• Chrome: haz clic en el ícono ⋮ → Transmitir...\n' +
    '• Safari: usa el ícono de AirPlay en la barra de dirección\n' +
    '• Android: activa "Transmitir pantalla" desde el panel de notificaciones\n' +
    '• iOS: usa Duplicar pantalla desde el Centro de control'
  );
};

// ─── EMISOR: Compartir pantalla ───────────────────────────────────────────────
// FLUJO:
//   1. Generar código y mostrarlo ← copiar ANTES de que Chrome cambie el foco
//   2. Crear doc en Firestore
//   3. getDisplayMedia con audio ← Chrome abre selector aquí
//   4. RTCPeerConnection, offer, ICE

window.startSharing = async function() {
  const startBtn = document.getElementById('startShareBtn');
  const stopBtn  = document.getElementById('stopShareBtn');

  try {
    setStatus('emitStatus', 'waiting', '⏳ Preparando sesión...');

    // PASO 1 — Código visible antes del selector de Chrome
    sessionCode = randomCode();
    document.querySelectorAll('.session-code-display').forEach(el => el.textContent = sessionCode);
    document.querySelectorAll('.session-code-block').forEach(el => el.style.display = 'block');
    log('emitLog', `Código de sesión: ${sessionCode} — cópialo ahora.`);

    // PASO 2 — Doc en Firestore
    const sessionRef = doc(db, 'screen_sessions', sessionCode);
    await setDoc(sessionRef, { host_uid: currentUser.uid, created_at: new Date(), status: 'waiting' });

    setStatus('emitStatus', 'waiting', '⏳ Elige la ventana a compartir...');
    log('emitLog', 'Selecciona la ventana/pantalla. Activa "Compartir audio" si lo necesitas.');

    // PASO 3 — Captura pantalla + audio del sistema
    // Chrome permite audio al compartir una pestaña o todo el escritorio.
    // El usuario verá la opción "Compartir audio" en el selector del navegador.
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1280 } },
      audio: true   // ← solicita audio del sistema; el usuario puede activarlo/desactivarlo
    });

    const hasAudio = localStream.getAudioTracks().length > 0;
    log('emitLog', hasAudio ? '🔊 Audio del sistema incluido.' : '🔇 Sin audio (no fue habilitado en el selector).');

    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = localStream;
      document.getElementById('localPreview') && (document.getElementById('localPreview').style.display = 'block');
    }
    localStream.getVideoTracks()[0].onended = () => stopSharing();

    // PASO 4 — PeerConnection
    pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'screen_sessions', sessionCode, 'hostCandidates'), event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      log('emitLog', `Estado: ${s}`);
      if (s === 'connected')                     setStatus('emitStatus', 'active', '🟢 Transmitiendo');
      if (s === 'disconnected' || s === 'failed') setStatus('emitStatus', 'error',  'Conexión perdida');
    };

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await updateDoc(sessionRef, { offer: { type: offer.type, sdp: offer.sdp } });
    log('emitLog', 'Oferta publicada. Esperando receptor...');
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
  const lv = document.getElementById('localVideo');
  if (lv) lv.srcObject = null;
  document.getElementById('localPreview') && (document.getElementById('localPreview').style.display = 'none');
  document.querySelectorAll('.session-code-block').forEach(el => el.style.display = 'none');
  document.getElementById('startShareBtn') && (document.getElementById('startShareBtn').disabled = false);
  document.getElementById('stopShareBtn')  && (document.getElementById('stopShareBtn').disabled  = true);
  setStatus('emitStatus', 'idle', 'Inactivo');
  log('emitLog', 'Transmisión detenida.');
};

// ─── RECEPTOR: Ver pantalla ───────────────────────────────────────────────────

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
  const ctrlBar    = document.getElementById('dashVideoControls');

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
      const vid = remoteVid;
      if (vid) vid.srcObject = event.streams[0];
      if (remPrev)  remPrev.style.display  = 'block';
      if (ctrlBar)  ctrlBar.style.display  = 'flex';
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
  const ctrlBar = document.getElementById('dashVideoControls');
  if (ctrlBar) ctrlBar.style.display = 'none';
  viewCode = null;
};

// ─── AUTH GUARD (solo screen-share.html standalone) ───────────────────────────

onAuthStateChanged(auth, async (user) => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => { auth.signOut(); window.location.href = 'index.html'; };

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

export function initDashboardViewer(user) {
  currentUser = user;
}
