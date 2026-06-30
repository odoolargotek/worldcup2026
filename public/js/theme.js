// theme.js — Toggle claro/oscuro + botón de idioma, persiste en localStorage
(function() {
  const saved = localStorage.getItem('wc2026_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  function updateThemeBtn(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    // Usa i18n si está disponible, si no usa texto fijo
    if (window.t) {
      btn.textContent = theme === 'light' ? window.t('nav.dark') : window.t('nav.light');
    } else {
      btn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateThemeBtn(saved);
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('wc2026_theme', next);
      updateThemeBtn(next);
    });
  });

  // Re-actualiza el texto del botón de tema cuando cambia el idioma
  document.addEventListener('langchange', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeBtn(current);
  });
})();
