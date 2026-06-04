// functions/index.js — Cloud Functions FCM: recordatorio + resultado cargado
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();
const db  = getFirestore();
const fcm = getMessaging();

// =====================================================
// 1. RECORDATORIO: 2h antes del primer partido del día
//    Cron: cada hora en punto
// =====================================================
exports.scheduleMatchReminders = onSchedule('every 60 minutes', async () => {
  const now      = new Date();
  const in2h     = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in2h15   = new Date(now.getTime() + 2.25 * 60 * 60 * 1000);

  // Partidos que empiezan en ~2h y aún no tienen resultado
  const snap = await db.collection('matches')
    .where('kickoff', '>=', in2h)
    .where('kickoff', '<=', in2h15)
    .where('home_score', '==', null)
    .get();

  if (snap.empty) return null;

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();

    // Obtener todos los group_members de las comparsas de este torneo
    const membersSnap = await db.collection('group_members').get();
    const usersSinPred = new Set();

    for (const memberDoc of membersSnap.docs) {
      const { user_uid, group_id } = memberDoc.data();
      const predId   = `${group_id}_${matchDoc.id}_${user_uid}`;
      const predSnap = await db.collection('predictions').doc(predId).get();

      // Solo notificar si NO tiene pronóstico para este partido
      if (!predSnap.exists) usersSinPred.add(user_uid);
    }

    if (usersSinPred.size === 0) continue;

    // Obtener tokens FCM
    const tokensSnap = await db.collection('fcm_tokens')
      .where('user_uid', 'in', [...usersSinPred].slice(0, 30)) // Firestore limit
      .get();

    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (tokens.length === 0) continue;

    const kickoffStr = m.kickoff.toDate().toLocaleTimeString('es-BO', {
      hour: '2-digit', minute: '2-digit'
    });

    await fcm.sendEachForMulticast({
      tokens,
      notification: {
        title: `⏰ ¡Faltan 2 horas para pronosticar!`,
        body:  `${m.home_flag || '⚽'} ${m.home_team} vs ${m.away_team} ${m.away_flag || '⚽'} — ${kickoffStr}`,
        icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
      },
      data: {
        url:      `https://worldcup2026-8f27b.web.app`,
        match_id: matchDoc.id,
      },
      webpush: {
        fcmOptions: { link: 'https://worldcup2026-8f27b.web.app' }
      }
    });

    console.log(`[FCM] Recordatorio enviado para ${m.home_team} vs ${m.away_team} a ${tokens.length} usuarios`);
  }

  return null;
});

// =====================================================
// 2. RESULTADO CARGADO: cuando el admin actualiza
//    home_score de un partido
// =====================================================
exports.onResultLoaded = onDocumentUpdated('matches/{matchId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Solo disparar si se acaba de cargar el resultado (antes no existía)
  const resultadoCargado =
    (before.home_score === undefined || before.home_score === null) &&
    after.home_score !== undefined && after.home_score !== null;

  if (!resultadoCargado) return null;

  const m = after;
  const matchId = event.params.matchId;

  // Determinar resultado textual
  let resultText;
  if (m.home_score > m.away_score)       resultText = `Ganó ${m.home_team} 🏆`;
  else if (m.home_score < m.away_score)  resultText = `Ganó ${m.away_team} 🏆`;
  else                                    resultText = `Empate 🤝`;

  // Encontrar todos los usuarios que tenían pronóstico en este partido
  const predsSnap = await db.collection('predictions')
    .where('match_id', '==', matchId)
    .get();

  if (predsSnap.empty) return null;

  const userUids = [...new Set(predsSnap.docs.map(d => d.data().user_uid))];

  // Obtener tokens en batches de 30 (límite Firestore 'in')
  const allTokens = [];
  for (let i = 0; i < userUids.length; i += 30) {
    const batch    = userUids.slice(i, i + 30);
    const tokSnap  = await db.collection('fcm_tokens')
      .where('user_uid', 'in', batch)
      .get();
    tokSnap.docs.forEach(d => { if (d.data().token) allTokens.push(d.data().token); });
  }

  if (allTokens.length === 0) return null;

  // Enviar en batches de 500 (límite FCM multicast)
  for (let i = 0; i < allTokens.length; i += 500) {
    await fcm.sendEachForMulticast({
      tokens: allTokens.slice(i, i + 500),
      notification: {
        title: `⚽ Resultado: ${m.home_team} ${m.home_score} — ${m.away_score} ${m.away_team}`,
        body:  `${resultText} · ¡Revisa tu puntaje en la comparsa!`,
        icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
      },
      data: {
        url:      `https://worldcup2026-8f27b.web.app`,
        match_id: matchId,
      },
      webpush: {
        fcmOptions: { link: 'https://worldcup2026-8f27b.web.app' }
      }
    });
  }

  console.log(`[FCM] Resultado enviado: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} a ${allTokens.length} usuarios`);
  return null;
});
