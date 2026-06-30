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
      'nav.calendar':            'Calendario',
      'nav.calendar_download':   'Descargar calendario de partidos',

      // ── INDEX / AUTH ──
      'auth.title':              '⚽ Polla Mundialera',
      'auth.subtitle':           'Mundial 2026',
      'auth.app_name':           'WC2026 Comparsa',
      'auth.app_tagline':        'Pronostica, compite con amigos y gana el pozo',
      'auth.tab.login':          'Iniciar sesión',
      'auth.tab.register':       'Registrarse',
      'auth.email':              'Correo electrónico',
      'auth.password':           'Contraseña',
      'auth.password_hint':      'Contraseña (mín. 6 caracteres)',
      'auth.display_name':       'Nombre o apodo',
      'auth.btn.login':          'Ingresar',
      'auth.btn.register':       'Crear cuenta',
      'auth.forgot':             '¿Olvidaste tu contraseña?',
      'auth.no_account':         '¿No tienes cuenta?',
      'auth.have_account':       'Ya tengo cuenta',
      'auth.recover':            'Enviar enlace',
      'auth.recover_title':      'Recuperar contraseña',
      'auth.recover_desc':       'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.',
      'auth.back_login':         'Volver al inicio de sesión',
      'auth.recover_sent':       'Te enviamos un correo de recuperación.',
      'auth.error.invalid':      'Correo o contraseña incorrectos.',
      'auth.error.email_used':   'Este correo ya está registrado.',
      'auth.error.weak_pass':    'La contraseña es muy corta (mínimo 6 caracteres).',
      'auth.hint.exact':         'Score exacto',
      'auth.hint.correct':       'Resultado correcto',
      'auth.hint.fav':           'Favorito avanza',

      // ── DASHBOARD ──
      'dash.welcome':            '¡Bienvenido!',
      'dash.my_groups':          'Mis comparsas',
      'dash.create_group':       'Crear comparsa',
      'dash.join_group':         'Unirse a un grupo',
      'dash.join_desc':          'Pide el código de 6 letras al dueño e ingrésalo aquí.',
      'dash.code_placeholder':   'Código (ej: AB3X7Z)',
      'dash.btn.join':           'Unirse',
      'dash.btn.create':         'Crear grupo',
      'dash.group_name':         'Nombre del grupo',
      'dash.group_type':         'Tipo',
      'dash.type.open':          'Abierta — Pozo acumulable',
      'dash.type.closed':        'Cerrada — Premio fijo',
      'dash.currency':           'Moneda',
      'dash.usd_label':          'Dólares americanos ($)',
      'dash.bob_label':          'Bolivianos (Bs.)',
      'dash.fee':                'Cuota por participante',
      'dash.fee_optional':       'Cuota por participante (opcional)',
      'dash.prize':              'Premio total fijo',
      'dash.max_members':        'Máx. participantes',
      'dash.description':        'Descripción',
      'dash.no_groups':          'Aún no perteneces a ninguna comparsa.',
      'dash.members':            'miembros',
      'dash.tab.groups':         'Comparsas',
      'dash.tab.tv':             'Ver en vivo',
      'dash.your_name':          'Tu apodo o nombre...',
      'dash.save_name':          'Guardar',
      'dash.stage':              'Etapa de inicio',
      'dash.stage_placeholder':  '-- Etapa de inicio --',
      'dash.dist.winner':        'Todo al 1° lugar (100%)',
      'dash.dist.top2':          'Top 2: 70% / 30%',
      'dash.dist.top3':          'Top 3: 60% / 30% / 10%',
      'dash.dist.custom':        'Personalizado',
      'dash.loading_groups':     'Cargando tus grupos, espera un momento...',
      'dash.nickname_title':     '¡Pónle tu nombre o apodo!',
      'dash.nickname_desc':      'Apareces como "Sin nombre" en los grupos. Escribe cómo quieres que te vean los demás.',
      'dash.nickname_required':  'Escribe un nombre o apodo primero.',
      'dash.nickname_saved':     '¡Listo! Ya aparecerás como',
      'dash.tv_title':           'Partidos en vivo',
      'dash.tv_desc':            'Haz clic en el link de tu idioma preferido para abrir el stream en una nueva pestaña.',
      'dash.tv_loading':         'Cargando transmisiones...',
      'dash.tv_error':           '⚠️ No se pudo cargar la lista de transmisiones.',
      'dash.tv_no_streams':      'Sin transmisiones disponibles',
      'dash.tv_no_streams_desc': 'El administrador aún no ha cargado links para hoy. Vuelve a revisar cuando comiencen los partidos.',
      'dash.tv_matches_count':   '{{count}} partido(s) · {{links}} link(s) disponibles',
      'dash.tv_watch_stream':    'Ver stream',
      'dash.delete_group_title': 'Eliminar grupo',
      'dash.delete_irreversible':'Esta acción es irreversible',
      'dash.delete_warn1':       'Se eliminarán todos los miembros y sus pronósticos',
      'dash.delete_warn2':       'El código de invitación dejará de funcionar',
      'dash.delete_warn3':       'No se puede recuperar después',
      'dash.delete_confirm_label': 'Vas a eliminar el grupo:',
      'dash.delete_type_name':   'Para confirmar, escribe exactamente el nombre:',
      'dash.delete_type_placeholder': 'Escribe el nombre aquí...',
      'dash.delete_confirm_btn': 'Sí, eliminar definitivamente',

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
      'legal.disclaimer':        '⚠️ Juego de entretenimiento privado. No es un sitio de apuestas. No se administra ni garantiza premios.',
      'legal.full_notice':       'Aviso legal completo',

      // ── SPONSOR / FOOTER ──
      'sponsor.tagline':         'Soluciones Digitales',
      'footer.developed_by':     'Desarrollado por',
      'footer.disclaimer':       'Juego de entretenimiento privado — No es un sitio de apuestas —',
      'footer.terms':            'Términos de uso',

      // ── STREAM VIEW ──
      'stream.title':            '📺 Ver Pantalla',
      'stream.section_title':    'Pantalla compartida en vivo',
      'stream.enter_code':       'Código de sesión',
      'stream.host_desc':        'Comparte tu pantalla. El audio del sistema se incluye si lo activas en el selector de Chrome.',
      'stream.code_copy_hint':   '📋 Copia este código ahora y compártelo, luego elige la ventana:',
      'stream.session_code_label': 'CÓDIGO DE SESIÓN',
      'stream.local_preview':    'Tu vista previa:',
      'stream.join_desc':        '¿Alguien está compartiendo su pantalla? Ingresa el código para verla aquí mismo:',
      'stream.viewer_banner_title': '📺 Ver en pantalla completa o en tu TV',
      'stream.viewer_banner_desc':  'Abre el visor en una página dedicada con más controles.',
      'stream.watch_hint':       'ℹ️ Ver aquí muestra el video en este mismo dashboard · Abrir en visor abre la página completa en una nueva pestaña',
      'stream.cast_hint':        '📺 Enviar a TV: Chrome → menú ⋮ → "Transmitir..." · Android → Duplicar pantalla · iOS → AirPlay desde Centro de control',
      'stream.btn.connect':      'Conectar',
      'stream.btn.fullscreen':   '⛶ Pantalla completa',
      'stream.btn.sendtv':       '📺 Enviar a TV',
      'stream.btn.share':        'Compartir mi pantalla',
      'stream.btn.stop':         'Detener',
      'stream.btn.watch_here':   'Ver aquí',
      'stream.btn.open_viewer':  'Abrir visor independiente',
      'stream.btn.open_in_viewer': 'Abrir en visor',
      'stream.btn.leave':        'Salir de la pantalla',
      'stream.status.idle':      'Inactivo',
      'stream.status.active':    'Activo',
      'stream.status.waiting':   'Esperando...',
      'stream.status.error':     'Error de conexión',
      'stream.connecting':       'Conectando...',
      'stream.connected':        'Conectado',
      'stream.ended':            'Sesión finalizada',

      // ── FAVORITE ──
      'fav.pick_title':          'Elige tu equipo favorito',
      'fav.pick_sub':            'Fase',
      'fav.current':             'Favorito actual',
      'fav.change_warn':         'Cambiar favorito tiene una penalización de -3 pts.',
      'fav.search':              '🔍 Buscar equipo...',
      'fav.btn.save':            'Confirmar favorito',
      'fav.btn.cancel':          'Cancelar',
      'fav.btn.skip':            'Saltar por ahora — elegir después',
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
      'btn.copy':                'Copiar',
      'lbl.or':                  'o',
      'lbl.yes':                 'Sí',
      'lbl.no':                  'No',
      'lbl.vs':                  'vs',
      'msg.loading':             'Cargando...',
      'msg.error':               'Ocurrió un error. Intenta de nuevo.',
      'msg.no_data':             'Sin datos disponibles.',
      'msg.saved':               'Guardado correctamente.',

      // ── FASES (mapa directo desde Firestore) ──
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
      'nav.calendar':            'Calendar',
      'nav.calendar_download':   'Download match calendar',

      // ── INDEX / AUTH ──
      'auth.title':              '⚽ World Cup Pool',
      'auth.subtitle':           'World Cup 2026',
      'auth.app_name':           'WC2026 Pool',
      'auth.app_tagline':        'Predict, compete with friends and win the pot',
      'auth.tab.login':          'Log in',
      'auth.tab.register':       'Sign up',
      'auth.email':              'Email address',
      'auth.password':           'Password',
      'auth.password_hint':      'Password (min. 6 characters)',
      'auth.display_name':       'Name or nickname',
      'auth.btn.login':          'Log in',
      'auth.btn.register':       'Create account',
      'auth.forgot':             'Forgot your password?',
      'auth.no_account':         "Don't have an account?",
      'auth.have_account':       'I already have an account',
      'auth.recover':            'Send reset link',
      'auth.recover_title':      'Reset password',
      'auth.recover_desc':       'Enter your email and we will send you a link to reset your password.',
      'auth.back_login':         'Back to login',
      'auth.recover_sent':       'We sent you a recovery email.',
      'auth.error.invalid':      'Incorrect email or password.',
      'auth.error.email_used':   'This email is already registered.',
      'auth.error.weak_pass':    'Password is too short (minimum 6 characters).',
      'auth.hint.exact':         'Exact score',
      'auth.hint.correct':       'Correct result',
      'auth.hint.fav':           'Favorite advances',

      // ── DASHBOARD ──
      'dash.welcome':            'Welcome!',
      'dash.my_groups':          'My pools',
      'dash.create_group':       'Create pool',
      'dash.join_group':         'Join a pool',
      'dash.join_desc':          'Ask the owner for the 6-letter code and enter it here.',
      'dash.code_placeholder':   'Code (e.g. AB3X7Z)',
      'dash.btn.join':           'Join',
      'dash.btn.create':         'Create pool',
      'dash.group_name':         'Pool name',
      'dash.group_type':         'Type',
      'dash.type.open':          'Open — Accumulating pot',
      'dash.type.closed':        'Closed — Fixed prize',
      'dash.currency':           'Currency',
      'dash.usd_label':          'US Dollars ($)',
      'dash.bob_label':          'Bolivianos (Bs.)',
      'dash.fee':                'Entry fee per player',
      'dash.fee_optional':       'Entry fee per player (optional)',
      'dash.prize':              'Fixed total prize',
      'dash.max_members':        'Max. players',
      'dash.description':        'Description',
      'dash.no_groups':          'You are not part of any pool yet.',
      'dash.members':            'members',
      'dash.tab.groups':         'Pools',
      'dash.tab.tv':             'Watch live',
      'dash.your_name':          'Your nickname or name...',
      'dash.save_name':          'Save',
      'dash.stage':              'Starting stage',
      'dash.stage_placeholder':  '-- Starting stage --',
      'dash.dist.winner':        'All to 1st place (100%)',
      'dash.dist.top2':          'Top 2: 70% / 30%',
      'dash.dist.top3':          'Top 3: 60% / 30% / 10%',
      'dash.dist.custom':        'Custom',
      'dash.loading_groups':     'Loading your pools, please wait...',
      'dash.nickname_title':     'Add your name or nickname!',
      'dash.nickname_desc':      'You appear as "No name" in pools. Enter how you want others to see you.',
      'dash.nickname_required':  'Please enter a name or nickname first.',
      'dash.nickname_saved':     'Done! You will now appear as',
      'dash.tv_title':           'Live matches',
      'dash.tv_desc':            'Click the link in your preferred language to open the stream in a new tab.',
      'dash.tv_loading':         'Loading streams...',
      'dash.tv_error':           '⚠️ Could not load the stream list.',
      'dash.tv_no_streams':      'No streams available',
      'dash.tv_no_streams_desc': 'The admin has not loaded any links for today. Check back when matches start.',
      'dash.tv_matches_count':   '{{count}} match(es) · {{links}} link(s) available',
      'dash.tv_watch_stream':    'Watch stream',
      'dash.delete_group_title': 'Delete pool',
      'dash.delete_irreversible':'This action is irreversible',
      'dash.delete_warn1':       'All members and their predictions will be deleted',
      'dash.delete_warn2':       'The invitation code will stop working',
      'dash.delete_warn3':       'This cannot be recovered afterwards',
      'dash.delete_confirm_label': 'You are about to delete:',
      'dash.delete_type_name':   'To confirm, type the exact pool name:',
      'dash.delete_type_placeholder': 'Type the name here...',
      'dash.delete_confirm_btn': 'Yes, delete permanently',

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
      'legal.disclaimer':        '⚠️ Private entertainment game. Not a betting site. No prizes are managed or guaranteed.',
      'legal.full_notice':       'Full legal notice',

      // ── SPONSOR / FOOTER ──
      'sponsor.tagline':         'Digital Solutions',
      'footer.developed_by':     'Developed by',
      'footer.disclaimer':       'Private entertainment game — Not a betting site —',
      'footer.terms':            'Terms of use',

      // ── STREAM VIEW ──
      'stream.title':            '📺 Watch Screen',
      'stream.section_title':    'Live screen share',
      'stream.enter_code':       'Session code',
      'stream.host_desc':        'Share your screen. System audio is included if you enable it in the Chrome picker.',
      'stream.code_copy_hint':   '📋 Copy this code now and share it, then choose the window:',
      'stream.session_code_label': 'SESSION CODE',
      'stream.local_preview':    'Your preview:',
      'stream.join_desc':        'Is someone sharing their screen? Enter the code to watch it right here:',
      'stream.viewer_banner_title': '📺 Watch fullscreen or on your TV',
      'stream.viewer_banner_desc':  'Open the viewer in a dedicated page with more controls.',
      'stream.watch_hint':       'ℹ️ Watch here shows the video in this dashboard · Open in viewer opens the full page in a new tab',
      'stream.cast_hint':        '📺 Send to TV: Chrome → ⋮ menu → "Cast..." · Android → Screen mirror · iOS → AirPlay from Control Center',
      'stream.btn.connect':      'Connect',
      'stream.btn.fullscreen':   '⛶ Fullscreen',
      'stream.btn.sendtv':       '📺 Send to TV',
      'stream.btn.share':        'Share my screen',
      'stream.btn.stop':         'Stop',
      'stream.btn.watch_here':   'Watch here',
      'stream.btn.open_viewer':  'Open independent viewer',
      'stream.btn.open_in_viewer': 'Open in viewer',
      'stream.btn.leave':        'Leave screen',
      'stream.status.idle':      'Idle',
      'stream.status.active':    'Active',
      'stream.status.waiting':   'Waiting...',
      'stream.status.error':     'Connection error',
      'stream.connecting':       'Connecting...',
      'stream.connected':        'Connected',
      'stream.ended':            'Session ended',

      // ── FAVORITE ──
      'fav.pick_title':          'Pick your favorite team',
      'fav.pick_sub':            'Stage',
      'fav.current':             'Current favorite',
      'fav.change_warn':         'Changing your favorite applies a -3 pt penalty.',
      'fav.search':              '🔍 Search team...',
      'fav.btn.save':            'Confirm favorite',
      'fav.btn.cancel':          'Cancel',
      'fav.btn.skip':            'Skip for now — choose later',
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
      'btn.copy':                'Copy',
      'lbl.or':                  'or',
      'lbl.yes':                 'Yes',
      'lbl.no':                  'No',
      'lbl.vs':                  'vs',
      'msg.loading':             'Loading...',
      'msg.error':               'An error occurred. Please try again.',
      'msg.no_data':             'No data available.',
      'msg.saved':               'Saved successfully.',

      // ── FASES (mapa directo desde Firestore) ──
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
