import { NextResponse } from "next/server";
import { baseUrlDelFlujo, origenDelPedido } from "@/lib/google-base";
import {
  OAUTH_COOKIE,
  OAUTH_TTL_SECONDS,
  authorizationUrl,
  googleConfig,
  newNonce,
  pkcePair,
  sealState,
} from "@/lib/google";

/** Arranca el ingreso con Google. Si no está configurado, no rompe: vuelve al login con aviso. */
export async function GET(req: Request) {
  const cfg = googleConfig();
  const url = new URL(req.url);
  const pedido = origenDelPedido(url, req.headers);
  // La base sale del pedido cuando el host es de la app: la cookie de `state` se guarda en ese host y
  // Google tiene que volver al mismo, si no la cookie no viaja y el ingreso se cae.
  const base = baseUrlDelFlujo(pedido, process.env.APP_BASE_URL);
  if (!cfg) return NextResponse.redirect(`${base}/login?error=google_no_configurado`, 302);

  const { verifier, challenge } = pkcePair();
  const nonce = newNonce();
  const sealed = await sealState(nonce, verifier);

  // La cookie se setea sobre la respuesta: es la que se va a Google y la que tiene que volver con el socio.
  const response = NextResponse.redirect(authorizationUrl(cfg, base, nonce, challenge), 302);
  response.cookies.set(OAUTH_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // `path: "/"`: con `/api/auth/google` alcanzaba para el callback, pero cualquier cambio de ruta o un
    // salto de host dejaba la cookie fuera de alcance. La cookie de un flujo de 10 minutos no molesta en `/`.
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  });
  return response;
}
