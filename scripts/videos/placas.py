"""Placas de portada/cierre y bandas de subtítulo para los videos del club."""
import json, os, subprocess

W = 1920
H_APP = 980
H_BAND = 100
W2 = os.environ.get("VIDEO_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".videos-work")
MAGICK = "/opt/homebrew/bin/magick"
LOGO = "/Users/altostake/Dev/cannabis-club/public/logo-republica.png"
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
F_TXT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
NEGRO = "#111111"
CREMA = "#F2ECE2"
ROSA = "#F3C4D3"
ROJO = "#E8412A"

os.makedirs(f"{W2}/placas", exist_ok=True)
os.makedirs(f"{W2}/bandas", exist_ok=True)


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"magick falló: {r.stderr[-300:]}")
    return r.stdout


# --- placa 1920x1080: fondo negro, logo sobre placa blanca, título grande ---
def placa(nombre, chico, titulo, sub, fondo=NEGRO, tinta=CREMA, destacado=ROSA):
    placa_bg = f"{W2}/placas/_{nombre}-bg.png"
    logoTmp = f"{W2}/placas/_{nombre}-logo.png"
    # logo con fondo blanco (placa) y esquinas suaves
    run([MAGICK, LOGO, "-resize", "260x260", "-background", "white", "-gravity", "center",
         "-extent", "320x320", logoTmp])
    run([MAGICK, "-size", f"{W}x1080", f"xc:{fondo}", placa_bg])
    # banda inferior con el color de firma
    run([MAGICK, placa_bg, "-fill", destacado, "-draw", f"rectangle 0,1040 {W},1080", placa_bg])
    salida = f"{W2}/placas/{nombre}.png"
    run([MAGICK, placa_bg, logoTmp, "-gravity", "north", "-geometry", "+0+230", "-composite",
         "-font", F_TXT, "-pointsize", "30", "-fill", destacado, "-gravity", "north",
         "-annotate", "+0+610", chico,
         "-font", F_BOLD, "-pointsize", "104", "-fill", tinta, "-gravity", "north",
         "-annotate", "+0+660", titulo,
         "-font", F_TXT, "-pointsize", "38", "-fill", tinta, "-gravity", "north",
         "-annotate", "+0+800", sub,
         salida])
    print("placa", salida)


placa("portada-socio", "REPÚBLICA ONG · PORTAL DEL SOCIO", "Cómo se usa", "Del carnet a la reserva, paso por paso")
placa("cierre-socio", "REPÚBLICA ONG", "¿Dudas?", "Escribile al club por WhatsApp", fondo=CREMA, tinta=NEGRO, destacado=ROJO)
placa("portada-admin", "REPÚBLICA ONG · GESTIÓN DEL CLUB", "Cómo se administra", "Panel, dispensario, stock y libros")
placa("cierre-admin", "REPÚBLICA ONG", "Un solo registro", "Quién, qué, cuándo y por qué", fondo=CREMA, tinta=NEGRO, destacado=ROJO)
placa("portada-dispensario", "REPÚBLICA ONG · EL MOSTRADOR", "Cómo se dispensa", "Del turno del día al comprobante")
placa("cierre-dispensario", "REPÚBLICA ONG", "Nada se borra", "Cada gramo queda con quién, cuándo y por qué", fondo=CREMA, tinta=NEGRO, destacado=ROJO)


# --- banda de subtítulo 1920x100 ---
def banda(nombre, titulo, sub):
    salida = f"{W2}/bandas/{nombre}.png"
    run([MAGICK, "-size", f"{W}x{H_BAND}", "xc:none",
         "-fill", NEGRO, "-draw", f"rectangle 0,0 {W},{H_BAND}",
         "-fill", ROJO, "-draw", f"rectangle 0,0 10,{H_BAND}",
         "-font", F_TXT, "-pointsize", "34", "-fill", "white", "-gravity", "west",
         "-annotate", "+40+0", titulo,
         "-font", F_TXT, "-pointsize", "27", "-fill", ROSA, "-gravity", "east",
         "-annotate", "+40+2", sub,
         salida])
    print("banda", salida)


CUALES = ["socio", "admin", "dispensario"]

for cual in CUALES:
    for s in json.load(open(f"{W2}/guion-{cual}.json")):
        if s["tipo"] == "nav":
            banda(s["id"], s["titulo"], s["sub"])

print("listo")
