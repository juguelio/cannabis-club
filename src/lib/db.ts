import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Consultas lentas: cualquier consulta que tarde más que esto queda en los logs (Vercel › Logs),
 * con su duración y el comienzo del SQL, nunca los parámetros (pueden ser datos de un socio).
 * `SLOW_QUERY_MS=0` lo apaga.
 */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 300);

function createClient() {
  const client = new PrismaClient({
    // Columnas pesadas que ninguna pantalla lista: la foto de una variedad (hasta 3 MB) y las imágenes
    // de marca del club. Antes `include: { strain: true }` traía la foto de cada variedad en el panel,
    // el dispensario, el stock y la ficha del socio. Se leen sólo donde se sirven (SQL directo o `select`).
    omit: {
      strain: { fotoData: true },
      club: { marcaLogo: true, marcaEmblema: true, marcaPortada: true },
    },
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      ...(process.env.NODE_ENV === "development" ? [{ emit: "stdout" as const, level: "warn" as const }] : []),
    ],
  });
  if (SLOW_QUERY_MS > 0) {
    client.$on("query", (e) => {
      if (e.duration < SLOW_QUERY_MS) return;
      const sql = e.query.replace(/"public"\./g, "").replace(/\s+/g, " ").slice(0, 180);
      console.warn(JSON.stringify({ evento: "consulta_lenta", ms: e.duration, sql }));
    });
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
