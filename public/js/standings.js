// standings.js
// Fase de Grupos  → puntos pronósticos + favoritos A-L + penalidades
// Eliminatorias   → puntos pronósticos acumulados solamente
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, where, getDoc, doc, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params   = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

// Grupos de fase de grupos (para favoritos)
const PHASES = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

let groupData = null;
const userInfoCache = {};

function sym() {
  return (groupData?.currency === 'BOB') ? 'Bs.' : '$';
}

// true si el grupo aún está en fase de grupos
function isGroupStage() {
  const s = (groupData?.stage || '').toLowerCase();
  return s === '' || s === 'fase de grupos' || s.startsWith('grupo');
}

function getCategory(pts) {
  if (pts >= 150) return { label: '🔥 Leyenda',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' };
  if (pts >= 100) return { label: '🏆 Experto',   color: '#4aafd4', bg: 'rgba(29,144,198,0.15)',  border: 'rgba(29,144,198,0.4)' };
  if (pts >=  60) return { label: '⚽ Competidor', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)' };
  if (pts >=  30) return { label: '🌱 En forma',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' };
  return                  { label: '🐶 Novato',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)' };
}

// ─── MODAL PUNTUACIÓN ───────────────────────────────────────────────────────
function openScoringModal() {
  document.getElementById('scoringModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'scoringModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px 16px;`;

  const favsSection = isGroupStage() ? `
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🏆 Favoritos por grupo</div>
    <div style="background:rgba(29,144,198,0.08);border:1px solid rgba(29,144,198,0.3);border-radius:10px;padding:12px 16px;margin-bottom:18px">
      <div style="font-size:13px;color:var(--text);margin-bottom:6px">Elige un favorito por cada grupo (A–L). Si tu equipo avanza a la siguiente fase, ¡sumas puntos extra!</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <span style="background:rgba(29,144,198,0.15);color:#4aafd4;border:1px solid rgba(29,144,198,0.3);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700">🥇 1° del grupo = más pts</span>
        <span style="background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.3);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700">✅ Pasa de fase = pts extra</span>
      </div>
    </div>` : `
    <div style="background:rgba(29,144,198,0.08);border:1px solid rgba(29,144,198,0.3);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--text)">
      🏆 <strong>Fase eliminatoria:</strong> los puntos se acumulan partido a partido hasta la Final. Solo cuentan pronósticos.
    </div>`;

  modal.innerHTML = `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:420px;position:relative;max-height:90vh;overflow-y:auto">
    <button id="closeScoringModal" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:1.4rem;color:var(--text-muted);cursor:pointer">&times;</button>
    <h5 style="font-weight:800;margin-bottom:4px;color:var(--primary-light)">📊 ¿Cómo se calculan los puntos?</h5>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Cada partido tiene dos formas de sumar puntos:</p>
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🎯 Pronósticos de partido</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700;color:var(--gold)">🎯 Score exacto</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Adivinas el marcador exacto<br><span style="font-style:italic">Ej: pronosticas 2-1 y termina 2-1</span></div></div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--gold)">+6</div>
      </div>
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.3);border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700;color:#34d399">✅ Resultado correcto</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Aciertas quién gana o empate<br><span style="font-style:italic">Ej: pronosticas 1-0 y termina 3-0</span></div></div>
        <div style="font-size:1.6rem;font-weight:800;color:#34d399">+3</div>
      </div>
      <div style="background:rgba(148,163,184,0.06);border:1px solid rgba(148,163,184,0.15);border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700;color:var(--text-muted)">❌ Resultado incorrecto</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">No aciertas el ganador</div></div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--text-muted)">0</div>
      </div>
    </div>
    ${favsSection}
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🔥 Niveles de jugador</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#94a3b8">🐶 Novato</span><span style="color:var(--text-muted)">0 – 29 pts</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#a78bfa">🌱 En forma</span><span style="color:var(--text-muted)">30 – 59 pts</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#34d399">⚽ Competidor</span><span style="color:var(--text-muted)">60 – 99 pts</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#4aafd4">🏆 Experto</span><span style="color:var(--text-muted)">100 – 149 pts</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#f59e0b">🔥 Leyenda</span><span style="color:var(--text-muted)">150+ pts</span></div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('closeScoringModal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function getUserInfo(uid) {
  if (userInfoCache[uid]) return userInfoCache[uid];
  let name = null, email = null;
  try {
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (uSnap.exists()) {
      const d = uSnap.data();
      const candidate = (d.display_name||'').trim() || (d.displayName||'').trim();
      if (candidate) name = candidate;
      if (d.email) email = d.email;
    }
  } catch(_) {}
  if (!name && auth.currentUser?.uid === uid) {
    const authName = (auth.currentUser.displayName||'').trim();
    if (authName) name = authName;
    if (!email && auth.currentUser.email) email = auth.currentUser.email;
  }
  name = name || (email ? email.split('@')[0] : 'Sin nombre');
  const info = { name, email: email || null };
  userInfoCache[uid] = info;
  return info;
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !GROUP_ID) return;
  const gSnap = await getDoc(doc(db, 'groups', GROUP_ID));
  if (!gSnap.exists()) return;
  groupData = gSnap.data();

  const nameEl = document.getElementById('groupNameNav');
  if (nameEl) nameEl.textContent = groupData.name;
  const codeEl = document.getElementById('groupCodeDisplay');
  if (codeEl) codeEl.textContent = groupData.code;
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(groupData.code).then(() => alert('✅ Código copiado: ' + groupData.code));
  });

  const prizeEl = document.getElementById('groupPrize');
  const feeEl   = document.getElementById('groupFee');

  const myMemberSnap = await getDoc(doc(db, 'group_members', `${GROUP_ID}_${user.uid}`));
  const myRole = myMemberSnap.exists() ? myMemberSnap.data().role : null;
  if (myRole === 'admin') renderAdminPanel(user, groupData);

  await renderStandings(user, prizeEl, feeEl);
});

// ─── PANEL ADMIN ────────────────────────────────────────────────────────────
function renderAdminPanel(user, g) {
  const container = document.getElementById('rankingTab');
  if (!container) return;
  const panel = document.createElement('div');
  panel.id = 'adminPanel';
  panel.style.cssText = 'background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px 18px;margin-bottom:16px';
  panel.innerHTML = `
    <div style="font-size:12px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚙️ Panel de administrador</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button id="toggleOpenBtn" class="btn btn-sm ${
        g.is_open === false ? 'btn-outline-success' : 'btn-outline-danger'
      }" style="font-size:12px;font-weight:700">
        ${g.is_open === false ? '🟢 Reabrir inscripciones' : '🔴 Cerrar inscripciones'}
      </button>
      <button id="editGroupBtn" class="btn btn-sm btn-outline-warning" style="font-size:12px;font-weight:700">✏️ Editar configuración</button>
    </div>
    <div id="adminMsg" style="margin-top:8px;font-size:12px"></div>`;
  container.parentNode.insertBefore(panel, container);

  document.getElementById('toggleOpenBtn')?.addEventListener('click', async () => {
    const newState = !(g.is_open === false);
    await updateDoc(doc(db, 'groups', GROUP_ID), { is_open: !newState });
    g.is_open = !newState;
    const btn = document.getElementById('toggleOpenBtn');
    if (btn) {
      btn.textContent = g.is_open === false ? '🟢 Reabrir inscripciones' : '🔴 Cerrar inscripciones';
      btn.className   = `btn btn-sm ${g.is_open === false ? 'btn-outline-success' : 'btn-outline-danger'}`;
    }
    const msg = document.getElementById('adminMsg');
    if (msg) {
      msg.style.color = g.is_open === false ? '#f5a0ac' : '#4aafd4';
      msg.textContent = g.is_open === false ? '🔴 Inscripciones cerradas.' : '🟢 Inscripciones reabiertas.';
    }
  });
  document.getElementById('editGroupBtn')?.addEventListener('click', () => openEditModal(g));
}

// ─── MODAL EDITAR GRUPO ──────────────────────────────────────────────────────
async function openEditModal(g) {
  const membersSnap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', GROUP_ID)));
  const members = [];
  for (const mDoc of membersSnap.docs) {
    const m    = mDoc.data();
    const info = await getUserInfo(m.user_uid);
    members.push({ docId: mDoc.id, uid: m.user_uid, name: info.name, email: info.email, role: m.role });
  }
  document.getElementById('editGroupModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'editGroupModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-start;justify-content:center;padding:20px 16px;overflow-y:auto;`;
  const pct = g.prize_pct || { p1:60, p2:30, p3:10 };
  const existingQR   = g.payment_qr || '';
  const existingInst = g.payment_instructions || '';
  modal.innerHTML = `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:480px;position:relative">
    <button id="closeEditModal" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:1.4rem;color:var(--text-muted);cursor:pointer">×</button>
    <h5 style="font-weight:800;margin-bottom:18px;color:var(--gold)">✏️ Editar comparsa</h5>
    <div style="display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap">
      <button class="edit-tab-btn active" data-etab="general" style="font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:rgba(245,158,11,0.15);color:var(--gold);cursor:pointer">📝 General</button>
      <button class="edit-tab-btn" data-etab="montos" style="font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);color:var(--text-muted);cursor:pointer">💰 Montos</button>
      <button class="edit-tab-btn" data-etab="pago" style="font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);color:var(--text-muted);cursor:pointer">💳 Pago</button>
      <button class="edit-tab-btn" data-etab="participantes" style="font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);color:var(--text-muted);cursor:pointer">👥 Participantes</button>
    </div>
    <div id="etab-general">
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Nombre de la comparsa</label><input type="text" id="editName" class="form-control" value="${escHtml(g.name||'')}" maxlength="50"></div>
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Descripción (opcional)</label><textarea id="editDesc" class="form-control" rows="2" maxlength="200" style="resize:none">${escHtml(g.description||'')}</textarea></div>
    </div>
    <div id="etab-montos" class="d-none">
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Moneda</label><select id="editCurrency" class="form-select"><option value="USD" ${(g.currency||'USD')==='USD'?'selected':''}>USD — Dólar</option><option value="BOB" ${g.currency==='BOB'?'selected':''}>BOB — Boliviano</option></select></div>
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Cuota por participante</label><input type="number" id="editFee" class="form-control" min="0" value="${g.fee||0}"><div style="font-size:11px;color:var(--text-muted);margin-top:4px">Deja en 0 si la comparsa es sin costo.</div></div>
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Premio fijo (solo comparsa cerrada)</label><input type="number" id="editPrize" class="form-control" min="0" value="${g.prize||0}"><div style="font-size:11px;color:var(--text-muted);margin-top:4px">Si es comparsa abierta el pozo se calcula (cuota × participantes).</div></div>
      <div class="mb-1"><label style="font-size:12px;color:var(--text-muted);margin-bottom:6px;display:block">Distribución del premio (%)</label><div style="display:flex;gap:8px;align-items:center"><div style="flex:1;text-align:center"><div style="font-size:11px;color:#f59e0b;margin-bottom:4px">🥇 1°</div><input type="number" id="editP1" class="form-control" min="0" max="100" value="${pct.p1||60}"></div><div style="flex:1;text-align:center"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">🥈 2°</div><input type="number" id="editP2" class="form-control" min="0" max="100" value="${pct.p2||30}"></div><div style="flex:1;text-align:center"><div style="font-size:11px;color:#d97706;margin-bottom:4px">🥉 3°</div><input type="number" id="editP3" class="form-control" min="0" max="100" value="${pct.p3||0}"></div></div><div id="pctError" style="font-size:11px;color:#f5a0ac;margin-top:4px"></div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">Deben sumar 100%.</div></div>
    </div>
    <div id="etab-pago" class="d-none">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Sube el QR de tu método de pago para que los participantes puedan escanearlo.</p>
      <div id="qrPreviewWrap" style="margin-bottom:14px;${existingQR?'':'display:none'}">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">QR actual:</div>
        <div style="display:flex;align-items:flex-start;gap:12px">
          <img id="qrPreviewImg" src="${existingQR}" alt="QR de pago" style="width:120px;height:120px;object-fit:contain;border-radius:10px;border:1px solid var(--border);background:#fff;padding:6px">
          <button id="removeQrBtn" style="background:rgba(201,52,75,0.15);color:#f5a0ac;border:1px solid rgba(201,52,75,0.3);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">🗑️ Quitar QR</button>
        </div>
      </div>
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:6px;display:block">${existingQR?'Reemplazar QR':'Subir QR de pago'}</label><input type="file" id="editQrInput" accept="image/*" class="form-control" style="font-size:12px"><div style="font-size:11px;color:var(--text-muted);margin-top:4px">Formatos: JPG, PNG, WebP. Máx ~600 KB.</div><div id="qrUploadPreview" style="margin-top:10px;display:none"><div style="font-size:11px;color:#34d399;margin-bottom:4px">✅ Nuevo QR seleccionado:</div><img id="qrUploadImg" src="" alt="Preview" style="width:100px;height:100px;object-fit:contain;border-radius:8px;border:1px solid var(--border);background:#fff;padding:4px"></div></div>
      <div class="mb-3"><label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;display:block">Instrucciones de pago (opcional)</label><textarea id="editPayInst" class="form-control" rows="3" maxlength="300" style="resize:none" placeholder="Ej: Transferir a cuenta 7XXXXXXX, poner tu nombre en referencia">${escHtml(existingInst)}</textarea></div>
      <div style="display:flex;justify-content:flex-end"><button id="savePayBtn" class="btn btn-sm btn-success" style="font-weight:700">💾 Guardar pago</button></div>
      <div id="payMsg" style="margin-top:8px;font-size:12px;text-align:right"></div>
    </div>
    <div id="etab-participantes" class="d-none">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${members.length} participante(s). Puedes expulsar a quien necesites.</p>
      <div style="display:flex;flex-direction:column;gap:8px" id="membersList">
        ${members.map(m => {
          const noName  = !m.name || m.name==='Sin nombre';
          const emailLine = m.email ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">📧 ${escHtml(m.email)}</div>` : '';
          return `<div id="member-row-${m.uid}" style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
            <div style="flex:1"><div style="font-weight:600;font-size:0.9rem${noName?';color:var(--text-muted);font-style:italic':''}">${escHtml(m.name)}</div>${emailLine}<div style="font-size:11px;color:var(--text-muted)">${m.role==='admin'?'⭐ Administrador':'Participante'}</div></div>
            ${m.role!=='admin'?`<button onclick="window._kickMember('${m.uid}','${escHtml(m.name)}','${m.docId}')" style="background:rgba(201,52,75,0.15);color:#f5a0ac;border:1px solid rgba(201,52,75,0.3);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Expulsar</button>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end" id="editModalActions">
      <button id="cancelEditBtn" class="btn btn-outline-light btn-sm">Cancelar</button>
      <button id="saveEditBtn" class="btn btn-warning btn-sm" style="font-weight:700">💾 Guardar cambios</button>
    </div>
    <div id="editSaveMsg" style="margin-top:10px;font-size:12px;text-align:right"></div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('closeEditModal')?.addEventListener('click',  () => modal.remove());
  document.getElementById('cancelEditBtn')?.addEventListener('click',   () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target===modal) modal.remove(); });

  document.getElementById('editQrInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 700*1024) { alert('La imagen es demasiado grande. Usa una imagen menor a 600 KB.'); e.target.value=''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => { const w=document.getElementById('qrUploadPreview'); const i=document.getElementById('qrUploadImg'); if(w&&i){i.src=ev.target.result;w.style.display='block';} };
    reader.readAsDataURL(file);
  });
  document.getElementById('removeQrBtn')?.addEventListener('click', async () => {
    if (!confirm('¿Quitar el QR de pago?')) return;
    try { await updateDoc(doc(db,'groups',GROUP_ID),{payment_qr:''}); g.payment_qr=''; document.getElementById('qrPreviewWrap').style.display='none'; document.getElementById('payMsg').innerHTML='<span style="color:#34d399">✅ QR eliminado.</span>'; }
    catch(e) { document.getElementById('payMsg').innerHTML='<span style="color:#f5a0ac">⚠️ Error al quitar el QR.</span>'; }
  });
  document.getElementById('savePayBtn')?.addEventListener('click', async () => {
    const inst=document.getElementById('editPayInst')?.value.trim()||''; const file=document.getElementById('editQrInput')?.files?.[0];
    const payMsg=document.getElementById('payMsg'); const saveBtn=document.getElementById('savePayBtn');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Guardando...';}
    try {
      const updates={payment_instructions:inst};
      if(file){
        const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=(e)=>resolve(e.target.result);r.onerror=reject;r.readAsDataURL(file);});
        updates.payment_qr=base64; g.payment_qr=base64;
        const w=document.getElementById('qrPreviewWrap'); const i=document.getElementById('qrPreviewImg'); if(w&&i){i.src=base64;w.style.display='block';}
        document.getElementById('qrUploadPreview').style.display='none'; document.getElementById('editQrInput').value='';
      }
      await updateDoc(doc(db,'groups',GROUP_ID),updates); g.payment_instructions=inst;
      if(payMsg) payMsg.innerHTML='<span style="color:#34d399">✅ Datos de pago guardados correctamente.</span>';
    } catch(err) { if(payMsg) payMsg.innerHTML='<span style="color:#f5a0ac">⚠️ Error al guardar. Intenta de nuevo.</span>'; }
    finally { if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='💾 Guardar pago';} }
  });

  const ALL_TABS=['general','montos','pago','participantes'];
  modal.querySelectorAll('.edit-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.edit-tab-btn').forEach(b=>{b.style.background='var(--bg)';b.style.color='var(--text-muted)';b.classList.remove('active');});
      btn.style.background='rgba(245,158,11,0.15)'; btn.style.color='var(--gold)'; btn.classList.add('active');
      const tab=btn.dataset.etab;
      ALL_TABS.forEach(t=>document.getElementById(`etab-${t}`)?.classList.toggle('d-none',t!==tab));
      const actions=document.getElementById('editModalActions');
      if(actions) actions.style.display=(tab==='participantes'||tab==='pago')?'none':'flex';
    });
  });
  document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
    const name=document.getElementById('editName')?.value.trim(); const desc=document.getElementById('editDesc')?.value.trim();
    const currency=document.getElementById('editCurrency')?.value; const fee=parseFloat(document.getElementById('editFee')?.value)||0;
    const prize=parseFloat(document.getElementById('editPrize')?.value)||0;
    const p1=parseInt(document.getElementById('editP1')?.value)||0; const p2=parseInt(document.getElementById('editP2')?.value)||0; const p3=parseInt(document.getElementById('editP3')?.value)||0;
    const saveMsg=document.getElementById('editSaveMsg'); const pctErr=document.getElementById('pctError');
    if(!name){if(saveMsg)saveMsg.innerHTML='<span style="color:#f5a0ac">⚠️ El nombre no puede estar vacío</span>';return;}
    if(p1+p2+p3!==100){if(pctErr)pctErr.textContent='⚠️ La distribución debe sumar exactamente 100%';if(saveMsg)saveMsg.innerHTML='';return;}
    if(pctErr) pctErr.textContent='';
    const btn=document.getElementById('saveEditBtn'); if(btn){btn.disabled=true;btn.textContent='Guardando...';}
    try {
      await updateDoc(doc(db,'groups',GROUP_ID),{name,description:desc||'',currency,fee,prize,prize_pct:{p1,p2,p3}});
      Object.assign(g,{name,description:desc,currency,fee,prize,prize_pct:{p1,p2,p3}});
      const nameNav=document.getElementById('groupNameNav'); if(nameNav) nameNav.textContent=name;
      if(saveMsg) saveMsg.innerHTML='<span style="color:#34d399">✅ Guardado correctamente. Recarga para ver todos los cambios.</span>';
    } catch(e) { if(saveMsg) saveMsg.innerHTML='<span style="color:#f5a0ac">⚠️ Error al guardar. Intenta de nuevo.</span>'; }
    finally { if(btn){btn.disabled=false;btn.textContent='💾 Guardar cambios';} }
  });
  window._kickMember = async (uid, name, docId) => {
    if (!confirm(`¿Expulsar a ${name} de la comparsa?`)) return;
    try { await deleteDoc(doc(db,'group_members',docId)); document.getElementById(`member-row-${uid}`)?.remove(); }
    catch(e) { alert('Error al expulsar participante.'); }
  };
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function calcPrize(g, memberCount) {
  if (!g) return 0;
  if (g.type==='open')   return (g.fee||0)*memberCount;
  if (g.type==='closed') return g.prize||0;
  return g.prize||0;
}

function distLabel(g, memberCount) {
  const total=calcPrize(g,memberCount); if(!total) return null;
  const s=sym(); const pct=g.prize_pct||{p1:100,p2:0,p3:0}; const lines=[];
  if(pct.p1) lines.push(`🥇 ${s}${Math.round(total*pct.p1/100)} (${pct.p1}%)`);
  if(pct.p2) lines.push(`🥈 ${s}${Math.round(total*pct.p2/100)} (${pct.p2}%)`);
  if(pct.p3) lines.push(`🥉 ${s}${Math.round(total*pct.p3/100)} (${pct.p3}%)`);
  return lines;
}

function renderMyPointsCard(me, position, total) {
  const el = document.getElementById('myPointsCard'); if (!el) return;
  const cat = getCategory(me.total);
  const nextCat = [{min:150,label:'🔥 Leyenda'},{min:100,label:'🏆 Experto'},{min:60,label:'⚽ Competidor'},{min:30,label:'🌱 En forma'}].find(c=>me.total<c.min);
  const progress = nextCat ? Math.round((me.total/nextCat.min)*100) : 100;
  const favsLine = isGroupStage()
    ? `<div style="font-size:11px;color:var(--text-muted)">·</div><div style="font-size:11px;color:var(--text-muted)"><span style="color:#34d399;font-weight:700">${me.totalFavPts}</span> favs</div>
       ${me.totalPenalty?`<div style="font-size:11px;color:var(--text-muted)">·</div><div style="font-size:11px;color:#f5a0ac"><span style="font-weight:700">-${me.totalPenalty}</span> pen</div>`:''}`
    : '';
  el.innerHTML = `
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Mis puntos</div>
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:8px;margin-top:4px">
      <span style="font-size:2rem;font-weight:800;color:${cat.color};line-height:1">${me.total}</span>
      <span style="font-size:12px;color:var(--text-muted)">pts</span>
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">#${position} de ${total}</span>
    </div>
    <div style="display:inline-block;background:${cat.bg};color:${cat.color};border:1px solid ${cat.border};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;margin-bottom:10px">${cat.label}</div>
    ${nextCat?`<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px"><span>Hacia ${nextCat.label}</span><span>${me.total} / ${nextCat.min} pts</span></div><div style="background:var(--border);border-radius:99px;height:5px;overflow:hidden"><div style="height:100%;width:${progress}%;background:${cat.color};border-radius:99px;transition:width 0.6s ease"></div></div></div>`:`<div style="font-size:11px;color:var(--gold);font-weight:700">🔥 ¡Nivel máximo!</div>`}
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
      <div style="font-size:11px;color:var(--text-muted)"><span style="color:#f59e0b;font-weight:700">${me.exactos}</span> exactos</div>
      <div style="font-size:11px;color:var(--text-muted)">·</div>
      <div style="font-size:11px;color:var(--text-muted)"><span style="color:#4aafd4;font-weight:700">${me.resultados}</span> result.</div>
      ${favsLine}
    </div>`;
}

async function renderStandings(currentUser, prizeEl, feeEl) {
  const rankingTab = document.getElementById('rankingTab'); if (!rankingTab) return;
  const s = sym();
  const groupStage = isGroupStage();

  const membersSnap = await getDocs(query(collection(db,'group_members'), where('group_id','==',GROUP_ID)));
  const predsSnap   = await getDocs(query(collection(db,'predictions'),   where('group_id','==',GROUP_ID)));
  const memberCount = membersSnap.size;
  const totalPrize  = calcPrize(groupData, memberCount);

  if (prizeEl) {
    if (groupData.type==='open') {
      prizeEl.innerHTML = totalPrize ? `<span style="color:var(--primary-light)">💰 Pozo: ${s}${totalPrize}</span>` : '<span style="color:var(--text-muted)">Sin cuota</span>';
    } else {
      prizeEl.textContent = totalPrize ? `${s}${totalPrize}` : 'Sin definir';
    }
  }
  if (feeEl) {
    feeEl.textContent = groupData.fee ? `Cuota: ${s}${groupData.fee} · ${memberCount} participantes` : `${memberCount} participantes`;
  }

  const predsByUser = {};
  predsSnap.forEach(d => { const p=d.data(); if(!predsByUser[p.user_uid]) predsByUser[p.user_uid]=[]; predsByUser[p.user_uid].push(p); });

  const rows = [];
  for (const mDoc of membersSnap.docs) {
    const m    = mDoc.data();
    const info = await getUserInfo(m.user_uid);

    const userPreds = predsByUser[m.user_uid] || [];
    let exactos=0, resultados=0, predPts=0;
    userPreds.forEach(p => { if(p.points===6) exactos++; else if(p.points===3) resultados++; predPts+=p.points||0; });

    if (groupStage) {
      // Fase de grupos: incluir favoritos y penalidades
      const favs         = m.favorites     || {};
      const favsPts      = m.favorites_pts || {};
      const penalties    = m.penalties     || {};
      const totalFavPts  = Object.values(favsPts).reduce((a,b)=>a+b,0);
      const totalPenalty = Object.values(penalties).reduce((a,b)=>a+b,0);
      const chosenCount  = PHASES.filter(ph=>favs[ph]).length;
      const total = totalFavPts + predPts - totalPenalty;
      rows.push({ name:info.name, email:info.email, isMe:m.user_uid===currentUser.uid, favs, favsPts, penalties, totalFavPts, totalPenalty, exactos, resultados, predPts, chosenCount, total });
    } else {
      // Eliminatoria: solo pronósticos
      rows.push({ name:info.name, email:info.email, isMe:m.user_uid===currentUser.uid, exactos, resultados, total:predPts, totalFavPts:0, totalPenalty:0, chosenCount:0, favs:{}, favsPts:{}, penalties:{} });
    }
  }

  rows.sort((a,b) => b.total - a.total);
  const meIndex = rows.findIndex(r=>r.isMe);
  if (meIndex !== -1) renderMyPointsCard(rows[meIndex], meIndex+1, rows.length);

  rankingTab.innerHTML = '';

  const distLines = distLabel(groupData, memberCount);
  if (distLines && distLines.length && totalPrize > 0) {
    const podio = document.createElement('div');
    podio.style.cssText = 'background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(29,144,198,0.05));border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px 18px;margin-bottom:16px';
    podio.innerHTML = `
      <div style="font-size:12px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🏆 Distribución del premio — Pozo: ${s}${totalPrize}${groupData.type==='open'?`<span style="color:var(--text-muted);font-weight:400"> (${s}${groupData.fee||0} × ${memberCount} personas)</span>`:''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${distLines.map(l=>`<div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:8px 14px;font-size:0.88rem;font-weight:700;color:var(--gold)">${l}</div>`).join('')}</div>
      ${rows.length>=1?`<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">Líder actual: <strong style="color:var(--gold)">${rows[0].name}</strong> con ${rows[0].total} pts</div>`:''}`;
    rankingTab.appendChild(podio);
  }

  const medals=['🥇','🥈','🥉'];
  const pct=groupData?.prize_pct||{p1:100,p2:0,p3:0};
  const pctArr=[pct.p1,pct.p2,pct.p3];
  let cardIndex=0;

  rows.forEach((r, i) => {
    const medal   = i<3 ? medals[i] : `<span style="color:var(--text-muted);font-size:0.9rem">${i+1}</span>`;
    const meStyle = r.isMe ? 'border-color:#1D90C6!important;box-shadow:0 0 0 1px #1D90C6' : '';
    const scoringBtnId = `scoringBtn_${cardIndex++}`;
    let prizeChip='';
    if (totalPrize>0 && i<3 && pctArr[i]>0) {
      const amount=Math.round(totalPrize*pctArr[i]/100);
      prizeChip=`<span style="font-size:11px;background:rgba(245,158,11,0.15);color:var(--gold);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:2px 8px;margin-left:6px">💰 ${s}${amount}</span>`;
    }
    const noName  = r.name==='Sin nombre';
    const nameHtml = noName && r.email
      ? `<span title="${escHtml(r.email)}" style="color:var(--text-muted);font-style:italic">Sin nombre</span> <span style="font-size:10px;color:var(--text-muted)">📧 ${escHtml(r.email)}</span>`
      : escHtml(r.name);

    // Desglose según fase
    let desgloseHTML;
    if (groupStage) {
      const favsLines = PHASES.filter(ph=>r.favs[ph]).map(ph => {
        const pts=r.favsPts[ph]||0; const pen=r.penalties[ph]||0;
        return `<div class="ranking-concept" style="font-size:0.8rem"><span style="color:var(--text-muted)">${ph}: <strong style="color:var(--text)">${r.favs[ph]}</strong></span><span><span style="color:var(--primary-light)">+${pts}</span>${pen?`<span style="color:var(--accent)"> -${pen}</span>`:''}</span></div>`;
      }).join('');
      const noFavsMsg = r.chosenCount===0 ? `<div style="color:var(--text-muted);font-size:0.82rem;font-style:italic">Sin favoritos elegidos</div>` : '';
      const penLine   = r.totalPenalty>0 ? `<div class="ranking-concept" style="color:var(--accent);font-weight:600"><span>⚠️ Penalidades</span><span>-${r.totalPenalty} pts</span></div>` : '';
      desgloseHTML = `
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">🏆 Favoritos</div>
        ${favsLines||noFavsMsg}
        <div class="ranking-concept" style="font-weight:700;margin-top:4px"><span>Subtotal favs</span><span style="color:var(--primary-light)">+${r.totalFavPts} pts</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">🎯 Pronósticos</div>
          <button id="${scoringBtnId}" style="background:none;border:1px solid var(--border);border-radius:20px;padding:1px 8px;font-size:10px;color:var(--text-muted);cursor:pointer;line-height:1.6">ℹ️ ¿Cómo se punta?</button>
        </div>
        <div class="ranking-concept"><span>Exactos ×${r.exactos}</span><span style="color:var(--primary-light)">+${r.exactos*6} pts</span></div>
        <div class="ranking-concept"><span>Resultados ×${r.resultados}</span><span style="color:var(--primary-light)">+${r.resultados*3} pts</span></div>
        ${penLine}
        <div style="height:1px;background:var(--border);margin:8px 0"></div>
        <div class="ranking-concept" style="font-weight:700"><span>Total</span><span style="color:var(--gold);font-size:1rem">${r.total} pts</span></div>`;
    } else {
      desgloseHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">🎯 Pronósticos acumulados</div>
          <button id="${scoringBtnId}" style="background:none;border:1px solid var(--border);border-radius:20px;padding:1px 8px;font-size:10px;color:var(--text-muted);cursor:pointer;line-height:1.6">ℹ️ ¿Cómo se punta?</button>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>🎯 Exactos ×${r.exactos}</span><span style="color:var(--gold);font-weight:700">+${r.exactos*6} pts</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>✅ Resultados ×${r.resultados}</span><span style="color:#34d399;font-weight:700">+${r.resultados*3} pts</span></div>
        <div style="height:1px;background:var(--border);margin:8px 0"></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;padding:4px 0"><span>Total</span><span style="color:var(--gold)">${r.total} pts</span></div>`;
    }

    const subtitleLine = groupStage
      ? `🏆 ${r.chosenCount}/12 favs · 🎯 ${r.exactos} exactos · ✅ ${r.resultados} resultados`
      : `🎯 ${r.exactos} exactos · ✅ ${r.resultados} resultados`;

    const card = document.createElement('div');
    card.className = 'mb-3';
    card.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;${meStyle}">
        <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">
          <div style="font-size:1.5rem;min-width:36px;text-align:center">${medal}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:1rem">${nameHtml}${r.isMe?'<span style="color:#4aafd4;font-size:11px;margin-left:6px">(tú)</span>':''}${prizeChip}</div>
            <div style="font-size:12px;color:var(--text-muted)">${subtitleLine}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.8rem;font-weight:800;color:${i===0?'var(--gold)':i===1?'#9ca3af':i===2?'#d97706':'var(--primary-light)'}">${r.total}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">pts</div>
          </div>
        </div>
        <details>
          <summary style="padding:10px 18px;cursor:pointer;font-size:12px;color:var(--text-muted);list-style:none">▼ Ver desglose</summary>
          <div style="padding:4px 18px 12px">${desgloseHTML}</div>
        </details>
      </div>`;
    rankingTab.appendChild(card);
    card.querySelector(`#${scoringBtnId}`)?.addEventListener('click', (e) => { e.stopPropagation(); openScoringModal(); });
  });

  if (rows.length===0) {
    rankingTab.innerHTML += '<p style="color:var(--text-muted);text-align:center;padding:40px 0">Aún no hay participantes.</p>';
  }
}
