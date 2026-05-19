# TrackYourLift — Master-Roadmap

## Rolle & Kontext

Du bist ein Senior Fullstack-Entwickler. Ich bin Anfänger und habe dieses Projekt von Replit zu Cursor umgezogen. Das Ziel ist eine Workout-Tracking-App, die extrem einfach zu bedienen ist, aber unter der Haube mächtige Features bietet.

**Zielgruppe:** Gym-Nutzer und Home-Workout-Fans.

**Key Features:** Große Übungsdatenbank, KI-Trainingspläne, Gewichtsempfehlungen und ein Smart Import (Fotos, Excel oder PDFs alter Pläne → digitaler Plan).

---

## Checkliste (Stand: lokal / Cursor)

### Block 1 — Setup & Basis **(Completed)**

- [x] **HANDOVER_REPORT.md** gelesen, Tech-Stack verstanden
- [x] **SQLite `workout.db`** aus Backup (lokal ausführen, wenn noch nicht vorhanden):

  `node -e "require('better-sqlite3')('workout.db').exec(require('fs').readFileSync('db_export.sql','utf-8'))"`

- [x] **`npm install`** (ggf. `better-sqlite3`: `npx prebuild-install` im Paketordner unter Windows)
- [x] **Letzte Fehler aus Report** adressiert (u. a. Auth-Routen, Vitest-Startskript, Gemini-Fallback-Kette, `tsc` sauber, Store-Webhooks ohne globales Auth auf `/api/subscriptions`)
- [x] **Native Einstieg:** `client/index.js` → `AppNative.tsx`

### Block 2 — Workout-UX & Polish **(Completed)**

- [x] **User-Auth lokal:** `POST /api/auth/signup`, `POST /api/auth/login` (+ Guest/Google/Apple wie zuvor)
- [x] **129 Übungen** im DB-Export / Seed
- [x] **Übungsliste / Medien:** öffentlicher Katalog `GET /api/exercises/catalog`, Thumbnails über **`GET /api/exercises/gif/:name?resolution=360`**, **`expo-image`** in **`ServerExerciseThumb`**, Lazy-Fetch pro Karte; Profil/Workout konsistent
- [x] **KI / Gemini:** `server/services/geminiGenerate.ts` (Modellkette), Import + Übersetzung, **Auto-Generate Pläne** mit Gemini + Template-Fallback
- [x] **Haftungsausschluss:** `DisclaimerScreen.tsx`, Button **„Ich habe verstanden und akzeptiere“**, **AsyncStorage** (`disclaimer_accepted_v1`), vor Onboarding/Main
- [x] **Slider-Feedback (ActiveWorkout):** Anker **Gewicht 10 / 50 / 100 kg**, **Reps 5 / 10 / 15** mit **zweizeiligen Tick-Markierungen** (vertikale Striche unter dem Slider + Zahlen darunter), kräftigere Akzentfarben
- [x] **Hybrid-Eingabe:** Tap auf Gewicht/Reps-Zahl → Modal mit **`number-pad` / `decimal-pad`**, **`KeyboardAvoidingView`**, **`returnKeyType="done"`**, Fokus & Soft-Keyboard zuverlässig
- [x] **Rest-Timer:** Toggle **oben rechts im Workout-Header** (Icon + Switch + Beschriftung „Pause“), zusätzlich **Profil** → gleiche Präferenz via **`mergeRestTimerPreference`** in `storage.ts`
- [x] **Übung wechseln:** `GET /api/exercises/alternatives`, Modal im aktiven Workout, Plan-Persistenz

### Block 3 — (optional / laufend)

- [x] **Smart Import (siehe Block 4)** — umgesetzt in Block 4

### Block 4 — KI Smart Import **(Completed)**

- [x] **Backend:** `server/routes/importWorkout.ts` — Claude primär, Gemini-Fallback, Rate-Limit, JSON-Extraktion, **serverseitiges Namens-Matching** (`importExerciseMatchService.ts` → Katalog), **422 `IMPORT_UNREADABLE`** bei leerem / unlesbarem Ergebnis
- [x] **Client:** `useWorkoutImport.ts`, `ImportWorkoutScreen.tsx` — Kamera/Bibliothek/PDF/Excel, Review vor Speichern, **Scan-UI mit Laser-Animation** (Reanimated), deutsche Fehlertexte
- [x] **Persistenz:** `Exercise.targetWeight` / `Exercise.targetReps` (optional) in `storage.ts`; Import schreibt bestätigte Werte aus dem Review; **ActiveWorkout** nutzt sie als **Startwerte** in den Slidern, wenn für ein Set keine Last-Session-Zeile existiert
- [ ] *(optional später)* Vitest/Contract-Tests für Import-Route, strengere Payload-Limits dokumentieren

### Start (lokal)

```bash
# Backend (JWT_SECRET setzen, siehe HANDOVER)
npx tsx server/index.ts
# oder: node ./node_modules/tsx/dist/cli.mjs server/index.ts
```

```bash
# Expo
npx expo start
# optional: EXPO_OFFLINE=1 npx expo start
```

---

## Original-Notizen (Disclaimer-Spezifikation)

Haftungsausschluss einbauen: Komponente `DisclaimerScreen.tsx` mit Haftungstext.

Der Nutzer muss den Disclaimer beim **allerersten** Start mit einem Button **„Ich habe verstanden und akzeptiere“** bestätigen, bevor er zur App gelangt.

Zustimmung lokal (AsyncStorage), damit die Abfrage nicht bei jedem Start erscheint.

Design: schlicht und seriös, passend zu einer Gym-App.
