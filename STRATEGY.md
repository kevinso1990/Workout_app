# TrackYourLift — Produktstrategie (eine Seite)

Stand 2026-11-20 · v3 (Ziel, Zielgruppe und Ausschlüsse bestätigt; Launch nur kostenlos) · ⚠ = noch offen.
Gehört zur [Roadmap](MASTER_ROADMAP.md): jede Roadmap-Zeile muss auf eine Wette hier zeigen.

## 1. Wo wir heute stehen (ehrlich)
- 1.0.0 ist freigegeben, aber zurückgehalten; 1.1.0 ist der echte Launch. Es gibt noch keine Nutzer außer uns.
- Viele Funktionen: Logging, KI-Pläne, Smart Import, Mobility, Cardio, Coach, Live Activity, Bestleistungen, Serie.
- **Messen startet gerade.** Die anonyme Nutzungsstatistik ist seit 2026-11-20 auf dem Server live; die App sendet ab dem nächsten Build. Kennzahlen: `server/scripts/productMetrics.ts`.
- Import-Benchmark, synthetisch (`ops/import-benchmark`, 6 selbst erstellte Pläne): vorher 55/67 Übungen ohne Nacharbeit (82 %), nach den Fixes vom 2026-11-20 67/67 in 2 Läufen.
- Import-Benchmark, echt (`ops/import-benchmark/real`, 10 öffentliche Trainer-Pläne, PDFs bleiben außerhalb des Repos): Übungen 288/300 → 300/300, ohne Zuordnung 99 → 38, Termine 10/10. Mit PDF direkt an Gemini statt Text: Wdh 95 % → 100 %, Supersätze 8/9 → 9/9.
- Schulden: Medien von MuscleWiki (Lizenzrisiko), VPS-Repo divergiert. Pro-Abo-Code (RevenueCat) ist vorhanden, aber abgeschaltet (`EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED` nicht gesetzt).

## 2. Ziel und Horizont
- Horizont 12 Monate (neues Produkt, aber Solo-Entwickler: 5–10 Jahre wäre Fantasie).
- Ziel: 1.000 Nutzer, die in Woche 4 noch ≥ 2× pro Woche loggen. Erst danach Geld verlangen.

## 3. Wo wir gewinnen
**Was nur wir können:** *Dein echter Plan, egal wie komplex, wird zum geführten Training.*
Foto oder PDF vom Trainer → Plan in 1 Minute, inklusive Rotation, Kurz/Lang-Varianten, Mobility-Tagen und deutscher Ausführungsanleitung.
Hevy und Strong loggen gut, aber sie verstehen keinen 3-Wochen-Zyklus und keinen Trainer-Zettel.

**Für wen:** Deutschsprachige, die 2–4× pro Woche nach einem Plan trainieren, den jemand anderes geschrieben hat (Trainer, Coach, Instagram, KI). Nicht: Powerlifter mit eigenem Excel, nicht: Anfänger ganz ohne Plan.

**Ein Use Case zuerst:** Plan rein → heute starten → Satz loggen → nächstes Mal sehen, was zu schlagen ist. Erst wenn das in Woche 4 trägt, wird breiter gebaut.

**Schwer zu kopieren:** die Plan-Struktur (Rotation, Varianten, Supersätze, Mobility) plus Import, der sie richtig erkennt, plus deutsche Inhalte für 1.000 Übungen.

**Bezahlmodell:** Zum Launch nur kostenlos, keine Kaufoberfläche. KI-Kosten begrenzt der Server: `importLimiter` (15 Importe/Tag pro IP) und `aiUsageGuard` (Tages- und Monatsdeckel).
Später, wenn Woche-4-Bindung da ist: Pro mit Monatskontingent für KI-Import und -Anpassung (nicht unbegrenzt, zu teuer). Das Logging bleibt immer kostenlos.

**Erster Kontakt kinderleicht:** vom Install zum ersten geloggten Satz in unter 2 Minuten, auch ohne Plan (Vorlage).

## 4. Was wir nicht machen
Kein Social-Feed. Kein Ernährungs-Tracking. Keine eigene Watch-App vor Woche-4-Bindung. Keine Coach-Marktplatz-Funktion. Keine Features, nur weil Hevy/Setgraph sie haben, sondern nur, wenn sie den einen Use Case stärken. Apple Health erst nach Launch.
**Konkurrenz:** Hevy, Strong, Setgraph. Kurswechsel, wenn einer von ihnen Plan-Import mit Struktur bringt oder wenn der Import in Tests unter 80 % richtig erkennt.

## 5. Die Wetten (Hypothesen mit Messwert)
| Wette | Messwert | Ziel |
|---|---|---|
| Import ist der Grund zu installieren | Anteil Installs mit erfolgreichem Import in 24 h | ≥ 40 % |
| Geführtes Training hält | Woche-4-Aktive (≥ 2 Trainings/Woche) | ≥ 25 % |
| Vergleich „zuletzt → heute“ motiviert | Trainings pro aktiver Woche | ≥ 2,5 |
| *(später)* Zahlen für Import/KI | Pro-Conversion nach 30 Tagen | ≥ 3 % |

**Endzustand rückwärts:** Launch 1.1.0 → Analytics für die 4 Messwerte → Import-Qualität auf echten Trainer-Plänen → Onboarding „Plan rein“ als erster Schritt → erst bei Woche-4-Bindung: Pro mit Kontingent.
Jeder Schritt ist für sich etwas wert.

## 6. Regeln für den Alltag
Jede neue Funktion beantwortet zwei Fragen: Welche Wette aus §5 stärkt sie, und woran sehen wir es?
Wenn keine: „Nein“, nicht „später“.
