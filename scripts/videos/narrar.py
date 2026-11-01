import json, os, subprocess, sys, time

W = os.environ.get("VIDEO_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".videos-work")
VENV = os.environ.get("EDGE_TTS") or os.path.expanduser("~/.hermes/cache/scratch/walkthrough/ttsvenv/bin/edge-tts")
CUALES = sys.argv[1:] or ["socio", "admin", "dispensario"]

# edge-tts pide 48 kbps por defecto; el mismo endpoint acepta 96 kbps
# (misma voz y mismo sample rate, la mitad de artefactos de mp3).
COMM = os.path.join(os.path.dirname(os.path.dirname(VENV)), "lib", "python3.12", "site-packages", "edge_tts", "communicate.py")
if os.path.exists(COMM):
    _t = open(COMM).read()
    if "audio-24khz-48kbitrate-mono-mp3" in _t:
        open(COMM, "w").write(_t.replace("audio-24khz-48kbitrate-mono-mp3", "audio-24khz-96kbitrate-mono-mp3"))
        print("edge-tts: salida a 96 kbps")
os.makedirs(f"{W}/audio", exist_ok=True)


def dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)


def tts(sec, intento=1):
    mp3 = f"{W}/audio/{sec['id']}.mp3"
    if os.path.exists(mp3) and os.path.getsize(mp3) > 5000:
        return True
    r = subprocess.run([VENV, "--voice", sec["voz"], "--rate=-4%", "--text", sec["texto"], "--write-media", mp3],
                       capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(mp3) and os.path.getsize(mp3) > 5000:
        return True
    if intento < 4:
        time.sleep(3 * intento)
        return tts(sec, intento + 1)
    print(f"  FALLO {sec['id']}: {r.stderr.strip().splitlines()[-1][:160] if r.stderr else 'sin error'}")
    return False


for nombre in CUALES:
    secs = json.load(open(f"{W}/guion-{nombre}.json"))
    total, faltan = 0.0, 0
    print(f"== {nombre} ==")
    for s in secs:
        ok = tts(s)
        time.sleep(1.2)
        if not ok:
            faltan += 1
            continue
        d = dur(f"{W}/audio/{s['id']}.mp3")
        total += d
        pal = len(s["texto"].split())
        print(f"  {s['id']} {d:5.1f}s {pal:3d} pal ({pal / d:.2f} pal/s) {s['titulo']}")
    print(f"  total voz: {total:.1f}s | faltan: {faltan}")

# duraciones.json: lo que el grabador usa para saber cuánto tiene que durar cada sección
durs = {}
for nombre in CUALES:
    for s in json.load(open(f"{W}/guion-{nombre}.json")):
        p = f"{W}/audio/{s['id']}.mp3"
        if os.path.exists(p):
            durs[s["id"]] = round(dur(p), 2)
json.dump(durs, open(f"{W}/duraciones.json", "w"), indent=1)
print(f"\nduraciones.json: {len(durs)} secciones")
