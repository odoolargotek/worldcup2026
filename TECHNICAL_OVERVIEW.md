# 📄 Documento Técnico — WC2026 Polla Mundialera
> Versión: Junio 2026 (actualizado 30-Jun-2026) · Repositorio: `odoolargotek/worldcup2026`

Este documento es el punto de entrada técnico completo del proyecto. Sirve para retomar el desarrollo en una nueva conversación sin perder contexto.

---

## 🧭 Resumen del Proyecto

Aplicación web de **polla deportiva privada** para el Mundial 2026. Permite a usuarios crear grupos ("comparsas"), hacer pronósticos de partidos, elegir equipos favoritos por grupo y ver un ranking con puntos en tiempo real.

- **Frontend:** HTML/CSS/JS vanilla con módulos ES6
- **Backend:** Firebase (Auth + Firestore + Hosting)
- **Sin framework:** No usa React, Vue ni Node.js — todo corre en el cliente
- **Deploy:** Firebase Hosting — `worldcup2026-8f27b.web.app`

---

## 🏗️ Estructura del Repositorio

```
worldcup2026/
├── public/
│   ├── index.html            ← Login / Registro / Recuperar contraseña
│   ├── dashboard.html        ← Mis grupos + crear/unirse a grupo
│   ├── standings.html        ← Ranking de una comparsa (param ?gid=)
│   ├── admin.html            ← Panel admin (resultados, partidos, TV, streams)
│   ├── matches.html          ← Ver partidos y hacer pronósticos
│   ├── groups.html           ← Tabla de grupos del torneo
│   ├── group-detail.html     ← Detalle de un grupo del torneo
│   ├── rules.html            ← Instrucciones del juego
│   ├── news.html             ← Noticias
│   ├── profile.html          ← Perfil de usuario (ruta protegida)
│   ├── legal.html            ← Aviso legal
│   ├── css/
│   │   ├── style.css
│   │   └── sponsor.css
│   ├── js/
│   │   ├── firebase-config.js       ← Inicialización Firebase (exporta `auth` y `db`)
│   │   ├── auth.js                  ← Login, registro, logout, guard de ruta, recuperar contraseña
│   │   ├── groups.js                ← Lógica crear/unirse/listar grupos en dashboard (v=5)
│   │   ├── standings.js             ← Ranking, cálculo de puntos, panel admin de comparsa
│   │   ├── matches.js               ← Vista de partidos y pronósticos del usuario
│   │   ├── load-matches.js          ← Admin: carga de partidos en lote
│   │   ├── bulk-matches.js          ← Admin: carga masiva de los 72 partidos de grupos
│   │   ├── admin.js                 ← Panel admin general (resultados, ET/penales, propagación)
│   │   ├── admin-dashboard.js       ← Dashboard de métricas del admin
│   │   ├── fix-team-names.js        ← Admin: normaliza nombres duplicados de equipos
│   │   ├── fix-favorites-groups.js  ← Admin: reasigna favoritos a su grupo correcto
│   │   ├── fix-favorites-manual.js  ← Admin: parche manual + limpieza de penalidades
│   │   ├── streams-manager.js       ← Admin: gestión de links de streams en vivo (Firestore)
│   │   ├── favorite.js              ← Lógica de favoritos por grupo
│   │   ├── predictions.js           ← Lógica de pronósticos
│   │   ├── groups-table.js          ← Tabla de posiciones del torneo
│   │   ├── rules.js                 ← Renderiza la sección de instrucciones
│   │   ├── payment.js               ← Vista de pagos de comparsa + resolución de usuarios
│   │   ├── news.js                  ← Noticias desde Firestore
│   │   ├── notifications.js         ← Notificaciones in-app
│   │   ├── perplexity-suggest.js    ← Sugerencia de pronósticos con IA (Perplexity API)
│   │   ├── sponsor-config.js        ← Configuración del banner de sponsor
│   │   ├── theme.js                 ← Toggle claro/oscuro
│   │   ├── time.js                  ← Utilidades de tiempo/zona horaria
│   │   └── disclaimer.js            ← Banner de aviso legal
│   └── data/
│       └── matches.json             ← Partidos con enlaces de stream (TV en vivo)
```

---

## 🔥 Firebase — Colecciones Firestore

### `users/{uid}`
Creado al registrarse **o** al guardar nombre desde el banner del dashboard.
```js
{
  uid: string,
  display_name: string,   // nombre o apodo visible en rankings
  email: string,
  tv_access: boolean,     // acceso al tab "Ver en Vivo" (gestionado desde admin)
  created_at: Timestamp
}
```
> ⚠️ Usuarios creados manualmente desde Firebase Console NO tienen este documento hasta que guardan su nombre en el dashboard.

---

### `groups/{groupId}`
```js
{
  name: string,
  code: string,           // código de 6 letras para invitar
  owner_uid: string,
  type: 'open' | 'closed',
  currency: 'USD' | 'BOB',
  fee: number,            // cuota por participante
  prize: number,          // premio fijo (solo type=closed)
  prize_pct: { p1, p2, p3 },  // % distribución del pozo
  stage: string,          // etapa de inicio (Grupos, Octavos, etc.)
  is_open: boolean,       // si acepta nuevos miembros
  description: string,
  payment_qr: string,     // base64 de imagen QR de pago
  payment_instructions: string,
  created_at: Timestamp
}
```

---

### `group_members/{groupId}_{uid}`
```js
{
  group_id: string,
  user_uid: string,
  role: 'admin' | 'member',
  email: string,
  favorites: {                      // { "Grupo A": "Argentina", "Ronda de 32": "Países Bajos", ... }
    [phase: string]: string
  },
  favorites_pts: {                  // puntos acumulados por favorito por fase
    [phase: string]: number
  },
  favorites_pts_by_match: {         // puntos por favorito desglosados por partido (idempotencia)
    [matchId: string]: number
  },
  penalties: {                      // penalidades por cambio de favorito (-3 c/u)
    [phase: string]: number
  },
  paid: boolean,
  joined_at: Timestamp
}
```

---

### `predictions/{groupId}_{uid}_{matchId}`
```js
{
  group_id: string,
  user_uid: string,
  match_id: string,
  home_score: number,
  away_score: number,
  points: 0 | 3 | 6,       // 6=exacto, 3=resultado correcto, 0=fallo
  points_synced: boolean,   // true si ya fue calculado al cerrar el partido
  submitted_at: Timestamp
}
```

---

### `matches/{matchId}`
```js
{
  home_team: string,
  away_team: string,
  home_flag: string,        // emoji bandera
  away_flag: string,
  phase: string,            // "Grupo A", "Ronda de 32", "Octavos", etc.
  kickoff: Timestamp,
  city: string,
  home_score: number | null,
  away_score: number | null,
  finished: boolean,
  match_status: 'FT' | 'AET' | 'PEN' | 'LIVE' | '',
  // Campos de Tiempo Extra / Penales (solo partidos eliminatorios):
  extra_time: boolean,
  et_home_score: number | null,    // marcador al final del ET
  et_away_score: number | null,
  penalties: boolean,
  penalties_winner: string | null, // nombre del equipo ganador en penales
  // Campos de streaming (sync automática desde TheSportsDB):
  channels: string[],
  tv_station: string | null,
  stream_url: string | null,
  tsdb_id: string | null,
  channels_synced_at: Timestamp,
  last_synced: Timestamp
}
```

---

### `standings/{grupoId}`
Tabla de posiciones calculada por el admin (botón "Recalcular grupos").
```js
{
  grupo: string,           // "Grupo A", "Grupo B", ...
  teams: [{ name, flag, pj, g, e, p, gf, gc, gd, pts }],
  updated: Timestamp
}
```

---

### `app_config/live_streams`
JSON de streams manuales editado desde el tab "Streams" del admin.
```js
{
  streams: [ { match: string, streams: [{ label, url }] } ],
  updated_at: Timestamp
}
```

### `app_config/streaming_sync`
Metadata de la última sincronización automática de canales.
```js
{
  last_sync: Timestamp,
  matches_updated: number,
  date_synced: string     // "YYYY-MM-DD"
}
```

---

## 🎯 Sistema de Puntos

| Evento | Puntos |
|---|---|
| Score exacto (ej: 2-1 correcto) | **+6** |
| Resultado correcto (ganador o empate) | **+3** |
| Resultado incorrecto | 0 |
| Favorito gana su partido | **+3** |
| Favorito empata su partido | **+1** |
| Favorito pierde su partido | 0 |
| Cambiar favorito de grupo | **−3** |

**Fórmula total:**
```
total = Σ(prediction.points) + Σ(favorites_pts[phase]) - Σ(penalties[phase])
```

**Desempate:** Mayor cantidad de scores exactos.

**Categorías de jugador:**
- 🐶 Novato: 0–29 pts
- 🌱 En forma: 30–59 pts
- ⚽ Competidor: 60–99 pts
- 🏆 Experto: 100–149 pts
- 🔥 Leyenda: 150+ pts

---

## 🏆 Fase Eliminatoria — Ronda de 32 y Octavos

### Flujo de cierre de partido eliminatorio

El panel admin (`admin.html` → tab "Resultados") tiene un bloque **ET / Penales** que se activa al cerrar partidos de la fase eliminatoria:

1. **Guardar marcador** (sin cerrar) con "Guardar marcador (sin cerrar)"
2. **Cerrar partido** con el botón "Cerrar partido definitivamente":
   - Toggle **Tiempo Extra (ET)**: habilita campos de marcador al final del ET
   - Toggle **Penales**: requiere seleccionar el equipo ganador en penales
   - El campo `match_status` se guarda como `'FT'`, `'AET'` o `'PEN'` según corresponda

### Campos guardados en Firestore al cerrar

```js
// Partido con ET y penales:
{
  finished: true,
  match_status: 'PEN',
  extra_time: true,
  et_home_score: 1,
  et_away_score: 1,
  penalties: true,
  penalties_winner: 'Países Bajos'
}
```

### Propagación automática a Octavos

Al cerrar un partido de **Ronda de 32**, `admin.js` ejecuta `propagateWinnerToOctavos()` automáticamente:

- Usa el mapa `R32_TO_OCTAVOS` (16 entradas hardcoded con los cruces del torneo)
- Determina el ganador: si hay `penalties_winner`, ese es el ganador; si no, el que marcó más goles en 90'
- Busca el partido de Octavos correspondiente en Firestore (por `type`/`phase` que contenga "octavo")
- Actualiza `home_team` o `away_team` del partido de Octavos según el slot (`home`/`away`)
- El resultado aparece en el mensaje de confirmación del cierre

**Mapa R32 → Octavos (hardcoded en `admin.js`):**
```
Alemania vs Paraguay → Octavos (local)
Francia vs Suecia → Octavos (visitante, mismo partido que Alemania)
Sudáfrica vs Canadá → Octavos (local)
Países Bajos vs Marruecos → Octavos (visitante, mismo partido que Sudáfrica)
... (16 cruces en total)
```

---

## ⚙️ Panel de Administrador Global (`admin.html`)

Tabs disponibles:

### 📊 Dashboard
- Métricas generales: comparsas, usuarios, pronósticos, partidos (desde `admin-dashboard.js`)

### 🏆 Resultados
Tiene 5 secciones:

1. **Sincronización automática (TheSportsDB):**
   - "Sincronizar partidos": actualiza marcadores de partidos en ventana activa (±4h) consultando TheSportsDB API v3
   - "Recalcular tablas de grupos": recalcula PJ/G/E/P/GF/GC/pts y guarda en `standings/`

2. **Cargar / Actualizar Marcador:** guarda score parcial sin cerrar el partido, recalcula pronósticos

3. **Cerrar partido como FINAL:**
   - Bloque ET/Penales (toggles `chkET` y `chkPEN`)
   - Al activar Penales → muestra `<select id="penWinner">` con los dos equipos del partido
   - Calcula puntos de pronósticos + favoritos al cerrar
   - Propaga ganador a Octavos si es Ronda de 32
   - `match_status`: `FT` / `AET` / `PEN`

4. **Recalcular puntos de pronósticos:** reutiliza marcador ya guardado para recalcular (útil si hubo bug)

5. **Recalcular favoritos:** idempotente — usa `favorites_pts_by_match` para no duplicar puntos

6. **Resetear resultado:** revierte un partido a pendiente, quita puntos de pronósticos y favoritos

### ⚽ Partidos
- Corregir nombres duplicados (`fix-team-names.js`)
- Corregir grupos de favoritos (`fix-favorites-groups.js`) — vista previa + aplicar
- Parche manual de favoritos (`fix-favorites-manual.js`)
- Limpiar penalidades de grupos vacíos
- Cargar calendario completo (72 partidos de fase de grupos)
- Agregar partido individual
- Listar / eliminar todos los partidos

### 👥 Comparsas
- Lista todas las comparsas con conteo de miembros y pronósticos
- Permite eliminar una comparsa (borra miembros y pronósticos asociados)

### 📺 Acceso TV
- Sincronizar canales desde TheSportsDB para partidos del día
- Gestión de `tv_access` por usuario (activar/desactivar)
- Buscador de usuarios por nombre o correo

### 📡 Streams (manual)
- Editor JSON para cargar links de streams en vivo
- Se guarda en `app_config/live_streams` en Firestore
- Los usuarios con `tv_access: true` lo ven en su dashboard
- Formato:
```json
[{ "match": "Argentina vs Brasil", "streams": [{ "label": "🇪🇸 Español", "url": "https://..." }] }]
```

---

## ⚙️ Panel de Admin por Comparsa

Accesible en `standings.html` para el `role: 'admin'` del grupo.

Funciones (modal tabbed):
- **General:** cambiar nombre y descripción del grupo
- **Montos:** cambiar cuota, premio, moneda, distribución %
- **Pago:** subir QR de pago e instrucciones
- **Participantes:** ver lista con emails + expulsar miembros
- Abrir/cerrar inscripciones (`is_open`)

---

## 🔐 Autenticación y Guard de Rutas

**Páginas públicas** (sin login): `index.html`  
**Páginas protegidas** (redirigen a `index.html` sin login):
`admin.html`, `dashboard.html`, `matches.html`, `standings.html`, `groups.html`, `predict.html`, `group-detail.html`, `rules.html`, `news.html`, `profile.html`

**Flujo registro:**
1. `createUserWithEmailAndPassword` → Firebase Auth
2. `updateProfile` → pone `displayName` en Auth
3. `setDoc(users/{uid})` → crea doc en Firestore con `display_name`, `email`, `uid`

---

## 👤 Resolución de Nombre de Usuario

```
1. users/{uid}.display_name        ← Firestore (fuente principal)
2. users/{uid}.displayName         ← Firestore (campo legacy)
3. auth.currentUser.displayName    ← Firebase Auth (solo para el usuario activo)
4. email.split('@')[0]             ← Derivado del correo
5. "Sin nombre"                    ← Fallback final
```

Implementado en `standings.js → getUserInfo(uid)` con cache en memoria `userInfoCache`.

---

## 💳 Sistema de Pagos

El admin puede subir un **QR de pago** (base64, máx ~600KB) e **instrucciones de pago** desde el modal de edición en `standings.html`. Los participantes ven el QR al entrar a la comparsa.

**Resolución de email para la lista de pagos:**
```
1. group_members.email     ← email al momento de unirse
2. users/{uid}.email       ← Firestore (fallback si el campo 1 está vacío)
```

---

## 📺 TV en Vivo (Tab "Ver en Vivo" en dashboard)

Solo visible para usuarios con `users/{uid}.tv_access === true`.

Fuentes de datos (en orden de prioridad):
1. `app_config/live_streams` en Firestore (streams manuales cargados desde admin)
2. `matches/{matchId}.stream_url` / `.channels` (sync automática TheSportsDB)

---

## 🤖 Integración con Perplexity AI

Archivo: `perplexity-suggest.js`

Ofrece sugerencias de pronóstico asistidas por IA usando la Perplexity API. Se integra en la vista de partidos para que el usuario reciba una sugerencia antes de apostar.

---

## 🐛 Bugs Resueltos

| Fecha | Descripción | Solución |
|---|---|---|
| Jun 12, 2026 | Usuarios creados manualmente no tienen `users/{uid}` → aparecen sin nombre y sin email en lista de pagos | `payment.js` usa doble fallback (`group_members.email` + `users/{uid}.email`) |
| Jun 12, 2026 | Banner "Ponle tu nombre": `saveNicknameBtn` usaba `updateDoc` aunque el doc no existía | Corregido a `setDoc` con merge |
| Jun 27, 2026 | `favorites_pts_by_match` no se inicializaba al recalcular favoritos → puntos duplicados | `recalcFavoritesForMatch()` ahora lee el map existente y lo parchea por partido |
| Jun 29, 2026 | Propagación a Octavos fallaba cuando el partido de Octavos no existía aún en Firestore | `propagateWinnerToOctavos()` retorna mensaje de advertencia en lugar de lanzar error |
| Jun 30, 2026 | `updatePenOptions()` usaba regex `\w` que no captura tildes ni caracteres especiales (ej: "Países Bajos") → el `<select>` de ganador por penales no se llenaba | Nuevo algoritmo: busca el score `N-N` como pivote y extrae los nombres de equipo antes y después, sin regex de caracteres |

---

## 🚀 Próximos Requerimientos Pendientes

- Pronósticos especiales para fase eliminatoria (ganador en 90', ET, penales)
- Puntos extras por predecir correctamente el equipo que avanza (no solo el marcador)
- Notificaciones push antes del pitazo
- Historial de pronósticos por usuario
- Página `profile.html` dedicada (actualmente solo existe como ruta protegida en `auth.js`)
- Export de ranking a PDF/imagen para compartir
- Integración de pagos automáticos (transferencias, QR dinámico)
- Partidos de Cuartos de Final, Semifinales, Final — agregar al mapa de propagación

---

## 🔗 Links Útiles

- **App en producción:** https://worldcup2026-8f27b.web.app
- **Repositorio:** https://github.com/odoolargotek/worldcup2026
- **Firebase Console:** https://console.firebase.google.com/project/worldcup2026-8f27b
- **Largotek:** https://www.largotek.com
