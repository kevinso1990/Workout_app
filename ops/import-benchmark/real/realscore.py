# realscore.py <resultsdir> — scores real-plan imports against real_plans.py
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from real_plans import REAL
RES = sys.argv[1]
WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

def digits(s): return [int(x) for x in re.findall(r"\d+", str(s or ""))]
def text(e): return " ".join([str(e.get("name", "")), str((e.get("importMeta") or {}).get("originalName", ""))]).lower()
def dedupe(xs):
    out = []
    for x in xs:
        if not out or out[-1] != x: out.append(x)
    return out
def reps_ok(want, got, plan):
    if want is None: return True
    g = digits(got)
    if plan.get("reps_2min_as_120") and want == [2] and g in ([2], [120]): return True
    return g in (want, dedupe(want), [min(want), max(want)], sorted(set(want)))
def sets_ok(want, got):
    if want is None: return True
    return got in want if isinstance(want, tuple) else got == want

T = {k: 0 for k in ["ex", "found", "sets_chk", "sets_ok", "reps_chk", "reps_ok", "unmapped", "extra", "ss", "ss_ok", "sched", "sched_ok", "runs", "fail"]}
lines, issues = [], []
for p in REAL:
    for variant in ("pdf", "photo"):
        path = os.path.join(RES, f"{p['id']}.{variant}.json")
        if not os.path.exists(path): continue
        r = json.load(open(path)); T["runs"] += 1
        tag = f"{p['id']}/{variant}"
        days = r.get("days") or []
        if r["_status"] != 200 or not days:
            T["fail"] += 1; n = sum(len(d["ex"]) for d in p["days"]); T["ex"] += n
            lines.append(f"{tag}: FEHLER {r['_status']} {str(r.get('error',''))[:80]}"); continue
        found = 0; exp_n = 0; mapping = {}
        pool_all = [e for d in days for e in d.get("exercises", [])]
        used_days = set()
        for i, d in enumerate(p["days"]):
            exp_n += len(d["ex"])
            if p.get("anywhere"):
                pool, od = pool_all, None
            else:
                def hits(od): return sum(any(a in text(e) for a in x[0]) for x in d["ex"] for e in od.get("exercises", []))
                cands = [(hits(od), -abs(j - i), j) for j, od in enumerate(days) if j not in used_days]
                if not cands:
                    issues.append(f"{tag}: Tag '{d['name']}' fehlt"); continue
                _, _, j = max(cands); used_days.add(j); mapping[i] = j; od = days[j]
                pool = list(od.get("exercises", []))
                if d["kind"] and (od.get("kind") or "strength") not in d["kind"]:
                    issues.append(f"{tag}: Tag '{d['name']}' als {od.get('kind')}")
            matched = []
            for x in d["ex"]:
                m = next((e for e in pool if any(a in text(e) for a in x[0])), None)
                if not m:
                    issues.append(f"{tag}/{d['name']}: '{x[0][0]}' fehlt"); continue
                pool.remove(m); matched.append(m); found += 1
                if (m.get("importMeta") or {}).get("needsUserMapping"):
                    T["unmapped"] += 1; issues.append(f"{tag}/{d['name']}: '{m['name']}' nicht zugeordnet")
                if x[1] is not None:
                    T["sets_chk"] += 1
                    if sets_ok(x[1], m.get("sets")): T["sets_ok"] += 1
                    else: issues.append(f"{tag}/{d['name']}: {m['name']} Sätze {m.get('sets')} statt {x[1]}")
                if x[2] is not None:
                    T["reps_chk"] += 1
                    if reps_ok(x[2], m.get("reps"), p): T["reps_ok"] += 1
                    else: issues.append(f"{tag}/{d['name']}: {m['name']} Wdh '{m.get('reps')}' statt {x[2]}")
            if not p.get("anywhere"):
                ok_extra = [a for a in d.get("extra_ok", [])] + p.get("extra_ok_global", [])
                extra = [e for e in pool if not any(a in text(e) for a in ok_extra)]
                if extra:
                    T["extra"] += len(extra); issues.append(f"{tag}/{d['name']}: zusätzlich {[e['name'] for e in extra]}")
                for a, b in d.get("supersets", []):
                    T["ss"] += 1
                    ea = next((e for e in matched if a in text(e)), None); eb = next((e for e in matched if b in text(e) and e is not ea), None)
                    if ea and eb and ea.get("superset") and ea.get("superset") == eb.get("superset"): T["ss_ok"] += 1
                    else: issues.append(f"{tag}/{d['name']}: Supersatz {a}+{b} fehlt ({ea and ea.get('superset')}/{eb and eb.get('superset')})")
        if p.get("anywhere"):
            ok_extra = p.get("extra_ok_global", [])
            leftover = [e for e in pool_all if not any(any(a in text(e) for a in x[0]) for d in p["days"] for x in d["ex"]) and not any(a in text(e) for a in ok_extra)]
            if leftover: T["extra"] += len(leftover); issues.append(f"{tag}: zusätzlich {[e['name'] for e in leftover]}")
        if p.get("warmup"):
            w = " ".join(str(d.get("warmup") or "") for d in days).lower()
            if not any(a in w for a in p["warmup"]): issues.append(f"{tag}: Aufwärmen fehlt")
        sched_txt = ""
        if p.get("schedule"):
            T["sched"] += 1
            weeks = (r.get("schedule") or {}).get("weeks") or []
            want = [{wd: mapping.get(di) for wd, di in w} for w in p["schedule"]]
            got = [{s["weekday"]: s["dayIndex"] for s in w} for w in weeks]
            if got == want: T["sched_ok"] += 1; sched_txt = " · Termine ✓"
            else:
                sched_txt = " · Termine ✗"
                issues.append(f"{tag}: Termine {[{WD[k]: v for k, v in w.items()} for w in got]} statt {[{WD[k]: v for k, v in w.items()} for w in want]}")
        T["ex"] += exp_n; T["found"] += found
        lines.append(f"{tag}: {len(days)}/{len(p['days'])} Tage · Übungen {found}/{exp_n}{sched_txt} · {r['_seconds']} s")

print("\n".join(lines)); t = T
pct = lambda a, b: f"{a}/{b} ({round(100*a/b) if b else 0} %)"
print(f"\nGESAMT ({t['runs']} Importe, {t['fail']} fehlgeschlagen): Übungen {pct(t['found'], t['ex'])} · ohne Zuordnung {t['unmapped']} · "
      f"Sätze {pct(t['sets_ok'], t['sets_chk'])} · Wdh {pct(t['reps_ok'], t['reps_chk'])} · zusätzlich {t['extra']} · "
      f"Supersätze {pct(t['ss_ok'], t['ss'])} · Termine {pct(t['sched_ok'], t['sched'])}")
print("\nDETAILS:"); [print(" -", i) for i in issues]
