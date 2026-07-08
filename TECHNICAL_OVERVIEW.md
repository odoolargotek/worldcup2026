# 📄 Documento Técnico — WC2026 Polla Mundialera
> Versión: Julio 2026 (actualizado 08-Jul-2026) · Repositorio: `odoolargotek/worldcup2026`

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
│   ├── index.html                 ← Login / Registro / Recuperar contraseña
│   ├── dashboard.html             ← Mis grupos + crear/unirse + tab "Ver en vivo"
│   ├── stream-view.html           ← ★ Visor independiente de pantalla compartida
│   ├── standings.html             ← Ranking de una comparsa (param ?gid=)
│   ├── admin.html                 ← Panel admin (resultados, partidos, TV, streams)
│   ├── admin-hub.html             ← Hub central de links a todas las páginas admin
│   ├── admin-load-knockout.html   ← ★ Carga de Cuartos / Semis / 3P / Final
│   ├── admin-patch-slots.html     ← ★ Parchea / normaliza `slot` y elimina legacy duplicates
│   ├── screen-share.html          ← ★ Página emisor WebRTC (solo is_host:true)
│   ├── matches.html               ← Ver partidos y hacer pronósticos
│   ├── groups.html                ← Tabla de grupos del torneo
│   ├── group-detail.html          ← Detalle de un grupo del torneo
│   ├── rules.html                 ← Instrucciones del juego
│   ├── news.html                  ← Noticias
│   ├── profile.html               ← Perfil de usuario (ruta protegida)
│   ├── legal.html                 ← Aviso legal
│   ├── css/
│   │   ├── style.css
│   │   └── sponsor.css
│   ├── js/
│   │   ├── firebase-config.js       ← Inicialización Firebase (exporta `auth` y `db`)
│   │   ├── auth.js                  ← Login, registro, logout, guard de ruta, recuperar contraseña
│   │   ├── groups.js                ← Lógica crear/unirse/listar grupos en dashboard (v=5)
│   │   ├── standings.js             ← Ranking, cálculo de puntos, panel admin de comparsa
│   │   ├── matches.js               ← Vista de partidos y pronósticos del usuario
│   │   ├── screen-share.js          ← ★ Módulo WebRTC (emisor + receptor embebido en dashboard)
│   │   ├── load-matches.js          ← Admin: carga de partidos en lote
│   │   ├── bulk-matches.js          ← Admin: carga masiva de los 72 partidos de grupos
│   │   ├── admin.js                 ← Panel admin general (resultados, ET/penales, propagación)
│   │   ├── admin-dashboard.js       ← Dashboard de métricas del admin
│   │   ├── fix-team-names.js        ← Admin: normaliza nombres duplicados de equipos
│   │   ├── fix-favorites-groups.js  ← Admin: reasigna favoritos a su grupo correcto
│   │   ├── fix-favorites-manual.js  ← Admin: parche manual + limpieza de penalidades
│   │   ├── streams-manager.js       ← Admin: gestión de links de streams en vivo (Firestore)
│   │   ├── live-streams.js          ← ★ Carga streams desde Firestore para el tab TV
│   │   ├── favorite.js              ← Lógica de favoritos por grupo
│   │   ├── predictions.js           ← Lógica de pronósticos
│   │   ├── groups-table.js          ← Tabla de posiciones del torneo
│   │   ├── rules.js                 ← Renderiza la sección de instrucciones
│   │   ├── payment.js               ← Vista de pagos de comparsa + resolución de usuarios
│   │   ├── news.js                  ← Noticias desde Firestore
│   │   ├── notifications.js         ← Notificaciones in-app
│   │   ├── perplexity-suggest.js    ← Sugerencia de pronóstico con IA (Perplexity API)
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
  display_name: string,
  email: string,
  tv_access: boolean,
  is_host: boolean,
  created_at: Timestamp
}
```
> ⚠️ Usuarios creados manualmente desde Firebase Console NO tienen este documento hasta que guardan su nombre en el dashboard.

---

### `groups/{groupId}`
```js
{
  name: string,
  code: string,
  owner_uid: string,
  type: 'open' | 'closed',
  currency: 'USD' | 'BOB',
  fee: number,
  prize: number,
  prize_pct: { p1, p2, p3 },
  stage: string,
  is_open: boolean,
  description: string,
  payment_qr: string,
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
  favorites: { [phase: string]: string },
  favorites_pts: { [phase: string]: number },
  favorites_pts_by_match: { [matchId: string]: number },
  penalties: { [phase: string]: number },
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
  points: 0 | 3 | 6,
  points_synced: boolean,
  submitted_at: Timestamp
}
```

---

### `matches/{matchId}`
```js
{
  home_team, away_team, home_flag, away_flag,
  phase, type, slot, kickoff, city,
  home_score, away_score,
  finished: boolean,
  match_status: 'FT' | 'AET' | 'PEN' | 'LIVE' | '',
  extra_time: boolean,
  et_home_score, et_away_score,
  penalties: boolean,
  penalties_winner: string | null,
  channels, tv_station, stream_url, tsdb_id,
  channels_synced_at, last_synced
}
```

### ★ Slots canónicos para fase eliminatoria tardía

Se introdujo el campo `slot` para identificar de manera estable los partidos de fases avanzadas, evitar duplicados cuando los equipos aún están “Por definir”, y soportar futura propagación automática de ganadores.

| Slot | Fase | Kickoff Bolivia |
|---|---|---|
| `QF1` | Cuartos de Final | Jue 09/07 4:00 p. m. |
| `QF2` | Cuartos de Final | Vie 10/07 3:00 p. m. |
| `QF3` | Cuartos de Final | Sáb 11/07 5:00 p. m. |
| `QF4` | Cuartos de Final | Sáb 11/07 9:00 p. m. |
| `SF1` | Semifinales | Mar 14/07 3:00 p. m. |
| `SF2` | Semifinales | Mié 15/07 3:00 p. m. |
| `3P` | Tercer Puesto | Sáb 18/07 5:00 p. m. |
| `FIN` | Final | Dom 19/07 5:00 p. m. |

### Estado operativo al 08-Jul-2026

- Ya están cargados en Firestore los **4 Cuartos**, las **2 Semifinales**, el partido por **Tercer Puesto** y la **Final**.
- Se eliminó un documento legacy duplicado `final_01` con fecha vieja (26/07) y equipos placeholder incompatibles.
- Se normalizaron slots legacy como `Final` → `FIN` y `3er Puesto` → `3P`.

---

### `standings/{grupoId}`
```js
{
  grupo: string,
  teams: [{ name, flag, pj, g, e, p, gf, gc, gd, pts }],
  updated: Timestamp
}
```

---

### `app_config/live_streams`
```js
{
  streams: [ { match: string, streams: [{ label, url }] } ],
  updated_at: Timestamp
}
```

### `app_config/streaming_sync`
```js
{
  last_sync: Timestamp,
  matches_updated: number,
  date_synced: string
}
```

---

### ★ `screen_sessions/{code}` — Pantalla Compartida WebRTC

Colección creada dinámicamente cuando el host inicia una sesión de pantalla compartida.

```js
{
  code: string,
  host_uid: string,
  status: 'active' | 'ended',
  offer: RTCSessionDescriptionInit,
  answer: RTCSessionDescriptionInit,
  created_at: Timestamp
}
```

**Subcolecciones:**
- `screen_sessions/{code}/hostCandidates/{id}` — ICE candidates del emisor
- `screen_sessions/{code}/guestCandidates/{id}` — ICE candidates del receptor

> ⚠️ Cada sesión consume ~15–25 operaciones Firestore en total (señalización). El video viaja **P2P directo**, nunca por Firebase.

---

## 📡 Sistema de Pantalla Compartida (WebRTC)

### Arquitectura general

Usa **WebRTC P2P con Firebase como servidor de señalización**. El video y audio del sistema viajan directamente entre los dispositivos (peer-to-peer), sin pasar por Firebase ni ningún servidor intermedio.

```
Emisor (host)
  └─► getDisplayMedia({ video, audio: true })
  └─► crea RTCPeerConnection
  └─► genera offer SDP → guarda en screen_sessions/{code}
  └─► escucha answer del receptor en onSnapshot
  └─► intercambia ICE candidates vía hostCandidates/

Receptor (guest)
  └─► lee offer de screen_sessions/{code}
  └─► crea RTCPeerConnection
  └─► genera answer SDP → guarda en screen_sessions/{code}.answer
  └─► recibe stream en ontrack → asigna a <video>
  └─► intercambia ICE candidates vía guestCandidates/
```

### Audio del sistema

Al llamar `getDisplayMedia({ audio: true, video: true })`, Chrome presenta un checkbox **"Compartir audio del sistema"** en el selector de pantalla. Si el usuario lo activa, el stream incluye el audio del sistema (música, TV, etc.). El log de `screen-share.js` informa si el audio quedó incluido o no.

### Páginas involucradas

| Página | Rol | Acceso requerido |
|---|---|---|
| `screen-share.html` | Emisor dedicado | `is_host: true` |
| `dashboard.html` → tab TV → bloque emisor | Emisor embebido | `is_host: true` |
| `dashboard.html` → tab TV → bloque receptor | Receptor embebido | `tv_access: true` |
| `stream-view.html` | ★ Receptor en página completa | `tv_access: true` |

### `stream-view.html` — Visor independiente

Página dedicada 100% a ver la pantalla compartida. Características:

- **Auth guard:** solo usuarios con `tv_access: true` pueden acceder
- **Código por URL:** acepta `?code=ABC123` → se conecta automáticamente sin escribir nada
- **Botón ⛶ Pantalla completa** (sobre el video, visible al hacer hover)
- **Botón 📺 Enviar a TV** — lógica por dispositivo:
  - Safari / iOS: `video.webkitShowPlaybackTargetPicker()` → AirPlay nativo
  - Chrome / PC: `PresentationRequest` → Chromecast / Smart TV
  - Android: instrucciones para "Duplicar pantalla"
- **Guía fija** con instrucciones por dispositivo (Chrome, Android, iOS, Smart TV con browser)
- **Log de conexión** en tiempo real

### Integración en dashboard

Dentro del tab "📺 Ver en vivo" → bloque "Pantalla compartida en vivo":

- **Banner azul** con botón **🔗 Abrir visor independiente** → `stream-view.html`
- **Botón "🔗 Abrir en visor"** junto al input de código: si ya escribiste el código, abre `stream-view.html?code=XXXXXX` directamente
- **Botón "📺 Ver aquí"** → conecta dentro del dashboard (video embebido)
- Controles flotantes sobre el video embebido: ⛶ Pantalla completa + 📺 Enviar a TV

### Limitación conocida: ancho de banda upload

La arquitectura actual es **P2P Mesh**: el emisor abre **una conexión de subida por cada receptor**. Con pantalla 1080p a ~2–3 Mbps por stream:

| Receptores | Upload requerido |
|---|---|
| 1 | ~3 Mbps |
| 3 | ~9 Mbps |
| 5 | ~15 Mbps |

**Recomendación para escalar:** migrar a una arquitectura **SFU (Selective Forwarding Unit)** donde el host sube el stream una sola vez y el servidor distribuye a todos los receptores. Opciones evaluadas:

| Opción | Costo | Notas |
|---|---|---|
| **Jitsi Meet** (iframe o link) | Gratis | Más simple, SFU propio, sin código extra |
| **LiveKit Cloud** | Gratis hasta 50 participantes/mes | SDK web, open source |
| **Cloudflare Calls** | Gratis hasta 1,000 min/mes | Fácil de integrar |
| **100ms.live** | Gratis 10,000 min/mes | Buen SDK |

Para grupos pequeños (≤ 4–5 personas), el P2P actual es suficiente.

---

## ⚙️ Admin Hub (`admin-hub.html`)

Página de acceso rápido a todas las herramientas de administración. Secciones:

| Sección | Páginas incluidas |
|---|---|
| 🏠 Principal | `admin.html`, `admin-report.html`, `admin-messages.html`, `admin-predictions.html` |
| 📡 Pantalla Compartida | `screen-share.html`, `stream-view.html`, `dashboard.html` |
| ⚽ Partidos | `admin-kickoffs.html`, `admin-set-winner.html`, `load-matches.html`, `audit-matches.html`, `admin-load-knockout.html` |
| 🔧 Herramientas de Fix | `admin-patch-slots.html` + herramientas legacy/fix/debug |
| 🔄 Migraciones | `migrate-groups-stage.html`, `migrate-match-types.html`, `recalc-all-favorites.html` |

---

## 🎯 Sistema de Puntos

| Evento | Puntos |
|---|---|
| Score exacto | **+6** |
| Resultado correcto (ganador o empate) | **+3** |
| Resultado incorrecto | 0 |
| Favorito gana | **+3** |
| Favorito empata | **+1** |
| Favorito pierde | 0 |
| Cambiar favorito | **−3** |

**Fórmula:**
```
total = Σ(prediction.points) + Σ(favorites_pts[phase]) - Σ(penalties[phase])
```

**Desempate:** Mayor cantidad de scores exactos.

**Categorías:**
- 🐶 Novato: 0–29 pts · 🌱 En forma: 30–59 · ⚽ Competidor: 60–99 · 🏆 Experto: 100–149 · 🔥 Leyenda: 150+

---

## 🏆 Fase Eliminatoria — Estado actual

### Implementado

1. **Cierre de partido eliminatorio** con toggles de ET (`chkET`) y Penales (`chkPEN`)
   - `match_status`: `FT` / `AET` / `PEN`
   - Si Penales: `<select id="penWinner">` con los dos equipos
2. **Propagación automática** a Octavos via `propagateWinnerToOctavos()`
   - Usa el mapa hardcoded `R32_TO_OCTAVOS`
   - Si hay `penalties_winner` → ese es el ganador; si no, el que marcó más goles en 90'
3. **Carga admin de Cuartos / Semis / 3P / Final** con `admin-load-knockout.html`
4. **Migración y normalización de slots** con `admin-patch-slots.html`
   - Detecta duplicados/legacy
   - Normaliza slots no canónicos
   - Borra duplicados como `final_01`

### Pendiente inmediato

- Agregar propagación automática **Cuartos → Semifinales**
- Agregar propagación automática **Semifinales → Final / Tercer Puesto**
- Decidir naming final del mapa (`QF_TO_SF`, `SF_TO_FINAL_AND_3P` o similar)

---

## ⚙️ Panel de Administrador Global (`admin.html`)

Tabs: **Dashboard · Resultados · Partidos · Comparsas · Acceso TV · Streams**

- **Resultados:** sincronización TheSportsDB, carga marcadores, cierre con ET/Penales, recalcular puntos, resetear
- **Acceso TV:** gestión de `tv_access` e `is_host` por usuario
- **Streams:** editor JSON para `app_config/live_streams`

---

## ⚙️ Panel de Admin por Comparsa

Accesible en `standings.html` para `role: 'admin'`. Funciones: nombre, montos, QR de pago, participantes, abrir/cerrar inscripciones.

---

## 🔐 Autenticación y Guard de Rutas

**Páginas públicas:** `index.html`
**Páginas protegidas:** redirigen a `index.html` sin login — incluye `stream-view.html` (además requiere `tv_access: true`).

**Flujo registro:** `createUserWithEmailAndPassword` → `updateProfile` → `setDoc(users/{uid})`

---

## 👤 Resolución de Nombre de Usuario

```
1. users/{uid}.display_name
2. users/{uid}.displayName  (legacy)
3. auth.currentUser.displayName
4. email.split('@')[0]
5. "Sin nombre"
```

---

## 💳 Sistema de Pagos

QR de pago (base64, máx ~600KB) + instrucciones en modal del admin de comparsa (`standings.html`).

**Resolución de email:** `group_members.email` → `users/{uid}.email`

---

## 📺 TV en Vivo

Solo para usuarios con `tv_access: true`. Dos fuentes:
1. `app_config/live_streams` — streams manuales del admin
2. `matches/{matchId}.stream_url` / `.channels` — sync TheSportsDB

---

## 🤖 Integración con Perplexity AI

`perplexity-suggest.js` — sugerencias de pronóstico en la vista de partidos.

---

## 🐛 Bugs Resueltos

| Fecha | Descripción | Solución |
|---|---|---|
| Jun 12 | Usuarios manuales sin `users/{uid}` → sin nombre en pagos | Doble fallback en `payment.js` |
| Jun 12 | `saveNicknameBtn` usaba `updateDoc` aunque doc no existía | Corregido a `setDoc` con merge |
| Jun 27 | `favorites_pts_by_match` no inicializado → puntos duplicados | `recalcFavoritesForMatch()` parchea por partido |
| Jun 29 | Propagación a Octavos lanzaba error si el partido no existía | Retorna advertencia en lugar de error |
| Jun 30 | `updatePenOptions()` con regex `\w` no capturaba tildes → select de penales vacío para equipos como "Países Bajos" | Nuevo algoritmo extrae nombres antes/después del score `N-N` |
| Jul 08 | Segunda semifinal no cargaba porque ambas semis eran `Por definir vs Por definir` | Nueva deduplicación por `slot` en `admin-load-knockout.html` |
| Jul 08 | Existían slots legacy (`Final`, `3er Puesto`) y un duplicado `final_01` | `admin-patch-slots.html` normaliza slots y elimina legacy duplicates |

---

## 🚀 Próximos Requerimientos Pendientes

- Pronósticos especiales para fase eliminatoria (ganador en 90', ET, penales)
- Puntos extras por predecir correctamente el equipo que avanza
- Notificaciones push antes del pitazo
- Historial de pronósticos por usuario
- Página `profile.html` dedicada
- Export de ranking a PDF/imagen
- Integración de pagos automáticos
- **Propagación automática Cuartos → Semifinales**
- **Propagación automática Semifinales → Final y 3er Puesto**
- **Migración pantalla compartida a SFU** (Jitsi iframe o LiveKit) si el grupo supera 4–5 espectadores simultáneos

---

## 🔗 Links Útiles

- **App en producción:** https://worldcup2026-8f27b.web.app
- **Repositorio:** https://github.com/odoolargotek/worldcup2026
- **Firebase Console:** https://console.firebase.google.com/project/worldcup2026-8f27b
- **Largotek:** https://www.largotek.com
