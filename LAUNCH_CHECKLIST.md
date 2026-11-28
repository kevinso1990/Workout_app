# TrackYourLift — Launch-Leitfaden (App Store)

Arbeite die Blöcke der Reihe nach ab. Alles unter „📋 Kopieren" ist fertig zum
Einfügen. Alles unter „👉 Schritte" machst du in App Store Connect / beim Anbieter.

---

## 1) Screenshots  (App Store Connect → Version → Medien)
Apple verlangt mindestens **iPhone 6,9″** (1320×2868) **oder 6,5″** (1242×2688).
→ Werden separat aus dem Simulator generiert und dir übergeben (5 Stück, in
dieser Reihenfolge, weil der Import der Grund zum Installieren ist):
1. Import: Foto/PDF vom Trainingsplan → erkannter Plan
2. Importierter Plan mit Rotation / Kurz-Lang-Varianten
3. Aktives Training mit „Letztes Mal“ zum Schlagen
4. Woche/Monat mit Kraft- und Sporttagen
5. Fortschritt / Rekorde

**👉 Schritte:** App Store Connect → deine App → Version 1.1.0 → **Vorschau und
Screenshots** → 6,9″-Tab → die 5 PNGs hochladen (Reihenfolge = Reihenfolge im Store).

---

## 2) App-Privacy „Nutrition Labels"  (ASC → App-Datenschutz)
Wahrheitsgemäß, Stand 1.1.0: Gast-Konto über eine Geräte-ID im Schlüsselbund,
Cloud-Backup auf unserem Server, optional „Mit Apple fortfahren“, anonyme
Nutzungsstatistik. Kostenlos, keine Käufe.

**Frage „Erfasst diese App Daten?" → Ja.**

| Datentyp | Verknüpft mit Nutzer? | Tracking? | Zweck |
|---|---|---|---|
| **Gesundheit & Fitness → Fitness** (Pläne, Trainings, Sätze, Körpermaße) | Ja | Nein | App-Funktionalität |
| **Identifikatoren → Nutzer-ID** (Gast-/Konto-ID) | Ja | Nein | App-Funktionalität |
| **Kontaktinformationen → Name, E-Mail-Adresse** (nur bei „Mit Apple fortfahren“, ggf. Apple-Relay-Adresse) | Ja | Nein | App-Funktionalität |
| **Nutzerinhalte → Fotos oder Videos, andere Nutzerinhalte** (Foto/PDF/Excel beim Import) | Ja | Nein | App-Funktionalität |
| **Nutzungsdaten → Produktinteraktion** (anonyme Ereignisse wie „Training beendet“, zufällige ID) | **Nein** | Nein | Analyse |
| **Diagnose → Absturzdaten** (nur wenn Sentry-DSN im Build gesetzt ist) | Nein | Nein | App-Funktionalität |

- **„Käufe“: entfernen.** 1.1.0 hat keine In-App-Käufe.
- **„Zum Tracking verwendet": NEIN** (keine Werbung/Cross-App-Tracking).
- **Auftragsverarbeiter** (gehört in die Datenschutzerklärung, nicht ins Label): Hostinger (Server, EU), Google Gemini (Import/KI). Anthropic nur, wenn der Server wieder mit Claude läuft.
- Muss zur Datenschutzerklärung passen (siehe #8).

---

## 3) Store-Metadaten  (ASC → App-Informationen / Version)

**Kategorie:** Health & Fitness (primär). Sekundär optional: Lifestyle.

Positionierung aus [STRATEGY.md](STRATEGY.md): *Dein echter Plan, egal wie
komplex, wird zum geführten Training.* Der Import steht vorn, der KI-Plan ist
die Alternative für alle ohne Plan.

### 📋 Untertitel (max. 30 Zeichen)
- DE: `Trainingsplan-Import & Logger` (29)
- EN: `Workout plan import & logger` (28)

### 📋 Werbetext / Promo (max. 170 Zeichen)
- DE: `Foto oder PDF vom Trainingsplan rein – die App macht daraus dein geführtes Training, mit Rotation, Varianten und Supersätzen. Jeden Satz loggen. Kostenlos.` (155)
- EN: `Snap or upload your coach's plan and get a guided workout – rotations, variants and supersets included. Log every set, beat last time. Free.` (140)

### 📋 Keywords (max. 100 Zeichen, kommagetrennt, KEINE Leerzeichen nach Komma)
Wörter aus Name und Untertitel zählt Apple schon mit, deshalb fehlen hier
„trainingsplan“, „import“ und „logger“.
- DE: `trainer,pdf,foto,gym,fitness,krafttraining,workout,muskelaufbau,hantel,übungen,tracker,ki,coach` (95)
- EN: `coach,trainer,pdf,photo,gym,fitness,strength,lifting,routine,tracker,exercises,ai,dumbbell` (90)

### 📋 Beschreibung — DE
```
Du trainierst nach einem Plan von deinem Trainer, Coach oder aus dem Netz?
TrackYourLift macht daraus dein geführtes Training – ohne Abtippen.

▶ PLAN REIN, LOSLEGEN
Fotografiere deinen Trainingsplan oder lade ein PDF oder eine Excel-Datei hoch.
Die App erkennt Übungen, Sätze, Wiederholungen und Pausen – auch Rotationen
über mehrere Wochen, Kurz- und Lang-Varianten, Supersätze und Mobility-Tage.
Du prüfst das Ergebnis und startest noch heute.

▶ JEDES MAL BESSER ALS LETZTES MAL
Beim Training siehst du, was du beim letzten Mal geschafft hast. Gewicht und
Wiederholungen trägst du mit einem Tipp ein, der Pausen-Timer läuft auch auf dem
Sperrbildschirm. Gerät belegt? Tausch die Übung gegen eine Alternative – nur für
diese Einheit.

▶ 1000+ ÜBUNGEN AUF DEUTSCH
Große Übungsbibliothek mit Bildern, deutschen Namen und Ausführungshinweisen.

▶ DEINE WOCHE IM BLICK
Kraft- und Sporttage in Wochen- und Monatsansicht, Rekorde, Verlauf pro Übung
und Muskelgruppen-Balance.

▶ KEIN PLAN? KEIN PROBLEM
Beantworte ein paar Fragen und die KI baut dir einen Plan für dein Ziel – oder
stell dir deinen Plan selbst aus der Übungsbibliothek zusammen.

Kostenlos und ohne Konto – leg direkt los. Deine Pläne und Trainings werden
automatisch gesichert. Mit „Mit Apple fortfahren“ nimmst du sie auf ein neues
iPhone mit.
```

### 📋 Beschreibung — EN
```
Training from a plan your coach, trainer or the internet wrote? TrackYourLift
turns it into a guided workout – no retyping.

▶ IMPORT YOUR PLAN, START TODAY
Take a photo of your plan or upload a PDF or Excel file. The app picks up
exercises, sets, reps and rest – including multi-week rotations, short and long
variants, supersets and mobility days. Review the result and start today.

▶ BEAT LAST TIME
During your workout you see what you did last time. Log weight and reps with a
tap; the rest timer keeps running on the lock screen. Machine taken? Swap the
exercise for an alternative – just for this session.

▶ 1000+ EXERCISES
Large exercise library with images, muscle groups and form cues.

▶ YOUR WEEK AT A GLANCE
Strength and sport days in week and month views, records, per-exercise history
and muscle-group balance.

▶ NO PLAN? NO PROBLEM
Answer a few questions and the AI builds a plan for your goal – or put one
together yourself from the exercise library.

Free, no account needed – just start. Your plans and workouts are backed up
automatically. Use "Continue with Apple" to take them to a new iPhone.
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
- **Datenschutzerklärung** (`/var/www/fitplan-web/datenschutz.html` auf dem VPS,
  nicht im Repo) deckt ab: Geräte-ID im Schlüsselbund, Cloud-Backup, „Mit Apple
  fortfahren“ (Name/E-Mail), anonyme Statistik, Auftragsverarbeiter Hostinger +
  Google Gemini (USA). Muss zu den App-Privacy-Labels (#2) passen.
- Vor dem Launch den orangen Hinweis „⚠️ Vor Veröffentlichung … Entwurf“ oben in
  der Datenschutzerklärung entfernen – erst nach der Prüfung.

---

## 9) QA-Pass (echtes Gerät via TestFlight)
Frischer Install → durchspielen: Onboarding → Plan (Import + KI) → Workout
loggen → Historie → Profil → Datensicherung → „Mit Apple fortfahren“ → „Jetzt
sichern“ → App löschen, neu installieren → Daten wieder da. Echtes Gerät: Build 72.

---

## 10) Rest-Platzhalter
3 Core-Holds (Bird Dog, Hollow Hold, L-Sit) ohne echtes Foto — Platzhalter bleibt,
da free-exercise-db keinen passenden Treffer hat. Kein Blocker.
```
