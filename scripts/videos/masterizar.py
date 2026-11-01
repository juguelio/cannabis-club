"""Masteriza la locución: 96 kbps → cadena de voz → -16 LUFS → WAV 48 kHz.

Uso: python3.12 masterizar.py [socio|admin]   (sin argumento: todos los audios del guion)
"""
import json, os, subprocess, sys

W = os.environ.get("VIDEO_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".videos-work")
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
SAL = f"{W}/audio-master"
os.makedirs(SAL, exist_ok=True)

# Cadena: quita retumbe, doma sibilancia, despeja la caja de 200 Hz, presencia y aire,
# comprime suave para que el nivel sea parejo y termina en fades de 20/60 ms.
CADENA = ",".join([
    "aresample=48000",
    "highpass=f=85:poles=2",
    "deesser=i=0.35:m=0.5",
    "equalizer=f=210:width_type=q:w=1.1:g=-1.8",
    "equalizer=f=3200:width_type=q:w=1.0:g=2.6",
    "equalizer=f=8200:width_type=q:w=1.3:g=1.8",
    "acompressor=threshold=0.125:ratio=2.4:attack=8:release=180:makeup=1.6:knee=4",
])


def loud(p):
    r = subprocess.run([FF, "-v", "info", "-i", p, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    ini = r.rfind("{")
    if ini < 0:
        return {}
    fin = r.find("}", ini)
    return json.loads(r[ini:fin + 1])


def medir(p):
    d = loud(p)
    return {k: float(d.get(k, 0) or 0) for k in ("input_i", "input_tp", "input_lra", "input_thresh")}


def master(entrada, salida):
    m = medir(entrada)
    ln = (f"loudnorm=I=-16:TP=-1.5:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
          f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:linear=true")
    af = (f"{CADENA},{ln},afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.06,areverse")
    r = subprocess.run([FF, "-y", "-v", "error", "-i", entrada, "-af", af, "-ar", "48000",
                        "-c:a", "pcm_s16le", salida], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-400:])
    return m, medir(salida)


cuales = sys.argv[1:] or ["socio", "admin", "dispensario"]
vistos = []
for c in cuales:
    for s in json.load(open(f"{W}/guion-{c}.json")):
        if s["id"] in vistos:
            continue
        vistos.append(s["id"])
        origen = f"{W}/audio/{s['id']}.mp3"
        destino = f"{SAL}/{s['id']}.wav"
        if not os.path.exists(origen):
            print(f"  falta {origen}")
            continue
        antes, despues = master(origen, destino)
        print(f"  {s['id']:4s} {antes['input_i']:6.1f} LUFS / TP {antes['input_tp']:5.1f} dB"
              f"  →  {despues['input_i']:6.1f} LUFS / TP {despues['input_tp']:5.1f} dB   {s['titulo']}")
print(f"\n{len(vistos)} audios masterizados en {SAL}")
