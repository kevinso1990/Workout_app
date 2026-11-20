# Ground truth for public training plans (read by hand from the PDFs).
# exercise: (aliases, sets, reps)
#   aliases: lowercase substrings, matched against name + original name
#   sets:    int, tuple of accepted ints, or None (not checked)
#   reps:    list of ints (the numbers in the cell, in order), or None (not checked)
#            a pyramid "12|10|8|6" also passes as the range "6-12"
# day: {"name": ..., "kind": set of accepted kinds or None, "ex": [...], "supersets": [(alias_a, alias_b), ...]}
# plan: {"id", "pdf", "pages" (for photo variant, 1-based, or None), "days", "anywhere" (match across days),
#        "schedule": list of weeks of (weekday 0=Mo, day index) or None, "extra_ok": aliases allowed beyond the list}

def ex(aliases, sets, reps):
    return (aliases, sets, reps)

KNIEBEUGE = ["kniebeug", "squat"]
BANK = ["bankdr", "bench"]

REAL = [
  {
    "id": "engel_5x5", "pdf": "engel-5x5.pdf", "pages": [1],
    "days": [
      {"name": "A", "kind": {"strength"}, "ex": [
        ex(KNIEBEUGE, 5, [5]), ex(BANK, 5, [5]), ex(["kreuzheb", "deadlift"], 5, [5]),
        ex(["scott", "preacher"], 3, [12]), ex(["french", "skull", "lying triceps", "lying tricep"], 3, [12])]},
      {"name": "B", "kind": {"strength"}, "ex": [
        ex(BANK, 5, [5]), ex(["front"], 5, [5]), ex(["military", "overhead", "shoulder press"], 5, [5]),
        ex(["reverse", "rear", "butterfly"], 3, [12]), ex(["beincurl", "leg curl", "beinbeuger"], 3, [12])]},
      {"name": "C", "kind": {"strength"}, "ex": [
        ex(KNIEBEUGE, 5, [5]), ex(BANK, 5, [5]), ex(["rudern", "row"], 5, [5]),
        ex(["seitheb", "lateral"], 3, [12]), ex(["crunch"], 3, [25])]},
    ],
    "schedule": [[(0, 0), (2, 1), (4, 2)]],
  },
  {
    "id": "engel_masse", "pdf": "engel-masseaufbau.pdf", "pages": [1],
    "days": [
      {"name": "A", "kind": {"strength"}, "ex": [
        ex(KNIEBEUGE, 4, [12, 10, 8, 6]), ex(["kreuzheb", "deadlift"], 4, [10, 8, 6, 4]),
        ex(["rudern", "row"], 3, [10, 8, 6]), ex(["klimmz", "pull-up", "pullup", "pull up", "chin"], 3, [12, 10, 8]),
        ex(["langhantel curl", "barbell curl", "langhantel-curl", "lh curl", "bicep curl", "biceps curl"], 3, [10, 8, 6]),
        ex(["hammer"], 2, [10, 8])]},
      {"name": "B", "kind": {"strength"}, "ex": [
        ex(BANK, 4, [15, 10, 8, 6]), ex(["überzüg", "pullover"], 3, [10, 8, 6]), ex(["dip"], 3, [10, 8, 6]),
        ex(["seitheb", "lateral"], 4, [10, 10, 8, 8]), ex(["kinnzieh", "upright"], 3, [10, 8, 6]),
        ex(["french", "skull", "lying tricep"], 4, [12, 10, 8, 6])]},
      {"name": "C", "kind": {"strength"}, "ex": [
        ex(KNIEBEUGE, 4, [12, 10, 8, 6]), ex(["kreuzheb", "deadlift"], 4, [10, 8, 6, 4]),
        ex(["fliegende", "fly", "flye", "crossover"], 3, [15, 15, 15]), ex(["brustpresse", "chest press"], 3, [15, 15, 15]),
        ex(["langhantel curl", "barbell curl", "langhantel-curl", "lh curl", "bicep curl", "biceps curl"], 3, [10, 8, 6]),
        ex(["hammer"], 2, [10, 8])]},
    ],
    "schedule": [[(0, 0), (2, 1), (4, 2)], [(0, 1), (2, 2), (4, 0)], [(0, 2), (2, 0), (4, 1)]],
  },
  {
    "id": "engel_gvt", "pdf": "engel-gvt.pdf", "pages": [1],
    "days": [
      {"name": "A", "kind": {"strength"}, "ex": [
        ex(BANK, 10, [10]), ex(["rudern", "row"], 10, [10]),
        ex(["fliegende", "fly", "flye"], 3, [10]), ex(["latzug", "pulldown", "lat pull"], 3, [10])],
       "supersets": [(BANK[0], "rudern"), ("fliegende", "latzug")]},
      {"name": "B", "kind": {"strength"}, "ex": [
        ex(["front", "kniebeug", "squat"], 10, [10]), ex(["beinbeuger", "leg curl"], 10, [10]),
        ex(["crunch"], 3, [10]), ex(["wadenheb", "calf"], 3, [10])],
       "supersets": [("front", "beinbeuger"), ("crunch", "waden")]},
      {"name": "C", "kind": {"strength"}, "ex": [
        ex(["military", "overhead", "shoulder press"], 10, [10]), ex(["curl"], 10, [10]),
        ex(["trizeps", "tricep", "trizpes", "pushdown"], 3, [10]), ex(["seitheb", "lateral"], 3, [10])],
       "supersets": [("military", "curl"), ("tri", "seitheb")]},
    ],
    "schedule": [[(0, 0), (2, 1), (4, 2)]],
  },
  {
    "id": "engel_profi", "pdf": "engel-profi.pdf", "pages": [1, 2],
    "days": [
      {"name": "A", "kind": {"strength"}, "ex": [
        ex(["schrägbank", "incline"], 4, [12, 10, 8, 6]), ex(["flachbank", "bench", "bankdr"], 4, [8, 8, 6, 6]),
        ex(["hex", "fliegende", "fly"], 3, [10, 10]), ex(["brustpresse", "chest press"], 3, [15, 12, 10]),
        ex(["überzüg", "pullover"], 2, [15, 15]), ex(["latzug", "pulldown"], 2, [15, 15]),
        ex(["rudern", "row"], 2, [15, 15]), ex(["überzüg", "pullover", "straight"], 2, [15, 15]),
        ex(["vorgebeugt", "rear", "reverse", "bent"], 3, [12, 10, 8])],
       "extra_ok": ["hex", "fliegende", "fly"]},
      {"name": "B", "kind": {"strength"}, "ex": [
        ex(["frontdr", "smith", "shoulder press", "overhead", "multipresse"], 3, [15, 12, 10]),
        ex(["nacken", "shoulder press", "behind"], 3, [10, 8, 6]), ex(["frontheb", "front raise"], 3, [12, 10, 8]),
        ex(["seitheb", "lateral"], 3, [10, 10, 10]), ex(["bizepscurl", "barbell curl", "langhantel", "bicep curl"], 3, [10, 8, 6]),
        ex(["dip"], 3, [10, 8, 6]), ex(["scott", "preacher"], 3, [10, 8, 6]),
        ex(["trizeps", "tricep", "overhead", "french"], 3, [10, 8, 6]), ex(["hammer"], 3, [10, 8, 6]),
        ex(["kickback"], 3, [10, 8, 6])],
       "supersets": [("curl", "dip"), ("scott", "tri"), ("hammer", "kickback")]},
      {"name": "C", "kind": {"strength"}, "ex": [
        ex(["latzug", "pulldown"], 4, [12, 10, 8, 6]), ex(["latzug", "pulldown"], 3, [10, 8, 6]),
        ex(["rudern", "row"], 4, [12, 10, 8, 6]), ex(["rudern", "row"], 3, [12, 10, 8]),
        ex(["kinnzieh", "upright"], 3, [12, 10, 8]), ex(["fliegende", "fly", "crossover"], 3, [15, 15, 15]),
        ex(["schrägbank", "incline", "multipresse", "smith"], 3, [15, 15, 15]), ex(["crunch"], 3, [30]),
        ex(["crunch"], 3, [20]), ex(["beinheb", "leg raise", "hanging"], 3, [15, 20])]},
      {"name": "D", "kind": {"strength"}, "ex": [
        ex(["beinstreck", "leg extension"], 3, [15, 12, 10]), ex(["front"], 4, [20, 15, 12, 10]),
        ex(["beinpresse", "leg press"], 4, [12, 10, 8, 6]), ex(["ausfallschritt", "lunge"], 3, [12, 10, 8]),
        ex(["gestreckt", "stiff", "romanian", "kreuzheb", "deadlift"], 4, [15, 12, 10, 8]),
        ex(["beincurl", "leg curl", "beinbeuger"], 3, [15, 12, 10]), ex(["wadenheb", "calf"], 3, [12, 10, 8]),
        ex(["wadenheb", "calf"], 3, [15, 12, 10])]},
    ],
    "schedule": [[(0, 0), (2, 1), (4, 2), (5, 3)]],
  },
  {
    "id": "fuersie_3er", "pdf": "fuersie-3er-split.pdf", "pages": None,
    "days": [
      {"name": "Push", "kind": {"strength"}, "ex": [
        ex(BANK, 3, [8, 12]), ex(["schulterdr", "shoulder press", "overhead"], 3, [8, 12]),
        ex(["brustpresse", "incline", "chest press", "schräg"], 3, [8, 12]), ex(["seitheb", "lateral"], 3, [10, 12]),
        ex(["dip"], 3, [10, 12]), ex(["butterfly", "fly", "pec deck", "flye"], 3, [10, 12]),
        ex(["reverse", "face pull", "rear"], 3, [10, 12]), ex(["trizeps", "tricep", "pushdown"], 3, [10, 12])]},
      {"name": "Pull", "kind": {"strength"}, "ex": [
        ex(["klimmz", "pull-up", "pullup", "pull up", "chin"], 3, None), ex(["latzug", "pulldown"], 3, [10, 12]),
        ex(["rudern", "row"], 3, [10, 12]), ex(["bizeps", "curl", "biceps"], 3, [10, 12]),
        ex(["rudern", "row"], 3, [10, 12]), ex(["überzüg", "pullover", "face pull"], 3, [10, 12]),
        ex(["hammer"], 3, [10, 12])]},
      {"name": "Beine + Bauch", "kind": {"strength"}, "ex": [
        ex(KNIEBEUGE + ["beinpresse", "leg press"], 4, [8, 12]), ex(["hip thrust", "glute bridge"], 3, [8, 12]),
        ex(["beinstreck", "leg extension", "beinpresse"], 3, [10, 12]), ex(["beinbeuger", "leg curl", "rumän", "romanian"], 3, [10, 12]),
        ex(["ausfallschritt", "lunge", "bulgarian", "split squat"], 3, [10, 12]), ex(["kickback", "abduktor", "abduct"], 3, [10, 12]),
        ex(["russian", "bicycle"], 3, [15, 20]), ex(["leg raise", "beinheb", "sit-up", "situp"], 3, [15, 20])]},
    ],
    "max_per_day": True,  # the b) options are alternatives, not extra exercises
  },
  {
    "id": "fitnessfirst", "pdf": "fitnessfirst-masse.pdf", "pages": [1],
    "days": [
      {"name": "Oberkörper 1", "kind": {"strength"}, "ex": [
        ex(["rudern", "row"], (4, 5, 6, 7, 8), [6, 12]), ex(BANK, (4, 5, 6, 7, 8), [6, 12]),
        ex(["schulterdr", "shoulder press"], (4, 5, 6, 7, 8), [6, 12]), ex(["latzug", "pulldown"], (4, 5, 6, 7, 8), [6, 12]),
        ex(["curl"], (4, 5, 6, 7, 8), [6, 12]), ex(["trizeps", "tricep", "pushdown"], (4, 5, 6, 7, 8), [6, 12])]},
      {"name": "Unterkörper 1", "kind": {"strength"}, "ex": [
        ex(["beinheb", "leg raise"], (4, 5, 6, 7, 8), [6, 12]), ex(["beinstreck", "leg extension"], (4, 5, 6, 7, 8), [6, 12]),
        ex(["ausfallschritt", "lunge"], (4, 5, 6, 7, 8), [6, 12]), ex(["beinbeuger", "leg curl"], (4, 5, 6, 7, 8), [6, 12]),
        ex(KNIEBEUGE, (4, 5, 6, 7, 8), [6, 12]), ex(["crunch"], (4, 5, 6, 7, 8), [6, 12])]},
      {"name": "Oberkörper 2", "kind": {"strength"}, "ex": [
        ex(["klimmz", "pull-up", "pullup", "pull up"], (4, 5, 6, 7, 8), [6, 12]), ex(["überkopf", "overhead", "military"], (4, 5, 6, 7, 8), [6, 12]),
        ex(["rudern", "row"], (4, 5, 6, 7, 8), [6, 12]), ex(BANK, (4, 5, 6, 7, 8), [6, 12]),
        ex(["dip"], (4, 5, 6, 7, 8), [6, 12]), ex(["curl"], (4, 5, 6, 7, 8), [6, 12])]},
      {"name": "Unterkörper 2", "kind": {"strength"}, "ex": [
        ex(["beinpresse", "leg press"], (4, 5, 6, 7, 8), [6, 12]), ex(["kreuzheb", "deadlift"], (4, 5, 6, 7, 8), [6, 12]),
        ex(["split squat", "split-squat"], (4, 5, 6, 7, 8), [6, 12]), ex(["unterarmstütz", "plank"], (4, 5, 6, 7, 8), [6, 12]),
        ex(["beinheb", "leg raise"], (4, 5, 6, 7, 8), [6, 12])]},
    ],
    "schedule": [[(0, 0), (1, 1), (3, 2), (4, 3)]],
  },
  {
    "id": "heimat_kk", "pdf": "heimatkk-muskelaufbau.pdf", "pages": [1, 2],
    "anywhere": True,
    "days": [
      {"name": "Ganzkörper", "kind": None, "ex": [
        ex(["beinpresse", "leg press"], (3, 4), None), ex(["beinbeuger", "leg curl"], 3, [8]),
        ex(["latzieh", "latzug", "pulldown"], 3, [8]), ex(["brustpresse", "chest press"], 3, [8]),
        ex(["rudern", "row"], 3, [8]), ex(["crunch"], 3, [8]),
        ex(["lunge", "lunch", "ausfallschritt", "hip flexor"], (1, 4), [60]), ex(["down dog", "downward", "hund"], 2, [90]),
        ex(["rotation", "twist"], 2, [90])]},
    ],
    "warmup": ["cross", "elliptical"],
  },
  {
    "id": "dav_mobility", "pdf": "dav-mobilisation.pdf", "pages": None,
    "anywhere": True,
    "days": [
      {"name": "Mobilisation", "kind": {"mobility"}, "ex": [
        ex(["wade", "calf", "calves"], 3, [2]), ex(["unterschenkel", "peroneal", "shin", "tibialis"], 3, [2]),
        ex(["beinbeuger & waden", "down dog", "downward", "hund", "hamstring", "beinbeuger und waden"], 3, [60]),
        ex(["oberschenkelaußen", "außenseite", "it band", "itb", "lateral thigh", "it-band"], 3, [2]),
        ex(["bindenspanner", "tfl", "tensor"], None, None), ex(["seitneigung", "side bend", "lateral flexion"], 3, [60]),
        ex(["innere", "vastus", "medialis", "inneren kopf"], 3, [2]), ex(["vorderseite", "quad", "quadriceps"], 3, [2]),
        ex(["hüftmusk", "glute", "gesäß", "piriformis", "hip"], 3, [2]), ex(["hüftöffner", "pigeon", "taube", "hip opener"], 3, [2]),
        ex(["rücken", "back", "lumbar"], 3, [2]), ex(["rückendehnung", "spreizsitz", "straddle", "sitzend"], 3, [2]),
        ex(["brust", "chest", "pec"], 3, [2]), ex(["diagonal"], 3, [2])]},
    ],
    "reps_2min_as_120": True,
  },
  {
    "id": "tubs_ruecken", "pdf": "tubs-ruecken.pdf", "pages": [1],
    "days": [
      {"name": "3", "kind": None, "ex": [
        ex(["schulter", "reverse", "rear", "y-raise", "t-raise"], None, [30]), ex(["vierfüßler", "bird", "quadruped"], None, [30]),
        ex(["bauch", "crunch"], None, [30]), ex(["rücken", "bridge", "brücke", "glute", "becken"], None, [30]),
        ex(["rücken", "superman", "back extension"], None, [30]), ex(["brust", "chest", "press", "isometr"], None, [30])]},
      {"name": "3.2", "kind": None, "ex": [
        ex(["schulter", "reverse", "rear", "hack"], None, [30]), ex(["vierfüßler", "bird", "quadruped"], None, [30]),
        ex(["bauch", "crunch"], None, [30]), ex(["rücken", "bridge", "brücke", "glute", "becken"], None, [30]),
        ex(["rücken", "superman", "back extension", "swimmer"], None, [30]), ex(["brust", "chest", "press", "isometr"], None, [30])]},
    ],
  },
  {
    "id": "hilfswerk", "pdf": "hilfswerk-zuhause.pdf", "pages": None,
    "anywhere": True,
    "days": [
      {"name": "Zuhause", "kind": None, "ex": [
        ex(["einbein", "single leg", "single-leg", "balance"], (1, 2), None), ex(["zehen", "fersen", "heel", "toe", "calf"], (1, 2), [5, 8]),
        ex(["kniebeug", "squat"], (1, 2), [5, 8]), ex(["hüftbeug", "hip flex", "knee raise", "marching", "march"], (1, 2), [5, 8]),
        ex(["seitheb", "lateral"], (1, 2), [5, 8]), ex(["reverse", "fly", "flies", "band pull"], (1, 2), [5, 8]),
        ex(["liegestütz", "push-up", "pushup", "push up", "wall"], (1, 2), [5, 8]), ex(["handtuch", "towel", "overhead"], (1, 2), [5, 8]),
        ex(["rumpfrot", "rotation", "twist"], (1, 2), [5, 8]), ex(["katze", "cat"], (1, 2), [5, 8]),
        ex(["brücke", "bridge"], (1, 2), [5, 8])]},
    ],
    "extra_ok_global": ["treppe", "stair"],
  },
]
