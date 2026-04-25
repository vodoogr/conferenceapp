# ConferenceApp — Guía de Setup Completo

## Estructura del proyecto

```
conferenceapp/
├── api/                    ← Vercel Serverless Functions (backend)
│   ├── auth/
│   │   ├── google.js       ← GET  /api/auth/google      — inicia OAuth
│   │   └── callback.js     ← GET  /api/auth/callback    — recibe token Google
│   ├── meetings/
│   │   ├── index.js        ← GET/POST /api/meetings
│   │   └── [id].js         ← GET/PATCH/DELETE /api/meetings/:id
│   ├── transcriptions/
│   │   └── [meetingId].js  ← GET/PATCH /api/transcriptions/:id
│   ├── process/
│   │   └── [meetingId].js  ← POST /api/process/:id  ← PIPELINE PRINCIPAL
│   ├── minutes/
│   │   └── [meetingId].js  ← GET/PATCH/POST /api/minutes/:id
│   ├── upload/
│   │   └── presigned.js    ← POST /api/upload/presigned
│   └── assistant/
│       └── chat.js         ← POST /api/assistant/chat
├── lib/                    ← Lógica compartida
│   ├── db.js               ← NeonDB client + helpers CRUD
│   ├── auth.js             ← JWT + Google OAuth helpers
│   ├── gemini.js           ← Transcripción + Actas + Asistente
│   └── drive.js            ← Google Drive upload + export
├── src/                    ← Frontend React (Vite)
│   ├── App.jsx             ← App principal con todas las pantallas
│   ├── main.jsx            ← Entry point React
│   ├── hooks/
│   │   └── useRecorder.js  ← MediaRecorder hook real
│   └── utils/
│       └── api.js          ← Cliente HTTP centralizado
├── sql/
│   └── schema.sql          ← ✅ YA EJECUTADO EN NEONDB
├── .env.example            ← Variables de entorno documentadas
├── vercel.json             ← Routing + config serverless
├── vite.config.js
├── index.html
└── package.json
```

---

## PASO 1 — Crear repo en GitHub

```bash
# En tu máquina local
git init conferenceapp
cd conferenceapp

# Copiar todos los archivos del proyecto aquí
# Luego:
git add .
git commit -m "feat: ConferenceApp initial commit"

# Crear repo en github.com y conectar
git remote add origin https://github.com/TU_USUARIO/conferenceapp.git
git push -u origin main
```

---

## PASO 2 — Variables de entorno necesarias

### 2a. DATABASE_URL (NeonDB — ya lo tienes)
1. Ve a **console.neon.tech** → tu proyecto
2. Click en **"Connection string"**
3. Copia el formato `postgresql://...`

### 2b. JWT_SECRET (generar aleatorio)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2c. GOOGLE_AI_API_KEY (ya la tienes)
- Es tu API key de Google AI Studio (aistudio.google.com)

### 2d. Google OAuth (pendiente — 10 minutos)
1. Ve a **console.cloud.google.com**
2. Crea un proyecto nuevo o usa uno existente
3. **APIs & Services → Enable APIs:**
   - ✅ Google Drive API
   - ✅ Google+ API (o People API)
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: ConferenceApp
   - Authorized redirect URIs: `https://TU-APP.vercel.app/api/auth/callback`
5. Copia **Client ID** y **Client Secret**

---

## PASO 3 — Deploy en Vercel

1. Ve a **vercel.com** → "Add New Project"
2. Import desde GitHub → selecciona tu repo `conferenceapp`
3. Framework Preset: **Vite**
4. **Environment Variables** — añade estas:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | postgresql://... (de NeonDB) |
| `JWT_SECRET` | el string aleatorio de 64 bytes |
| `GOOGLE_AI_API_KEY` | tu API key de AI Studio |
| `GOOGLE_CLIENT_ID` | de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | de Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://TU-APP.vercel.app/api/auth/callback` |
| `FRONTEND_URL` | `https://TU-APP.vercel.app` |

5. Click **Deploy**

---

## PASO 4 — Actualizar Google OAuth con URL real

Después del primer deploy, Vercel te da una URL tipo `conferenceapp-xxx.vercel.app`.

1. Vuelve a Google Cloud Console → Credentials → tu OAuth Client
2. Añade en Authorized redirect URIs: `https://conferenceapp-xxx.vercel.app/api/auth/callback`
3. Guarda
4. Actualiza `GOOGLE_REDIRECT_URI` en Vercel con esa URL

---

## Desarrollo local

```bash
npm install

# Crear .env.local con las variables (copia .env.example)
cp .env.example .env.local
# Edita .env.local con tus valores reales

# Terminal 1 — backend Vercel dev
npx vercel dev

# Terminal 2 — frontend Vite
npm run dev
```

---

## Flujo completo verificado

```
Usuario → /api/auth/google → Google OAuth
         ← token JWT → guardado en localStorage

Grabar reunión → MediaRecorder (micrófono real)
               → POST /api/meetings (crear)
               → POST /api/process/:id (audio base64)
               → Gemini transcribe + diariza
               → Gemini genera acta
               → meeting.status = READY

Ver transcripción → GET /api/transcriptions/:id
Renombrar speaker → PATCH /api/transcriptions/:id
Editar acta       → PATCH /api/minutes/:id
Finalizar acta    → PATCH /api/minutes/:id {status: FINAL}
Exportar Drive    → POST /api/minutes/:id/export
Asistente IA      → POST /api/assistant/chat
```

---

## Límites conocidos en V1

| Límite | Causa | Solución V2 |
|--------|-------|-------------|
| Audios >8MB van como base64 | Vercel 4.5MB payload limit | Upload directo a Drive via URL firmada |
| Reuniones >30min pueden timeout | Vercel 300s limit | Vercel Background Functions o queue |
| iOS Safari puede fallar grabación | WebM no soportado | RecordRTC con WAV fallback |
| Sin notificación push al terminar | Sin WebSocket | Supabase Realtime en V2 |
