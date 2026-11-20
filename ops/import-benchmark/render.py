import html, os, subprocess, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from plans import PLANS

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NAMES = {
 "kniebeug": "Kniebeuge", "bankdr": "Bankdrücken", "rudern": "Rudern", "ausfallschritt": "Ausfallschritte",
 "plank": "Plank", "kreuzheb": "Kreuzheben", "schulterdr": "Schulterdrücken", "klimmz": "Klimmzüge",
 "hip thrust": "Hip Thrust", "pallof": "Pallof Press", "beinpresse": "Beinpresse", "schrägbank": "Schrägbankdrücken",
 "latzug": "Latzug", "face pull": "Face Pulls", "farmer": "Farmer's Walk", "rumän": "Rumänisches Kreuzheben",
 "wadenheb": "Wadenheben", "beinbeuger": "Beinbeuger liegend", "seitheb": "Seitheben", "katze": "Katze-Kuh",
 "taube": "Tauben-Dehnung", "couch stretch": "Couch Stretch", "dips": "Dips", "trizeps": "Trizepsdrücken",
 "bizeps": "Bizepscurls", "beinstreck": "Beinstrecker", "abduktor": "Abduktorenmaschine", "bird dog": "Bird Dog",
 "dead bug": "Dead Bug", "glute bridge": "Glute Bridge", "seitstütz": "Seitstütz",
}
HAND = {"bankdr": "KH-Bankdr.", "schulterdr": "Schulterdr. KH", "trizeps": "Trizeps Seil", "klimmz": "Klimmz.",
        "rudern": "LH-Rudern", "bizeps": "Bizeps Curls", "kreuzheb": "rum. Kreuzh.", "beinstreck": "Beinstr.",
        "wadenheb": "Waden", "face pull": "Face Pulls"}
WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

def name(ex, hand=False):
    a = ex[0][0]
    return (HAND.get(a) if hand else None) or NAMES[a]

def chrome(args):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
                    f"--user-data-dir={OUT}/.chrome", *args], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def doc_html(p):
    rows = []
    for d in p["days"]:
        rows.append(f"<h2>{html.escape(d['name'])}</h2>")
        if not d["exercises"]:
            continue
        rows.append("<table><tr><th>Übung</th><th>Sätze</th><th>Wdh.</th><th>Hinweis</th></tr>")
        for ex in d["exercises"]:
            rows.append(f"<tr><td>{html.escape(name(ex))}</td><td>{ex[1]}</td><td>{html.escape(ex[2])}</td><td>{html.escape(ex[3])}</td></tr>")
        rows.append("</table>")
    if "schedule" in p:
        rows.append("<h2>Wochenplan</h2><table><tr><th></th>" + "".join(f"<th>{w}</th>" for w in WD) + "</tr>")
        for i, week in enumerate(p["schedule"]):
            cells = {wd: p["days"][di]["name"] for wd, di in week}
            rows.append(f"<tr><td>Woche {i+1}</td>" + "".join(f"<td>{html.escape(cells.get(w, '–'))}</td>" for w in range(7)) + "</tr>")
        rows.append("</table>")
    if "avoid" in p:
        rows.append("<h2>Bitte vorerst NICHT machen</h2><ul><li>Kreuzheben</li><li>Tiefe Kniebeugen</li><li>Sit-ups / Crunches</li></ul>")
    return f"""<html><head><meta charset="utf-8"><style>
      body{{font-family:Helvetica,Arial;margin:36px;color:#111}} h1{{font-size:22px}} .h{{color:#555;font-size:13px}}
      h2{{font-size:16px;margin-top:22px;border-bottom:2px solid #c33;padding-bottom:3px}}
      table{{border-collapse:collapse;width:100%;font-size:13px}} td,th{{border:1px solid #bbb;padding:5px 7px;text-align:left}}
      th{{background:#eee}}</style></head><body><h1>{html.escape(p['title'])}</h1><div class="h">{html.escape(p['header'])}</div>
      {''.join(rows)}</body></html>"""

def hand_html(p):
    lines = []
    for d in p["days"]:
        lines.append(f"<div class='d'>{html.escape(d['name'])}</div>")
        for ex in d["exercises"]:
            lines.append(f"<div>{html.escape(name(ex, True))} &nbsp; {ex[1]}x{html.escape(ex[2])}</div>")
    return f"""<html><head><meta charset="utf-8"><style>
      body{{margin:0;background:#fbf8ef;font-family:'Bradley Hand','Noteworthy',cursive;font-size:30px;color:#1d2a6b;
      padding:40px 50px;line-height:1.45;
      background-image:repeating-linear-gradient(#fbf8ef 0 41px,#b9cbe6 42px)}}
      .t{{font-size:40px;text-decoration:underline}} .d{{margin-top:18px;font-size:34px;text-decoration:underline}}
      </style></head><body><div class='t'>{html.escape(p['title'])}</div>{''.join(lines)}</body></html>"""

def insta_html(p):
    blocks = []
    for d in p["days"]:
        items = "".join(f"<div class='r'>▪️ {html.escape(name(ex))} <b>{ex[1]}×{html.escape(ex[2])}</b>{(' · ' + html.escape(ex[3])) if ex[3] else ''}</div>" for ex in d["exercises"])
        blocks.append(f"<div class='c'><div class='dn'>{html.escape(d['name'])} DAY</div>{items}</div>")
    return f"""<html><head><meta charset="utf-8"><style>
      body{{margin:0;background:#0d0d10;color:#f2f2f2;font-family:-apple-system,Helvetica;padding:28px 22px;width:430px}}
      .t{{font-size:28px;font-weight:800}} .h{{color:#aaa;margin:6px 0 18px}} .c{{background:#1c1c22;border-radius:18px;padding:16px;margin-bottom:16px}}
      .dn{{color:#ff7a3d;font-weight:800;margin-bottom:8px;letter-spacing:1px}} .r{{margin:7px 0;font-size:16px}}
      </style></head><body><div class='t'>{html.escape(p['title'])}</div><div class='h'>{html.escape(p['header'])}</div>{''.join(blocks)}
      <div class='h'>Mo Upper · Di Lower · Do Upper · Fr Lower</div></body></html>"""

def photoify(src, dst):
    from PIL import Image, ImageFilter, ImageEnhance
    random.seed(7)
    im = Image.open(src).convert("RGB")
    im = im.rotate(-4, resample=Image.BICUBIC, expand=True, fillcolor=(70, 66, 60))
    w, h = im.size
    # Slight perspective: shrink the top edge, like a phone held at an angle.
    coeffs = (1, 0.04, -w * 0.02, 0.0, 1, 0, 0.00004, 0)
    im = im.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(70, 66, 60))
    im = ImageEnhance.Brightness(im).enhance(0.92)
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    px = im.load()
    for _ in range(w * h // 40):
        x, y = random.randrange(w), random.randrange(h)
        r, g, b = px[x, y]; n = random.randint(-18, 18)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    im.save(dst, "JPEG", quality=68)

if __name__ == "__main__":
    OUT = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for p in PLANS:
        base = os.path.join(OUT, p["id"])
        if p["format"] == "pdf":
            open(base + ".html", "w").write(doc_html(p))
            chrome([f"--print-to-pdf={base}.pdf", "--no-pdf-header-footer", f"file://{base}.html"])
        elif p["format"] == "photo":
            open(base + ".html", "w").write(hand_html(p))
            chrome([f"--screenshot={base}.raw.png", "--window-size=900,1500", f"file://{base}.html"])
            photoify(base + ".raw.png", base + ".jpg")
        elif p["format"] == "screenshot":
            open(base + ".html", "w").write(insta_html(p))
            chrome([f"--screenshot={base}.png", "--window-size=474,1050", "--hide-scrollbars", f"file://{base}.html"])
        elif p["format"] == "xlsx":
            from openpyxl import Workbook
            wb = Workbook(); ws = wb.active; ws.title = "Plan"
            ws.append(["Tag", "Übung", "Sätze", "Wdh", "Pause", "Notiz"])
            for d in p["days"]:
                for ex in d["exercises"]:
                    ws.append([d["name"], name(ex), ex[1], ex[2], "90s", ex[3]])
                if not d["exercises"]:
                    ws.append([d["name"], p["cardio_note"], "", "", "", ""])
            wb.save(base + ".xlsx")
        print("rendered", p["id"])
