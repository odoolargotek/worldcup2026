// fix-favorites-groups.js
// Corrige los favoritos de jugadores que eligieron equipos ANTES de la
// corrección de grupos — reasigna cada equipo a su grupo real.
//
// CÓMO USAR (desde admin.html o la consola del browser con Firebase cargado):
//   import { fixFavoritesGroups } from './fix-favorites-groups.js';
//   await fixFavoritesGroups({ dryRun: true });          // solo muestra cambios
//   await fixFavoritesGroups({ dryRun: false });         // aplica a TODOS
//   await fixFavoritesGroups({ userId: 'UID', dryRun: false }); // solo 1 jugador

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, writeBatch, getDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ─── Mapa oficial Grupo → Equipos (fuente: favorite.js) ──────────────────────
const TEAMS_BY_PHASE = {
  'Grupo A': ['México','Sudáfrica','Corea del Sur','Chequia'],
  'Grupo B': ['Canadá','Bosnia y Herzegovina','Qatar','Suiza'],
  'Grupo C': ['Brasil','Marruecos','Haití','Escocia'],
  'Grupo D': ['USA','Paraguay','Australia','Turquía'],
  'Grupo E': ['Alemania','Curazao','Costa de Marfil','Ecuador'],
  'Grupo F': ['Países Bajos','Japón','Suecia','Túnez'],
  'Grupo G': ['Bélgica','Egipto','Irán','Nueva Zelanda'],
  'Grupo H': ['España','Cabo Verde','Arabia Saudita','Uruguay'],
  'Grupo I': ['Francia','Senegal','Irak','Noruega'],
  'Grupo J': ['Argentina','Argelia','Austria','Jordania'],
  'Grupo K': ['Portugal','RD Congo','Uzbekistán','Colombia'],
  'Grupo L': ['Inglaterra','Panamá','Ghana','Croacia'],
};

// Lookup inverso: "Brasil" → "Grupo C"
const TEAM_TO_GROUP = {};
for (const [grupo, equipos] of Object.entries(TEAMS_BY_PHASE)) {
  for (const equipo of equipos) {
    TEAM_TO_GROUP[equipo] = grupo;
  }
}

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * @param {object}  opts
 * @param {boolean} opts.dryRun   - true = solo muestra, NO escribe (default: true)
 * @param {string}  [opts.userId] - si se pasa, corrige solo ese UID
 * @param {function} [opts.onLog] - callback(msg, color) para UI, si no usa console
 */
export async function fixFavoritesGroups({ dryRun = true, userId = null, onLog } = {}) {
  const log = onLog || ((msg, color) => {
    if (color) console.log('%c' + msg, `color:${color}`);
    else        console.log(msg);
  });

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#888');
  log(`🔧 fix-favorites-groups  [${dryRun ? 'DRY RUN' : '⚡ APLICANDO'}]`, '#f0c040');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#888');

  // Cargar documentos
  let docs;
  if (userId) {
    // Solo buscar docs que contengan ese UID
    const allSnap = await getDocs(collection(db, 'group_members'));
    docs = allSnap.docs.filter(d => d.id.endsWith('_' + userId));
    if (docs.length === 0) {
      log(`❌ No se encontró ningún group_member con userId: ${userId}`, '#f87171');
      return { checked: 0, fixed: 0, skipped: 0, conflicts: [] };
    }
  } else {
    const allSnap = await getDocs(collection(db, 'group_members'));
    docs = allSnap.docs;
  }

  let checked = 0, fixed = 0, skipped = 0;
  const allConflicts = [];
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const snap of docs) {
    const data = snap.data();
    const favs = data.favorites || {};
    const playerName = data.display_name || data.name || snap.id;

    // ¿Tiene al menos un favorito incorrecto?
    let needsFix = false;
    for (const [grupoActual, equipo] of Object.entries(favs)) {
      if (!equipo) continue;
      const grupoReal = TEAM_TO_GROUP[equipo];
      if (grupoReal && grupoReal !== grupoActual) { needsFix = true; break; }
    }

    if (!needsFix) { skipped++; continue; }

    log(`\n👤 ${playerName}  (${snap.id})`, '#93c5fd');

    // Reconstruir favorites con grupos correctos
    const corrected = {};
    const memberConflicts = [];

    for (const [grupoActual, equipo] of Object.entries(favs)) {
      if (!equipo) continue;
      const grupoReal = TEAM_TO_GROUP[equipo];

      if (!grupoReal) {
        log(`  ⚠️  "${equipo}" no reconocido en ${grupoActual} — se conserva en su lugar`, '#fbbf24');
        corrected[grupoActual] = equipo;
        continue;
      }

      if (corrected[grupoReal] !== undefined) {
        // Conflicto: dos equipos quieren el mismo grupo
        memberConflicts.push({
          grupoReal,
          equipo1: corrected[grupoReal],
          equipo2: equipo,
          player: playerName,
          docId: snap.id,
        });
        log(`  🚨 CONFLICTO en ${grupoReal}: "${corrected[grupoReal]}" vs "${equipo}" — se conserva el primero`, '#f87171');
        // Conservamos el primero; el segundo queda en su grupo original
        corrected[grupoActual] = equipo;
        continue;
      }

      corrected[grupoReal] = equipo;

      if (grupoActual !== grupoReal) {
        log(`  🔄 ${equipo}: ${grupoActual} → ${grupoReal}`, '#34d399');
      } else {
        log(`  ✅ ${equipo}: ${grupoActual} (ya correcto)`, '#6ee7b7');
      }
    }

    if (memberConflicts.length > 0) allConflicts.push(...memberConflicts);

    checked++;

    if (!dryRun) {
      batch.update(doc(db, 'group_members', snap.id), { favorites: corrected });
      batchCount++;
      fixed++;

      // Commit cada 400 ops
      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    } else {
      fixed++; // en dry run contamos igual para el resumen
    }
  }

  if (!dryRun && batchCount > 0) await batch.commit();

  // ─── Resumen final ────────────────────────────────────────────
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#888');
  log(`📊 Resumen:`, '#f0c040');
  log(`   👥 Jugadores revisados con errores : ${checked}`, '#e2e8f0');
  log(`   ✅ Jugadores ${dryRun ? 'a corregir' : 'corregidos'}      : ${fixed}`, '#34d399');
  log(`   ⏭️  Sin cambios (ya correctos)      : ${skipped}`, '#94a3b8');
  if (allConflicts.length > 0) {
    log(`\n⚠️  CONFLICTOS que requieren revisión manual (${allConflicts.length}):`, '#fbbf24');
    allConflicts.forEach(c =>
      log(`   ${c.player} — ${c.grupoReal}: "${c.equipo1}" vs "${c.equipo2}"`, '#fca5a5')
    );
  }
  if (dryRun) {
    log('\n💡 Para aplicar los cambios ejecuta con dryRun: false', '#93c5fd');
  } else {
    log('\n🎉 ¡Listo! Favoritos corregidos en Firestore.', '#34d399');
  }
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '#888');

  return { checked, fixed, skipped, conflicts: allConflicts };
}
