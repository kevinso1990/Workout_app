# TrackYourLift — Technischer Übergabebericht
**Erstellt:** 3. Mai 2026  
**Zweck:** Vollständige Übergabe an Cursor / VS Code oder eine externe KI ohne Rückfragen.

---

## 1. Tech-Stack & Architektur

### Übersicht
```
┌─────────────────────────────────────────────────────────┐
│  MOBILE APP (Expo / React Native)     Port 8081 Metro   │
│  client/AppNative.tsx → React Navigation                │
├─────────────────────────────────────────────────────────┤
│  WEB SPA (React 19 / Vite / Wouter)   Port 5000 (/)    │
│  client/App.tsx → client/pages/                        │
├─────────────────────────────────────────────────────────┤
│  BACKEND  Express.js + TypeScript     Port 5000 /api/  │
│  server/index.ts                                        │
├─────────────────────────────────────────────────────────┤
│  DATENBANK  SQLite (WAL-Modus)                          │
│  ./workout.db  — better-sqlite3 (synchron)              │
└─────────────────────────────────────────────────────────┘
```

### Sprachen & Versionen
| Technologie | Version | Einsatz |
|---|---|---|
| TypeScript | ~5.9 | Frontend + Backend |
| React | 19.1.0 | Web SPA |
| React Native | 0.81.5 | Mobile App |
| Expo SDK | ^54 | Mobile Plattform |
| Express | ^5.0 | REST-Backend |
| better-sqlite3 | ^12.6 | Datenbankzugriff |
| Vite | ^7.3 | Web-Build-Tool |
| TailwindCSS | v4 | Web-Styling |
| React Navigation | 7+ | Native Navigation |
| i18next | ^25 | 6 Sprachen (de/en/es/fr/it/pt) |
| @anthropic-ai/sdk | ^0.92 | KI-Import (primär) |
| @google/generative-ai | ^0.24 | KI-Import (Fallback) |
| web-push | ^3.6 | Push-Benachrichtigungen |

### Zwei parallele App-Codebases (WICHTIG)
- **Native App:** `client/AppNative.tsx` → `client/screens/` → `client/navigation/`  
  Läuft in Expo Go (iOS/Android) auf Port 8081 via Metro.
- **Web SPA:** `client/App.tsx` → `client/pages/`  
  Läuft im Browser, serviert vom Express-Backend auf Port 5000.  
  **Diese beiden niemals mischen** — `window.location` crasht die native App.

---

## 2. Datenbank-Details

### Datei
```
./workout.db   (SQLite, WAL-Modus, Foreign Keys aktiviert)
```

### Aktueller Datenbestand (3. Mai 2026)
| Tabelle | Zeilen |
|---|---|
| exercises | 129 |
| users | 19 |
| plans | 2 |
| plan_exercises | 0 |
| sessions | 0 |
| sets | 0 |
| body_weight | 1 |
| exercise_feedback | 0 |
| muscle_fatigue | 0 |
| push_subscriptions | 0 |
| notification_log | 1 |
| exercise_media_cache | 0 |
| exercise_votes | 0 |
| subscription_receipts | 0 |

### Tabellenstruktur (vollständig)

```sql
-- Übungen (129 vorgeseedete Einträge)
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL,
  equipment TEXT DEFAULT 'barbell',
  is_custom INTEGER DEFAULT 0
);

-- Workout-Pläne
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Übungen in einem Plan (mit Supersatz-Unterstützung)
CREATE TABLE plan_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  sort_order INTEGER NOT NULL,
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  default_weight REAL DEFAULT 0,
  superset_group INTEGER          -- NULL = kein Supersatz
);

-- Workout-Einheiten (Sessions)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,               -- NULL = läuft noch
  rpe INTEGER,                    -- Rate of Perceived Exertion 1-10
  notes TEXT
);

-- Protokollierte Sätze
CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  is_drop_set INTEGER DEFAULT 0,
  parent_set_id INTEGER REFERENCES sets(id) ON DELETE SET NULL,
  logged_at TEXT DEFAULT (datetime('now'))
);

-- Nutzer-Feedback pro Übung (easy/right/hard)
CREATE TABLE exercise_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  rating TEXT CHECK(rating IN ('easy', 'right', 'hard'))
);

-- Körpergewicht-Verlauf
CREATE TABLE body_weight (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg REAL NOT NULL,
  logged_date TEXT NOT NULL DEFAULT (date('now')),
  notes TEXT
);

-- MuscleWiki GIF/Video Cache (Server-seitig)
CREATE TABLE exercise_media_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_name TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,             -- JSON mit gif/mp4/fallback URLs
  fetched_at TEXT DEFAULT (datetime('now'))
);

-- Muskel-Ermüdung (für Recovery-Panel)
CREATE TABLE muscle_fatigue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  muscle_group TEXT NOT NULL,
  fatigue_score REAL NOT NULL,
  last_trained_at TEXT NOT NULL,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
);

-- Benutzer (OAuth: Google + Apple; Gäste möglich)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,             -- NULL bei OAuth-Nutzern
  created_at TEXT DEFAULT (datetime('now')),
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_provider TEXT,
  subscription_expires_at TEXT,
  name TEXT,
  avatar_url TEXT,
  provider TEXT,                  -- 'google' | 'apple'
  provider_id TEXT
);

-- Push-Benachrichtigungs-Abonnements (Web-Push VAPID)
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Deduplizierung für tägliche Push-Nachrichten
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT NOT NULL,
  sent_date TEXT NOT NULL,
  UNIQUE(notification_type, sent_date)
);

-- Abo-Quittungen (Apple/Google In-App Purchase)
CREATE TABLE subscription_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL,
  receipt_data TEXT NOT NULL,
  verified_at TEXT DEFAULT (datetime('now'))
);

-- Nutzer-Voting für Übungsqualität
CREATE TABLE exercise_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
  UNIQUE(exercise_id, user_id)
);

-- Split-Refresh Snooze (Erinnerung, Plan zu erneuern)
CREATE TABLE split_refresh_snooze (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snoozed_at TEXT DEFAULT (datetime('now')),
  snooze_until TEXT NOT NULL
);
```

### Datenbankzugriff
- **Bibliothek:** `better-sqlite3` — vollständig synchron, kein ORM
- **Singleton:** `server/db.ts` exportiert eine einzige `db`-Instanz
- **Controller:** `server/controllers/*.ts` — direktes SQL mit `db.prepare(...).all/get/run()`
- **Migrationen:** Inline-Funktionen in `server/db.ts`, die bei jedem Server-Start laufen

---

## 3. Projektstruktur

```
TrackYourLift/
├── app.json                    # Expo-Konfiguration (Name, Bundle-IDs, Icons)
├── babel.config.js
├── package.json                # Alle Abhängigkeiten (NICHT bearbeiten für native Deps)
├── tsconfig.json
├── vite.config.ts              # Web-SPA Build
├── vitest.*.config.ts          # Test-Konfiguration
├── playwright.config.ts        # E2E-Tests
├── workout.db                  # SQLite-Datenbank (lokal)
│
├── client/                     # FRONTEND (beide Apps)
│   ├── index.js                # Expo-Einstiegspunkt → AppNative (NICHT App.tsx!)
│   ├── AppNative.tsx           # Native App Root (Expo Go)
│   ├── App.tsx                 # Web SPA Root (Browser)
│   │
│   ├── screens/                # Native Screens (React Navigation)
│   │   ├── main/
│   │   │   ├── ActiveWorkoutScreen.tsx   # Workout läuft
│   │   │   └── StartWorkoutScreen.tsx    # Plan auswählen
│   │   ├── onboarding/                   # 9 Onboarding-Screens
│   │   ├── CreatePlanScreen.tsx
│   │   ├── EditPlanScreen.tsx
│   │   ├── ExercisesScreen.tsx
│   │   ├── ImportWorkoutScreen.tsx       # KI-Import (Foto/PDF/CSV)
│   │   ├── MyPlansScreen.tsx
│   │   ├── PlanDetailScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── ProgressScreen.tsx
│   │
│   ├── navigation/
│   │   ├── RootStackNavigator.tsx        # Haupt-Stack
│   │   ├── MainTabNavigator.tsx          # 3-Tab Bottom Bar
│   │   └── OnboardingStackNavigator.tsx
│   │
│   ├── pages/                  # Web SPA Pages (Wouter)
│   │   ├── Dashboard.tsx, Plans.tsx, PlanBuilder.tsx
│   │   ├── ActiveWorkout.tsx, PostWorkout.tsx
│   │   ├── Progress.tsx, History.tsx
│   │   └── Profile.tsx, SessionDetail.tsx
│   │
│   ├── components/             # Wiederverwendbare Komponenten
│   │   ├── ErrorBoundary.tsx   # App-Crash-Schutz (IMMER einbinden)
│   │   ├── MuscleHeatmap.tsx   # SVG Muskel-Wärmekarte
│   │   ├── ConsistencyCalendar.tsx
│   │   ├── RecoveryPanel.tsx
│   │   ├── ExerciseMedia.tsx   # GIF/Video-Anzeige
│   │   ├── GifPreviewModal.tsx
│   │   ├── PlateCalculator.tsx
│   │   └── onboarding/ProgressBar.tsx
│   │
│   ├── hooks/
│   │   └── useWorkoutImport.ts  # KI-Import-Logik (Foto/PDF/XLSX)
│   │
│   ├── lib/
│   │   ├── api.ts              # API-Helfer + continueAsGuest()
│   │   ├── query-client.ts     # TanStack Query + getApiUrl()
│   │   ├── storage.ts          # AsyncStorage-Wrapper
│   │   ├── onboardingUtils.ts  # Plan-Generierungs-Logik (getestete reine Funktionen)
│   │   └── notifications.ts    # Push-Benachrichtigungen
│   │
│   ├── constants/theme.ts      # Farben, Abstände, Typografie
│   ├── context/
│   │   ├── ThemeContext.tsx    # Dark/Light Mode
│   │   └── OnboardingContext.tsx
│   └── locales/                # i18n: de, en, es, fr, it, pt
│
├── server/                     # BACKEND (Express + TypeScript)
│   ├── index.ts                # Server-Einstieg, Port 5000
│   ├── db.ts                   # SQLite-Singleton + Schema + Migrationen
│   │
│   ├── routes/
│   │   ├── index.ts            # Alle Routen registrieren
│   │   ├── auth.ts             # Google/Apple/Guest OAuth
│   │   ├── plans.ts            # CRUD Pläne + Auto-Generierung
│   │   ├── sessions.ts         # Workout-Sessions
│   │   ├── sets.ts             # Satz-Protokollierung
│   │   ├── exercises.ts        # Übungs-Bibliothek
│   │   ├── stats.ts            # Statistiken & PRs
│   │   ├── recovery.ts         # Muskel-Recovery
│   │   ├── recommendations.ts  # Progressive Overload Empfehlungen
│   │   ├── importWorkout.ts    # KI-Import (Claude → Gemini Fallback)
│   │   ├── push.ts             # Web-Push Subscriptions
│   │   ├── bodyWeight.ts       # Körpergewicht-Verlauf
│   │   ├── muscleWiki.ts       # MuscleWiki-Proxy + Cache
│   │   ├── subscriptions.ts    # In-App Purchase Webhooks
│   │   ├── splitRefresh.ts     # Plan-Erneuerungs-Erinnerung
│   │   ├── votes.ts            # Übungs-Voting
│   │   ├── feedback.ts         # Übungs-Feedback (easy/right/hard)
│   │   └── translateExercise.ts # Übungsname übersetzen (Gemini)
│   │
│   ├── controllers/            # Business-Logik pro Route
│   ├── middleware/
│   │   ├── auth.ts             # JWT-Prüfung (requireAuth / optionalAuth)
│   │   └── rateLimiter.ts      # IP-basiertes Rate-Limiting
│   └── __tests__/
│       └── import.test.ts      # 7 Unit-Tests für Import-Route
│
├── e2e/                        # Playwright E2E-Tests
│   └── onboarding.spec.ts      # 8 Tests für Onboarding-Flow
│
└── assets/                     # App-Icons, Splash, Illustrationen
```

---

## 4. API-Endpunkte (vollständige Liste)

```
AUTH         POST /api/auth/google           Google OAuth Sign-In
             POST /api/auth/apple            Apple Sign-In
             POST /api/auth/guest            Gast-Login (kein Account nötig)
             GET  /api/auth/me               Aktueller Nutzer
             POST /api/auth/logout

PLÄNE        GET  /api/plans                 Alle Pläne
             POST /api/plans                 Plan erstellen
             GET  /api/plans/:id             Plan details
             PUT  /api/plans/:id             Plan aktualisieren
             DELETE /api/plans/:id           Plan löschen
             POST /api/plans/auto-generate   KI-Plan-Generierung (Onboarding)

SESSIONS     GET  /api/sessions              Session-Liste
             POST /api/sessions              Session starten
             GET  /api/sessions/:id          Session details
             PUT  /api/sessions/:id          Session beenden
             GET  /api/sessions/history      Verlauf (auth required)

SÄTZE        POST /api/sets                  Satz protokollieren
             PATCH /api/sets/:id/rir         RIR aktualisieren
             DELETE /api/sets/:id            Satz löschen

STATISTIKEN  GET  /api/stats/weekly-volume
             GET  /api/stats/prs             Persönliche Rekorde
             GET  /api/stats/exercise-history/:id
             GET  /api/stats/last-sets/:id
             GET  /api/stats/totals
             GET  /api/stats/consistency
             GET  /api/stats/muscle-volume-7d
             GET  /api/stats/muscle-balance
             GET  /api/stats/weekly-summary
             GET  /api/stats/exercise-progress/:id
             GET  /api/stats/exercise-best/:id
             GET  /api/stats/rest-average/:id
             GET  /api/stats/logged-exercises

RECOVERY     GET  /api/recovery              Muskel-Erholungsstatus
EMPFEHLUNGEN GET  /api/recommendations/:planId
             POST /api/recommendations/:planId/accept

ÜBUNGEN      GET  /api/exercises             Übungs-Bibliothek
             POST /api/exercises             Eigene Übung hinzufügen
             GET  /api/musclwiki/search      MuscleWiki-Proxy

KI-IMPORT    POST /api/import-workout        Foto/PDF/CSV → Plan (Claude+Gemini)
             Limit: 15 Anfragen / IP / Tag

KÖRPERGEWICHT GET  /api/body-weight
             POST /api/body-weight

PUSH-PUSH    GET  /api/push/vapid-public     VAPID Public Key
             POST /api/push/subscribe
             DELETE /api/push/unsubscribe

ABONNEMENTS  GET  /api/subscriptions/status
             POST /api/subscriptions/validate/apple
             POST /api/subscriptions/validate/google
             POST /api/subscriptions/webhooks/apple
             POST /api/subscriptions/webhooks/google
```

---

## 5. Detaillierte Fehlerhistorie

### Fehler 1 — KI-Import crashte wegen erschöpftem Gemini-Kontingent
**Fehlermeldung:**
```
[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
model: gemini-2.0-flash-lite
```
**Ursache:** Der gesamte Foto-Import lief über Gemini (Google AI Free Tier). Das kostenlose tägliche Kontingent war am 2. Mai 2026 vollständig aufgebraucht.  
**Lösung:** Claude (`claude-haiku-4-5-20251001`) als primären Provider eingebaut; Gemini bleibt Fallback.

---

### Fehler 2 — Claude 404 wegen veralteter Modellbezeichnung
**Fehlermeldung:**
```
Claude failed, trying Gemini fallback: 404
{"type":"error","error":{"type":"not_found_error","message":"model: claude-3-5-haiku-20241022"}}
```
**Ursache:** Das Modell `claude-3-5-haiku-20241022` wurde von Anthropic am 19. Februar 2026 eingestellt (EOL). Der Code verwendete noch den alten Namen.  
**Lösung:** Modell auf `claude-haiku-4-5-20251001` aktualisiert.

---

### Fehler 3 — KI kann ein leeres/synthetisches Bild nicht verarbeiten
**Fehlermeldung:**
```
Claude failed: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Could not process image"}}
Import workout error: Error: Could not parse workout plan from input
```
**Ursache:** Ein selbst erstelltes 1×1-Pixel-JPEG war malformed. Echter Usecase (Handyfoto) funktioniert korrekt.  
**Lösung:** Kein Code-Fix nötig — korrektes Verhalten. Eine leere/ungültige Datei soll abgelehnt werden.

---

### Fehler 4 — Foto-Auswahl schlägt lautlos fehl (Permission denied)
**Symptom:** Nutzer tippt "Choose from Library", nichts passiert, keine Fehlermeldung.  
**Ursache:** `expo-image-picker` gibt bei verweigerten Berechtigungen `null` zurück ohne Exception. Der Code prüfte das Ergebnis nicht.  
**Lösung:** `pickImage()` in `useWorkoutImport.ts` wirft jetzt beschreibende Fehler bei Permission denied und iOS "limited" access.

---

### Fehler 5 — Metro-Server blockiert auf Expo-Login-Prompt
**Symptom:** `Start Frontend` Workflow hängt ohne Output.  
**Ursache:** Beim ersten Start fragt Expo interaktiv: "Log in or proceed anonymously?" — blockiert den CI-ähnlichen Replit-Workflow.  
**Lösung:** `EXPO_OFFLINE=1` als Env-Variable gesetzt → überspringt den Prompt. Tradeoff: kein OTA-Update-Check in Dev.

---

## 6. Feature-Status (Roadmap)

### Native Mobile App (Expo)

| Feature | Status | Hinweise |
|---|---|---|
| Onboarding-Flow (9 Screens) | **[ERLEDIGT]** | WelcomeScreen → SplitSelectionScreen; 47 Unit-Tests, 8 E2E-Tests |
| Plan-Auto-Generierung (KI) | **[ERLEDIGT]** | POST /api/plans/auto-generate; Frequenz/Ziel/Level/Equipment |
| Pläne anzeigen (MyPlans) | **[ERLEDIGT]** | Liste, Detail, Löschen |
| Plan erstellen (manuell) | **[ERLEDIGT]** | CreatePlanScreen + EditPlanScreen |
| Workout starten | **[ERLEDIGT]** | StartWorkoutScreen → ActiveWorkoutScreen |
| Sätze protokollieren | **[ERLEDIGT]** | 3 Taps, Gewicht/Wiederholungen, Ziel: ≤3 Taps |
| Supersätze | **[ERLEDIGT]** | superset_group in DB, visuelle Gruppierung |
| Drop-Sets | **[ERLEDIGT]** | is_drop_set + parent_set_id |
| Workout beenden + RPE | **[ERLEDIGT]** | sessions.finished_at + sessions.rpe |
| Übungs-Feedback (easy/right/hard) | **[ERLEDIGT]** | exercise_feedback Tabelle |
| Progressive Overload Empfehlung | **[ERLEDIGT]** | /api/recommendations/:planId |
| Fortschrifts-Screen | **[ERLEDIGT]** | ProgressScreen.tsx |
| Statistiken & PRs | **[ERLEDIGT]** | weekly-volume, prs, exercise-history etc. |
| Recovery-Panel | **[ERLEDIGT]** | muscle_fatigue + Decay-Logik |
| Muskel-Heatmap | **[ERLEDIGT]** | SVG MuscleHeatmap.tsx |
| Übungs-Bibliothek | **[ERLEDIGT]** | 129 geseedete Übungen + eigene hinzufügen |
| Übungs-Medien (GIF/Video) | **[ERLEDIGT]** | MuscleWiki-Proxy + expo-video |
| KI-Import (Foto/PDF/CSV) | **[ERLEDIGT]** | Claude primär (Haiku), Gemini Fallback; 15 req/IP/Tag |
| Körpergewicht-Tracking | **[ERLEDIGT]** | body_weight Tabelle |
| Konsistenz-Kalender | **[ERLEDIGT]** | ConsistencyCalendar.tsx |
| Übungs-Voting | **[ERLEDIGT]** | exercise_votes Tabelle |
| Mehrsprachigkeit | **[ERLEDIGT]** | de, en, es, fr, it, pt |
| Dark/Light Mode | **[ERLEDIGT]** | ThemeContext, dark-first |
| Platten-Kalkulator | **[ERLEDIGT]** | PlateCalculator.tsx |
| Gast-Modus (ohne Anmeldung) | **[ERLEDIGT]** | POST /api/auth/guest + AsyncStorage |
| Google Sign-In | **[ERLEDIGT]** | google-auth-library |
| Apple Sign-In | **[ERLEDIGT]** | expo-apple-authentication + jwks-rsa |
| Push-Benachrichtigungen | **[ERLEDIGT]** | web-push + VAPID-Keys |
| PWA (Web) | **[ERLEDIGT]** | Service Worker + Manifest |
| In-App Purchases | **[TEILWEISE FUNKTIONAL]** | Webhooks vorhanden; subscription_tier in DB; UI-Integration unklar |
| Split-Refresh Erinnerung | **[TEILWEISE FUNKTIONAL]** | Snooze-Logik vorhanden; UI-Hinweis mglw. nicht prominent genug |
| Übungsname übersetzen | **[TEILWEISE FUNKTIONAL]** | /api/translate-exercise (Gemini) — Quota-Problem wie oben |
| Rest-Timer (aktives Workout) | **[OFFEN]** | Kein Countdown-Timer nach jedem Satz |
| Workout-Sharing | **[OFFEN]** | expo-sharing vorhanden, Feature nicht gebaut |
| Wearable-Integration | **[OFFEN]** | Nicht implementiert |
| Soziale Features | **[OFFEN]** | Nicht implementiert |

### Web SPA (Browser, Port 5000)

| Feature | Status |
|---|---|
| Dashboard | **[ERLEDIGT]** |
| Plan-Builder | **[ERLEDIGT]** |
| Aktives Workout | **[ERLEDIGT]** |
| Fortschritts-Grafiken | **[ERLEDIGT]** |
| Session-Verlauf | **[ERLEDIGT]** |
| Profil | **[ERLEDIGT]** |

---

## 7. Lokale Einrichtung & Secrets

### Voraussetzungen
```bash
Node.js 20+
npm (kein pnpm/yarn)
```

### Projekt klonen und starten
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Expo-Browserpakete installieren (Playwright für E2E)
npx playwright install chromium

# 3. Backend starten (Terminal 1)
NODE_ENV=development npx tsx server/index.ts
# → Server läuft auf http://localhost:5000

# 4. Frontend starten (Terminal 2)
EXPO_OFFLINE=1 npm run expo:dev
# → Metro läuft auf http://localhost:8081
```

### Umgebungsvariablen (Secrets)
Alle Secrets als `.env`-Datei im Projekt-Root oder als Systemvariablen:

```env
# PFLICHT — Server-Authentifizierung
JWT_SECRET=<zufälliger langer String>
SESSION_SECRET=<zufälliger langer String>

# PFLICHT — Push-Benachrichtigungen (VAPID)
# Generieren: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=<öffentlicher VAPID-Schlüssel>
VAPID_PRIVATE_KEY=<privater VAPID-Schlüssel>

# PFLICHT für KI-Import — mindestens einer muss gesetzt sein
ANTHROPIC_API_KEY=<Claude API Key von console.anthropic.com>
GEMINI_API_KEY=<Google AI Key von aistudio.google.com>

# OPTIONAL — für lokale Entwicklung (wird automatisch gesetzt in Replit)
EXPO_PUBLIC_DOMAIN=localhost:5000
```

### Wichtige npm-Scripts
```bash
npm run expo:dev          # Metro-Dev-Server
npm run test              # Unit-Tests (47 Tests)
npm run test:component    # Komponenten-Tests (40 Tests)
npm run test:e2e          # E2E-Tests mit Playwright (8 Tests)
npx tsx server/index.ts   # Backend direkt starten
```

### Bundle-IDs (NIEMALS ändern nach erstem Setup)
```
iOS:     com.kevinsonnen.workoutapp
Android: com.fitplan.app
Scheme:  fitplan://
```

---

## 8. Wichtige Hinweise für Cursor / VS Code

### KI-Modelle (Stand Mai 2026)
- **Claude primär:** `claude-haiku-4-5-20251001` (schnell, günstig)
- **Claude EOL:** `claude-3-5-haiku-20241022` — gibt 404, nicht verwenden
- **Gemini Fallback:** `gemini-2.0-flash-lite` — Free Tier täglich erschöpfbar

### Kritische Architektur-Regeln
1. `client/index.js` MUSS `@/AppNative` importieren, NICHT `@/App`
2. Nie `window`, `document` oder `wouter` in native Screens verwenden
3. Nie `i18n.ts` in den nativen Baum importieren (Browser-only Detector)
4. Bilder mit `require('../../assets/...')` laden, keine Aliases für Assets
5. Niemals `&&` für bedingte JSX-Render verwenden → stattdessen ternary `? :`
6. Alle `<Text>`-Ausgaben müssen in `<Text>`-Komponenten sein
7. `package.json` scripts NICHT ändern; native Deps nur über `npx expo install`

### Datenbankzugriff lokal
```javascript
// Beispiel direkt mit better-sqlite3
const Database = require('better-sqlite3');
const db = new Database('./workout.db');
db.prepare("SELECT COUNT(*) as n FROM exercises").get(); // → { n: 129 }
```
