"""Monta el video: frames del screencast + banda de subtítulo + locución, por sección y concatenado.

Uso: python3.12 montar.py socio|admin
"""
import json, os, subprocess, sys

FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"
W2 = os.environ.get("VIDEO_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".videos-work")
CUAL = sys.argv[1] if len(sys.argv) > 1 else "socio"
OUT = f"{W2}/grab-{CUAL}"
SEG = f"{W2}/seg-{CUAL}"
WA, HA, HB = 1920, 980, 100
os.makedirs(SEG, exist_ok=True)


def dur(p):
    o = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                       capture_output=True, text=True).stdout.strip()
    return float(o or 0)


def sh(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"ffmpeg falló ({args[0]}): {r.stderr[-500:]}")
    return r


guion = {s["id"]: s for s in json.load(open(f"{W2}/guion-{CUAL}.json"))}
orden = [s["id"] for s in json.load(open(f"{W2}/guion-{CUAL}.json"))]
grab = json.load(open(f"{OUT}/grabacion.json"))
secciones = {s["id"]: s for s in grab["secciones"]}
frames = grab["frames"]

LENTO = 1.18          # ralentiza el ritmo del screencast
COLA = 1.0            # silencio después de cada locución
MIN_D, MAX_D = 0.07, 2.2

segmentos = []
for sid in orden:
    sec = guion[sid]
    # se usa el audio masterizado (−16 LUFS, EQ, de-esser) si existe; si no, el crudo
    wav = f"{W2}/audio-master/{sid}.wav"
    mp3 = wav if os.path.exists(wav) else f"{W2}/audio/{sid}.mp3"
    ta = dur(mp3)
    T = round(ta + COLA, 3)
    seg = f"{SEG}/{sid}.mp4"
    log = []

    if sec["tipo"] == "placa":
        alias = {"s0p": "portada-socio", "a0p": "portada-admin", "d0p": "portada-dispensario"}
        nombre_placa = alias.get(sid) or ("cierre-" + CUAL)
        placa = f"{W2}/placas/{nombre_placa}.png"
        if not os.path.exists(placa):
            raise RuntimeError(f"falta la placa {placa} (corré placas.py)")
        sh([FFMPEG, "-y", "-loop", "1", "-t", f"{T}", "-i", placa, "-i", mp3,
            "-f", "lavfi", "-t", f"{T}", "-i", "anullsrc=r=48000:cl=stereo",
            "-filter_complex",
            f"[0:v]scale={WA}:{HA+HB},fps=30,format=yuv420p,fade=t=in:st=0:d=0.5[v];"
            f"[1:a]apad=pad_dur={COLA},atrim=0:{T},asetpts=N/SR/TB[a1];[2:a][a1]amix=inputs=2:duration=first:normalize=0[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{T}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "1", seg])
        log.append(f"placa {T:.1f}s")
    else:
        s = secciones.get(sid)
        if not s:
            raise RuntimeError(f"sin sección grabada para {sid}")
        fr = [f for f in frames if s["desde"] <= f["ts"] <= s["hasta"]]
        lista = f"{SEG}/{sid}.txt"
        if len(fr) < 2:
            still = f"{OUT}/stills/{sid}.png"
            with open(lista, "w") as fh:
                fh.write(f"file '{still}'\nduration {T}\nfile '{still}'\n")
            log.append("still (sin frames)")
        else:
            durs = []
            for i, f in enumerate(fr[:-1]):
                d = (fr[i + 1]["ts"] - f["ts"]) / 1000 * LENTO
                durs.append(min(max(d, MIN_D), MAX_D))
            natural = sum(durs)
            # estiramos o comprimimos el movimiento para que ocupe exactamente la locución
            k = T / natural if natural > 0 else 1
            durs = [min(max(d * k, MIN_D), 1.6) for d in durs]
            resto = T - sum(durs)
            if resto > 0:
                durs[-1] += resto
            with open(lista, "w") as fh:
                for f, d in zip(fr[:-1], durs):
                    fh.write(f"file '{OUT}/{f['file']}'\nduration {d:.3f}\n")
                fh.write(f"file '{OUT}/{fr[-1]['file']}'\nduration {max(T - sum(durs), MIN_D):.3f}\n")
                fh.write(f"file '{OUT}/{fr[-1]['file']}'\n")
            log.append(f"{len(fr)} frames")
        banda = f"{W2}/bandas/{sid}.png"
        sh([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista, "-i", banda, "-i", mp3,
            "-f", "lavfi", "-t", f"{T}", "-i", "anullsrc=r=48000:cl=stereo",
            "-filter_complex",
            f"[0:v]fps=30,scale={WA}:{HA},setsar=1,pad={WA}:{HA+HB}:0:0:black[v0];[v0][1:v]overlay=0:{HA}:format=auto,format=yuv420p[v];"
            f"[2:a]apad=pad_dur={COLA},atrim=0:{T},asetpts=N/SR/TB[a1];[3:a][a1]amix=inputs=2:duration=first:normalize=0[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{T}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "1", seg])

    d = dur(seg)
    segmentos.append({"id": sid, "seg": seg, "dur": d})
    print(f"  {sid:4s} voz {ta:5.1f}s → segmento {d:5.1f}s  ({', '.join(log)})  {sec['titulo']}")

# ---------- concat ----------
lista = f"{SEG}/lista.txt"
with open(lista, "w") as fh:
    for s in segmentos:
        fh.write(f"file '{s['seg']}'\n")
final = f"{W2}/{CUAL}.mp4"
sh([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", final])
total = dur(final)
print(f"\nvideo: {final}  ({total/60:.1f} min, {total:.1f}s)")

# ---------- subtítulos ----------
def ts(t):
    h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


t = 0.0
with open(f"{W2}/{CUAL}.srt", "w") as fh:
    for i, s in enumerate(segmentos, 1):
        texto = guion[s["id"]]["texto"]
        fh.write(f"{i}\n{ts(t)} --> {ts(t + s['dur'] - 0.15)}\n{texto}\n\n")
        t += s["dur"]
print(f"subtítulos: {W2}/{CUAL}.srt  ({t:.1f}s acumulados)")
