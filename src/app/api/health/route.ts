import { prisma } from "@/lib/db";
import { huellaBase } from "@/lib/db-fingerprint";

/**
 * Chequeo de vida para el deploy: la app responde y la base contesta. Sin datos.
 * La `huella` identifica la base sin exponerla: sirve para comparar producción con
 * preview y detectar si un entorno de prueba está apuntando a la base real.
 */
export async function GET() {
  const started = Date.now();
  const huella = huellaBase();

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
