// Graba el recorrido real de la app por CDP screencast, con cursor sintético.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

// Graba el recorrido real de la app por CDP screencast, con cursor sintético.
// Uso: node record.mjs socio|admin|dispensario
//   VIDEO_BASE (default http://127.0.0.1:3321)  VIDEO_WORK (default <repo>/.videos-work)
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CUAL = process.argv[2] ?? 'socio';
const BASE = process.env.VIDEO_BASE ?? 'http://127.0.0.1:3321';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1920, H = 980;                       // área de la app; la banda de subtítulo se agrega al montar
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = process.env.VIDEO_WORK ?? join(RAIZ, '.videos-work');
const OUT = join(WORK, `grab-${CUAL}`);
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), `guion-${CUAL}.json`);
const CLAVES = JSON.parse(readFileSync(join(WORK, 'claves.json'), 'utf8'));
const CRED = CLAVES[CUAL];

for (const d of ['frames', 'stills']) mkdirSync(`${OUT}/${d}`, { recursive: true });

const guion = JSON.parse(readFileSync(SCRIPT, 'utf8'));
const DUR = JSON.parse(readFileSync(join(WORK, 'duraciones.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(45000);
page.on('dialog', (d) => d.accept().catch(() => {}));

// ---------- screencast ----------
const client = await page.createCDPSession();
const frames = [];
let nFrame = 0, grabando = false;
client.on('Page.screencastFrame', async (f) => {
  const ts = Date.now();
  if (grabando) {
    const file = `frames/f${String(++nFrame).padStart(5, '0')}.jpg`;
    try { writeFileSync(`${OUT}/${file}`, Buffer.from(f.data, 'base64')); frames.push({ file, ts }); } catch {}
  }
  try { await client.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await client.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
grabando = true;

// ---------- cursor + ayudas ----------
const inyectar = () => page.evaluate(() => {
  if (!document.getElementById('__cur')) {
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;left:960px;top:520px;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid #E8412A;background:rgba(232,65,42,.25);pointer-events:none;transition:left .3s ease,top .3s ease,opacity .2s';
    document.body.appendChild(c);
    const s = document.createElement('style');
    s.textContent = '@keyframes __p{from{transform:scale(1);opacity:.9}to{transform:scale(3);opacity:0}}.__pulse{position:fixed;z-index:2147483646;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#E8412A;pointer-events:none;animation:__p .75s ease-out forwards}.__hl{outline:3px solid #E8412A !important;outline-offset:4px;border-radius:10px;transition:outline-color .2s}';
    document.head.appendChild(s);
  }
}).catch(() => {});

const mover = (x, y) => page.evaluate((x, y) => { const c = document.getElementById('__cur'); if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; } }, x, y).catch(() => {});
const pulso = (x, y) => page.evaluate((x, y) => {
  const d = document.createElement('div'); d.className = '__pulse'; d.style.left = x + 'px'; d.style.top = y + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 950);
}, x, y).catch(() => {});

const ubicar = (texto, exacto = false, sinScroll = false) => page.evaluate(({ texto, exacto, sinScroll }) => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const t = norm(texto);
  const cands = [...document.querySelectorAll('a,button,[role="button"],tr,[role="option"]')].filter((e) => e.getBoundingClientRect().width > 0);
  const el = cands.find((e) => { const x = norm(e.textContent); return exacto ? x === t : x.includes(t); });
  if (!el) return null;
  if (!sinScroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  document.querySelectorAll('.__hl').forEach((x) => x.classList.remove('__hl'));
  el.classList.add('__hl');
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}, { texto, exacto, sinScroll }).catch(() => null);

// clic con mouse real (CDP): los listbox de combobox no responden a element.click()
const clicReal = async (punto) => {
await page.mouse.move(punto.x, punto.y);
await sleep(160);
await page.mouse.down();
await sleep(70);
await page.mouse.up();
};

const clic = async (texto, { exacto = false, espera = 1100, sinScroll = false } = {}) => {
let p = await ubicar(texto, exacto, sinScroll);
if (!p) { console.log(`   (no encontré «${texto}»)`); return false; }
await sleep(sinScroll ? 260 : 500);
p = await ubicar(texto, exacto, sinScroll);
if (!p) return false;
await mover(p.x, p.y); await sleep(420); await pulso(p.x, p.y); await sleep(180);
await clicReal(p);
await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
await sleep(espera);
await inyectar();
return true;
};

// clic por prefijo (los botones del portal cambian de texto según la selección)
const clicPrefijo = async (prefijo, { espera = 1400 } = {}) => {
  const p = await page.evaluate((pref) => {
    const el = [...document.querySelectorAll('button')].filter((e) => e.getBoundingClientRect().width > 0)
      .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().startsWith(pref.toLowerCase()));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    document.querySelectorAll('.__hl').forEach((x) => x.classList.remove('__hl'));
    el.classList.add('__hl');
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, prefijo).catch(() => null);
  if (!p) { console.log(`   (no encontré botón que empiece con «${prefijo}»)`); return false; }
  await sleep(520); await mover(p.x, p.y); await sleep(500); await pulso(p.x, p.y); await sleep(220);
  await page.evaluate((pref) => {
    const el = [...document.querySelectorAll('button')].filter((e) => e.getBoundingClientRect().width > 0)
      .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().startsWith(pref.toLowerCase()));
    el?.click();
  }, prefijo);
  await sleep(espera); await inyectar();
  return true;
};

// mantiene movimiento suave mientras corre la locución (para que no sea una foto fija)
const mantener = async (T, desdeYa) => {
  const fin = desdeYa + Math.max(T - 0.9, 0.4) * 1000;
  while (Date.now() < fin) {
    const { y, max } = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }));
    const dy = y >= max - 4 ? -Math.max(60, (max - y) * 0) : Math.min(46, Math.max(18, max / 40));
    await page.evaluate((d) => window.scrollBy(0, d), dy || 0);
    await sleep(360);
  }
};

// Cookie de onboarding para mostrar /solicitud en el video del socio.
const ponerCookieSolicitud = async () => {
  const token = readFileSync(join(WORK, 'token-solicitud.txt'), 'utf8').trim();
  await client.send('Network.setCookie', {
    name: 'cc_solicitud', value: token, domain: new URL(BASE).hostname, path: '/', httpOnly: true,
  }).catch((e) => console.log('   (no pude poner la cookie)', String(e).slice(0, 80)));
};

const ir = async (ruta, espera = 1500) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle2' });
  await sleep(espera);
  await inyectar();
};

const desplazar = async (dy, pasos = 10, pausa = 120) => {
  for (let i = 0; i < pasos; i++) { await page.evaluate((d) => window.scrollBy(0, d), dy / pasos); await sleep(pausa); }
  await sleep(700);
};
const desplazarA = async (texto) => {
  const p = await ubicar(texto);
  if (p) { await sleep(900); await mover(p.x, Math.min(p.y, H - 160)); await sleep(700); }
};
const still = (n) => page.screenshot({ path: `${OUT}/stills/${n}.png` }).catch(() => {});

// Hover + pulso sin hacer clic: para señalar un botón sin ejecutar la acción.
const senalar = async (texto, { exacto = false } = {}) => {
  const p = await ubicar(texto, exacto);
  if (!p) { console.log(`   (no encontré «${texto}» para señalar)`); return false; }
  await sleep(420);
  await mover(p.x, p.y); await sleep(520); await pulso(p.x, p.y); await sleep(400);
  return true;
};

// Clic por aria-label exacto (las flechas del calendario no tienen texto útil).
const clicAria = async (etiqueta, { espera = 1400, prefijo = false } = {}) => {
  const p = await page.evaluate((lab, pref) => {
    const el = [...document.querySelectorAll('button,[role="button"],a')]
      .find((e) => {
        const a = e.getAttribute('aria-label') || '';
        return e.getBoundingClientRect().width > 0 && (pref ? a.startsWith(lab) : a === lab);
      });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, etiqueta, prefijo).catch(() => null);
  if (!p) { console.log(`   (no encontré aria-label «${etiqueta}»)`); return false; }
  await mover(p.x, p.y); await sleep(400); await pulso(p.x, p.y); await sleep(200);
  await clicReal(p);
  await sleep(espera); await inyectar();
  return true;
};

// ---------- guion ----------
const secciones = [];
let actual = null;
const abrir = (s) => { actual = { id: s.id, titulo: s.titulo, sub: s.sub, desde: Date.now(), hasta: null }; secciones.push(actual); };
const cerrar = async () => { if (actual) { actual.hasta = Date.now(); actual = null; } };
const paso = async (etiqueta, fn) => {
  try { await fn(); console.log('ok    ', etiqueta); }
  catch (e) { console.log('FALLO ', etiqueta, '::', String(e).slice(0, 140)); }
  await sleep(250);
};

const login = async ({ escribir = false } = {}) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(1100); await inyectar();
  await page.waitForSelector('input#email');
  if (escribir) { await page.click('input#email'); await page.type('input#email', CRED.usuario, { delay: 65 }); }
  else await page.$eval('input#email', (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, CRED.usuario);
  if (escribir) { await page.click('input#password'); await page.type('input#password', CRED.clave, { delay: 65 }); }
  else await page.$eval('input#password', (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, CRED.clave);
  await sleep(500);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
    page.$eval('form', (f) => { f.requestSubmit(); }).catch(() => {}),
  ]);
  await sleep(2200); await inyectar();
};

// arrancamos sin sesión: la primera sección es la portada pública
await page.goto(`${BASE}/sitio`, { waitUntil: 'networkidle2' });
await sleep(1200);
await inyectar();

const ACC = {
  // ===================== SOCIO =====================
  s2p: async () => {
    await ir('/sitio', 2200);
    await sleep(1300);
    await desplazarA('Ya soy socio');
    await sleep(1100);
  },
  s202: async () => {
    await clic('Ya soy socio', { espera: 1600 });
    await page.waitForSelector('input#email');
    await mover(960, 430); await sleep(400);
    await page.click('input#email');
    await page.type('input#email', CRED.usuario, { delay: 65 });
    await page.click('input#password');
    await page.type('input#password', CRED.clave, { delay: 65 });
    await sleep(600);
    const p = await ubicar('Ingresar', { exacto: true });
    if (p) { await mover(p.x, p.y); await sleep(420); await pulso(p.x, p.y); }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
      page.$eval('form', (f) => { f.requestSubmit(); }).catch(() => {}),
    ]);
    await sleep(2600);
    await inyectar();
  },
  s203: async () => {
    await ponerCookieSolicitud();
    await ir('/solicitud', 2400);
    await sleep(1300);
    const cajas = await page.evaluate(() => {
      const inps = [...document.querySelectorAll('form input.input')].filter((e) => e.offsetWidth > 0);
      const r = (i) => { const b = inps[i]?.getBoundingClientRect(); return b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } : null; };
      return { nombre: r(0), apellido: r(1), dni: r(3) };
    });
    for (const [punto, texto] of [[cajas.nombre, 'Lucía'], [cajas.apellido, 'Ferrari'], [cajas.dni, '33445566']]) {
      if (!punto) continue;
      await mover(punto.x, punto.y); await sleep(420);
      await page.mouse.click(punto.x, punto.y); await sleep(240);
      await page.keyboard.type(texto, { delay: 85 }); await sleep(520);
    }
    await desplazar(420, 10, 110);
    await sleep(1000);
    await desplazarA('Declaro que los datos');
    await sleep(1300);
    await desplazar(300, 8, 120);
    await sleep(1100);
  },
  s204: async () => {
    await ir('/portal', 1900);
    await desplazar(120, 4, 90);
    await sleep(1500);
  },
  s205: async () => {
    await desplazarA('Reservar un retiro');
    await sleep(700);
    await clic('10 g', { exacto: true, espera: 700 });
    await clic('lun2', { espera: 800 });
    await clic('10:20', { exacto: true, espera: 800 });
    await sleep(1100);
  },
  s206: async () => {
    await clicPrefijo('Reservar', { espera: 2600 });
    await sleep(1200);
  },
  s207: async () => {
    await clic('Historial', { exacto: true, espera: 1400 });
    await sleep(1500);
  },
  s208: async () => {
    await desplazarA('Privacidad y permisos');
    await sleep(1700);
  },
  s209: async () => {
    await desplazarA('Tu documentación');
    await sleep(1700);
  },

  // ===================== ADMIN =====================
  a2p: async () => {
    await ir('/sitio', 2200);
    await sleep(1300);
    await desplazar(320, 8, 110);
    await sleep(1200);
    await desplazarA('Ingresar');
    await sleep(900);
  },
  a202: async () => {
    await ir('/', 2000);
    await sleep(1700);
    await desplazar(560, 10, 110);
    await sleep(1300);
  },
  a203: async () => {
    await ir('/socios', 1900);
    await page.click('input[placeholder*="Legajo"]').catch(() => {});
    await page.type('input[placeholder*="Legajo"]', 'Gomez', { delay: 70 }).catch(() => {});
    await sleep(1600);
  },
  a204: async () => {
    await ir('/socios?ver=altas', 2400);
    await sleep(1300);
    await desplazar(260, 8, 120);
    await sleep(900);
    await senalar('Aprobar y crear legajo');
    await sleep(1200);
  },
  a205: async () => {
    await clic('Gómez, María', { espera: 2000 });
    await sleep(1300);
    await desplazar(430, 8, 120);
    await sleep(1300);
  },
  a206: async () => {
    await ir('/calendario', 2300);
    await sleep(1000);
    await clicAria('Semana siguiente', { espera: 2200 });
    await sleep(900);
    await clicAria('miércoles, 4 de noviembre', { espera: 1500, prefijo: true });
    await sleep(1400);
  },
  a207: async () => {
    await ir('/dispensario', 2000);
    await page.click('input[placeholder*="Legajo"]').catch(() => {});
    await page.type('input[placeholder*="Legajo"]', 'Gomez', { delay: 75 }).catch(() => {});
    await sleep(1500);
    await clic('Gómez, María', { espera: 1500, sinScroll: true });
    await clic('Lemon Haze', { espera: 1400 });
    await clic('10 g', { exacto: true, espera: 1000 });
    await sleep(1500);
  },
  a208: async () => {
    await clic('Confirmar entrega', { espera: 3000 });
    await sleep(2100);
  },
  a209: async () => {
    await ir('/stock', 2000);
    await sleep(1400);
    await desplazar(300, 8, 110);
    await sleep(1400);
  },
  a210: async () => {
    await ir('/traslados', 2100);
    await sleep(1300);
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href*="/traslados/"]')].find((x) => x.getBoundingClientRect().width > 0);
      return a?.getAttribute('href') || null;
    }).catch(() => null);
    if (href) { await ir(href, 2200); await sleep(1100); await desplazar(240, 8, 110); }
    await sleep(1400);
  },
  a211: async () => {
    await ir('/avisos', 2000);
    await sleep(1600);
    await desplazar(260, 8, 110);
    await sleep(1400);
  },
  a212: async () => {
    await ir('/cierre-mensual', 2000);
    await sleep(1700);
    await desplazar(300, 8, 110);
    await sleep(1500);
  },
  a213: async () => {
    await ir('/informe-semestral', 2100);
    await sleep(1100);
    await desplazar(420, 8, 120);
    await sleep(1600);
  },
  a214: async () => {
    await ir('/configuracion?seccion=precios', 2200);
    await sleep(1200);
    await desplazar(300, 8, 120);
    await sleep(1500);
  },
  a215: async () => {
    await ir('/configuracion?seccion=catalogo', 2200);
    await sleep(1200);
    await desplazar(320, 8, 120);
    await sleep(1500);
  },

  // ===================== DISPENSARIO =====================
  d2p: async () => {
    await ir('/sitio', 2200);
    await sleep(1300);
    await desplazar(300, 8, 110);
    await sleep(1100);
    await desplazarA('Ingresar');
    await sleep(900);
  },
  d202: async () => {
    await ir('/', 2000);
    await sleep(1700);
    await desplazar(420, 9, 110);
    await sleep(1300);
  },
  d203: async () => {
    await ir('/turnos', 2100);
    await sleep(1500);
    await desplazar(240, 8, 110);
    await sleep(1300);
  },
  d204: async () => {
    await ir('/calendario', 2300);
    await sleep(900);
    await clicAria('Semana siguiente', { espera: 2200 });
    await sleep(1000);
    await clicAria('martes, 3 de noviembre', { espera: 1400, prefijo: true });
    await sleep(1400);
  },
  d205: async () => {
    await ir('/dispensario', 2100);
    await page.click('input[placeholder*="Legajo"]').catch(() => {});
    await page.type('input[placeholder*="Legajo"]', 'Pérez', { delay: 80 }).catch(() => {});
    await sleep(1600);
    await senalar('Pérez, Julián');
    await sleep(900);
  },
  d206: async () => {
    await clic('Pérez, Julián', { espera: 1800, sinScroll: true });
    await sleep(1500);
  },
  d207: async () => {
    await clic('Lemon Haze', { espera: 1400 });
    await clic('5 g', { exacto: true, espera: 1000 });
    await sleep(1500);
  },
  d208: async () => {
    await clic('Confirmar entrega', { espera: 3200 });
    await sleep(2200);
  },
  d209: async () => {
    await ir('/socios', 2000);
    await sleep(1400);
    await desplazar(300, 8, 110);
    await sleep(1300);
  },
  d210: async () => {
    await ir('/stock', 2000);
    await sleep(1400);
    await desplazar(300, 8, 110);
    await sleep(1300);
  },
  d211: async () => {
    await ir('/avisos', 2000);
    await sleep(1600);
    await desplazar(240, 8, 110);
    await sleep(1300);
  },
};

for (const s of guion) {
  if (s.tipo === 'placa') continue;
  abrir(s);
  await paso(`${s.id} ${s.titulo}`, ACC[s.id] ?? (async () => { await sleep(1500); }));
  await paso(`${s.id} movimiento`, async () => {
    const inicio = actual?.desde ?? Date.now();
    await mantener(DUR[s.id] ?? 8, inicio);
  });
  await still(s.id);
  await sleep(600);
  await cerrar();
  // el video de admin no muestra el login: entra después de la portada
  if (s.id === 'a2p' || s.id === 'd2p') { await paso('login silencioso', () => login()); }
}

grabando = false;
await client.send('Page.stopScreencast').catch(() => {});
writeFileSync(`${OUT}/grabacion.json`, JSON.stringify({ viewport: { W, H }, cual: CUAL, secciones, frames }, null, 1));
console.log(`secciones grabadas: ${secciones.length} | frames: ${frames.length}`);
for (const s of secciones) console.log(` - ${s.id} ${((s.hasta - s.desde) / 1000).toFixed(1)}s`);
await browser.close();
