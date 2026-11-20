# realrun.py <plansdir> <outdir> [ids...] — sends each plan as PDF and (where pages are set) as phone photos. Run via realbench.sh.
import base64, json, os, random, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from real_plans import REAL
PDF, OUT = sys.argv[1], sys.argv[2]
only = sys.argv[3:] or None
TOOLS = os.path.dirname(os.path.abspath(__file__))
URL = "http://localhost:5055/api/import-workout?v=2"
os.makedirs(OUT, exist_ok=True)
IMG = os.path.join(OUT, "img"); os.makedirs(IMG, exist_ok=True)

def photo(pdf, page, dst):
    from PIL import Image, ImageFilter, ImageEnhance
    raw = dst + ".raw.png"
    subprocess.run([os.environ.get("PDF2PNG", os.path.join(TOOLS, "pdf2png")), pdf, str(page), raw, "1.2"], check=True)
    random.seed(page)
    im = Image.open(raw).convert("RGB")
    im.thumbnail((1600, 2400))
    im = im.rotate(-3, resample=Image.BICUBIC, expand=True, fillcolor=(80, 76, 70))
    w, h = im.size
    im = im.transform((w, h), Image.PERSPECTIVE, (1, 0.03, -w * 0.015, 0, 1, 0, 0.00003, 0), Image.BICUBIC, fillcolor=(80, 76, 70))
    im = ImageEnhance.Brightness(im).enhance(0.9)
    im = im.filter(ImageFilter.GaussianBlur(0.9))
    im.save(dst, "JPEG", quality=70)

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "accept": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            res, status = json.loads(r.read()), 200
    except urllib.error.HTTPError as e:
        res, status = {"error": e.read().decode()[:400]}, e.code
    except Exception as e:
        res, status = {"error": str(e)}, 0
    res["_status"], res["_seconds"] = status, round(time.time() - t, 1)
    return res

for p in REAL:
    if only and p["id"] not in only:
        continue
    pdf = os.path.join(PDF, p["pdf"])
    res = post({"pdfData": base64.b64encode(open(pdf, "rb").read()).decode()})
    json.dump(res, open(os.path.join(OUT, p["id"] + ".pdf.json"), "w"), ensure_ascii=False, indent=1)
    print(p["id"], "pdf", res["_status"], res["_seconds"], "s", (res.get("error") or "")[:100], flush=True)
    if p.get("pages") and not os.environ.get("PDF_ONLY"):
        imgs = []
        for pg in p["pages"]:
            dst = os.path.join(IMG, f"{p['id']}.p{pg}.jpg")
            photo(pdf, pg, dst)
            imgs.append({"base64": base64.b64encode(open(dst, "rb").read()).decode(), "mediaType": "image/jpeg"})
        res = post({"images": imgs})
        json.dump(res, open(os.path.join(OUT, p["id"] + ".photo.json"), "w"), ensure_ascii=False, indent=1)
        print(p["id"], "photo", res["_status"], res["_seconds"], "s", (res.get("error") or "")[:100], flush=True)
