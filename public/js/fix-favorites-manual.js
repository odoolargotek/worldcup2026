// fix-favorites-manual.js
// Aplica correcciones manuales puntuales a los favoritos de un jugador.
// Usa esto cuando el script automático descartó un equipo por conflicto
// pero quieres forzar un valor específico en un grupo.
//
// CÓMO USAR (desde admin.html):
//   import { patchFavorites } from './fix-favorites-manual.js';
//   await patchFavorites({ dryRun: true });   // solo muestra
//   await patchFavorites({ dryRun: false });  // aplica

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ─── PARCHES MANUALES ──────────────────────────────────────────────────────
// Cada entrada: userId (UID de Firebase Auth) + patches (grupo → equipo)
// Para borrar un favorito de un grupo, pon null como valor.
// ────────────────────────────────────────────────────────────
const MANUAL_PATCHES = [
  {
    userId: 'YyGkFKfNLpSHaDgOmj4Kl8PmwPC3',  // El Bedre
    patches: {
      'Grupo K': 'Portugal',    // reemplaza Colombia (descartada por conflicto)
      'Grupo L': 'Inglaterra',  // grupo que quedó vacío (Nueva Zelanda era su placeholder)
    },
  },
  // ─ agrega más jugadores aquí si hace falta ─
  // { userId: 'OTRO_UID', patches: { 'Grupo X': 'Equipo' } },
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
    // Buscar todos los group_members de este usuario
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
          log(`  🗑️  ${grupo}: "${prev}" → eliminado`, '#f87171');
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
