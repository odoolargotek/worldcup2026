// functions/index.js — Cloud Functions WC2026 Comparsa
// Módulos: FCM recordatorios, resultado cargado, sync API-Football, seed matches, notificaciones de pago

const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { onRequest }         = require('firebase-functions/v2/https');
const { defineSecret }      = require('firebase-functions/params');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');
const axios                 = require('axios');

initializeApp();
const db  = getFirestore();
const fcm = getMessaging();

// ─────────────────────────────────────────────────────────
// SECRET: guarda la key con:
//   firebase functions:secrets:set API_FOOTBALL_KEY
// ─────────────────────────────────────────────────────────
const API_FOOTBALL_KEY = defineSecret('API_FOOTBALL_KEY');

// ID del Mundial 2026 en API-Football (league=1, season=2026)
const WC_LEAGUE_ID = 1;
const WC_SEASON    = 2026;

// ─────────────────────────────────────────────────────────
// HELPER: cliente Axios para API-Football v3
// ─────────────────────────────────────────────────────────
function apiClient(key) {
  return axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: { 'x-apisports-key': key },
    timeout: 10000,
  });
}

// ─────────────────────────────────────────────────────────
// HELPER: calcular puntos de un pronóstico
//   Score exacto  → 6 pts
//   Resultado OK  → 3 pts
//   Fallo         → 0 pts
// ─────────────────────────────────────────────────────────
function calcPoints(home, away, predHome, predAway) {
  if (home === predHome && away === predAway) return 6;
  const matchSign = Math.sign(home - away);
  const predSign  = Math.sign(predHome - predAway);
  if (matchSign === predSign) return 3;
  return 0;
}

// =====================================================
// 1. RECORDATORIO: 2h antes del primer partido del día
//    Cron: cada hora en punto
// =====================================================
exports.scheduleMatchReminders = onSchedule('every 60 minutes', async () => {
  const now    = new Date();
  const in2h   = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in2h15 = new Date(now.getTime() + 2.25 * 60 * 60 * 1000);

  const snap = await db.collection('matches')
    .where('kickoff', '>=', in2h)
    .where('kickoff', '<=', in2h15)
    .where('home_score', '==', null)
    .get();

  if (snap.empty) return null;

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    const membersSnap = await db.collection('group_members').get();
    const usersSinPred = new Set();

    for (const memberDoc of membersSnap.docs) {
      const { user_uid, group_id } = memberDoc.data();
      const predId   = `${group_id}_${matchDoc.id}_${user_uid}`;
      const predSnap = await db.collection('predictions').doc(predId).get();
      if (!predSnap.exists) usersSinPred.add(user_uid);
    }

    if (usersSinPred.size === 0) continue;

    const tokensSnap = await db.collection('fcm_tokens')
      .where('user_uid', 'in', [...usersSinPred].slice(0, 30))
      .get();

    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (tokens.length === 0) continue;

    const kickoffStr = m.kickoff.toDate().toLocaleTimeString('es-BO', {
      hour: '2-digit', minute: '2-digit',
    });

    await fcm.sendEachForMulticast({
      tokens,
      notification: {
        title: '⏰ ¡Faltan 2 horas para pronosticar!',
        body:  `${m.home_flag || '⚽'} ${m.home_team} vs ${m.away_team} ${m.away_flag || '⚽'} — ${kickoffStr}`,
        icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
      },
      data: { url: 'https://worldcup2026-8f27b.web.app', match_id: matchDoc.id },
      webpush: { fcmOptions: { link: 'https://worldcup2026-8f27b.web.app' } },
    });

    console.log(`[FCM] Recordatorio: ${m.home_team} vs ${m.away_team} → ${tokens.length} usuarios`);
  }
  return null;
});

// =====================================================
// 2. RESULTADO CARGADO: cuando admin actualiza home_score
// =====================================================
exports.onResultLoaded = onDocumentUpdated('matches/{matchId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  const resultadoCargado =
    (before.home_score === undefined || before.home_score === null) &&
    after.home_score !== undefined && after.home_score !== null;

  if (!resultadoCargado) return null;

  const m       = after;
  const matchId = event.params.matchId;

  let resultText;
  if (m.home_score > m.away_score)      resultText = `Ganó ${m.home_team} 🏆`;
  else if (m.home_score < m.away_score) resultText = `Ganó ${m.away_team} 🏆`;
  else                                   resultText = 'Empate 🤝';

  const predsSnap = await db.collection('predictions')
    .where('match_id', '==', matchId)
    .get();

  if (predsSnap.empty) return null;

  const userUids  = [...new Set(predsSnap.docs.map(d => d.data().user_uid))];
  const allTokens = [];

  for (let i = 0; i < userUids.length; i += 30) {
    const tokSnap = await db.collection('fcm_tokens')
      .where('user_uid', 'in', userUids.slice(i, i + 30))
      .get();
    tokSnap.docs.forEach(d => { if (d.data().token) allTokens.push(d.data().token); });
  }

  if (allTokens.length === 0) return null;

  for (let i = 0; i < allTokens.length; i += 500) {
    await fcm.sendEachForMulticast({
      tokens: allTokens.slice(i, i + 500),
      notification: {
        title: `⚽ Resultado: ${m.home_team} ${m.home_score} — ${m.away_score} ${m.away_team}`,
        body:  `${resultText} · ¡Revisa tu puntaje en la comparsa!`,
        icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
      },
      data: { url: 'https://worldcup2026-8f27b.web.app', match_id: matchId },
      webpush: { fcmOptions: { link: 'https://worldcup2026-8f27b.web.app' } },
    });
  }

  console.log(`[FCM] Resultado: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} → ${allTokens.length} usuarios`);
  return null;
});

// =====================================================
// 3. SYNC RESULTADOS: cron cada 3 minutos (días de
//    partido). Actualiza home_score/away_score desde
//    API-Football y recalcula puntos de pronósticos.
// =====================================================
exports.syncMatchResults = onSchedule(
  { schedule: 'every 3 minutes', secrets: [API_FOOTBALL_KEY] },
  async () => {
    const key = API_FOOTBALL_KEY.value();
    if (!key) { console.warn('[SYNC] API_FOOTBALL_KEY no configurada'); return; }

    const api = apiClient(key);
    const now = new Date();

    // Ventana: partidos entre hace 3h y en 10 min (en curso o recién terminados)
    const from3h   = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const plus10m  = new Date(now.getTime() + 10 * 60 * 1000);

    const snap = await db.collection('matches')
      .where('kickoff', '>=', from3h)
      .where('kickoff', '<=', plus10m)
      .where('finished', '!=', true)
      .get();

    if (snap.empty) { console.log('[SYNC] Sin partidos activos en ventana'); return; }
    console.log(`[SYNC] Partidos a revisar: ${snap.size}`);

    for (const doc of snap.docs) {
      const match      = doc.data();
      const fixtureId  = match.api_fixture_id;
      if (!fixtureId) { console.warn(`[SYNC] ${doc.id} sin api_fixture_id, saltando`); continue; }

      try {
        const res     = await api.get('/fixtures', { params: { id: fixtureId } });
        const fixture = res.data?.response?.[0];
        if (!fixture) continue;

        const status   = fixture.fixture.status.short; // NS, 1H, HT, 2H, ET, PEN, FT, AET
        const homeGoals = fixture.goals.home ?? null;
        const awayGoals = fixture.goals.away ?? null;
        const finished  = ['FT', 'AET', 'PEN'].includes(status);

        // Actualizar marcador en Firestore
        await doc.ref.update({
          home_score: homeGoals,
          away_score: awayGoals,
          match_status: status,
          finished: finished,
          last_synced: new Date(),
        });

        console.log(`[SYNC] ${match.home_team} ${homeGoals}-${awayGoals} ${match.away_team} [${status}]`);

        // Solo recalcular puntos cuando el partido terminó
        if (!finished) continue;

        // Leer pronósticos de este partido
        const predsSnap = await db.collection('predictions')
          .where('match_id', '==', doc.id)
          .get();

        if (predsSnap.empty) continue;

        const batch = db.batch();
        predsSnap.forEach(predDoc => {
          const pred = predDoc.data();
          const pts  = calcPoints(homeGoals, awayGoals, pred.pred_home, pred.pred_away);
          batch.update(predDoc.ref, {
            points:        pts,
            points_synced: true,
          });
        });
        await batch.commit();
        console.log(`[SYNC] Puntos recalculados para ${predsSnap.size} pronósticos de ${doc.id}`);

      } catch (err) {
        console.error(`[SYNC] Error en fixture ${fixtureId}:`, err.message);
      }
    }
  }
);

// =====================================================
// 4. SEED MATCHES: HTTP endpoint para cargar/actualizar
//    el calendario del Mundial 2026 desde API-Football
//    Llamar UNA sola vez:
//      POST https://<region>-worldcup2026-8f27b.cloudfunctions.net/seedMatchesFromApi
//    Requiere header: x-seed-token: <valor de SEED_SECRET>
// =====================================================
exports.seedMatchesFromApi = onRequest(
  { secrets: [API_FOOTBALL_KEY] },
  async (req, res) => {
    // Protección mínima contra llamadas accidentales
    const seedToken = req.headers['x-seed-token'];
    if (seedToken !== 'WC2026_SEED_OK') {
      return res.status(403).send('Forbidden: header x-seed-token inválido');
    }

    const key = API_FOOTBALL_KEY.value();
    if (!key) return res.status(500).send('API_FOOTBALL_KEY no configurada');

    const api = apiClient(key);

    try {
      // Traer todos los fixtures del Mundial 2026
      const apiRes = await api.get('/fixtures', {
        params: { league: WC_LEAGUE_ID, season: WC_SEASON },
      });

      const fixtures = apiRes.data?.response;
      if (!fixtures || fixtures.length === 0) {
        return res.status(404).send('Sin fixtures retornados por la API');
      }

      const batchSize = 400; // Firestore batch limit ~500
      let processed = 0;

      for (let i = 0; i < fixtures.length; i += batchSize) {
        const chunk   = fixtures.slice(i, i + batchSize);
        const batch   = db.batch();

        chunk.forEach(f => {
          const fId    = String(f.fixture.id);
          const docRef = db.collection('matches').doc(fId);

          // Mapeo al esquema de tu colección matches
          batch.set(docRef, {
            api_fixture_id: fId,
            home_team:      f.teams.home.name,
            away_team:      f.teams.away.name,
            home_flag:      f.teams.home.logo,   // URL del logo/bandera
            away_flag:      f.teams.away.logo,
            kickoff:        new Date(f.fixture.date), // Firestore convierte a Timestamp
            phase:          f.league.round,
            city:           f.fixture.venue?.city || '',
            stadium:        f.fixture.venue?.name || '',
            home_score:     f.goals.home,         // null si no ha jugado
            away_score:     f.goals.away,
            match_status:   f.fixture.status.short,
            finished:       ['FT', 'AET', 'PEN'].includes(f.fixture.status.short),
            last_synced:    new Date(),
          }, { merge: true }); // merge: no sobreescribe pronósticos si ya existen
        });

        await batch.commit();
        processed += chunk.length;
      }

      console.log(`[SEED] ${processed} fixtures cargados en Firestore`);
      return res.status(200).json({
        ok: true,
        fixtures_loaded: processed,
        message: `${processed} partidos cargados/actualizados en matches`,
      });

    } catch (err) {
      console.error('[SEED] Error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// =====================================================
// 5. NOTIFICACIONES DE PAGO
//    Trigger: notifications/{uid}/items/{notifId} onCreate
//    Escrito por payment.js al confirmar o rechazar pago.
//    Envía FCM push al usuario afectado.
// =====================================================
exports.onPaymentNotification = onDocumentCreated(
  'notifications/{uid}/items/{notifId}',
  async (event) => {
    const notif = event.data.data();
    const uid   = event.params.uid;

    if (!notif || !notif.title) {
      console.warn(`[PAY-NOTIF] Doc vacío para uid=${uid}`);
      return null;
    }

    // Buscar FCM tokens del usuario
    const tokSnap = await db.collection('fcm_tokens')
      .where('user_uid', '==', uid)
      .get();

    const tokens = tokSnap.docs.map(d => d.data().token).filter(Boolean);
    if (tokens.length === 0) {
      console.log(`[PAY-NOTIF] Sin tokens FCM para uid=${uid}`);
      return null;
    }

    const groupUrl = notif.group_id
      ? `https://worldcup2026-8f27b.web.app/group.html?gid=${notif.group_id}&tab=pagos`
      : 'https://worldcup2026-8f27b.web.app';

    try {
      const result = await fcm.sendEachForMulticast({
        tokens,
        notification: {
          title: notif.title,
          body:  notif.body || '',
          icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
        },
        data: {
          url:      groupUrl,
          type:     notif.type || 'payment',
          group_id: notif.group_id || '',
        },
        webpush: { fcmOptions: { link: groupUrl } },
      });
      console.log(`[PAY-NOTIF] uid=${uid} → ${result.successCount}/${tokens.length} enviados`);
    } catch (err) {
      console.error(`[PAY-NOTIF] Error enviando a uid=${uid}:`, err.message);
    }

    return null;
  }
);
