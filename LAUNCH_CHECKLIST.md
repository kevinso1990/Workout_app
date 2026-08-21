# TrackYourLift — Launch-Leitfaden (App Store)

Arbeite die Blöcke der Reihe nach ab. Alles unter „📋 Kopieren" ist fertig zum
Einfügen. Alles unter „👉 Schritte" machst du in App Store Connect / beim Anbieter.

---

## 1) Screenshots  (App Store Connect → Version → Medien)
Apple verlangt mindestens **iPhone 6,9″** (1320×2868) **oder 6,5″** (1242×2688).
→ Werden separat aus dem Simulator generiert und dir übergeben (5 Stück:
Plan-Übersicht, aktives Workout, KI-Ziel, Import, Fortschritt).

**👉 Schritte:** App Store Connect → deine App → „+ Version" (1.0) → **Vorschau und
Screenshots** → 6,9″-Tab → die 5 PNGs hochladen (Reihenfolge = Reihenfolge im Store).

---

## 2) App-Privacy „Nutrition Labels"  (ASC → App-Datenschutz)
Wahrheitsgemäß, basierend auf dem Gast-Modell (kein Login, geräte-/gast-basiert):

**Frage „Erfasst diese App Daten?" → Ja.**

| Datentyp | Erfasst? | Verknüpft mit Nutzer? | Tracking? | Zweck |
|---|---|---|---|---|
| **Gesundheit & Fitness → Fitness** (Workouts, Sätze) | Ja | Ja (Gast-ID) | Nein | App-Funktionalität |
| **Identifikatoren → Geräte-ID / Nutzer-ID** | Ja | Ja | Nein | App-Funktionalität |
| **Nutzerinhalte → Fotos/PDF** (nur beim Import) | Ja | Ja | Nein | App-Funktionalität |

- **„Zum Tracking verwendet": NEIN** (keine Werbung/Cross-App-Tracking).
- **Drittanbieter offenlegen:** Import/KI senden Inhalte an **Anthropic** und **Google (Gemini)** als Auftragsverarbeiter. (RevenueCat erst wenn Abo aktiv.)
- Muss zur Datenschutzerklärung passen (siehe #8).

---

## 3) Store-Metadaten  (ASC → App-Informationen / Version)

**Kategorie:** Health & Fitness (primär). Sekundär optional: Lifestyle.

### 📋 Untertitel (max. 30 Zeichen)
- DE: `KI-Trainingsplan & Logger`
- EN: `AI workout plans & logger`

### 📋 Werbetext / Promo (max. 170 Zeichen)
- DE: `Erstelle per KI in Sekunden einen Trainingsplan – oder importiere deinen bestehenden aus PDF/Foto. Logge jeden Satz. 1000+ Übungen mit Bildern.`
- EN: `Build a workout plan with AI in seconds — or import your existing one from a PDF/photo. Log every set. 1000+ exercises with images.`

### 📋 Keywords (max. 100 Zeichen, kommagetrennt, KEINE Leerzeichen nach Komma)
- DE: `training,gym,fitness,workout,trainingsplan,krafttraining,ki,hantel,muskelaufbau,plan,satz,übungen`
- EN: `workout,gym,fitness,training,lifting,strength,ai,dumbbell,plan,log,tracker,exercises,muscle`

### 📋 Beschreibung — DE
```
TrackYourLift ist dein Krafttraining-Logger mit KI.

▶ KI-TRAININGSPLAN IN SEKUNDEN
Sag der App dein Ziel („Hüftmobilität verbessern", „Muskelaufbau Oberkörper") –
sie baut daraus einen passenden Plan. Oder importiere deinen bestehenden Plan
einfach per PDF oder Foto; die KI liest ihn aus und legt ihn für dich an.

▶ SCHNELL LOGGEN IM GYM
Gewicht und Wiederholungen in 1-kg-Schritten per Tipp, Pausen-Timer, der dein
Workout nicht verdeckt, Aufwärmsätze, persönliche Rekorde. Gerät belegt? Tausch
die Übung mit einem Tipp gegen eine Alternative – nur für diese Einheit.

▶ 1000+ ÜBUNGEN MIT BILDERN
Große Übungsbibliothek mit Fotos, deutschen Namen und Muskelgruppen.

▶ FORTSCHRITT SEHEN
Volumen, Rekorde, Verlauf pro Übung und Muskelgruppen-Balance.

Kein Konto nötig – leg direkt los. Deine Daten bleiben auf deinem Gerät, mit
optionalem Cloud-Backup per Code.
```

### 📋 Beschreibung — EN
```
TrackYourLift is your strength-training logger with AI.

▶ AI WORKOUT PLAN IN SECONDS
Tell the app your goal ("improve hip mobility", "upper-body muscle") and it
builds a matching plan. Or import your existing plan from a PDF or photo — the
AI reads it and sets it up for you.

▶ FAST LOGGING IN THE GYM
Tap weight and reps in 1 kg steps, a rest timer that doesn't hide your workout,
warm-up sets, personal records. Machine taken? Swap the exercise for an
alternative in one tap — just for this session.

▶ 1000+ EXERCISES WITH IMAGES
Large exercise library with photos, names and muscle groups.

▶ SEE PROGRESS
Volume, records, per-exercise history and muscle-group balance.

No account required — just start. Your data stays on your device, with optional
cloud backup via a code.
```

### 📋 Support-URL / Marketing-URL
- Support-URL: `https://api.trackyourlift.de/impressum.html` (oder eine echte Support-Seite/Mail)
- Datenschutz-URL: `https://api.trackyourlift.de/datenschutz.html`

---

## 4) Altersfreigabe  (ASC → Version → Altersfreigabe)
Alle Fragen mit **„Keine/Nein"** beantworten → Ergebnis **4+**.
(Keine Gewalt, kein anstößiger Inhalt, kein Gewinnspiel, kein Nutzer-generierter
öffentlicher Content.)

---

## 5) Export-Compliance
Bereits erledigt im Code (`ITSAppUsesNonExemptEncryption: false`) → beim Einreichen
**keine** Rückfrage. Nichts zu tun.

---

## 6) Sentry aktivieren (Crash-Reporting)
**👉 Konto:** sentry.io → 2 Projekte (React Native + Node.js) → je DSN kopieren.
- **Server (sofort):**
  ```bash
  ssh root@187.77.89.8 'echo "SENTRY_DSN=DEIN_SERVER_DSN" >> /root/Workout_app/.env && cd /root/Workout_app && pm2 restart workout-api'
  ```
- **Client:** `EXPO_PUBLIC_SENTRY_DSN=DEIN_CLIENT_DSN` in die `.env` → **Build 28** nötig (DSN wird beim Build eingebacken).
→ Schick mir die 2 DSNs, dann trage ich sie ein + stoße Build 28 an.

---

## 7) Off-site-Backup + Uptime-Monitor
- **Off-site (Backblaze B2, 10 GB gratis):** Bucket + App-Key anlegen → auf dem VPS
  `apt install rclone && rclone config` (Remote „offsite", Typ b2) → dann:
  ```bash
  ssh root@187.77.89.8 'printf "#!/bin/bash\nrclone copy \"\$1\" offsite:trackyourlift-backups/\n" > /root/backups/offsite-upload.sh && chmod +x /root/backups/offsite-upload.sh'
  ```
- **Uptime-Monitor (kostenlos, kein Code):** uptimerobot.com → + Add Monitor →
  HTTP(s) → `https://api.trackyourlift.de/health` → Intervall 5 Min → E-Mail-Alarm.

---

## 8) Legal-Review
Von jemandem mit Ahnung (Anwalt/Datenschutz-Dienst) prüfen lassen:
- **Impressum** vollständig (Name/Anschrift/Kontakt nach §5 TMG).
- **Datenschutzerklärung** deckt ab: Gast-Modell + Geräte-ID, Cloud-Backup,
  **Auftragsverarbeiter Anthropic + Google (Gemini)** (Datenübermittlung USA),
  RevenueCat (sobald Abo aktiv). Muss zu den App-Privacy-Labels (#2) passen.

---

## 9) QA-Pass (echtes Gerät via TestFlight)
Frischer Install → durchspielen: Onboarding → Plan (KI + Import) → Workout
loggen → Historie → Backup-Code sichern & wiederherstellen. → Wird von mir im
Simulator vorab durchgespielt; echtes-Gerät-Pass machst du auf Build 27.

---

## 10) Rest-Platzhalter
3 Core-Holds (Bird Dog, Hollow Hold, L-Sit) ohne echtes Foto — Platzhalter bleibt,
da free-exercise-db keinen passenden Treffer hat. Kein Blocker.
```
