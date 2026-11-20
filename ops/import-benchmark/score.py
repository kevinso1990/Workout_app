import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from plans import PLANS
from render import HAND  # noqa: E402  (display abbreviations for the handwritten plan)
RES = sys.argv[1]
HINTS = {"rumänisch": "romanian", "rum.": "romanian", "kabel": "cable", "seilzug": "cable", "seil": "rope",
         "kurzhantel": "dumbbell", "kh": "dumbbell", "lh": "barbell", "langhantel": "barbell"}

def digits(s): return re.findall(r"\d+", str(s or ""))
def text(e): return " ".join([str(e.get("name", "")), str((e.get("importMeta") or {}).get("originalName", ""))]).lower()

def hint_tokens(p, ex):
    src = " ".join([ex[3], HAND.get(ex[0][0], "") if p["format"] == "photo" else ""]).lower()
    return {v for k, v in HINTS.items() if re.search(r"(^|[^a-zäöü])" + re.escape(k) + r"($|[^a-zäöü])", src)}

totals = {"ex": 0, "found": 0, "sets": 0, "reps": 0, "equip": 0, "equip_of": 0, "unmapped": 0}
issues = []
for p in PLANS:
    r = json.load(open(os.path.join(RES, p["id"] + ".json")))
    days = r.get("days") or []
    exp_days = p["days"]
    line = [f"{p['id']}: {len(days)}/{len(exp_days)} Tage"]
    used = set()
    pf = {"ex": 0, "found": 0, "sets": 0, "reps": 0}
    for i, d in enumerate(exp_days):
        # match the output day with the most alias hits (fallback: same position)
        def hits(od): return sum(any(a in text(e) for a in ex[0]) for ex in d["exercises"] for e in od.get("exercises", []))
        cands = [(hits(od), -abs(j - i), j) for j, od in enumerate(days) if j not in used]
        if not cands:
            issues.append(f"{p['id']}: Tag '{d['name']}' fehlt"); pf["ex"] += len(d["exercises"]); continue
        _, _, j = max(cands); used.add(j); od = days[j]
        if d["kind"] != (od.get("kind") or "strength"):
            issues.append(f"{p['id']}: Tag '{d['name']}' als {od.get('kind')} statt {d['kind']} erkannt")
        if d["kind"] == "cardio" and not (od.get("notes") or od.get("durationMinutes")):
            issues.append(f"{p['id']}: Cardio-Tag ohne Vorgabe")
        outs = list(od.get("exercises", []))
        for ex in d["exercises"]:
            pf["ex"] += 1
            m = next((e for e in outs if any(a in text(e) for a in ex[0])), None)
            if not m:
                issues.append(f"{p['id']}/{d['name']}: '{ex[0][0]}' nicht gefunden"); continue
            outs.remove(m); pf["found"] += 1
            if (m.get("importMeta") or {}).get("needsUserMapping"):
                totals["unmapped"] += 1; issues.append(f"{p['id']}/{d['name']}: '{m['name']}' nicht zugeordnet (Nutzer muss wählen)")
            if m.get("sets") == ex[1]: pf["sets"] += 1
            else: issues.append(f"{p['id']}/{d['name']}: {m['name']} Sätze {m.get('sets')} statt {ex[1]}")
            want = digits(ex[2]) or [ex[2].lower()]
            got = digits(m.get("reps")) or [str(m.get("reps", "")).lower()]
            if want == got: pf["reps"] += 1
            else: issues.append(f"{p['id']}/{d['name']}: {m['name']} Wdh '{m.get('reps')}' statt '{ex[2]}'")
            if "/seite" in ex[2].lower() or "pro seite" in ex[3].lower():
                if not m.get("perSide"): issues.append(f"{p['id']}/{d['name']}: {m['name']} 'pro Seite' fehlt")
            for tok in hint_tokens(p, ex):
                totals["equip_of"] += 1
                if tok in m["name"].lower() or (tok == "cable" and "rope" in m["name"].lower()): totals["equip"] += 1
                else: issues.append(f"{p['id']}/{d['name']}: '{(m.get('importMeta') or {}).get('originalName')}' ({ex[3] or HAND.get(ex[0][0])}) → {m['name']} (erwartet {tok})")
    if "schedule" in p:
        sched = (r.get("schedule") or {}).get("weeks")
        ok = sched is not None and len(sched) == len(p["schedule"])
        line.append("Rotation " + ("✓" if ok else f"✗ ({'fehlt' if sched is None else str(len(sched)) + ' Wochen'})"))
        if ok:
            # compare weekday → day name (via output day names)
            bad = 0
            for wk, (exp_w, got_w) in enumerate(zip(p["schedule"], sched)):
                e = {wd: p["days"][di]["name"].split(" –")[0].lower() for wd, di in exp_w}
                g = {s["weekday"]: (days[s["dayIndex"]]["dayName"] if s["dayIndex"] < len(days) else "?").lower() for s in got_w}
                for wd in set(e) | set(g):
                    if e.get(wd, "–") not in g.get(wd, "–"): bad += 1; issues.append(f"{p['id']}: Woche {wk+1} {['Mo','Di','Mi','Do','Fr','Sa','So'][wd]}: '{g.get(wd,'–')}' statt '{e.get(wd,'–')}'")
            line.append(f"Termine falsch: {bad}")
    if "avoid" in p:
        av = " ".join(r.get("avoidExercises") or []).lower()
        hit = sum(any(a in av for a in group) for group in p["avoid"])
        line.append(f"Verbote {hit}/{len(p['avoid'])}")
        for group in p["avoid"]:
            if any(any(a in text(e) for a in group) for d in days for e in d.get("exercises", [])):
                issues.append(f"{p['id']}: verbotene Übung '{group[0]}' im Plan gelandet")
    for k in pf: totals[k] += pf[k]
    line.append(f"Übungen {pf['found']}/{pf['ex']}, Sätze {pf['sets']}, Wdh {pf['reps']} · {r['_seconds']} s")
    print(" · ".join(line))
print()
t = totals
print(f"GESAMT: Übungen erkannt {t['found']}/{t['ex']} ({round(100*t['found']/t['ex'])} %), davon ohne Zuordnung {t['unmapped']}, Sätze richtig {t['sets']}/{t['found']}, Wdh richtig {t['reps']}/{t['found']}, Gerät/Variante richtig {t['equip']}/{t['equip_of']}")
print("\nFEHLER:"); [print(" -", i) for i in issues]
