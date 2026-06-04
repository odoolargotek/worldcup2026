# 🏆 Worldcup 2026 — Polla Mundialera

App web para organizar tu grupo de predicciones del Mundial FIFA 2026.

🌐 **Live:** https://worldcup2026-8f27b.web.app

## Stack
- **Frontend**: HTML + CSS (Bootstrap 5) + Vanilla JS
- **Auth**: Firebase Authentication (email/password)
- **DB**: Cloud Firestore
- **Hosting**: Firebase Hosting (deploy via GitHub Actions)

## Estructura
```
worldcup2026/
├── public/
│   ├── index.html          # Login / registro
│   ├── dashboard.html      # Inicio tras login (mis grupos)
│   ├── group.html          # Vista del grupo (ranking + partidos)
│   ├── predict.html        # Formulario de pronóstico
│   ├── admin.html          # Carga de resultados (admin)
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── firebase-config.js   # Config SDK Firebase
│       ├── auth.js              # Login / registro / logout
│       ├── groups.js            # Crear / unirse a grupos
│       ├── matches.js           # Listar partidos
│       ├── predictions.js       # CRUD pronósticos
│       ├── standings.js         # Ranking del grupo
│       └── admin.js             # Cargar resultados
├── firestore.rules
├── firebase.json
├── .firebaserc
└── .github/
    └── workflows/
        └── firebase-deploy.yml
```

## Deploy
Cada push a `main` dispara el workflow de GitHub Actions y hace deploy automático a Firebase Hosting.

## Colecciones Firestore
| Colección | Campos clave |
|---|---|
| `users` | uid, display_name, email |
| `groups` | name, code, owner_uid, created_at |
| `group_members` | group_id, user_uid, role |
| `matches` | home_team, away_team, kickoff, phase, home_score?, away_score? |
| `predictions` | group_id, match_id, user_uid, home_score, away_score, points |

## Sistema de puntos
- ✅ Resultado exacto → **3 puntos**
- 🟡 Resultado correcto (G/E/P) → **1 punto**
- ❌ Falla → **0 puntos**
