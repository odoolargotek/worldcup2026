# 📄 Documento Técnico — WC2026 Polla Mundialera
> Versión: Junio 2026 · Repositorio: `odoolargotek/worldcup2026`

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
│   ├── admin.html            ← Panel admin (agregar resultados, gestionar partidos)
│   ├── matches.html          ← Ver partidos y hacer pronósticos
│   ├── groups.html           ← Tabla de grupos del torneo
│   ├── group-detail.html     ← Detalle de un grupo del torneo
│   ├── rules.html            ← Instrucciones del juego
│   ├── news.html             ← Noticias
│   ├── profile.html          ← Perfil de usuario (ruta protegida, sin archivo dedicado aún)
│   ├── legal.html            ← Aviso legal
│   ├── css/
│   │   ├── style.css
│   │   └── sponsor.css
│   ├── js/
│   │   ├── firebase-config.js     ← Inicialización Firebase (exporta `auth` y `db`)
│   │   ├── auth.js                ← Login, registro, logout, guard de ruta, recuperar contraseña
│   │   ├── groups.js              ← Lógica crear/unirse/listar grupos en dashboard (v=5)
│   │   ├── standings.js           ← Ranking, cálculo de puntos, panel admin de comparsa
│   │   ├── matches.js             ← Vista de partidos y pronósticos del usuario
│   │   ├── load-matches.js        ← Admin: carga de partidos en lote
│   │   ├── bulk-matches.js        ← Admin: operaciones masivas sobre partidos
│   │   ├── admin.js               ← Panel admin general (resultados, configuración)
│   │   ├── admin-dashboard.js     ← Dashboard de métricas del admin
│   │   ├── favorite.js            ← Lógica de favoritos por grupo
│   │   ├── predictions.js         ← Lógica de pronósticos
│   │   ├── groups-table.js        ← Tabla de posiciones del torneo
│   │   ├── rules.js               ← Renderiza la sección de instrucciones
│   │   ├── payment.js             ← Vista de pagos de comparsa + resolución de usuarios
│   │   ├── news.js                ← Noticias desde Firestore
│   │   ├── notifications.js       ← Notificaciones in-app
│   │   ├── perplexity-suggest.js  ← Sugerencia de pronósticos con IA (Perplexity API)
│   │   ├── sponsor-config.js      ← Configuración del banner de sponsor
│   │   ├── theme.js               ← Toggle claro/oscuro
│   │   ├── time.js                ← Utilidades de tiempo/zona horaria
│   │   └── disclaimer.js         ← Banner de aviso legal
│   └── data/
│       └── matches.json           ← Partidos con enlaces de stream (TV en vivo)
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
  email: string,          // email al momento de unirse (puede estar desactualizado)
  favorites: {            // { "Grupo A": "Argentina", "Grupo B": "Francia", ... }
    [phase: string]: string
  },
  favorites_pts: {        // puntos acumulados por favorito por grupo
    [phase: string]: number
  },
  penalties: {            // penalidades por cambio de favorito (-3 c/u)
    [phase: string]: number
  },
  paid: boolean,          // si pagó la cuota
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
  points: 0 | 3 | 6,     // 6=exacto, 3=resultado correcto, 0=fallo
  submitted_at: Timestamp
}
```

---

### `matches/{matchId}`
```js
{
  match_id: string,
  home_team: string,
  away_team: string,
  phase: string,          // "Grupo A", "Octavos", etc.
  match_date: Timestamp,
  home_score: number | null,   // null si no ha jugado
  away_score: number | null,
  status: 'pending' | 'finished'
}
```

---

## 🎯 Sistema de Puntos

| Evento | Puntos |
|---|---|
| Score exacto (ej: 2-1 correcto) | **+6** |
| Resultado correcto (ganador o empate) | **+3** |
| Resultado incorrecto | 0 |
| Favorito gana su partido de grupo | **+3** |
| Favorito empata su partido de grupo | **+1** |
| Favorito pierde su partido de grupo | 0 |
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

## 🔐 Autenticación y Guard de Rutas

El archivo `auth.js` maneja todo el ciclo de autenticación con Firebase Auth.

**Páginas públicas** (sin login): `index.html`
**Páginas protegidas** (redirigen a `index.html` sin login):
`admin.html`, `dashboard.html`, `matches.html`, `standings.html`, `groups.html`, `predict.html`, `group-detail.html`, `rules.html`, `news.html`, `profile.html`

**Flujo registro:**
1. `createUserWithEmailAndPassword` → Firebase Auth
2. `updateProfile` → pone `displayName` en Auth
3. `setDoc(users/{uid})` → crea doc en Firestore con `display_name`, `email`, `uid`

**Flujo login:** solo `signInWithEmailAndPassword` → redirige a `dashboard.html`

> ⚠️ Usuarios creados manualmente (desde Firebase Console o por flujos externos) no tienen `users/{uid}` en Firestore hasta que guardan su nombre desde el banner del dashboard.

---

## 👤 Resolución de Nombre de Usuario

El sistema tiene múltiples fallbacks para mostrar el nombre:

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

Archivo: `payment.js`

El admin puede subir un **QR de pago** (base64, máx ~600KB) e **instrucciones de pago** desde el modal de edición en `standings.html`. Los participantes ven el QR al entrar a la comparsa.

El admin marca manualmente a cada participante como `paid: true` en `group_members`.

**Resolución de email para la lista de pagos:**
```
1. group_members.email     ← email al momento de unirse
2. users/{uid}.email       ← Firestore (fallback si el campo 1 está vacío)
```

---

## 📺 TV en Vivo (Tab "Ver en Vivo")

En `dashboard.html` hay un tab oculto que muestra partidos con streams. Solo visible para usuarios con `users/{uid}.tv_access === true`.

Los datos se cargan desde:
1. `https://raw.githubusercontent.com/odoolargotek/worldcup2026/main/public/data/matches.json`
2. `https://streamtp.top/api/matches.json` (fallback)

Formato de cada partido en el JSON:
```json
{
  "title": "Argentina vs Francia",
  "time": "18:00",
  "status": "live",
  "category": "Grupo C",
  "streams": [
    { "flag": "🇺🇸", "language": "Inglés", "embedUrl": "https://...", "streamId": "s1" }
  ]
}
```

---

## ⚙️ Panel de Administrador Global

Accesible desde `admin.html` (solo usuarios con rol admin en Firebase Auth custom claims o lógica de whitelist).

Funciones:
- Cargar partidos en lote (`load-matches.js`, `bulk-matches.js`)
- Agregar/editar resultados de partidos
- Recalcular puntos de todos los usuarios
- Dashboard de métricas (`admin-dashboard.js`)

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

## 🤖 Integración con Perplexity AI

Archivo: `perplexity-suggest.js`

Ofrece sugerencias de pronóstico asistidas por IA usando la Perplexity API. Se integra en la vista de partidos para que el usuario reciba una sugerencia antes de apostar.

---

## 🐛 Bugs Conocidos / Issues Resueltos Recientemente

| Fecha | Descripción | Solución |
|---|---|---|
| Jun 12, 2026 | Usuarios creados manualmente no tienen `users/{uid}` → aparecen sin nombre y sin email en lista de pagos | `payment.js` usa doble fallback (email de `group_members` + `users/{uid}.email`). Usuario debe guardar nombre desde banner del dashboard para crear el doc. |
| Jun 12, 2026 | Banner "Ponle tu nombre" en dashboard: `saveNicknameBtn` usa `updateDoc` si el doc existe o `setDoc` si no existe | ✅ Correcto — cubre ambos casos |

---

## 🚀 Posibles Próximos Requerimientos

- Fase eliminatoria (Octavos, Cuartos, Semi, Final) con pronósticos especiales
- Notificaciones push antes del pitazo
- Historial de pronósticos por usuario
- Página `profile.html` dedicada (actualmente solo existe como ruta protegida en `auth.js` pero no hay archivo HTML)
- Export de ranking a PDF/imagen para compartir
- Integración de pagos automáticos (transferencias, QR dinámico)

---

## 🔗 Links Útiles

- **App en producción:** https://worldcup2026-8f27b.web.app
- **Repositorio:** https://github.com/odoolargotek/worldcup2026
- **Firebase Console:** https://console.firebase.google.com/project/worldcup2026-8f27b
- **Largotek:** https://www.largotek.com
