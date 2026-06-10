// predictions.js — Guardar pronóstico + countdown de plazo
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { fmtLong } from './time.js';
import { findPerplexitySuggestion, renderPerplexityButton } from './perplexity-suggest.js';

const params   = new URLSearchParams(window.location.search);
const MATCH_ID = params.get('mid');
const GROUP_ID = params.get('gid');

document.getElementById('backLink')?.setAttribute('href', `group.html?gid=${GROUP_ID}`);

let kickoffDate = null;
let countdownInterval = null;

onAuthStateChanged(auth, async (user) => {
  if (!user || !MATCH_ID) return;

  const mSnap = await getDoc(doc(db, 'matches', MATCH_ID));
  if (!mSnap.exists()) return;
  const m = mSnap.data();
  kickoffDate = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);

  document.getElementById('matchPhase').textContent   = m.phase || '';
  document.getElementById('homeFlag').textContent     = m.home_flag || '⚽';
  document.getElementById('awayFlag').textContent     = m.away_flag || '⚽';
  document.getElementById('homeName').textContent     = m.home_team;
  document.getElementById('awayName').textContent     = m.away_team;
  document.getElementById('matchKickoff').textContent = fmtLong(kickoffDate);
  if (m.city) document.getElementById('matchCity').textContent = '📍 ' + m.city;

  startCountdown(kickoffDate);

  // --- Sugerencia Perplexity --- SIEMPRE se carga, antes de cualquier lockForm
  const suggestion = await findPerplexitySuggestion(m.home_team, m.away_team);
  renderPerplexityButton(m.home_team, m.away_team, suggestion);
  // -----------------------------

  const now = new Date();
  if (kickoffDate <= now || (m.home_score !== undefined && m.home_score !== null)) {
    lockForm('Este partido ya no acepta pronósticos.');
    return;
  }

  const predId   = `${GROUP_ID}_${MATCH_ID}_${user.uid}`;
  const predSnap = await getDoc(doc(db, 'predictions', predId));
  if (predSnap.exists()) {
    const p = predSnap.data();
    document.getElementById('homeScore').value = p.home_score;
    document.getElementById('awayScore').value = p.away_score;
    document.getElementById('submitPrediction').textContent = '✏️ Actualizar pronóstico';
  }

  document.getElementById('predictForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hs = parseInt(document.getElementById('homeScore').value);
    const as = parseInt(document.getElementById('awayScore').value);
    if (isNaN(hs) || isNaN(as)) return;

    const nowCheck = new Date();
    if (kickoffDate <= nowCheck) { lockForm('Plazo vencido.'); return; }

    const btn = document.getElementById('submitPrediction');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
      await setDoc(doc(db, 'predictions', predId), {
        group_id:   GROUP_ID,
        match_id:   MATCH_ID,
        user_uid:   user.uid,
        home_score: hs,
        away_score: as,
        created_at: new Date()
      });
      showMsg('✅ ¡Pronóstico guardado!', 'var(--green-light)');
      btn.textContent = '✏️ Actualizar pronóstico';
      btn.disabled = false;
    } catch(err) {
      showMsg('❌ Error: ' + err.message, 'var(--danger)');
      btn.disabled = false;
      btn.textContent = '💾 Guardar pronóstico';
    }
  });
});

function startCountdown(kickoff) {
  const el     = document.getElementById('deadlineCountdown');
  const banner = document.getElementById('deadlineBanner');
  if (!el) return;

  function tick() {
    const now     = new Date();
    const diffMs  = kickoff - now;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = diffMs / 36e5;

    if (diffMs <= 0) {
      el.innerHTML = `<div style="background:rgba(100,100,100,0.2);border:1px solid #475569;border-radius:10px;padding:10px 16px;font-size:0.9rem;color:#94a3b8">
        🔒 El plazo para pronosticar ha vencido
      </div>`;
      banner?.classList.add('d-none');
      lockForm('Plazo vencido.');
      clearInterval(countdownInterval);
      return;
    }

    const days = Math.floor(diffHrs / 24);
    const hrs  = Math.floor(diffHrs % 24);
    const mins = Math.floor(diffMin % 60);
    const secs = diffSec % 60;

    let bgColor, borderColor, textColor, icon, urgencyLabel;
    if (diffMin < 60) {
      bgColor='rgba(239,68,68,0.15)'; borderColor='rgba(239,68,68,0.5)';
      textColor='#fca5a5'; icon='🚨'; urgencyLabel='¡Cierra muy pronto!';
    } else if (diffHrs < 3) {
      bgColor='rgba(239,68,68,0.1)'; borderColor='rgba(239,68,68,0.4)';
      textColor='#fca5a5'; icon='🔴'; urgencyLabel='Cierra en menos de 3 horas';
    } else if (diffHrs < 24) {
      bgColor='rgba(245,158,11,0.12)'; borderColor='rgba(245,158,11,0.4)';
      textColor='var(--gold)'; icon='⚠️'; urgencyLabel='¡Hoy vence el plazo!';
    } else if (days <= 3) {
      bgColor='rgba(59,130,246,0.1)'; borderColor='rgba(59,130,246,0.3)';
      textColor='#93c5fd'; icon='📅'; urgencyLabel=`Cierra en ${days} día${days>1?'s':''}`;
    } else {
      bgColor='rgba(30,41,59,0.5)'; borderColor='var(--border)';
      textColor='var(--text-muted)'; icon='⏳'; urgencyLabel='Tiempo restante';
    }

    if (diffHrs < 24 && banner) {
      banner.classList.remove('d-none');
      banner.innerHTML = `
        <div class="${diffMin<60?'pulse-red':''}" style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:10px 16px;text-align:center;color:${textColor};font-weight:700;font-size:0.9rem">
          ${icon} ${urgencyLabel} — ${diffMin<60 ? `${mins}m ${secs}s` : `${hrs}h ${mins}m`}
        </div>`;
    }

    const timeStr = days > 0
      ? `${days}d ${hrs}h ${mins}m`
      : hrs > 0
        ? `${hrs}h ${mins}m ${secs}s`
        : `${mins}m ${secs}s`;

    el.innerHTML = `
      <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:10px 16px">
        <div style="font-size:10px;color:${textColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${icon} ${urgencyLabel}</div>
        <div style="font-size:1.6rem;font-weight:800;color:${textColor};letter-spacing:2px">${timeStr}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">para pronosticar</div>
      </div>`;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function lockForm(msg) {
  const form = document.getElementById('predictForm');
  const btn  = document.getElementById('submitPrediction');
  if (form) form.style.opacity = '0.4';
  if (btn)  { btn.disabled = true; btn.textContent = '🔒 Plazo vencido'; }
  if (msg)  showMsg('🔒 ' + msg, '#94a3b8');
  clearInterval(countdownInterval);
}

function showMsg(text, color) {
  const el = document.getElementById('predictMsg');
  if (el) el.innerHTML = `<div style="color:${color};font-weight:600">${text}</div>`;
}
