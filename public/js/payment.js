// payment.js — Módulo de pagos: QR del admin + comprobante del participante
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

let currentUser = null;
let isAdmin     = false;
let groupData   = null;

// Cache: uid → { name, email }
const userInfoCache = {};
async function getUserInfo(uid) {
  if (userInfoCache[uid]) return userInfoCache[uid];
  let name  = null;
  let email = null;
  try {
    const s = await getDoc(doc(db, 'users', uid));
    if (s.exists()) {
      const d = s.data();
      const candidate = (d.display_name || '').trim() || (d.displayName || '').trim();
      if (candidate) name = candidate;
      if (d.email) email = d.email;
    }
  } catch(_) {}
  if (!name && auth.currentUser?.uid === uid) {
    const authName = (auth.currentUser.displayName || '').trim();
    if (authName) name = authName;
    if (!email && auth.currentUser.email) email = auth.currentUser.email;
  }
  // Si no hay email en Firestore, intentar con auth directamente
  if (!email && auth.currentUser?.uid === uid && auth.currentUser.email) {
    email = auth.currentUser.email;
  }
  name = name || (email ? email.split('@')[0] : 'Sin nombre');
  const info = { name, email: email || null };
  userInfoCache[uid] = info;
  return info;
}
async function getUserName(uid) {
  return (await getUserInfo(uid)).name;
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

const MAX_B64 = 800 * 1024;

async function sendPaymentNotification(uid, { title, body, type }) {
  try {
    await addDoc(collection(db, 'notifications', uid, 'items'), {
      title, body, type: type || 'payment', group_id: GROUP_ID || '', created_at: serverTimestamp(),
    });
  } catch (e) { console.warn('[payment] No se pudo escribir notificación:', e.message); }
}

export async function renderPayment(containerEl) {
  if (!GROUP_ID || !containerEl) return;
  containerEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px 0">Cargando sección de pagos...</div>';

  await new Promise(resolve => onAuthStateChanged(auth, u => { currentUser = u; resolve(); }));
  if (!currentUser) { containerEl.innerHTML = '<p style="color:var(--text-muted)">Debes iniciar sesión.</p>'; return; }

  const [gSnap, myMemberSnap] = await Promise.all([
    getDoc(doc(db, 'groups', GROUP_ID)),
    getDoc(doc(db, 'group_members', `${GROUP_ID}_${currentUser.uid}`))
  ]);
  if (!gSnap.exists()) { containerEl.innerHTML = '<p style="color:var(--text-muted)">Comparsa no encontrada.</p>'; return; }
  groupData = gSnap.data();
  isAdmin   = myMemberSnap.exists() && myMemberSnap.data().role === 'admin';

  const sym = groupData.currency === 'BOB' ? 'Bs.' : '$';
  const fee = groupData.fee || 0;

  const membersSnap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID)));
  const members = [];
  for (const mDoc of membersSnap.docs) {
    const m    = mDoc.data();
    const info = await getUserInfo(m.user_uid);
    members.push({ docId: mDoc.id, uid: m.user_uid, name: info.name, email: info.email, role: m.role, payment: m.payment || {} });
  }

  const myMember  = members.find(m => m.uid === currentUser.uid);
  const myPayment = myMember?.payment || {};
  const qrUrl     = groupData.payment_qr || null;
  const payNotes  = groupData.payment_notes || '';

  const paid    = members.filter(m => m.payment?.status === 'confirmed').length;
  const pending = members.filter(m => m.payment?.status === 'pending').length;
  const none    = members.length - paid - pending;

  containerEl.innerHTML = `
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
    <div style="flex:1;min-width:110px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:1.6rem;font-weight:800;color:#34d399">${paid}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">✅ Confirmados</div>
    </div>
    <div style="flex:1;min-width:110px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:1.6rem;font-weight:800;color:#f59e0b">${pending}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">⏳ En revisión</div>
    </div>
    <div style="flex:1;min-width:110px;background:rgba(148,163,184,0.08);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:1.6rem;font-weight:800;color:var(--text-muted)">${none}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">⬜ Sin pagar</div>
    </div>
  </div>

  <div id="payQrSection" style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:12px">📲 Datos de pago</div>
    ${ qrUrl
      ? `<div style="text-align:center;margin-bottom:12px"><img src="${qrUrl}" alt="QR de pago" style="max-width:220px;width:100%;border-radius:10px;border:1px solid var(--border)" loading="lazy"></div>`
      : '<p style="color:var(--text-muted);font-size:13px;margin-bottom:8px">El administrador aún no ha subido el QR de pago.</p>'
    }
    ${ payNotes ? `<div style="font-size:13px;color:var(--text-muted);white-space:pre-line;border-top:1px solid var(--border);padding-top:10px;margin-top:4px">${escHtml(payNotes)}</div>` : '' }
    ${ fee ? `<div style="font-size:12px;color:var(--primary-light);font-weight:700;margin-top:8px">💰 Cuota: ${sym}${fee}</div>` : '' }
    ${ isAdmin ? `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:8px">⚙️ Configurar datos de pago (solo tú ves esto)</div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Imagen del QR</label>
      <input type="file" id="qrFileInput" accept="image/*" class="form-control mb-2" style="font-size:12px">
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Instrucciones / notas de pago</label>
      <textarea id="payNotesInput" class="form-control mb-2" rows="2" maxlength="300" placeholder="Ej: Transferir a cuenta Tigo Money 7XXXXXXX — poner tu nombre en la referencia" style="font-size:12px;resize:none">${escHtml(payNotes)}</textarea>
      <button id="saveQrBtn" class="btn btn-warning btn-sm" style="font-size:12px;font-weight:700">💾 Guardar QR / instrucciones</button>
      <div id="saveQrMsg" style="font-size:12px;margin-top:6px"></div>
    </div>` : '' }
  </div>

  ${ !isAdmin ? `
  <div id="myPaySection" style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;color:var(--primary-light);margin-bottom:10px">💳 Mi estado de pago</div>
    ${renderMyPayStatus(myPayment, sym, fee)}
  </div>` : '' }

  ${ isAdmin ? `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px">
    <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:12px">👥 Estado de pagos — participantes</div>
    <div id="adminPayList">
      ${members.map(m => renderAdminMemberRow(m, sym, fee)).join('')}
    </div>
  </div>` : '' }
  `;

  attachPaymentListeners(members, sym, fee);
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-BO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch(_) { return iso; }
}

function renderMyPayStatus(pay, sym, fee) {
  if (pay.status === 'confirmed') {
    return `<div style="display:flex;align-items:center;gap:10px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:10px;padding:14px">
      <span style="font-size:2rem">✅</span>
      <div>
        <div style="font-weight:700;color:#34d399">¡Pago confirmado!</div>
        <div style="font-size:12px;color:var(--text-muted)">El administrador verificó tu pago${fee ? ` de ${sym}${fee}` : ''}.${ pay.confirmed_at ? `<br>📅 <em>${fmtDate(pay.confirmed_at)}</em>` : '' }</div>
      </div>
    </div>`;
  }
  if (pay.status === 'pending') {
    return `<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-weight:700;color:#f59e0b">⏳ Comprobante enviado — en revisión</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">El admin confirmará tu pago pronto.</div>
      ${ pay.receipt ? `<img src="${pay.receipt}" alt="Tu comprobante" style="max-width:200px;width:100%;border-radius:8px;margin-top:10px;border:1px solid var(--border)" loading="lazy">` : '' }
    </div>
    <button id="reUploadBtn" class="btn btn-outline-warning btn-sm" style="font-size:12px">🔄 Subir nuevo comprobante</button>`;
  }
  return `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Escanea el QR de arriba${fee ? ` y paga ${sym}${fee}` : ''}, luego sube tu comprobante aquí.</p>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">📸 Comprobante de pago (foto / captura)</label>
    <input type="file" id="receiptFileInput" accept="image/*" class="form-control mb-2" style="font-size:12px">
    <button id="sendReceiptBtn" class="btn btn-success btn-sm w-100" style="font-size:13px;font-weight:700">📤 Enviar comprobante</button>
    <div id="sendReceiptMsg" style="font-size:12px;margin-top:6px"></div>`;
}

function renderAdminMemberRow(m, sym, fee) {
  const pay = m.payment || {};

  // Nombre: si no tiene nombre real, mostrar en cursiva
  const noRealName = !m.name || m.name === 'Sin nombre';
  const nameDisplay = noRealName
    ? `<span style="font-style:italic;color:var(--text-muted)">Sin nombre</span>`
    : `<span>${escHtml(m.name)}</span>`;
  // Email siempre visible debajo del nombre
  const emailLine = m.email
    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">📧 ${escHtml(m.email)}</div>`
    : '';

  let badge, actions = '';
  if (pay.status === 'confirmed') {
    const dateStr = pay.confirmed_at ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px">📅 ${fmtDate(pay.confirmed_at)}</div>` : '';
    badge = '<span style="background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.4);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">✅ Confirmado</span>';
    actions = `${dateStr}<button class="btn btn-sm btn-outline-secondary undo-pay-btn" data-uid="${m.uid}" data-docid="${m.docId}" style="font-size:10px;margin-top:6px;opacity:0.7">↩️ Deshacer pago</button>`;
  } else if (pay.status === 'pending') {
    badge = '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">⏳ En revisión</span>';
    actions = `
      ${ pay.receipt ? `<img src="${pay.receipt}" alt="Comprobante" style="max-width:160px;width:100%;border-radius:8px;margin:8px 0;border:1px solid var(--border);display:block" loading="lazy">` : '' }
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        <button class="btn btn-sm btn-success confirm-pay-btn" data-uid="${m.uid}" data-docid="${m.docId}" style="font-size:11px;font-weight:700">✅ Confirmar pago</button>
        <button class="btn btn-sm btn-outline-danger reject-pay-btn" data-uid="${m.uid}" data-docid="${m.docId}" style="font-size:11px">❌ Rechazar</button>
      </div>`;
  } else {
    badge = '<span style="background:rgba(148,163,184,0.1);color:var(--text-muted);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:11px">⬜ Sin pagar</span>';
    actions = `<button class="btn btn-sm btn-outline-success manual-confirm-btn" data-uid="${m.uid}" data-docid="${m.docId}" style="font-size:11px;margin-top:6px">✅ Marcar como pagado</button>`;
  }
  return `
    <div id="pay-row-${m.uid}" style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;align-items:flex-start">
      <div style="flex:1;min-width:140px">
        <div style="font-weight:600;font-size:0.9rem">${nameDisplay} ${m.role==='admin'?'<span style="font-size:10px;color:var(--gold)">★ Admin</span>':''}</div>
        ${emailLine}
        <div style="margin-top:4px">${badge}</div>
      </div>
      <div>${actions}</div>
    </div>`;
}

function attachPaymentListeners(members, sym, fee) {
  document.getElementById('saveQrBtn')?.addEventListener('click', async () => {
    const file  = document.getElementById('qrFileInput')?.files?.[0];
    const notes = document.getElementById('payNotesInput')?.value.trim();
    const msg   = document.getElementById('saveQrMsg');
    const btn   = document.getElementById('saveQrBtn');
    if (!file && notes === (groupData.payment_notes || '')) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">No hay cambios para guardar.</span>'; return; }
    if (file && file.size > 3 * 1024 * 1024) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ La imagen pesa más de 3 MB.</span>'; return; }
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const updates = { payment_notes: notes || '' };
      if (file) {
        const b64 = await toBase64(file);
        if (b64.length > MAX_B64) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ Imagen muy grande.</span>'; btn.disabled=false;btn.textContent='💾 Guardar QR / instrucciones'; return; }
        updates.payment_qr = b64; groupData.payment_qr = b64;
        const preview = document.querySelector('#payQrSection img[alt="QR de pago"]');
        if (preview) preview.src = b64;
        else {
          const qrDiv = document.getElementById('payQrSection');
          const newImg = document.createElement('img');
          newImg.src = b64; newImg.alt = 'QR de pago';
          newImg.style.cssText = 'max-width:220px;width:100%;border-radius:10px;border:1px solid var(--border);display:block;margin:0 auto 12px';
          qrDiv.insertBefore(newImg, qrDiv.querySelector('[style*="margin-top:16px"]') || qrDiv.firstElementChild.nextElementSibling);
        }
      }
      if (notes !== undefined) groupData.payment_notes = notes;
      await updateDoc(doc(db, 'groups', GROUP_ID), updates);
      if (msg) msg.innerHTML = '<span style="color:#34d399">✅ Guardado.</span>';
    } catch(e) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ Error al guardar.</span>'; }
    finally { btn.disabled = false; btn.textContent = '💾 Guardar QR / instrucciones'; }
  });

  document.getElementById('sendReceiptBtn')?.addEventListener('click', async () => {
    const file = document.getElementById('receiptFileInput')?.files?.[0];
    const msg  = document.getElementById('sendReceiptMsg');
    const btn  = document.getElementById('sendReceiptBtn');
    if (!file) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ Selecciona una imagen primero.</span>'; return; }
    if (file.size > 3 * 1024 * 1024) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ La imagen pesa más de 3 MB.</span>'; return; }
    btn.disabled = true; btn.textContent = 'Subiendo...';
    try {
      const b64 = await toBase64(file);
      if (b64.length > MAX_B64) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ Imagen muy grande.</span>'; btn.disabled=false;btn.textContent='📤 Enviar comprobante'; return; }
      const myDocId = `${GROUP_ID}_${currentUser.uid}`;
      await updateDoc(doc(db, 'group_members', myDocId), { 'payment.status':'pending', 'payment.receipt':b64, 'payment.sent_at':new Date().toISOString() });
      const mySection = document.getElementById('myPaySection');
      if (mySection) mySection.innerHTML = `
        <div style="font-size:13px;font-weight:700;color:var(--primary-light);margin-bottom:10px">💳 Mi estado de pago</div>
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px">
          <div style="font-weight:700;color:#f59e0b">⏳ Comprobante enviado — en revisión</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">El admin confirmará tu pago pronto.</div>
          <img src="${b64}" alt="Tu comprobante" style="max-width:200px;width:100%;border-radius:8px;margin-top:10px;border:1px solid var(--border)" loading="lazy">
        </div>`;
    } catch(e) { if (msg) msg.innerHTML = '<span style="color:#f5a0ac">⚠️ Error al subir.</span>'; btn.disabled=false; btn.textContent='📤 Enviar comprobante'; }
  });

  document.getElementById('reUploadBtn')?.addEventListener('click', () => {
    const mySection = document.getElementById('myPaySection');
    if (mySection) mySection.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--primary-light);margin-bottom:10px">💳 Mi estado de pago</div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">📸 Nuevo comprobante</label>
      <input type="file" id="receiptFileInput" accept="image/*" class="form-control mb-2" style="font-size:12px">
      <button id="sendReceiptBtn" class="btn btn-success btn-sm w-100" style="font-size:13px;font-weight:700">📤 Enviar comprobante</button>
      <div id="sendReceiptMsg" style="font-size:12px;margin-top:6px"></div>`;
    attachPaymentListeners(members, sym, fee);
  });

  document.querySelectorAll('.confirm-pay-btn, .manual-confirm-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid   = btn.dataset.uid;
      const docid = btn.dataset.docid;
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const confirmedAt = new Date().toISOString();
        await updateDoc(doc(db, 'group_members', docid), { 'payment.status':'confirmed', 'payment.confirmed_at':confirmedAt });
        const m = members.find(x => x.uid === uid);
        if (m) m.payment = { ...m.payment, status:'confirmed', confirmed_at:confirmedAt };
        await sendPaymentNotification(uid, { title:'✅ ¡Pago confirmado!', body:`El administrador confirmó tu pago en ${groupData?.name||'tu comparsa'}.`, type:'payment_confirmed' });
        const row = document.getElementById(`pay-row-${uid}`);
        if (row && m) { row.outerHTML = renderAdminMemberRow(m, sym, fee); attachPaymentListeners(members, sym, fee); }
      } catch(e) { btn.disabled=false; btn.textContent=btn.classList.contains('manual-confirm-btn')?'✅ Marcar como pagado':'✅ Confirmar pago'; }
    });
  });

  document.querySelectorAll('.undo-pay-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Deshacer la confirmación de pago?')) return;
      const uid   = btn.dataset.uid;
      const docid = btn.dataset.docid;
      btn.disabled = true; btn.textContent = 'Deshaciendo...';
      try {
        await updateDoc(doc(db, 'group_members', docid), { 'payment.status':'none', 'payment.confirmed_at':null, 'payment.receipt':'' });
        const m = members.find(x => x.uid === uid);
        if (m) m.payment = { status:'none', confirmed_at:null, receipt:'' };
        const row = document.getElementById(`pay-row-${uid}`);
        if (row && m) { row.outerHTML = renderAdminMemberRow(m, sym, fee); attachPaymentListeners(members, sym, fee); }
      } catch(e) { btn.disabled=false; btn.textContent='↩️ Deshacer pago'; }
    });
  });

  document.querySelectorAll('.reject-pay-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Rechazar el comprobante?')) return;
      const uid   = btn.dataset.uid;
      const docid = btn.dataset.docid;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'group_members', docid), { 'payment.status':'rejected', 'payment.receipt':'' });
        const m = members.find(x => x.uid === uid);
        await sendPaymentNotification(uid, { title:'❌ Comprobante rechazado', body:`El administrador rechazó tu comprobante en ${groupData?.name||'tu comparsa'}. Por favor sube uno nuevo.`, type:'payment_rejected' });
        if (m) m.payment = { status:'rejected', receipt:'' };
        const row = document.getElementById(`pay-row-${uid}`);
        if (row && m) { row.outerHTML = renderAdminMemberRow(m, sym, fee); attachPaymentListeners(members, sym, fee); }
      } catch(e) { btn.disabled=false; }
    });
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
