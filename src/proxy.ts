import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Corta el paso antes de renderizar: un socio no debe ni entrar a la consola del club
 * (ni ver el shell del backoffice mientras el server component redirige).
 * La verificación es de rol, sale del JWT; las reglas finas siguen en cada página y ruta.
 */
const COOKIE = "cc_session";
// `/lote/<código>` es la ficha neutra que abre el QR de la etiqueta: sin sesión y sin datos personales.
// `/sitio` es la portada pública del club y `/api/marca/*` sus imágenes (logo, emblema, portada).
const PUBLIC = ["/login", "/api/auth/login", "/api/auth/google", "/api/auth/logout", "/api/health", "/lote", "/sitio", "/privacidad", "/api/marca"];
// Páginas que se dibujan sin el shell de la app aunque haya sesión (el layout lee este header).
const BARE = ["/sitio", "/privacidad"];
const matches = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const secretKey = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

async function roleFromRequest(req: NextRequest): Promise<"ADMIN" | "OPERADOR" | "SOCIO" | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = String(payload.role ?? "");
    return role === "ADMIN" || role === "OPERADOR" || role === "SOCIO" ? role : null;
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
