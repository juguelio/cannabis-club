import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { CartasManager } from "@/components/cartas-manager";
import { prisma } from "@/lib/db";
import { alcanzablesPara } from "@/lib/cartas";

export const dynamic = "force-dynamic";

/**
 * Cartas del club.
 *
 * Escribir y aprobar es de ADMIN: la carta es la voz de la asociación. Un OPERADOR puede entrar a
 * leer —sirve para saber qué se dijo y cuándo— pero los botones que mandan no aparecen.
 */
export default async function CartasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const esAdmin = session.role === "ADMIN";

  const [cartas, padron] = await Promise.all([
    prisma.edicionCarta.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, edicion: true, titulo: true, copete: true, apertura: true, bloques: true, cta: true,
        estado: true, programadaPara: true, enviadaEn: true, alcanzados: true, enviados: true, errores: true,
      },
    }),
    alcanzablesPara(),
  ]);

  const filas = cartas.map((c) => ({
    ...c,
    apertura: (c.apertura as string[]) ?? [],
    bloques: (c.bloques as { titulo: string; texto: string; enlace?: { texto: string; url: string } }[]) ?? [],
    cta: (c.cta as { texto: string; url: string } | null) ?? null,
    programadaPara: c.programadaPara?.toISOString() ?? null,
    enviadaEn: c.enviadaEn?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHead
        title="Cartas"
        subtitle={
          esAdmin
            ? "La carta mensual del club: la escribís acá, la aprobás y sale sola a la hora que digas."
            : "Sólo lectura: escribir y aprobar la carta es de un administrador."
        }
      />
      <CartasManager cartasIniciales={filas} padron={padron} soloLectura={!esAdmin} />
    </>
  );
}
