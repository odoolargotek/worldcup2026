// i18n.js — Sistema de internacionalización ES/EN
// Persiste idioma en localStorage. Clave: 'wc2026_lang'
// Uso en HTML: <span data-i18n="key"></span>
// Uso en JS:   t('key') o t('key', { var: value })

(function() {

  // ─── TRADUCCIONES ────────────────────────────────────────────────────────────
  const translations = {
    es: {
      // ── NAV / HEADER ──
      'nav.dashboard':   'Mis Grupos',
      'nav.matches':     'Partidos',
      'nav.standings':   'Ranking',
      'nav.groups':      'Grupos',
      'nav.rules':       'Reglas',
      'nav.news':        'Noticias',
      'nav.profile':     'Perfil',
      'nav.logout':      'Cerrar sesión',
      'nav.login':       'Iniciar sesión',
      'nav.dark':        '☀️ Claro',
      'nav.light':       '🌙 Oscuro',
      'nav.lang_es':     '🇧🇴 ES',
      'nav.lang_en':     '🇺🇸 EN',

      // ── INDEX / AUTH ──
      'auth.title':              '⚽ Polla Mundialera',
      'auth.subtitle':           'Mundial 2026',
      'auth.tab.login':          'Iniciar sesión',
      'auth.tab.register':       'Registrarse',
      'auth.email':              'Correo electrónico',
      'auth.password':           'Contraseña',
      'auth.display_name':       'Nombre o apodo',
      'auth.btn.login':          'Ingresar',
      'auth.btn.register':       'Crear cuenta',
      'auth.forgot':             '¿Olvidaste tu contraseña?',
      'auth.recover':            'Recuperar',
      'auth.back_login':         'Volver al login',
      'auth.recover_sent':       'Te enviamos un correo de recuperación.',
      'auth.error.invalid':      'Correo o contraseña incorrectos.',
      'auth.error.email_used':   'Este correo ya está registrado.',
      'auth.error.weak_pass':    'La contraseña es muy corta (mínimo 6 caracteres).',

      // ── DASHBOARD ──
      'dash.welcome':            '¡Bienvenido!',
      'dash.my_groups':          'Mis comparsas',
      'dash.create_group':       'Crear comparsa',
      'dash.join_group':         'Unirse a comparsa',
      'dash.code_placeholder':   'Código de invitación',
      'dash.btn.join':           'Unirse',
      'dash.btn.create':         'Crear',
      'dash.group_name':         'Nombre de la comparsa',
      'dash.group_type':         'Tipo',
      'dash.type.open':          'Abierta',
      'dash.type.closed':        'Cerrada',
      'dash.currency':           'Moneda',
      'dash.fee':                'Cuota',
      'dash.prize':              'Premio',
      'dash.description':        'Descripción',
      'dash.no_groups':          'Aún no perteneces a ninguna comparsa.',
      'dash.members':            'miembros',
      'dash.tab.groups':         '🏆 Comparsas',
      'dash.tab.tv':             '📺 Ver en vivo',
      'dash.your_name':          'Tu nombre visible',
      'dash.save_name':          'Guardar',
      'dash.stage':              'Etapa de inicio',

      // ── MATCHES ──
      'matches.title':           '⚽ Partidos',
      'matches.filter.all':      'Todos',
      'matches.filter.pending':  'Sin pronóstico',
      'matches.filter.done':     'Con pronóstico',
      'matches.filter.finished': 'Finalizados',
      'matches.predict':         'Pronosticar',
      'matches.your_pick':       'Tu pronóstico',
      'matches.confirm':         'Confirmar',
      'matches.cancel':          'Cancelar',
      'matches.no_matches':      'No hay partidos disponibles.',
      'matches.phase.groups':    'Fase de Grupos',
      'matches.phase.r32':       'Ronda de 32',
      'matches.phase.r16':       'Octavos de Final',
      'matches.phase.qf':        'Cuartos de Final',
      'matches.phase.sf':        'Semifinales',
      'matches.phase.final':     'Final',
      'matches.phase.third':     'Tercer Puesto',
      'matches.status.ft':       'Final',
      'matches.status.aet':      'Prórroga',
      'matches.status.pen':      'Penales',
      'matches.status.live':     'En vivo',
      'matches.ai_suggest':      '🤖 Sugerir con IA',
      'matches.ai_loading':      'Consultando IA...',
      'matches.select_group':    'Selecciona una comparsa',
      'matches.points':          'pts',
      'matches.exact':           '¡Exacto!',
      'matches.correct':         'Correcto',
      'matches.wrong':           'Incorrecto',

      // ── STANDINGS (RANKING) ──
      'standings.title':         '🏆 Ranking',
      'standings.rank':          '#',
      'standings.player':        'Jugador',
      'standings.points':        'Puntos',
      'standings.exact':         'Exactos',
      'standings.correct':       'Correctos',
      'standings.favorite':      'Favorito',
      'standings.no_data':       'No hay datos aún.',
      'standings.select_group':  'Selecciona una comparsa',
      'standings.paid':          'Pagado',
      'standings.unpaid':        'Pendiente',
      'standings.category.novice':     '🐶 Novato',
      'standings.category.inshape':    '🌱 En forma',
      'standings.category.competitor': '⚽ Competidor',
      'standings.category.expert':     '🏆 Experto',
      'standings.category.legend':     '🔥 Leyenda',

      // ── GROUPS TABLE ──
      'groups.title':            '🌎 Grupos del Torneo',
      'groups.table.team':       'Equipo',
      'groups.table.pj':         'PJ',
      'groups.table.g':          'G',
      'groups.table.e':          'E',
      'groups.table.p':          'P',
      'groups.table.gf':         'GF',
      'groups.table.gc':         'GC',
      'groups.table.gd':         'DG',
      'groups.table.pts':        'Pts',

      // ── RULES ──
      'rules.title':             '📋 Reglas del Juego',
      'rules.points.title':      'Sistema de Puntos',
      'rules.exact':             'Score exacto',
      'rules.correct':           'Resultado correcto (ganador/empate)',
      'rules.wrong':             'Resultado incorrecto',
      'rules.fav_win':           'Favorito gana',
      'rules.fav_draw':          'Favorito empata',
      'rules.fav_lose':          'Favorito pierde',
      'rules.fav_change':        'Cambiar favorito',
      'rules.tiebreak':          'Desempate: mayor cantidad de scores exactos.',

      // ── PROFILE ──
      'profile.title':           '👤 Mi Perfil',
      'profile.display_name':    'Nombre visible',
      'profile.email':           'Correo',
      'profile.save':            'Guardar cambios',
      'profile.saved':           'Cambios guardados ✓',

      // ── NEWS ──
      'news.title':              '📰 Noticias',
      'news.no_news':            'No hay noticias disponibles.',

      // ── LEGAL ──
      'legal.title':             'Aviso Legal',

      // ── STREAM VIEW ──
      'stream.title':            '📺 Ver Pantalla',
      'stream.enter_code':       'Código de sesión',
      'stream.btn.connect':      'Conectar',
      'stream.btn.fullscreen':   '⛶ Pantalla completa',
      'stream.btn.sendtv':       '📺 Enviar a TV',
      'stream.connecting':       'Conectando...',
      'stream.connected':        'Conectado',
      'stream.ended':            'Sesión finalizada',

      // ── FAVORITE ──
      'fav.pick_title':          'Elige tu equipo favorito',
      'fav.pick_sub':            'Fase',
      'fav.current':             'Favorito actual',
      'fav.change_warn':         'Cambiar favorito tiene una penalización de -3 pts.',
      'fav.btn.save':            'Confirmar favorito',
      'fav.btn.cancel':          'Cancelar',
      'fav.saved':               'Favorito guardado ✓',

      // ── PAYMENTS ──
      'pay.title':               '💳 Pagos',
      'pay.paid':                'Pagado',
      'pay.pending':             'Pendiente',
      'pay.instructions':        'Instrucciones de pago',
      'pay.show_qr':             'Ver QR de pago',

      // ── GENERIC ──
      'btn.close':               'Cerrar',
      'btn.save':                'Guardar',
      'btn.cancel':              'Cancelar',
      'btn.confirm':             'Confirmar',
      'btn.loading':             'Cargando...',
      'btn.retry':               'Reintentar',
      'lbl.or':                  'o',
      'lbl.yes':                 'Sí',
      'lbl.no':                  'No',
      'lbl.vs':                  'vs',
      'msg.loading':             'Cargando...',
      'msg.error':               'Ocurrió un error. Intenta de nuevo.',
      'msg.no_data':             'Sin datos disponibles.',
      'msg.saved':               'Guardado correctamente.',
      'phase.Grupos':            'Grupos',
      'phase.R32':               'Ronda de 32',
      'phase.Octavos':           'Octavos de Final',
      'phase.Cuartos':           'Cuartos de Final',
      'phase.Semifinales':       'Semifinales',
      'phase.Final':             'Final',
      'phase.Tercer Puesto':     'Tercer Puesto',
    },

    en: {
      // ── NAV / HEADER ──
      'nav.dashboard':   'My Groups',
      'nav.matches':     'Matches',
      'nav.standings':   'Rankings',
      'nav.groups':      'Groups',
      'nav.rules':       'Rules',
      'nav.news':        'News',
      'nav.profile':     'Profile',
      'nav.logout':      'Log out',
      'nav.login':       'Log in',
      'nav.dark':        '☀️ Light',
      'nav.light':       '🌙 Dark',
      'nav.lang_es':     '🇧🇴 ES',
      'nav.lang_en':     '🇺🇸 EN',

      // ── INDEX / AUTH ──
      'auth.title':              '⚽ World Cup Pool',
      'auth.subtitle':           'World Cup 2026',
      'auth.tab.login':          'Log in',
      'auth.tab.register':       'Sign up',
      'auth.email':              'Email address',
      'auth.password':           'Password',
      'auth.display_name':       'Name or nickname',
      'auth.btn.login':          'Log in',
      'auth.btn.register':       'Create account',
      'auth.forgot':             'Forgot your password?',
      'auth.recover':            'Recover',
      'auth.back_login':         'Back to login',
      'auth.recover_sent':       'We sent you a recovery email.',
      'auth.error.invalid':      'Incorrect email or password.',
      'auth.error.email_used':   'This email is already registered.',
      'auth.error.weak_pass':    'Password is too short (minimum 6 characters).',

      // ── DASHBOARD ──
      'dash.welcome':            'Welcome!',
      'dash.my_groups':          'My pools',
      'dash.create_group':       'Create pool',
      'dash.join_group':         'Join a pool',
      'dash.code_placeholder':   'Invitation code',
      'dash.btn.join':           'Join',
      'dash.btn.create':         'Create',
      'dash.group_name':         'Pool name',
      'dash.group_type':         'Type',
      'dash.type.open':          'Open',
      'dash.type.closed':        'Closed',
      'dash.currency':           'Currency',
      'dash.fee':                'Entry fee',
      'dash.prize':              'Prize',
      'dash.description':        'Description',
      'dash.no_groups':          'You are not part of any pool yet.',
      'dash.members':            'members',
      'dash.tab.groups':         '🏆 Pools',
      'dash.tab.tv':             '📺 Watch live',
      'dash.your_name':          'Your display name',
      'dash.save_name':          'Save',
      'dash.stage':              'Starting stage',

      // ── MATCHES ──
      'matches.title':           '⚽ Matches',
      'matches.filter.all':      'All',
      'matches.filter.pending':  'No prediction',
      'matches.filter.done':     'Predicted',
      'matches.filter.finished': 'Finished',
      'matches.predict':         'Predict',
      'matches.your_pick':       'Your prediction',
      'matches.confirm':         'Confirm',
      'matches.cancel':          'Cancel',
      'matches.no_matches':      'No matches available.',
      'matches.phase.groups':    'Group Stage',
      'matches.phase.r32':       'Round of 32',
      'matches.phase.r16':       'Round of 16',
      'matches.phase.qf':        'Quarter-finals',
      'matches.phase.sf':        'Semi-finals',
      'matches.phase.final':     'Final',
      'matches.phase.third':     'Third Place',
      'matches.status.ft':       'Full Time',
      'matches.status.aet':      'Extra Time',
      'matches.status.pen':      'Penalties',
      'matches.status.live':     'Live',
      'matches.ai_suggest':      '🤖 AI Suggest',
      'matches.ai_loading':      'Asking AI...',
      'matches.select_group':    'Select a pool',
      'matches.points':          'pts',
      'matches.exact':           'Exact!',
      'matches.correct':         'Correct',
      'matches.wrong':           'Wrong',

      // ── STANDINGS (RANKING) ──
      'standings.title':         '🏆 Rankings',
      'standings.rank':          '#',
      'standings.player':        'Player',
      'standings.points':        'Points',
      'standings.exact':         'Exact',
      'standings.correct':       'Correct',
      'standings.favorite':      'Favorite',
      'standings.no_data':       'No data yet.',
      'standings.select_group':  'Select a pool',
      'standings.paid':          'Paid',
      'standings.unpaid':        'Pending',
      'standings.category.novice':     '🐶 Rookie',
      'standings.category.inshape':    '🌱 In form',
      'standings.category.competitor': '⚽ Competitor',
      'standings.category.expert':     '🏆 Expert',
      'standings.category.legend':     '🔥 Legend',

      // ── GROUPS TABLE ──
      'groups.title':            '🌎 Tournament Groups',
      'groups.table.team':       'Team',
      'groups.table.pj':         'MP',
      'groups.table.g':          'W',
      'groups.table.e':          'D',
      'groups.table.p':          'L',
      'groups.table.gf':         'GF',
      'groups.table.gc':         'GA',
      'groups.table.gd':         'GD',
      'groups.table.pts':        'Pts',

      // ── RULES ──
      'rules.title':             '📋 Game Rules',
      'rules.points.title':      'Points System',
      'rules.exact':             'Exact score',
      'rules.correct':           'Correct result (winner/draw)',
      'rules.wrong':             'Wrong result',
      'rules.fav_win':           'Favorite wins',
      'rules.fav_draw':          'Favorite draws',
      'rules.fav_lose':          'Favorite loses',
      'rules.fav_change':        'Change favorite',
      'rules.tiebreak':          'Tiebreaker: most exact scores.',

      // ── PROFILE ──
      'profile.title':           '👤 My Profile',
      'profile.display_name':    'Display name',
      'profile.email':           'Email',
      'profile.save':            'Save changes',
      'profile.saved':           'Changes saved ✓',

      // ── NEWS ──
      'news.title':              '📰 News',
      'news.no_news':            'No news available.',

      // ── LEGAL ──
      'legal.title':             'Legal Notice',

      // ── STREAM VIEW ──
      'stream.title':            '📺 Watch Screen',
      'stream.enter_code':       'Session code',
      'stream.btn.connect':      'Connect',
      'stream.btn.fullscreen':   '⛶ Fullscreen',
      'stream.btn.sendtv':       '📺 Send to TV',
      'stream.connecting':       'Connecting...',
      'stream.connected':        'Connected',
      'stream.ended':            'Session ended',

      // ── FAVORITE ──
      'fav.pick_title':          'Pick your favorite team',
      'fav.pick_sub':            'Stage',
      'fav.current':             'Current favorite',
      'fav.change_warn':         'Changing your favorite applies a -3 pt penalty.',
      'fav.btn.save':            'Confirm favorite',
      'fav.btn.cancel':          'Cancel',
      'fav.saved':               'Favorite saved ✓',

      // ── PAYMENTS ──
      'pay.title':               '💳 Payments',
      'pay.paid':                'Paid',
      'pay.pending':             'Pending',
      'pay.instructions':        'Payment instructions',
      'pay.show_qr':             'Show payment QR',

      // ── GENERIC ──
      'btn.close':               'Close',
      'btn.save':                'Save',
      'btn.cancel':              'Cancel',
      'btn.confirm':             'Confirm',
      'btn.loading':             'Loading...',
      'btn.retry':               'Retry',
      'lbl.or':                  'or',
      'lbl.yes':                 'Yes',
      'lbl.no':                  'No',
      'lbl.vs':                  'vs',
      'msg.loading':             'Loading...',
      'msg.error':               'An error occurred. Please try again.',
      'msg.no_data':             'No data available.',
      'msg.saved':               'Saved successfully.',
      'phase.Grupos':            'Groups',
      'phase.R32':               'Round of 32',
      'phase.Octavos':           'Round of 16',
      'phase.Cuartos':           'Quarter-finals',
      'phase.Semifinales':       'Semi-finals',
      'phase.Final':             'Final',
      'phase.Tercer Puesto':     'Third Place',
    }
  };

  // ─── ESTADO ──────────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'wc2026_lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'es';

  // ─── API PÚBLICA ─────────────────────────────────────────────────────────────

  /**
   * Traduce una clave. Soporta interpolación: t('key', { name: 'Juan' })
   * donde la clave contiene {{name}}.
   */
  window.t = function(key, vars) {
    const dict = translations[currentLang] || translations['es'];
    let text = dict[key];
    if (text === undefined) {
      // fallback: intenta en español
      text = translations['es'][key];
    }
    if (text === undefined) return key; // último fallback: la propia clave
    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), vars[k]);
      });
    }
    return text;
  };

  /** Retorna el idioma actual ('es' | 'en') */
  window.getLang = function() { return currentLang; };

  /** Cambia el idioma y re-renderiza todos los elementos data-i18n */
  window.setLang = function(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations();
    updateLangBtn();
    // Dispara evento para que los módulos JS puedan reaccionar
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  };

  // ─── APLICAR TRADUCCIONES ─────────────────────────────────────────────────────
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr'); // e.g. 'placeholder'
      const translation = window.t(key);
      if (attr) {
        el.setAttribute(attr, translation);
      } else {
        el.textContent = translation;
      }
    });
    // Actualiza lang del <html> para accesibilidad
    document.documentElement.lang = currentLang;
  }

  function updateLangBtn() {
    const btn = document.getElementById('langToggleBtn');
    if (!btn) return;
    // Muestra la bandera del idioma ALTERNATIVO (el que puedes cambiar)
    btn.textContent = currentLang === 'es' ? '🇺🇸 EN' : '🇧🇴 ES';
    btn.title = currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español';
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    updateLangBtn();

    // Conectar botón si existe
    document.getElementById('langToggleBtn')?.addEventListener('click', () => {
      window.setLang(currentLang === 'es' ? 'en' : 'es');
    });
  });

})();
