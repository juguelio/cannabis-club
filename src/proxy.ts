import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Corta el paso antes de renderizar: un socio no debe ni entrar a la consola del club
 * (ni ver el shell del backoffice mientras el server component redirige).
 * La verificación es de rol, sale del JWT; las reglas finas siguen en cada página y ruta.
 */
const COOKIE = "cc_session";
// `/lote/<código>` es la ficha neutra que abre el QR de la etiqueta: sin sesión y sin datos personales.
const PUBLIC = ["/login", "/api/auth/login", "/api/auth/logout", "/api/health", "/lote"];

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const role = await roleFromRequest(req);
  const isApi = pathname.startsWith("/api/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/");

  if (!role) {
    return isApi
      ? NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión requerida" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  if (role === "SOCIO" && !isPortal) {
    return isApi
      ? NextResponse.json({ error: "FORBIDDEN", message: "Tu cuenta es de socio" }, { status: 403 })
      : NextResponse.redirect(new URL("/portal", req.url));
  }

  if (role !== "SOCIO" && isPortal) {
    return isApi
      ? NextResponse.json({ error: "FORBIDDEN", message: "El portal es para socios" }, { status: 403 })
      : NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
