import base64, json, os, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from plans import PLANS
FILES, OUT = sys.argv[1], sys.argv[2]
URL = "http://localhost:5055/api/import-workout?v=2"
os.makedirs(OUT, exist_ok=True)
only = sys.argv[3:] or None
for p in PLANS:
    if only and p["id"] not in only:
        continue
    base = os.path.join(FILES, p["id"])
    fmt = p["format"]
    if fmt == "pdf":
        body = {"pdfData": base64.b64encode(open(base + ".pdf", "rb").read()).decode()}
    elif fmt == "photo":
        body = {"images": [{"base64": base64.b64encode(open(base + ".jpg", "rb").read()).decode(), "mediaType": "image/jpeg"}]}
    elif fmt == "screenshot":
        body = {"images": [{"base64": base64.b64encode(open(base + ".png", "rb").read()).decode(), "mediaType": "image/png"}]}
    else:
        body = {"spreadsheet": {"base64": base64.b64encode(open(base + ".xlsx", "rb").read()).decode(),
                "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
          headers={"content-type": "application/json", "accept": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            res = json.loads(r.read())
        status = 200
    except urllib.error.HTTPError as e:
        status, res = e.code, {"error": e.read().decode()[:500]}
    except Exception as e:
        status, res = 0, {"error": str(e)}
    res["_status"], res["_seconds"] = status, round(time.time() - t, 1)
    json.dump(res, open(os.path.join(OUT, p["id"] + ".json"), "w"), ensure_ascii=False, indent=1)
    print(p["id"], status, res["_seconds"], "s", (res.get("error") or "")[:120])
