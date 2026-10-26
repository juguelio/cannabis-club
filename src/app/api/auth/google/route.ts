import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
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
  const origin = new URL(req.url).origin;
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=google_no_configurado`, 302);

  const { verifier, challenge } = pkcePair();
  const nonce = newNonce();
  const sealed = await sealState(nonce, verifier);
  const jar = await cookies();
  jar.set(OAUTH_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_TTL_SECONDS,
  });

  return NextResponse.redirect(authorizationUrl(cfg, nonce, challenge), 302);
}
