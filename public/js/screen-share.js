/**
 * screen-share.js
 * WebRTC screen sharing usando Firestore como canal de señalización.
 * No requiere servidor extra — usa el Firebase del proyecto.
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

// --- Tabs ---

window.switchTab = function(tab) {
  document.getElementById('tabEmit').style.display  = tab === 'emit'  ? 'block' : 'none';
  document.getElementById('tabWatch').style.display = tab === 'watch' ? 'block' : 'none';
  document.getElementById('tabEmitBtn').classList.toggle('active',  tab === 'emit');
  document.getElementById('tabWatchBtn').classList.toggle('active', tab === 'watch');
};

window.copyCode = function() {
  if (!sessionCode) return;
  navigator.clipboard.writeText(sessionCode).then(() => {
    const btn = document.querySelector('.copy-btn');
    if (btn) { btn.textContent = '✅ Copiado'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800); }
  });
};

// --- EMISOR ---

window.startSharing = async function() {
  try {
    log('emitLog', 'Solicitando acceso al escritorio...');
    setStatus('emitStatus', 'waiting', 'Esperando permiso...');

    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1280 } },
      audio: false
    });

    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('localPreview').style.display = 'block';
    localStream.getVideoTracks()[0].onended = () => stopSharing();

    sessionCode = randomCode();
    document.getElementById('sessionCodeDisplay').textContent = sessionCode;
    document.getElementById('sessionCodeBlock').style.display = 'block';

    const sessionRef = doc(db, 'screen_sessions', sessionCode);
    await setDoc(sessionRef, {
      host_uid:   currentUser.uid,
      created_at: new Date(),
      status:     'waiting'
    });

    pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'screen_sessions', sessionCode, 'hostCandidates'), event.candidate.toJSON());
        log('emitLog', 'ICE candidate enviado.');
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
    log('emitLog', 'Oferta SDP publicada.');
    setStatus('emitStatus', 'waiting', '⏳ Esperando receptor...');

    unsubAnswer = onSnapshot(sessionRef, async (snap) => {
      const data = snap.data();
      if (data?.answer && pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        log('emitLog', 'Answer del receptor aplicada.');
      }
    });

    unsubIce = onSnapshot(collection(db, 'screen_sessions', sessionCode, 'guestCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch(e) {}
        }
      });
    });

    document.getElementById('startShareBtn').disabled = true;
    document.getElementById('stopShareBtn').disabled  = false;

  } catch(err) {
    log('emitLog', `Error: ${err.message}`);
    setStatus('emitStatus', 'error', `⚠️ ${err.message}`);
    stopSharing();
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
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('localPreview').style.display  = 'none';
  document.getElementById('sessionCodeBlock').style.display = 'none';
  document.getElementById('startShareBtn').disabled = false;
  document.getElementById('stopShareBtn').disabled  = true;
  setStatus('emitStatus', 'idle', 'Inactivo');
  log('emitLog', 'Transmisión detenida.');
};

// --- RECEPTOR ---

window.joinSession = async function() {
  const code = (document.getElementById('joinCodeInput').value || '').trim().toUpperCase();
  if (code.length !== 6) { alert('El código debe tener 6 caracteres.'); return; }

  try {
    log('watchLog', `Conectando a sesión ${code}...`);
    setStatus('watchStatus', 'waiting', '⏳ Conectando...');

    const sessionRef = doc(db, 'screen_sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists())              throw new Error('Sesión no encontrada. Verifica el código.');
    if (snap.data().status === 'ended') throw new Error('Esta sesión ya finalizó.');
    if (!snap.data().offer)          throw new Error('El emisor aún no publicó oferta. Espera.');

    pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'screen_sessions', code, 'guestCandidates'), event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      log('watchLog', `Estado: ${s}`);
      if (s === 'connected')                     setStatus('watchStatus', 'active', '🟢 Viendo en vivo');
      if (s === 'disconnected' || s === 'failed') setStatus('watchStatus', 'error',  'Conexión perdida');
    };

    pc.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
      document.getElementById('remotePreview').style.display = 'block';
      log('watchLog', 'Stream remoto recibido.');
    };

    await pc.setRemoteDescription(new RTCSessionDescription(snap.data().offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });
    log('watchLog', 'Answer enviada.');

    unsubIce = onSnapshot(collection(db, 'screen_sessions', code, 'hostCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch(e) {}
        }
      });
    });

    unsubOffer = onSnapshot(sessionRef, (snap) => {
      if (snap.data()?.status === 'ended') {
        log('watchLog', 'El emisor detuvo la transmisión.');
        leaveSession();
      }
    });

    sessionCode = code;
    document.getElementById('joinBlock').style.display  = 'none';
    document.getElementById('leaveBlock').style.display = 'block';

  } catch(err) {
    log('watchLog', `Error: ${err.message}`);
    setStatus('watchStatus', 'error', `⚠️ ${err.message}`);
    if (pc) { pc.close(); pc = null; }
  }
};

window.leaveSession = function() {
  if (unsubOffer) { unsubOffer(); unsubOffer = null; }
  if (unsubIce)   { unsubIce();   unsubIce   = null; }
  if (pc)         { pc.close(); pc = null; }
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('remotePreview').style.display = 'none';
  document.getElementById('joinBlock').style.display  = 'block';
  document.getElementById('leaveBlock').style.display = 'none';
  setStatus('watchStatus', 'idle', 'Inactivo');
  log('watchLog', 'Desconectado.');
  sessionCode = null;
};

// --- AUTH GUARD ---

onAuthStateChanged(auth, async (user) => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => { auth.signOut(); window.location.href = 'index.html'; };

  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    if (data.tv_access === true) {
      document.getElementById('mainContent').style.display = 'block';
    } else {
      document.getElementById('accessDenied').style.display = 'block';
    }
  } catch(e) {
    document.getElementById('accessDenied').style.display = 'block';
  }
});
