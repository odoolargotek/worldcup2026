// functions/index.js — Cloud Functions WC2026 Comparsa
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { onRequest }         = require('firebase-functions/v2/https');
const { defineSecret }      = require('firebase-functions/params');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');
const axios                 = require('axios');
const xml2js                = require('xml2js');

initializeApp();
const db  = getFirestore();
const fcm = getMessaging();

const API_FOOTBALL_KEY = defineSecret('API_FOOTBALL_KEY');
const WC_LEAGUE_ID = 1;
const WC_SEASON    = 2026;

function apiClient(key) {
  return axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: { 'x-apisports-key': key },
    timeout: 10000,
  });
}

function calcPoints(home, away, predHome, predAway) {
  if (home === predHome && away === predAway) return 6;
  const matchSign = Math.sign(home - away);
  const predSign  = Math.sign(predHome - predAway);
  if (matchSign === predSign) return 3;
  return 0;
}

// =====================================================
// 0. NEWS PROXY — RSS del Mundial sin CORS
//    GET https://<region>-worldcup2026-8f27b.cloudfunctions.net/newsProxy
// =====================================================
const NEWS_FEEDS = [
  'https://www.espn.com/espn/rss/soccer/news',
  'https://www.marca.com/rss/futbol/mundial.xml',
  'https://feeds.bbci.co.uk/sport/football/rss.xml',
  'https://www.football365.com/feed',
];

exports.newsProxy = onRequest({ cors: true }, async (req, res) => {
  const KEYWORDS = ['world cup','mundial','2026','fifa','wc2026','copa del mundo'];

  function matchesKeyword(item) {
    const text = ((item.title?.[0] || '') + ' ' + (item.description?.[0] || '')).toLowerCase();
    return KEYWORDS.some(k => text.includes(k));
  }

  const parser = new xml2js.Parser({ explicitArray: true, ignoreAttrs: false });
  const items  = [];

  await Promise.allSettled(NEWS_FEEDS.map(async (feedUrl) => {
    try {
      const r    = await axios.get(feedUrl, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const parsed = await parser.parseStringPromise(r.data);
      const channel = parsed?.rss?.channel?.[0];
      const source  = channel?.title?.[0] || feedUrl;
      const feedItems = channel?.item || [];
      feedItems.forEach(item => {
        const enclosure = item.enclosure?.[0]?.$;
        const thumb = enclosure?.url || item['media:thumbnail']?.[0]?.$?.url || null;
        items.push({
          title:   item.title?.[0] || '',
          link:    item.link?.[0]  || '#',
          source,
          pubDate: item.pubDate?.[0] || '',
          thumb,
        });
      });
    } catch (_) {}
  }));

  // Filtrar por Mundial 2026; si no hay suficientes, mostrar todo fútbol
  const filtered = items.filter(matchesKeyword);
  const result   = filtered.length >= 3 ? filtered : items;

  // Deduplicar y ordenar
  const seen = new Set();
  const final = result
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .filter(item => {
      const key = item.title.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 25);

  res.set('Cache-Control', 'public, max-age=300'); // cache 5 min
  res.json({ ok: true, items: final });
});

// =====================================================
// 1. RECORDATORIO: 2h antes del primer partido del día
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
  }
  return null;
});

// =====================================================
// 2. RESULTADO CARGADO
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
  return null;
});

// =====================================================
// 3. SYNC RESULTADOS cada 3 min
// =====================================================
exports.syncMatchResults = onSchedule(
  { schedule: 'every 3 minutes', secrets: [API_FOOTBALL_KEY] },
  async () => {
    const key = API_FOOTBALL_KEY.value();
    if (!key) return;

    const api = apiClient(key);
    const now = new Date();
    const from3h  = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const plus10m = new Date(now.getTime() + 10 * 60 * 1000);

    const snap = await db.collection('matches')
      .where('kickoff', '>=', from3h)
      .where('kickoff', '<=', plus10m)
      .where('finished', '!=', true)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const match     = doc.data();
      const fixtureId = match.api_fixture_id;
      if (!fixtureId) continue;

      try {
        const res      = await api.get('/fixtures', { params: { id: fixtureId } });
        const fixture  = res.data?.response?.[0];
        if (!fixture) continue;

        const status    = fixture.fixture.status.short;
        const homeGoals = fixture.goals.home ?? null;
        const awayGoals = fixture.goals.away ?? null;
        const finished  = ['FT', 'AET', 'PEN'].includes(status);

        await doc.ref.update({
          home_score: homeGoals, away_score: awayGoals,
          match_status: status, finished, last_synced: new Date(),
        });

        if (!finished) continue;

        const predsSnap = await db.collection('predictions')
          .where('match_id', '==', doc.id).get();
        if (predsSnap.empty) continue;

        const batch = db.batch();
        predsSnap.forEach(predDoc => {
          const pred = predDoc.data();
          const pts  = calcPoints(homeGoals, awayGoals, pred.pred_home, pred.pred_away);
          batch.update(predDoc.ref, { points: pts, points_synced: true });
        });
        await batch.commit();
      } catch (err) {
        console.error(`[SYNC] Error en fixture ${fixtureId}:`, err.message);
      }
    }
  }
);

// =====================================================
// 4. SEED MATCHES
// =====================================================
exports.seedMatchesFromApi = onRequest(
  { secrets: [API_FOOTBALL_KEY] },
  async (req, res) => {
    if (req.headers['x-seed-token'] !== 'WC2026_SEED_OK')
      return res.status(403).send('Forbidden');

    const key = API_FOOTBALL_KEY.value();
    if (!key) return res.status(500).send('API_FOOTBALL_KEY no configurada');

    const api = apiClient(key);
    try {
      const apiRes   = await api.get('/fixtures', { params: { league: WC_LEAGUE_ID, season: WC_SEASON } });
      const fixtures = apiRes.data?.response;
      if (!fixtures?.length) return res.status(404).send('Sin fixtures');

      let processed = 0;
      for (let i = 0; i < fixtures.length; i += 400) {
        const batch = db.batch();
        fixtures.slice(i, i + 400).forEach(f => {
          const fId = String(f.fixture.id);
          batch.set(db.collection('matches').doc(fId), {
            api_fixture_id: fId,
            home_team: f.teams.home.name, away_team: f.teams.away.name,
            home_flag: f.teams.home.logo, away_flag: f.teams.away.logo,
            kickoff:   new Date(f.fixture.date),
            phase:     f.league.round,
            city:      f.fixture.venue?.city || '',
            stadium:   f.fixture.venue?.name || '',
            home_score: f.goals.home, away_score: f.goals.away,
            match_status: f.fixture.status.short,
            finished: ['FT','AET','PEN'].includes(f.fixture.status.short),
            last_synced: new Date(),
          }, { merge: true });
        });
        await batch.commit();
        processed += Math.min(400, fixtures.length - i);
      }
      return res.status(200).json({ ok: true, fixtures_loaded: processed });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// =====================================================
// 5. NOTIFICACIONES DE PAGO
// =====================================================
exports.onPaymentNotification = onDocumentCreated(
  'notifications/{uid}/items/{notifId}',
  async (event) => {
    const notif = event.data.data();
    const uid   = event.params.uid;
    if (!notif?.title) return null;

    const tokSnap = await db.collection('fcm_tokens').where('user_uid', '==', uid).get();
    const tokens  = tokSnap.docs.map(d => d.data().token).filter(Boolean);
    if (!tokens.length) return null;

    const groupUrl = notif.group_id
      ? `https://worldcup2026-8f27b.web.app/group.html?gid=${notif.group_id}&tab=pagos`
      : 'https://worldcup2026-8f27b.web.app';

    try {
      await fcm.sendEachForMulticast({
        tokens,
        notification: { title: notif.title, body: notif.body || '', icon: 'https://worldcup2026-8f27b.web.app/icons/icon-192.png' },
        data: { url: groupUrl, type: notif.type || 'payment', group_id: notif.group_id || '' },
        webpush: { fcmOptions: { link: groupUrl } },
      });
    } catch (err) {
      console.error(`[PAY-NOTIF] Error uid=${uid}:`, err.message);
    }
    return null;
  }
);
