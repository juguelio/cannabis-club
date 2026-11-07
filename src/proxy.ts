import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { apuntaAProduccion } from "@/lib/db-fingerprint";
import { permite, seccionDeRuta } from "@/lib/roles";

/**
 * Corta el paso antes de renderizar: un socio no debe ni entrar a la consola del club
 * (ni ver el shell del backoffice mientras el server component redirige).
 * La verificación es de rol, sale del JWT; las reglas finas siguen en cada página y ruta.
 */
const COOKIE = "cc_session";
// `/lote/<código>` es la ficha neutra que abre el QR de la etiqueta: sin sesión y sin datos personales.
// `/sitio` es la portada pública del club y `/api/marca/*` sus imágenes (logo, emblema, portada).
// `/solicitud` y `/api/solicitud*` validan la cookie de onboarding por su cuenta (no usan `cc_session`).
// Los crons de Vercel llegan sin sesión y se autentican con el `Bearer` del CRON_SECRET
// dentro de la propia ruta; acá sólo se los deja llegar.
const PUBLIC = ["/login", "/api/auth/login", "/api/auth/google", "/api/auth/logout", "/api/health", "/lote", "/sitio", "/reprocann", "/terminos", "/privacidad", "/solicitud", "/api/solicitud", "/api/marca", "/api/variedades", "/api/mantenimiento/retencion", "/api/club/cotizacion", "/api/avisos/vencimientos",
  // La baja de la carta viene de un correo: sin sesión, con token firmado propio (GET y POST).
  "/api/baja",
  // El cron que manda las cartas se autentica adentro con el CRON_SECRET.
  "/api/cartas/enviar",
  // Sumarse a la carta desde un link: sin sesión, con token firmado (GET pregunta, POST anota).
  "/api/carta/alta",
  // Velocidad medida en usuarios reales (Web Vitals): también se mide /login y /sitio, sin sesión.
  "/api/vitals",
  // Descubrimiento y metadatos: son públicos por definición, si el proxy los manda al login los buscadores no los ven.
  "/robots.txt", "/sitemap.xml", "/llms.txt", "/manifest.webmanifest"];
// Páginas que se dibujan sin el shell de la app aunque haya sesión (el layout lee este header).
const BARE = ["/sitio", "/reprocann", "/privacidad", "/solicitud"];
const matches = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const secretKey = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

async function roleFromRequest(req: NextRequest): Promise<"ADMIN" | "OPERADOR" | "DISPENSADOR" | "SOCIO" | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = String(payload.role ?? "");
    return role === "ADMIN" || role === "OPERADOR" || role === "DISPENSADOR" || role === "SOCIO" ? role : null;
  } catch {
    return null;
  }
}

/** Deja pasar sin el header de "página desnuda" si lo trajo el cliente: solo lo pone el proxy. */
function pass(req: NextRequest) {
  if (!req.headers.has("x-cc-bare")) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.delete("x-cc-bare");
  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // GET no implica sólo lectura: OAuth crea cuentas y algunas lecturas registran auditoría.
  // Health queda disponible para diagnosticar el aislamiento sin exponer datos personales.
  const entornoDePrueba = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";
  if (entornoDePrueba && pathname !== "/api/health" && !process.env.PROD_DB_FINGERPRINT) {
    return NextResponse.json({ error: "ENTORNO_SIN_VERIFICAR", message: "Falta configurar la huella de producción para verificar el aislamiento de este entorno." }, { status: 503 });
  }
  if (entornoDePrueba && pathname !== "/api/health" && apuntaAProduccion()) {
    return NextResponse.json(
      {
        error: "ENTORNO_COMPARTIDO",
        message: "Este entorno está apuntando a la base de producción: el acceso está bloqueado.",
      },
      { status: 409 },
    );
  }

  if (matches(pathname, BARE)) {
    const headers = new Headers(req.headers);
    headers.set("x-cc-bare", "1");
    return NextResponse.next({ request: { headers } });
  }
  if (matches(pathname, PUBLIC)) return pass(req);

  const role = await roleFromRequest(req);
  const isApi = pathname.startsWith("/api/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/");

  if (!role) {
    // Sin sesión, la raíz es la portada pública (si el club la apagó, /sitio manda al ingreso).
    if (pathname === "/") return NextResponse.redirect(new URL("/sitio", req.url));
    return isApi
      ? NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión requerida" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  // El socio también puede cambiar su propia clave: es su cuenta, no una acción de staff.
  const selfService = pathname === "/api/auth/password" || pathname === "/api/auth/logout";
  if (role === "SOCIO" && !isPortal && !selfService) {
    return isApi
      ? NextResponse.json({ error: "FORBIDDEN", message: "Tu cuenta es de socio" }, { status: 403 })
      : NextResponse.redirect(new URL("/portal", req.url));
  }

  // El mostrador no abre lo que no le toca: se corta en el proxy, antes de renderizar la página.
  if (!isApi && role !== "SOCIO") {
    const seccion = seccionDeRuta(pathname);
    if (seccion && !permite(role, seccion)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (role !== "SOCIO" && isPortal) {
    return isApi
      ? NextResponse.json({ error: "FORBIDDEN", message: "El portal es para socios" }, { status: 403 })
      : NextResponse.redirect(new URL("/", req.url));
  }

  return pass(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
