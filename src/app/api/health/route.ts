import { prisma } from "@/lib/db";

/** Chequeo de vida para el deploy: la app responde y la base contesta. Sin datos. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: true, ms: Date.now() - started });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
