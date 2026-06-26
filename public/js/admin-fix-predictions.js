import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

let analysisData = null;

const btnAnalyze  = document.getElementById('btnAnalyze');
const btnMigrate  = document.getElementById('btnMigrate');
const analyzeResult  = document.getElementById('analyzeResult');
const migrateSection = document.getElementById('migrateSection');
const migrateLog     = document.getElementById('migrateLog');

function log(msg, color = '#94a3b8') {
  migrateLog.style.display = 'block';
  migrateLog.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
  migrateLog.scrollTop = migrateLog.scrollHeight;
}

// El ID correcto tiene formato: groupId_userId_matchId
// Los IDs autogenerados de Firestore son alfanuméricos largos sin guión bajo estructurado
function isStructuredId(id, groupIds, matchIds) {
  // Busca si el ID comienza con algún groupId conocido
  return groupIds.some(gid => id.startsWith(gid + '_')) &&
         matchIds.some(mid => id.endsWith('_' + mid));
}

btnAnalyze.addEventListener('click', async () => {
  btnAnalyze.disabled = true;
  btnAnalyze.textContent = '⏳ Analizando...';
  analyzeResult.innerHTML = '<div style="color:var(--text-muted)">⏳ Cargando datos de Firestore…</div>';

  const [predSnap, groupSnap, memberSnap, matchSnap] = await Promise.all([
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'groups')),
    getDocs(collection(db, 'group_members')),
    getDocs(query(collection(db, 'matches'), orderBy('kickoff'))),
  ]);

  const preds   = predSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const groups  = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const members = memberSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const groupIds = groups.map(g => g.id);
  const matchIds = matches.map(m => m.id);

  // Clasificar predicciones
  const structured   = preds.filter(p => isStructuredId(p.id, groupIds, matchIds));
  const unstructured = preds.filter(p => !isStructuredId(p.id, groupIds, matchIds));

  // Para las no estructuradas, calcular su ID correcto si tienen group_id, user_uid, match_id
  const fixable = [];
  const unfixable = [];

  for (const p of unstructured) {
    if (p.group_id && p.user_uid && p.match_id) {
      const correctId = `${p.group_id}_${p.user_uid}_${p.match_id}`;
      const duplicate = structured.find(s => s.id === correctId);
      fixable.push({ old: p, correctId, duplicate });
    } else {
      unfixable.push(p);
    }
  }

  analysisData = { fixable, unfixable, structured, unstructured, groups, matches, members };

  // Mostrar resumen
  analyzeResult.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:#34d399">${structured.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">Con ID correcto ✅</div>
      </div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:#f59e0b">${unstructured.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">Con ID incorrecto ⚠️</div>
      </div>
      <div style="background:rgba(74,175,212,0.08);border:1px solid rgba(74,175,212,0.25);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:#4aafd4">${fixable.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">Migrables 🔧</div>
      </div>
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:#f87171">${unfixable.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">Sin datos suficientes ❌</div>
      </div>
    </div>

    ${fixable.length > 0 ? `
    <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-weight:800;font-size:13px;margin-bottom:10px;color:#f1f5f9">📋 Pronósticos a migrar:</div>
      ${fixable.map(f => {
        const g = groups.find(g => g.id === f.old.group_id);
        const m = matches.find(m => m.id === f.old.match_id);
        const dupLabel = f.duplicate
          ? `<span style="color:#f59e0b;font-size:11px"> ⚠️ HAY DUPLICADO — se conservará el más reciente</span>`
          : `<span style="color:#34d399;font-size:11px"> ✅ Sin duplicado</span>`;
        return `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px">
          <span style="font-weight:700;color:#a78bfa">${g?.name || f.old.group_id}</span> ·
          <span style="color:#f1f5f9">${f.old.user_uid.substring(0,8)}…</span> ·
          <span style="color:#94a3b8">${m ? m.home_team+' vs '+m.away_team : f.old.match_id.substring(0,12)+'…'}</span>
          → <span style="color:#4aafd4;font-family:monospace;font-size:10px">${f.correctId.substring(0,40)}…</span>
          ${dupLabel}
        </div>`;
      }).join('')}
    </div>` : '<div style="color:#34d399;font-weight:700;padding:12px">✅ No hay pronósticos con ID incorrecto. Todo está limpio.</div>'}

    ${unfixable.length > 0 ? `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px;font-size:12px">
      <div style="font-weight:700;color:#f87171;margin-bottom:6px">❌ ${unfixable.length} pronósticos sin datos suficientes para migrar (sin group_id, user_uid o match_id):</div>
      ${unfixable.map(p => `<div style="color:var(--text-muted);font-family:monospace;font-size:10px">${p.id}</div>`).join('')}
    </div>` : ''}
  `;

  if (fixable.length > 0) {
    migrateSection.style.display = 'block';
  }

  btnAnalyze.disabled = false;
  btnAnalyze.textContent = '🔍 Analizar todos los pronósticos';
});

btnMigrate.addEventListener('click', async () => {
  if (!analysisData || !analysisData.fixable.length) return;

  btnMigrate.disabled = true;
  btnMigrate.textContent = '⏳ Migrando...';
  migrateLog.innerHTML = '';
  migrateLog.style.display = 'block';

  let migrated = 0, deleted = 0, errors = 0;

  for (const item of analysisData.fixable) {
    const { old: oldPred, correctId, duplicate } = item;
    try {
      // Decidir qué datos guardar en el doc correcto
      let dataToSave = { ...oldPred };
      delete dataToSave.id;

      if (duplicate) {
        // Comparar cuál es más reciente
        const oldTs   = oldPred.updated_at?.seconds || oldPred.created_at?.seconds || 0;
        const dupTs   = duplicate.updated_at?.seconds || duplicate.created_at?.seconds || 0;
        if (oldTs > dupTs) {
          // El incorrecto es más reciente — sobreescribir el correcto con sus datos
          log(`🔄 Migrando (más reciente) → ${correctId.substring(0,50)}…`, '#4aafd4');
          await setDoc(doc(db, 'predictions', correctId), dataToSave);
          migrated++;
        } else {
          // El correcto ya es más reciente — solo borrar el incorrecto
          log(`🗑️  Eliminando duplicado viejo → ${oldPred.id.substring(0,50)}…`, '#f59e0b');
        }
        // Borrar el incorrecto en ambos casos
        await deleteDoc(doc(db, 'predictions', oldPred.id));
        deleted++;
      } else {
        // No hay duplicado — mover al ID correcto
        log(`✅ Migrando → ${correctId.substring(0,50)}…`, '#34d399');
        await setDoc(doc(db, 'predictions', correctId), dataToSave);
        await deleteDoc(doc(db, 'predictions', oldPred.id));
        migrated++;
        deleted++;
      }
    } catch(e) {
      log(`❌ Error en ${oldPred.id.substring(0,30)}: ${e.message}`, '#f87171');
      errors++;
    }
  }

  log('', '#94a3b8');
  log(`══════════════════════════════`, '#4aafd4');
  log(`✅ Migración completada`, '#34d399');
  log(`   📦 Documentos migrados: ${migrated}`, '#34d399');
  log(`   🗑️  Documentos eliminados: ${deleted}`, '#f59e0b');
  if (errors) log(`   ❌ Errores: ${errors}`, '#f87171');
  log(``, '#94a3b8');
  log(`Ahora ve al reporte y presiona 🔄 Actualizar para ver los cambios.`, '#a78bfa');

  btnMigrate.disabled = false;
  btnMigrate.textContent = '🔧 Ejecutar migración y limpieza';
  analysisData = null;
});
