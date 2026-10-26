import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Chequeo de vida para el deploy: la app responde y la base contesta. Sin datos.
 * La `huella` identifica la base sin exponerla: sirve para comparar producción con
 * preview y detectar si un entorno de prueba está apuntando a la base real.
 */
export async function GET() {
  const started = Date.now();
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:]+)/)?.[1] ?? "";
  const base = url.split("?")[0].split("/").pop() ?? "";
  const huella = host ? createHash("sha256").update(`${host}/${base}`).digest("hex").slice(0, 12) : null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: true,
      ms: Date.now() - started,
      entorno: process.env.VERCEL_ENV ?? "local",
      huella,
    });
  } catch {
    return Response.json({ ok: false, db: false, entorno: process.env.VERCEL_ENV ?? "local", huella }, { status: 503 });
  }
}
