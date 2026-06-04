// theme.js — Toggle claro/oscuro, persiste en localStorage
(function() {
  const saved = localStorage.getItem('wc2026_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  function updateBtn(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateBtn(saved);
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('wc2026_theme', next);
      updateBtn(next);
    });
  });
})();
