// fix-favorites-groups.js
// Corrige los favoritos de jugadores que eligieron equipos ANTES de la
// corrección de grupos — reasigna cada equipo a su grupo real.
//
// Regla de conflicto:
//   Si dos equipos quieren el mismo grupo, gana el que YA estaba en su grupo
//   correcto (no fue movido). Si ambos fueron movidos, gana el primero en orden.
//   El perdedor se descarta (queda ese grupo sin favorito en vez de datos corruptos).
//
// CÓMO USAR (desde admin.html):
//   import { fixFavoritesGroups } from './fix-favorites-groups.js';
//   await fixFavoritesGroups({ dryRun: true });           // solo muestra
//   await fixFavoritesGroups({ dryRun: false });          // aplica a TODOS
//   await fixFavoritesGroups({ userId: 'UID', dryRun: false }); // solo 1

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, writeBatch
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
export async function fixFavoritesGroups({ dryRun = true, userId = null, onLog } = {}) {
  const log = onLog || ((msg, color) => {
    if (color) console.log('%c' + msg, `color:${color}`);
    else        console.log(msg);
  });

  log('━'.repeat(43), '#888');
  log(`🔧 fix-favorites-groups  [${dryRun ? 'DRY RUN' : '⚡ APLICANDO'}]`, '#f0c040');
  log('━'.repeat(43), '#888');

  // Cargar documentos
  let docs;
  if (userId) {
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

    // ¿Tiene al menos un favorito en grupo incorrecto?
    let needsFix = false;
    const seenTeams = new Set();
    for (const [grupoActual, equipo] of Object.entries(favs)) {
      if (!equipo) continue;
      const grupoReal = TEAM_TO_GROUP[equipo];
      if ((grupoReal && grupoReal !== grupoActual) || seenTeams.has(equipo)) {
        needsFix = true; break;
      }
      seenTeams.add(equipo);
    }

    if (!needsFix) { skipped++; continue; }

    log(`\n👤 ${playerName}  (${snap.id})`, '#93c5fd');

    // ───
    // Fase 1: construir lista de candidatos ordenados por prioridad
    // Prioridad: equipo que YA estaba en su grupo correcto > equipo movido
    // ───
    const candidates = []; // { equipo, grupoReal, wasMoved }
    const seenDuplicates = new Set();

    for (const [grupoActual, equipo] of Object.entries(favs)) {
      if (!equipo) continue;

      // Ignorar duplicados exactos de equipo (Portugal elegido dos veces, etc.)
      if (seenDuplicates.has(equipo)) {
        log(`  🗑️  Duplicado ignorado: "${equipo}" (ya procesado)`, '#94a3b8');
        continue;
      }
      seenDuplicates.add(equipo);

      const grupoReal = TEAM_TO_GROUP[equipo];
      if (!grupoReal) {
        log(`  ⚠️  "${equipo}" no reconocido — se conserva en ${grupoActual}`, '#fbbf24');
        candidates.push({ equipo, grupoReal: grupoActual, wasMoved: false });
        continue;
      }

      const wasMoved = grupoActual !== grupoReal;
      candidates.push({ equipo, grupoReal, wasMoved });
    }

    // Ordenar: no-movidos primero (tienen prioridad en conflictos)
    candidates.sort((a, b) => Number(a.wasMoved) - Number(b.wasMoved));

    // ───
    // Fase 2: asignar grupos sin colisiones
    // ───
    const corrected = {};
    const memberConflicts = [];

    for (const { equipo, grupoReal, wasMoved } of candidates) {
      if (corrected[grupoReal] !== undefined) {
        // Conflicto: el grupo ya fue ocupado por equipo de mayor prioridad
        memberConflicts.push({
          grupoReal,
          winner:  corrected[grupoReal],
          loser:   equipo,
          player:  playerName,
          docId:   snap.id,
        });
        log(
          `  ⚠️  CONFLICTO ${grupoReal}: "${corrected[grupoReal]}" gana sobre "${equipo}" — descartado`,
          '#fbbf24'
        );
        continue;
      }
      corrected[grupoReal] = equipo;
      if (wasMoved) {
        log(`  🔄 ${equipo}: → ${grupoReal}`, '#34d399');
      } else {
        log(`  ✅ ${equipo}: ${grupoReal} (ya correcto)`, '#6ee7b7');
      }
    }

    if (memberConflicts.length > 0) allConflicts.push(...memberConflicts);

    checked++;

    if (!dryRun) {
      batch.update(doc(db, 'group_members', snap.id), { favorites: corrected });
      batchCount++;
      fixed++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    } else {
      fixed++;
    }
  }

  if (!dryRun && batchCount > 0) await batch.commit();

  // ─── Resumen ────────────────────────────────────────────────────────
  log('\n' + '━'.repeat(43), '#888');
  log('📊 Resumen:', '#f0c040');
  log(`   👥 Jugadores con errores revisados : ${checked}`, '#e2e8f0');
  log(`   ✅ Jugadores ${dryRun ? 'a corregir' : 'corregidos'}       : ${fixed}`, '#34d399');
  log(`   ⏭️  Sin cambios (ya correctos)       : ${skipped}`, '#94a3b8');

  if (allConflicts.length > 0) {
    log(`\n⚠️  Grupos con conflicto resueltos automáticamente (${allConflicts.length}):`, '#fbbf24');
    allConflicts.forEach(c =>
      log(`   ${c.player} — ${c.grupoReal}: "✅${c.winner}" conservado, "🗑️${c.loser}" descartado`, '#fca5a5')
    );
    log('   (el equipo ganador es el que ya estaba en su grupo correcto o el primero en orden)', '#94a3b8');
  }

  if (dryRun) {
    log('\n💡 Para aplicar, pulsa "Aplicar corrección"', '#93c5fd');
  } else {
    log('\n🎉 ¡Listo! Favoritos corregidos en Firestore.', '#34d399');
  }
  log('━'.repeat(43), '#888');

  return { checked, fixed, skipped, conflicts: allConflicts };
}
