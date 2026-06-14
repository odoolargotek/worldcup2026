// fix-favorites-manual.js
// Aplica correcciones manuales puntuales a los favoritos de un jugador.
// Usa esto cuando el script automático descartó un equipo por conflicto
// pero quieres forzar un valor específico en un grupo.
//
// CÓMO USAR (desde admin.html):
//   import { patchFavorites, cleanPenalties } from './fix-favorites-manual.js';
//   await patchFavorites({ dryRun: true });   // solo muestra
//   await patchFavorites({ dryRun: false });  // aplica
//   await cleanPenalties({ dryRun: true });   // preview penalidades
//   await cleanPenalties({ dryRun: false });  // limpia penalidades

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ─── PARCHES MANUALES ──────────────────────────────────────────────────────
// Fuente: backup firestore-2026-06-07.json — El Bedre
//
// Grupos sin conflicto → restaurados al equipo original del backup
// Grupo H y Grupo I → null (vacíos, que el jugador elija sin penalidad)
// ────────────────────────────────────────────────────────────────────────────
const MANUAL_PATCHES = [
  {
    userId: 'YyGkFKfNLpSHaDgOmj4Kl8PmwPC3',  // El Bedre
    patches: {
      // ── Restauración directa (sin conflicto) ───────────────────────
      'Grupo A': 'México',          // backup Grupo A  → real Grupo A ✅
      'Grupo C': 'Brasil',          // backup Grupo I  → real Grupo C
      'Grupo D': 'Australia',       // backup Grupo K  → real Grupo D
      'Grupo E': 'Ecuador',         // backup Grupo B  → real Grupo E
      'Grupo F': 'Japón',           // backup Grupo E  → real Grupo F
      'Grupo G': 'Nueva Zelanda',   // backup Grupo L  → real Grupo G
      'Grupo K': 'Portugal',        // backup Grupo F  → real Grupo K
      'Grupo L': 'Inglaterra',      // ya aplicado anteriormente ✅

      // ── Con conflicto: se dejan vacíos para que El Bedre elija ───────
      'Grupo H': null,  // Uruguay 🇺🇾 vs España 🇪🇸 → vacío, sin penalidad
      'Grupo I': null,  // Francia 🇫🇷 vs Senegal 🇸🇳 → vacío, sin penalidad
    },
  },
];

// ─── LIMPIEZAS DE PENALIDADES ──────────────────────────────────────────────
// Grupo H y Grupo I quedan vacíos (conflicto sin resolver)
// → se eliminan sus penalidades para que el jugador pueda elegir libremente
const PENALTY_CLEANUPS = [
  {
    userId: 'YyGkFKfNLpSHaDgOmj4Kl8PmwPC3',  // El Bedre
    grupos: ['Grupo H', 'Grupo I'],
  },
];

// ───
const FLAGS = {
  'México':'🇲🇽','Sudáfrica':'🇿🇦','Corea del Sur':'🇰🇷','Chequia':'🇨🇿',
  'Canadá':'🇨🇦','Bosnia y Herzegovina':'🇧🇦','Qatar':'🇶🇦','Suiza':'🇨🇭',
  'Brasil':'🇧🇷','Marruecos':'🇲🇦','Haití':'🇭🇹','Escocia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Turquía':'🇹🇷',
  'Alemania':'🇩🇪','Curazao':'🇨🇼','Costa de Marfil':'🇨🇮','Ecuador':'🇪🇨',
  'Países Bajos':'🇳🇱','Japón':'🇯🇵','Suecia':'🇸🇪','Túnez':'🇹🇳',
  'Bélgica':'🇧🇪','Egipto':'🇪🇬','Irán':'🇮🇷','Nueva Zelanda':'🇳🇿',
  'España':'🇪🇸','Cabo Verde':'🇨🇻','Arabia Saudita':'🇸🇦','Uruguay':'🇺🇾',
  'Francia':'🇫🇷','Senegal':'🇸🇳','Irak':'🇮🇶','Noruega':'🇳🇴',
  'Argentina':'🇦🇷','Argelia':'🇩🇿','Austria':'🇦🇹','Jordania':'🇯🇴',
  'Portugal':'🇵🇹','RD Congo':'🇨🇩','Uzbekistán':'🇺🇿','Colombia':'🇨🇴',
  'Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Panamá':'🇵🇦','Ghana':'🇬🇭','Croacia':'🇭🇷',
};

export async function patchFavorites({ dryRun = true, onLog } = {}) {
  const log = onLog || ((msg, color) => {
    if (color) console.log('%c' + msg, `color:${color}`);
    else        console.log(msg);
  });

  log('━'.repeat(43), '#888');
  log(`📦 patch-favorites  [${dryRun ? 'DRY RUN' : '⚡ APLICANDO'}]`, '#f0c040');
  log('━'.repeat(43), '#888');

  let totalPatched = 0;

  for (const { userId, patches } of MANUAL_PATCHES) {
    const allSnap = await getDocs(collection(db, 'group_members'));
    const userDocs = allSnap.docs.filter(d => d.id.endsWith('_' + userId));

    if (userDocs.length === 0) {
      log(`❌ userId no encontrado: ${userId}`, '#f87171');
      continue;
    }

    for (const snap of userDocs) {
      const data  = snap.data();
      const favs  = { ...(data.favorites || {}) };
      const name  = data.display_name || data.name || snap.id;

      log(`\n👤 ${name}  (${snap.id})`, '#93c5fd');

      for (const [grupo, equipo] of Object.entries(patches)) {
        const prev = favs[grupo] || '(vacío)';
        if (equipo === null) {
          delete favs[grupo];
          log(`  🗑️  ${grupo}: "${prev}" → eliminado (elige libremente)`, '#f5a0ac');
        } else {
          favs[grupo] = equipo;
          log(`  ✏️  ${grupo}: "${prev}" → "${equipo}" ${FLAGS[equipo]||''}`, '#34d399');
        }
      }

      if (!dryRun) {
        await updateDoc(doc(db, 'group_members', snap.id), { favorites: favs });
        totalPatched++;
        log(`  ✅ Guardado en Firestore`, '#6ee7b7');
      } else {
        totalPatched++;
      }
    }
  }

  log('\n' + '━'.repeat(43), '#888');
  log(`📊 Resumen: ${totalPatched} documento(s) ${dryRun ? 'a parchear' : 'parcheados'}`, '#f0c040');
  if (dryRun) log('💡 Pulsa "Aplicar parche" para confirmar', '#93c5fd');
  else        log('🎉 ¡Parche aplicado!', '#34d399');
  log('━'.repeat(43), '#888');

  return { totalPatched };
}

// ─────────────────────────────────────────────────────────────────────────────
// cleanPenalties: elimina penalidades de grupos vacíos (sin equipo elegido)
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanPenalties({ dryRun = true, onLog } = {}) {
  const log = onLog || ((msg, color) => {
    if (color) console.log('%c' + msg, `color:${color}`);
    else        console.log(msg);
  });

  log('━'.repeat(43), '#888');
  log(`🧹 clean-penalties  [${dryRun ? 'DRY RUN' : '⚡ APLICANDO'}]`, '#f0c040');
  log('━'.repeat(43), '#888');

  let totalFixed = 0;

  const allSnap = await getDocs(collection(db, 'group_members'));

  for (const { userId, grupos } of PENALTY_CLEANUPS) {
    const userDocs = allSnap.docs.filter(d => d.id.endsWith('_' + userId));

    if (userDocs.length === 0) {
      log(`❌ userId no encontrado: ${userId}`, '#f87171');
      continue;
    }

    for (const snap of userDocs) {
      const data      = snap.data();
      const name      = data.display_name || data.name || snap.id;
      const favs      = data.favorites   || {};
      const penalties = { ...(data.penalties || {}) };

      log(`\n👤 ${name}  (${snap.id})`, '#93c5fd');

      let changed = false;
      for (const grupo of grupos) {
        const hasFav = !!favs[grupo];
        const hasPen = penalties[grupo] !== undefined && penalties[grupo] !== 0;

        if (!hasFav && hasPen) {
          log(`  🗑️  ${grupo}: penalidad ${penalties[grupo]} pts → eliminada (grupo vacío)`, '#f87171');
          delete penalties[grupo];
          changed = true;
        } else if (!hasFav && !hasPen) {
          log(`  ✅ ${grupo}: sin favorito y sin penalidad (ok)`, '#6ee7b7');
        } else if (hasFav) {
          log(`  ⏭️  ${grupo}: tiene favorito "${favs[grupo]}", no se toca`, '#9ca3af');
        }
      }

      if (changed && !dryRun) {
        await updateDoc(doc(db, 'group_members', snap.id), { penalties });
        totalFixed++;
        log(`  ✅ Guardado en Firestore`, '#6ee7b7');
      } else if (changed) {
        totalFixed++;
      }
    }
  }

  log('\n' + '━'.repeat(43), '#888');
  log(`📊 Resumen: ${totalFixed} documento(s) ${dryRun ? 'a limpiar' : 'limpiados'}`, '#f0c040');
  if (dryRun) log('💡 Pulsa "Limpiar penalidades" para confirmar', '#93c5fd');
  else        log('🎉 ¡Penalidades limpiadas!', '#34d399');
  log('━'.repeat(43), '#888');

  return { totalFixed };
}
