import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Ingreso con Google (OAuth 2.0 Authorization Code + PKCE).
 *
 * Se hace a mano sobre `jose` a propósito: la app ya tiene su propia sesión firmada
 * (`cc_session`, HS256, `tokenVersion`) y meter un framework de auth encima obligaría
 * a duplicar roles y revocación. Acá Google sólo prueba **quién sos**; el alta, el rol
 * y el vínculo con el padrón los sigue decidiendo el club.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = new URL("https://www.googleapis.com/oauth2/v3/certs");
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const OAUTH_COOKIE = "cc_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export const OAUTH_TTL_SECONDS = 600;

export type GoogleConfig = { clientId: string; clientSecret: string; baseUrl: string };

export function googleConfig(env: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const baseUrl = (env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!clientId || !clientSecret || !baseUrl) return null;
  return { clientId, clientSecret, baseUrl };
}

export const isGoogleEnabled = (env: NodeJS.ProcessEnv = process.env) => googleConfig(env) !== null;

export const redirectUri = (cfg: GoogleConfig) => `${cfg.baseUrl}/api/auth/google/callback`;

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return new TextEncoder().encode(secret);
};

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export const newNonce = () => randomBytes(16).toString("base64url");

/** El estado viaja firmado en una cookie httpOnly: el query string no se puede manipular. */
export async function sealState(nonce: string, verifier: string) {
  return new SignJWT({ n: nonce, v: verifier })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function openState(token: string): Promise<{ nonce: string; verifier: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const nonce = String(payload.n ?? "");
    const verifier = String(payload.v ?? "");
    return nonce && verifier ? { nonce, verifier } : null;
  } catch {
    return null;
  }
}

export function authorizationUrl(cfg: GoogleConfig, state: string, challenge: string) {
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri(cfg));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export async function exchangeAndVerify(cfg: GoogleConfig, code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri(cfg),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google rechazó el canje del código (${res.status})`);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google no devolvió id_token");

  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(GOOGLE_JWKS), {
    issuer: ISSUERS,
    audience: cfg.clientId,
  });
  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email || !payload.sub) throw new Error("El id_token no trae email o sub");
  return {
    sub: String(payload.sub),
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: String(payload.name ?? email.split("@")[0]).slice(0, 80),
  };
}
