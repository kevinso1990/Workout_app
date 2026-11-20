# Test plans with ground truth for the import benchmark.
# ex: (aliases, sets, reps, extra) — aliases are lowercase substrings that count as a match.

PLANS = [
  {
    "id": "p1_trainer_pdf", "format": "pdf",
    "title": "Trainingsplan Max M. – Ganzkörper 3×/Woche",
    "header": "Coach: Studio Kraftwerk · Phase 1 (Woche 1–6) · Pausen 90 s wenn nicht anders angegeben",
    "days": [
      {"name": "Ganzkörper A", "kind": "strength", "exercises": [
        (["kniebeug", "squat"], 4, "6-8", "Langhantel, RPE 8"),
        (["bankdr", "bench"], 3, "8-10", "Superset A1"),
        (["rudern", "row"], 3, "10", "Superset A2, Kabel"),
        (["ausfallschritt", "lunge"], 3, "8/Seite", "Kurzhantel"),
        (["plank", "unterarmstütz"], 3, "45 s", ""),
      ]},
      {"name": "Ganzkörper B", "kind": "strength", "exercises": [
        (["kreuzheb", "deadlift"], 4, "5", "rumänisch, Pause 2 min"),
        (["schulterdr", "overhead press", "shoulder press", "military"], 3, "8", ""),
        (["klimmz", "pull-up", "pull up", "chin"], 3, "6-8", "ggf. Band"),
        (["hip thrust", "hüftheb"], 3, "10-12", ""),
        (["pallof"], 3, "12/Seite", ""),
      ]},
      {"name": "Ganzkörper C", "kind": "strength", "exercises": [
        (["beinpresse", "leg press"], 3, "10-12", ""),
        (["schrägbank", "incline"], 3, "10", "Kurzhantel"),
        (["latzug", "lat pulldown", "pulldown"], 3, "10-12", ""),
        (["face pull"], 3, "15", ""),
        (["farmer"], 3, "40 m", ""),
      ]},
    ],
  },
  {
    "id": "p2_rotation_pdf", "format": "pdf",
    "title": "3-Wochen-Zyklus · Kurz & Lang",
    "header": "Kurz = 35 Min (unter der Woche) · Lang = 60 Min (Wochenende) · Mobility montags",
    "days": [
      {"name": "A kurz – Beine", "kind": "strength", "exercises": [
        (["kniebeug", "squat"], 3, "6", ""), (["rumän", "romanian", "rdl"], 3, "8", ""), (["wadenheb", "calf"], 2, "15", "")]},
      {"name": "A lang – Beine", "kind": "strength", "exercises": [
        (["kniebeug", "squat"], 4, "6", ""), (["rumän", "romanian", "rdl"], 3, "8", ""), (["beinpresse", "leg press"], 3, "12", ""),
        (["beinbeuger", "leg curl"], 3, "12", ""), (["wadenheb", "calf"], 3, "15", "")]},
      {"name": "B kurz – Oberkörper", "kind": "strength", "exercises": [
        (["bankdr", "bench"], 3, "6", ""), (["rudern", "row"], 3, "8", ""), (["seitheb", "lateral"], 2, "15", "")]},
      {"name": "B lang – Oberkörper", "kind": "strength", "exercises": [
        (["bankdr", "bench"], 4, "6", ""), (["rudern", "row"], 4, "8", ""), (["schulterdr", "shoulder press", "overhead"], 3, "10", ""),
        (["klimmz", "pull-up", "pull up", "chin"], 3, "8", ""), (["seitheb", "lateral"], 3, "15", "")]},
      {"name": "Mobility", "kind": "mobility", "exercises": [
        (["katze", "cat"], 2, "10", ""), (["taube", "pigeon"], 2, "60 s", "pro Seite"), (["couch stretch", "couch"], 2, "60 s", "pro Seite")]},
    ],
    # weekday 0=Mo; day index into days above
    "schedule": [
      [(0, 4), (1, 0), (3, 2), (5, 1)],
      [(0, 4), (1, 2), (3, 0), (5, 3)],
      [(0, 4), (1, 0), (3, 2), (5, 1)],
    ],
  },
  {
    "id": "p3_handwritten_photo", "format": "photo",
    "title": "Push / Pull / Beine",
    "header": "",
    "days": [
      {"name": "Push", "kind": "strength", "exercises": [
        (["bankdr", "bench"], 4, "8", "KH-Bankdr."), (["schulterdr", "shoulder press", "overhead"], 3, "10", ""),
        (["dips"], 3, "max", ""), (["trizeps", "tricep"], 3, "12", "Seilzug")]},
      {"name": "Pull", "kind": "strength", "exercises": [
        (["klimmz", "pull-up", "pull up", "chin"], 4, "6-8", ""), (["rudern", "row"], 3, "10", "LH"),
        (["face pull"], 3, "15", ""), (["bizeps", "curl"], 3, "12", "")]},
      {"name": "Beine", "kind": "strength", "exercises": [
        (["kniebeug", "squat"], 4, "8", ""), (["kreuzheb", "deadlift"], 3, "8", "rum."),
        (["beinstreck", "leg extension"], 3, "12", ""), (["wadenheb", "calf"], 4, "15", "")]},
    ],
  },
  {
    "id": "p4_excel", "format": "xlsx",
    "title": "Plan Lisa", "header": "",
    "days": [
      {"name": "Tag 1 Oberkörper", "kind": "strength", "exercises": [
        (["bankdr", "bench"], 3, "10", ""), (["latzug", "pulldown"], 3, "10", ""), (["seitheb", "lateral"], 3, "15", ""), (["bizeps", "curl"], 2, "12", "")]},
      {"name": "Tag 2 Unterkörper", "kind": "strength", "exercises": [
        (["hip thrust", "hüftheb"], 4, "10", ""), (["beinpresse", "leg press"], 3, "12", ""), (["abduktor", "abduct"], 3, "15", ""), (["wadenheb", "calf"], 3, "15", "")]},
      {"name": "Tag 3 Cardio", "kind": "cardio", "exercises": []},
    ],
    "cardio_note": "Laufen 30 Min locker",
  },
  {
    "id": "p5_physio", "format": "pdf",
    "title": "Physiotherapie – Heimübungsprogramm (LWS)",
    "header": "Täglich, ruhig ausführen, schmerzfrei bleiben.",
    "days": [
      {"name": "Heimprogramm", "kind": "mobility", "exercises": [
        (["bird dog", "vierfüßler"], 3, "10/Seite", ""), (["dead bug"], 3, "8/Seite", ""),
        (["glute bridge", "beckenheb", "brücke"], 3, "12", ""), (["seitstütz", "side plank"], 3, "20 s", "pro Seite"),
        (["katze", "cat"], 2, "10", "")]},
    ],
    "avoid": [["kreuzheb", "deadlift"], ["kniebeug", "squat"], ["sit-up", "situp", "crunch"]],
  },
  {
    "id": "p6_insta_screenshot", "format": "screenshot",
    "title": "UPPER / LOWER 💪 4x pro Woche",
    "header": "Save für später 🔥 #gymtok",
    "days": [
      {"name": "Upper", "kind": "strength", "exercises": [
        (["bankdr", "bench"], 4, "6-8", ""), (["rudern", "row"], 4, "8-10", ""), (["schulterdr", "shoulder press", "overhead"], 3, "10", ""),
        (["latzug", "pulldown", "lat pull"], 3, "12", "last set dropset")]},
      {"name": "Lower", "kind": "strength", "exercises": [
        (["kniebeug", "squat"], 4, "6-8", ""), (["rumän", "romanian", "rdl"], 3, "10", ""), (["ausfallschritt", "lunge", "split squat"], 3, "10/Seite", ""),
        (["wadenheb", "calf"], 4, "AMRAP", "")]},
    ],
  },
]
