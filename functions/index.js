// functions/index.js — Cloud Functions WC2026 Comparsa
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { onRequest }         = require('firebase-functions/v2/https');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');
const axios                 = require('axios');
const xml2js                = require('xml2js');

initializeApp();
const db  = getFirestore();
const fcm = getMessaging();

// TheSportsDB — gratuita, sin key, cubre Mundial 2026
// League ID 4429 = FIFA World Cup
const TSDB = axios.create({
  baseURL: 'https://www.thesportsdb.com/api/v1/json/3',
  timeout: 10000,
});

function calcPoints(home, away, predHome, predAway) {
  if (home === predHome && away === predAway) return 6;
  const matchSign = Math.sign(home - away);
  const predSign  = Math.sign(predHome - predAway);
  if (matchSign === predSign) return 3;
  return 0;
}

// Normaliza nombres de equipos para comparar
// ej: "México" === "Mexico", "USA" === "United States"
const ALIASES = {
  'mexico': ['mexico','méxico'],
  'usa':    ['usa','united states','united states of america','estados unidos'],
  'south korea': ['south korea','corea del sur','korea republic'],
  'czechia': ['czechia','chequia','czech republic'],
  'ivory coast': ['ivory coast','costa de marfil','côte d\'ivoire'],
  'dr congo': ['dr congo','rd congo','congo dr','democratic republic of congo'],
  'england': ['england','inglaterra'],
  'scotland': ['scotland','escocia'],
  'netherlands': ['netherlands','países bajos','holland'],
  'saudi arabia': ['saudi arabia','arabia saudita','saudi'],
  'cape verde': ['cape verde','cabo verde'],
  'bosnia': ['bosnia','bosnia y herzegovina','bosnia and herzegovina'],
  'new zealand': ['new zealand','nueva zelanda'],
};

function normalize(name) {
  const n = (name || '').toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(ALIASES)) {
    if (variants.includes(n)) return canonical;
  }
  return n;
}

function teamsMatch(a, b) {
  return normalize(a) === normalize(b);
}

// =====================================================
// 0. NEWS PROXY — RSS del Mundial sin CORS
// =====================================================
const NEWS_FEEDS = [
  { url: 'https://www.espn.com/espn/rss/soccer/news',       label: 'ESPN' },
  { url: 'https://www.marca.com/rss/futbol/mundial.xml',    label: 'Marca' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', label: 'BBC Sport' },
  { url: 'https://www.football365.com/feed',                label: 'Football365' },
];

exports.newsProxy = onRequest(
  { timeoutSeconds: 20, memory: '256MiB' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    const KEYWORDS = ['world cup','mundial','2026','fifa','wc2026','copa del mundo'];
    function matchesKeyword(item) {
      const text = ((item.title?.[0]||'') + ' ' + (item.description?.[0]||'')).toLowerCase();
      return KEYWORDS.some(k => text.includes(k));
    }
    const parser = new xml2js.Parser({ explicitArray: true, ignoreAttrs: false });
    const items  = [];
    await Promise.allSettled(NEWS_FEEDS.map(async ({ url, label }) => {
      try {
        const r      = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const parsed = await parser.parseStringPromise(r.data);
        const ch     = parsed?.rss?.channel?.[0];
        (ch?.item || []).forEach(item => {
          const enc   = item.enclosure?.[0]?.$;
          const thumb = enc?.url || item['media:thumbnail']?.[0]?.$?.url || item['media:content']?.[0]?.$?.url || null;
          items.push({ title: item.title?.[0]||'', link: item.link?.[0]||'#', source: label, pubDate: item.pubDate?.[0]||'', thumb });
        });
      } catch(e) { console.warn(`[NEWS] ${label}: ${e.message}`); }
    }));
    const filtered = items.filter(matchesKeyword);
    const pool     = filtered.length >= 3 ? filtered : items;
    const seen     = new Set();
    const final    = pool
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .filter(i => { const k = i.title.slice(0,60); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 25);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ ok: true, items: final });
  }
);

// =====================================================
// 1. RECORDATORIO 2h antes
// =====================================================
exports.scheduleMatchReminders = onSchedule('every 60 minutes', async () => {
  const now    = new Date();
  const in2h   = new Date(now.getTime() + 2*60*60*1000);
  const in2h15 = new Date(now.getTime() + 2.25*60*60*1000);
  const snap   = await db.collection('matches')
    .where('kickoff', '>=', in2h).where('kickoff', '<=', in2h15)
    .where('home_score', '==', null).get();
  if (snap.empty) return null;
  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    const membersSnap  = await db.collection('group_members').get();
    const usersSinPred = new Set();
    for (const memberDoc of membersSnap.docs) {
      const { user_uid, group_id } = memberDoc.data();
      const predSnap = await db.collection('predictions').doc(`${group_id}_${matchDoc.id}_${user_uid}`).get();
      if (!predSnap.exists) usersSinPred.add(user_uid);
    }
    if (!usersSinPred.size) continue;
    const tokensSnap = await db.collection('fcm_tokens')
      .where('user_uid', 'in', [...usersSinPred].slice(0, 30)).get();
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (!tokens.length) continue;
    const kickoffStr = m.kickoff.toDate().toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' });
    await fcm.sendEachForMulticast({
      tokens,
      notification: {
        title: '⏰ ¡Faltan 2 horas para pronosticar!',
        body:  `${m.home_flag||'⚽'} ${m.home_team} vs ${m.away_team} ${m.away_flag||'⚽'} — ${kickoffStr}`,
        icon:  'https://worldcup2026-8f27b.web.app/icons/icon-192.png',
      },
      data: { url: 'https://worldcup2026-8f27b.web.app', match_id: matchDoc.id },
      webpush: { fcmOptions: { link: 'https://worldcup2026-8f27b.web.app' } },
    });
  }
  return null;
});

// =====================================================
// 2. RESULTADO CARGADO → notificar usuarios
// =====================================================
exports.onResultLoaded = onDocumentUpdated('matches/{matchId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();
  const resultadoCargado =
    (before.home_score === undefined || before.home_score === null) &&
    after.home_score !== undefined && after.home_score !== null;
  if (!resultadoCargado) return null;
  const m = after; const matchId = event.params.matchId;
  let resultText;
  if (m.home_score > m.away_score)      resultText = `Ganó ${m.home_team} 🏆`;
  else if (m.home_score < m.away_score) resultText = `Ganó ${m.away_team} 🏆`;
  else                                   resultText = 'Empate 🤝';
  const predsSnap = await db.collection('predictions').where('match_id', '==', matchId).get();
  if (predsSnap.empty) return null;
  const userUids = [...new Set(predsSnap.docs.map(d => d.data().user_uid))];
  const allTokens = [];
  for (let i = 0; i < userUids.length; i += 30) {
    const tokSnap = await db.collection('fcm_tokens').where('user_uid', 'in', userUids.slice(i,i+30)).get();
    tokSnap.docs.forEach(d => { if (d.data().token) allTokens.push(d.data().token); });
  }
  if (!allTokens.length) return null;
  for (let i = 0; i < allTokens.length; i += 500) {
    await fcm.sendEachForMulticast({
      tokens: allTokens.slice(i,i+500),
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
// 3. SYNC RESULTADOS cada 5 min — TheSportsDB (gratis)
// =====================================================
exports.syncMatchResults = onSchedule(
  { schedule: 'every 5 minutes', memory: '256MiB', timeoutSeconds: 60 },
  async () => {
    const now    = new Date();
    const from4h = new Date(now.getTime() - 4*60*60*1000);
    const plus1h = new Date(now.getTime() + 60*60*1000);

    // Traer partidos en ventana activa (en juego o recién terminados)
    const snap = await db.collection('matches')
      .where('kickoff', '>=', from4h)
      .where('kickoff', '<=', plus1h)
      .where('finished', '!=', true)
      .get();
    if (snap.empty) return null;

    // Obtener todos los eventos del día de hoy y ayer desde TheSportsDB
    const dates = [...new Set(
      snap.docs.map(d => {
        const ko = d.data().kickoff?.toDate?.() || new Date(d.data().kickoff);
        return ko.toISOString().slice(0, 10);
      })
    )];

    const tsdbEvents = [];
    for (const date of dates) {
      try {
        const r = await TSDB.get(`/eventsday.php?d=${date}&l=FIFA%20World%20Cup`);
        const evs = r.data?.events || [];
        tsdbEvents.push(...evs);
      } catch(e) { console.warn(`[SYNC] TSDB ${date}: ${e.message}`); }
    }
    if (!tsdbEvents.length) { console.log('[SYNC] Sin eventos en TheSportsDB hoy'); return null; }

    for (const doc of snap.docs) {
      const match = doc.data();
      // Buscar el evento correspondiente por nombre de equipos
      const event = tsdbEvents.find(e =>
        teamsMatch(e.strHomeTeam, match.home_team) &&
        teamsMatch(e.strAwayTeam, match.away_team)
      );
      if (!event) continue;

      const homeGoals = event.intHomeScore !== null && event.intHomeScore !== '' ? parseInt(event.intHomeScore) : null;
      const awayGoals = event.intAwayScore !== null && event.intAwayScore !== '' ? parseInt(event.intAwayScore) : null;
      const status    = event.strStatus || '';
      const finished  = status === 'Match Finished' || status === 'FT' || status === 'AOT' || status === 'PEN';

      if (homeGoals === null && awayGoals === null) continue; // aún no empezó

      await doc.ref.update({
        home_score:   homeGoals,
        away_score:   awayGoals,
        match_status: finished ? 'FT' : 'LIVE',
        finished,
        last_synced:  new Date(),
      });
      console.log(`[SYNC] ${match.home_team} ${homeGoals}-${awayGoals} ${match.away_team} (${status})`);

      if (!finished) continue;

      // Calcular puntos de pronósticos
      const predsSnap = await db.collection('predictions').where('match_id', '==', doc.id).get();
      if (predsSnap.empty) continue;
      const batch = db.batch();
      predsSnap.forEach(predDoc => {
        const p = predDoc.data();
        if (p.points_synced) return;
        batch.update(predDoc.ref, {
          points: calcPoints(homeGoals, awayGoals, p.pred_home, p.pred_away),
          points_synced: true,
        });
      });
      await batch.commit();
    }
    return null;
  }
);

// =====================================================
// 4. NOTIFICACIONES DE PAGO
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
        notification: { title: notif.title, body: notif.body||'', icon: 'https://worldcup2026-8f27b.web.app/icons/icon-192.png' },
        data: { url: groupUrl, type: notif.type||'payment', group_id: notif.group_id||'' },
        webpush: { fcmOptions: { link: groupUrl } },
      });
    } catch(err) { console.error(`[PAY-NOTIF] uid=${uid}:`, err.message); }
    return null;
  }
);
