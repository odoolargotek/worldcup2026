// ====================================================
// matches.js — Listar partidos del grupo con estado
// ====================================================
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const params = new URLSearchParams(window.location.search);
const GROUP_ID = params.get('gid');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await renderMatches(user);
  setupTabs();
});

async function renderMatches(user) {
  const container = document.getElementById('matchList');
  if (!container) return;
  const q = query(collection(db, 'matches'), orderBy('kickoff'));
  const snap = await getDocs(q);
  const now = new Date();
  container.innerHTML = '';
  snap.forEach(matchDoc => {
    const m = matchDoc.data();
    const kickoff = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    const isOpen  = kickoff > now && m.home_score === undefined;
    const isDone  = m.home_score !== undefined;
    const stateClass = isDone ? 'match-done' : isOpen ? 'match-open' : 'match-closed';
    const resultBadge = isDone
      ? `<span class="badge bg-warning text-dark">${m.home_score} - ${m.away_score}</span>`
      : isOpen
        ? `<a class="btn btn-sm btn-success" href="predict.html?gid=${GROUP_ID}&mid=${matchDoc.id}">Pronosticar</a>`
        : '<span class="badge bg-secondary">Cerrado</span>';
    const card = document.createElement('div');
    card.className = `card bg-secondary text-light mb-2 p-3 ${stateClass}`;
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${m.home_team} vs ${m.away_team}</strong>
          <div class="text-muted small">${kickoff.toLocaleString('es-BO')} · ${m.phase}</div>
        </div>
        ${resultBadge}
      </div>`;
    container.appendChild(card);
  });
}

function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('rankingTab')?.classList.toggle('d-none', btn.dataset.tab !== 'ranking');
      document.getElementById('matchesTab')?.classList.toggle('d-none', btn.dataset.tab !== 'matches');
    });
  });
}
