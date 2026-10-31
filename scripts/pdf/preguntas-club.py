#!/usr/bin/env python3
"""Genera el PDF de preguntas para el club, con la identidad visual del sitio.

Uso:  python3 scripts/pdf/preguntas-club.py
Salida: docs/preguntas-al-cliente.pdf

La estética sale de `Club.marca` (paleta, tipografías) y de `src/app/sitio/sitio.css`
(etiquetas en mayúscula, números grandes, banda de color de firma). Las fuentes se embeben
en base64 para que el PDF no dependa de la máquina que lo abra.
"""
from __future__ import annotations

import base64
import json
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
# Vive dentro de `walkthrough` para que node resuelva `puppeteer-core` de ese node_modules.
SCRATCH = pathlib.Path.home() / ".hermes/cache/scratch/walkthrough/pdf-club"
SALIDA_HTML = SCRATCH / "preguntas-club.html"
PDF = RAIZ / "docs/preguntas-al-cliente.pdf"

# Paleta del club (Club.marca.colores) y rol de cada color, igual que en el sitio.
PAPEL = "#f2ece2"
TINTA = "#111111"
FIRMA = "#e8412a"
ACENTO = "#f3c4d3"
MUTED = "#6b6459"
LINEA = "#cfc6b6"

FUENTES = {
    "Montserrat": RAIZ / ".next/static/media/montserrat-latin-wght-normal.0s216eisv2o7-.woff2",
    "Instrument": RAIZ / ".next/static/media/instrument-sans-latin-wght-normal.3h2wr6o8p949u.woff2",
    "Gotica": RAIZ / ".next/static/media/unifrakturmaguntia-latin-400-normal.149sar0gtc4by.woff2",
}
LOGO = pathlib.Path.home() / ".hermes/cache/scratch/logo.bin"

DECISIONES = [
    {
        "n": "01",
        "titulo": "Tope mensual de retiro",
        "pide": "El sitio publica «no hay límite mensual de provisión», pero el sistema hoy frena a los 50 g por mes "
                "y 25 g por día. Un socio que retira sus 40 g no puede hacer el segundo envío del mes.",
        "por": "Es lo que el sistema usa para autorizar o frenar una entrega en el mostrador, y lo que queda escrito "
               "en el libro si un inspector lo revisa.",
        "opciones": ["Sin tope mensual", "El que autorice su REPROCANN", "Un tope fijo"],
    },
    {
        "n": "02",
        "titulo": "Extractos: cuántos gramos equivalen",
        "pide": "El registro trabaja en gramos. Para asentar un Live Rosin o un PEN hace falta la equivalencia: "
                "cuántos gramos de flores descuenta cada uno.",
        "por": "Sin ese número el libro no puede descontar stock de extractos y el tope del socio queda mal calculado.",
    },
    {
        "n": "03",
        "titulo": "¿Los aportes se publican en el sitio?",
        "pide": "Podemos mostrar el aporte de la membresía en el sitio público o dejarlo sólo dentro del portal del "
                "socio, donde ya aparece al consultar su cuenta.",
        "por": "Una lista de precios abierta al público choca con el marco de «no se vende, se prorratean costos». "
               "Nuestra recomendación es dejarla en el portal.",
        "opciones": ["Sólo en el portal (recomendado)", "También en el sitio público"],
    },
    {
        "n": "04",
        "titulo": "Actividades",
        "pide": "Mencionan acceso a actividades en CABA, La Plata y San Martín de los Andes. Falta qué actividad, "
                "dónde y con qué frecuencia para publicarlas.",
        "por": "Hoy el sitio no las nombra: preferimos no anunciar algo sin fecha antes que prometer y no cumplir.",
    },
    {
        "n": "05",
        "titulo": "Consulta médica: adentro o afuera",
        "pide": "El sitio la describe como paso obligatorio de $50.000 y 3 años de vigencia, pero la app no agenda "
                "ni cobra la consulta: eso se resuelve directamente con el médico.",
        "por": "Si quieren que el socio saque el turno y pague dentro del sistema, es trabajo nuevo con un costo; "
               "si no, se aclara en el sitio que se coordina con el consultorio.",
        "opciones": ["Sigue por fuera (hoy)", "Adentro: turno y pago"],
    },
    {
        "n": "06",
        "titulo": "Los diez datos legales",
        "pide": "Faltan: CUIT de la asociación, número de REPROCANN de la ONG, personería jurídica, director médico y "
                "matrícula, responsable técnico y título, REPS y domicilio legal. Hoy hay 1 de 10 cargado.",
        "por": "Los valores de ejemplo se imprimen en las etiquetas, en los libros y en el informe semestral. "
               "El sistema los marca como faltantes, pero los marca a nosotros, no a un inspector.",
    },
    {
        "n": "07",
        "titulo": "Cuentas y casillas del club",
        "pide": "Necesitamos el email real del administrador y del dispensador, y decidir el correo institucional: "
                "Zoho (la primera casilla es gratis) o Google Workspace (unos USD 7 por casilla, por mes).",
        "por": "Hoy quedaron las cuentas de prueba. Además falta que deleguen los dos dominios en nic.ar con los "
               "nameservers que ya les pasamos.",
    },
    {
        "n": "08",
        "titulo": "Fotos de las variedades",
        "pide": "Las fotos las sube el club desde Configuración › Catálogo. Si quieren, usamos las del Drive para la "
                "portada del sitio.",
        "por": "Sin foto la variedad se muestra como «Foto provisoria»: preferimos eso a un hueco o a una foto de otro.",
    },
    {
        "n": "09",
        "titulo": "Cuota social",
        "pide": "Quedó en $0, porque en su esquema la membresía de 10 g ya es la cuota mínima de retiro. Si además "
                "cobran una cuota mensual aparte, la cargamos.",
        "por": "Cobrar dos veces lo mismo en la cuenta del socio es un problema que después hay que explicar.",
    },
]

YA_ESTA = [
    ("El sitio, con sus textos", "Cultivo asociativo, «no se vende», membresía de 10 g, hasta cuatro por envío, "
     "consulta médica, retiro en San Telmo y los cuatro valores de envío con sus plazos."),
    ("Precios y aportes", "Membresía de 10 g a $130.000, que da $13.000 por gramo. Es lo que la cuenta del socio "
     "carga en cada entrega: probado con una entrega real."),
    ("Los extractos cargados", "Live Rosin 90u a $110.000 y PEN de live rosin 24K a $120.000, en la lista de productos."),
    ("Las altas, en su lugar", "Socios › Altas: la persona se registra con Google, sube su documentación y el club "
     "aprueba o rechaza desde ahí mismo."),
    ("Los aportes, configurables", "El club los cambia solo en Configuración › Precios y aportes, sin depender de "
     "nosotros."),
]

NUESTRO_LADO = [
    ("Dominio", "Verificar la delegación de los dos dominios y dejarlos andando con www y redirección al canónico."),
    ("Google", "Agregar el redirect nuevo para que el ingreso con Google siga funcionando en el dominio propio."),
    ("Avisos por email", "Sin la clave de envío no sale ningún correo de la app. Se habilita cuando el dominio esté "
     "verificado."),
    ("Respaldos", "Respaldo automático y tarea de retención programada, hoy manuales."),
]


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def construir_html() -> str:
    caras = "\n".join(
        f"@font-face{{font-family:'{nombre}';src:url(data:font/woff2;base64,{b64(ruta)}) format('woff2');"
        f"font-weight:100 900;font-display:block;}}"
        for nombre, ruta in FUENTES.items()
    )
    logo = b64(LOGO)

    tarjetas = [
        f"""
        <article class="card">
          <div class="card-n">{d['n']}</div>
          <div class="card-body">
            <h3>{d['titulo']}</h3>
            <p class="pide">{d['pide']}</p>
            <p class="por"><span>Por qué importa</span>{d['por']}</p>
            {f'<div class="chips">{"".join(f"<span>{o}</span>" for o in d.get("opciones", []))}</div>' if d.get("opciones") else ""}
          </div>
        </article>"""
        for d in DECISIONES
    ]
    # Tres por página: cinco apretaba la última contra el pie y la cortaba.
    paginas_decisiones = "".join(
        f"""
<section class="page">
  <div class="head"><h2>Las nueve decisiones</h2><div class="label">{etiqueta}</div></div>
  <div class="cards">{''.join(tarjetas[a:b])}</div>
  <div class="foot"><span>República Cannabis</span><span>{num} / 6</span></div>
</section>"""
        for a, b, etiqueta, num in [(0, 3, "01 — 03", 3), (3, 6, "04 — 06", 4), (6, 9, "07 — 09", 5)]
    )

    ya_esta = "\n".join(
        f'<li><b>{t}</b><span>{x}</span></li>' for t, x in YA_ESTA
    )
    nuestro = "\n".join(f'<li><b>{t}</b><span>{x}</span></li>' for t, x in NUESTRO_LADO)

    return f"""<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8">
<title>República Cannabis · Preguntas para el club</title>
<style>
{caras}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: {PAPEL}; color: {TINTA}; font-family: 'Instrument', sans-serif; font-size: 10.6pt; line-height: 1.5; }}
.page {{ width: 210mm; height: 297mm; padding: 20mm 18mm 16mm; position: relative; page-break-after: always; overflow: hidden; }}
.page:last-child {{ page-break-after: auto; }}
.dark {{ background: {TINTA}; color: {PAPEL}; }}
.label {{ font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 8.6pt; letter-spacing: .16em; text-transform: uppercase; }}
.wordmark {{ font-family: 'Gotica', serif; font-weight: 400; line-height: .92; }}
.h1 {{ font-family: 'Montserrat', sans-serif; font-weight: 850; text-transform: uppercase; letter-spacing: -.015em; line-height: .94; }}
.band {{ background: {FIRMA}; color: {PAPEL}; font-family: 'Montserrat', sans-serif; font-weight: 850;
         text-transform: uppercase; letter-spacing: .04em; font-size: 9pt; padding: 7px 12px; }}
.foot {{ position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex; justify-content: space-between;
         align-items: center; font-family: 'Montserrat', sans-serif; font-size: 7.6pt; letter-spacing: .12em;
         text-transform: uppercase; color: {MUTED}; border-top: 1px solid {LINEA}; padding-top: 5px; }}
.dark .foot {{ color: #b9b1a4; border-color: #3a3a3a; }}

/* tapa */
.cover {{ display: flex; flex-direction: column; justify-content: space-between; }}
.cover-top {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; }}
.cover-logo {{ width: 30mm; background: #fff; padding: 3mm; border-radius: 3px; }}
.cover-mid {{ padding: 6mm 0 0; }}
.cover-mid .wordmark {{ font-size: 62pt; margin-bottom: 6mm; }}
.cover-mid .h1 {{ font-size: 31pt; max-width: 150mm; }}
.cover-mid .lema {{ margin-top: 7mm; font-size: 12pt; color: #c9c1b4; max-width: 120mm; }}
.cover-bot {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; }}
.cover-bot .quien {{ font-size: 11pt; }}
.cover-bot .quien b {{ font-family: 'Montserrat', sans-serif; font-weight: 800; display: block; font-size: 12pt; }}
.cover-bot .fecha {{ text-align: right; }}

/* interior */
.head {{ display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid {TINTA};
         padding-bottom: 4mm; margin-bottom: 8mm; }}
.head h2 {{ font-family: 'Montserrat', sans-serif; font-weight: 850; text-transform: uppercase; font-size: 19pt;
            letter-spacing: -.01em; }}
.head .label {{ color: {MUTED}; }}
.intro {{ font-size: 11.4pt; max-width: 165mm; margin-bottom: 7mm; }}
.intro b {{ font-weight: 700; }}
ul.lista {{ list-style: none; }}
ul.lista li {{ display: grid; grid-template-columns: 52mm 1fr; gap: 6mm; padding: 5mm 0; border-bottom: 1px solid {LINEA}; }}
ul.lista li b {{ font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 10pt; text-transform: uppercase;
                 letter-spacing: .02em; line-height: 1.25; }}
ul.lista li span {{ font-size: 10.4pt; }}
.cards {{ display: flex; flex-direction: column; justify-content: space-between; height: 225mm; }}
.card {{ display: grid; grid-template-columns: 20mm 1fr; gap: 6mm; padding: 5.5mm 0; border-top: 1.5px solid {TINTA}; }}
.card-n {{ font-family: 'Montserrat', sans-serif; font-weight: 850; font-size: 26pt; line-height: 1; color: {FIRMA}; }}
.card-body h3 {{ font-family: 'Montserrat', sans-serif; font-weight: 850; text-transform: uppercase; font-size: 12.4pt;
                 letter-spacing: -.005em; margin-bottom: 2.5mm; }}
.pide {{ margin-bottom: 2.5mm; }}
.por {{ font-size: 9.8pt; color: #3d3a35; }}
.por span {{ font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 7.8pt; letter-spacing: .14em;
             text-transform: uppercase; color: {MUTED}; display: block; margin-bottom: 1mm; }}
.chips {{ margin-top: 3mm; display: flex; gap: 2.5mm; flex-wrap: wrap; }}
.chips span {{ border: 1.5px solid {TINTA}; border-radius: 999px; padding: 1.2mm 4mm; font-size: 8.8pt;
               font-family: 'Montserrat', sans-serif; font-weight: 700; }}
.cierre {{ margin-top: 6mm; background: {ACENTO}; padding: 6mm; border-left: 4px solid {FIRMA}; }}
.cierre p {{ margin: 0; }}
.cierre p b {{ font-weight: 700; display: inline; }}
.cierre > b {{ font-family: 'Montserrat', sans-serif; font-weight: 850; text-transform: uppercase; font-size: 10pt;
             display: block; margin-bottom: 2mm; }}
</style></head>
<body>

<section class="page dark cover">
  <div class="cover-top">
    <div>
      <div class="label" style="color:#c9c1b4">Asociación civil · Cultivo solidario · REPROCANN</div>
      <div class="band" style="margin-top:6mm; display:inline-block">Documento para el club</div>
    </div>
    <img class="cover-logo" src="data:image/png;base64,{logo}" alt="">
  </div>
  <div class="cover-mid">
    <div class="wordmark">República Cannabis</div>
    <h1 class="h1">Lo que necesitamos<br>para abrir</h1>
    <p class="lema">Nueve decisiones que dependen del club, y lo que ya está funcionando en el sistema.</p>
  </div>
  <div class="cover-bot">
    <div class="quien"><b>Para la comisión directiva</b>República Cannabis · San Telmo, CABA</div>
    <div class="fecha"><div class="label">30 de octubre de 2026</div></div>
  </div>
  <div class="foot"><span>República Cannabis</span><span>1 / 6</span></div>
</section>

<section class="page">
  <div class="head"><h2>Lo que ya está</h2><div class="label">Antes de las preguntas</div></div>
  <p class="intro">Esto ya está cargado y funcionando. No hace falta que decidan nada: <b>si algún número no es el que
  quieren, se cambia en un minuto desde Configuración.</b></p>
  <ul class="lista">{ya_esta}</ul>
  <div class="cierre">
    <b>Un solo número para mirar</b>
    <p>La membresía de 10 g a $130.000 equivale a <b>$13.000 por gramo</b>. Es lo que la cuenta del socio carga en cada
    entrega. Antes de esta puesta a punto el sistema cargaba $12.000 por esa misma entrega: la diferencia es que ahora
    el libro del club dice lo mismo que la caja.</p>
  </div>
  <div class="foot"><span>República Cannabis</span><span>2 / 6</span></div>
</section>

{paginas_decisiones}

<section class="page">
  <div class="head"><h2>De nuestro lado</h2><div class="label">No depende del club</div></div>
  <p class="intro">Esto lo resolvemos nosotros. Lo que necesitamos de ustedes son las nueve decisiones anteriores y,
  para las que piden un dato, el dato.</p>
  <ul class="lista">{nuestro}</ul>
  <div class="band" style="margin-top:9mm">Cómo respondernos</div>
  <p class="intro" style="margin-top:5mm">Alcanza con responder punto por punto en el mismo chat: no hace falta un
  documento formal. Lo que quede en duda lo resolvemos en una llamada de quince minutos.</p>
  <div class="cierre" style="margin-top:15mm">
    <b>Fecha que importa</b>
    <p>Para arrancar con datos reales necesitamos dos cosas: <b>el tope mensual</b> y <b>los datos legales</b>. Todo lo
    demás puede esperar a la segunda semana sin frenar el alta de los primeros socios.</p>
  </div>

  <div class="foot"><span>República Cannabis · San Telmo, CABA</span><span>6 / 6</span></div>
</section>

</body></html>"""


def render() -> None:
    SCRATCH.mkdir(parents=True, exist_ok=True)
    SALIDA_HTML.write_text(construir_html(), encoding="utf-8")
    script = SCRATCH / "render.mjs"
    script.write_text(
        """import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none'] });
const p = await b.newPage();
await p.goto('file://%s', { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 700));
await p.pdf({ path: '%s', format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await b.close();
console.log('ok');
""" % (SALIDA_HTML, PDF),
        encoding="utf-8",
    )
    print(subprocess.run(["node", str(script)], capture_output=True, text=True).stdout.strip())


if __name__ == "__main__":
    try:
        render()
        print(f"PDF: {PDF}")
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        raise
