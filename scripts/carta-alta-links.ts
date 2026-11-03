/**
 * Links para que los socios se sumen a la carta del club.
 *
 * Sirve para el padrón que ya existía cuando el club empezó a mandar la carta: a esa gente no se le
 * puede escribir «novedades» sin que haya dicho que sí, así que se le manda este link y decide en un
 * toque, sin entrar al portal.
 *
 * Imprime **sólo los que todavía no reciben la carta** y no tienen consentimiento vivo. Es de lectura:
 * no manda nada ni anota a nadie — el alta la hace el socio cuando aprieta el botón.
 *
 *   DATABASE_URL=... BAJA_SECRET=... APP_BASE_URL=https://republicacannabis.com.ar \
 *     npx tsx scripts/carta-alta-links.ts
 */
import { PrismaClient } from "@prisma/client";
import { urlAltaCarta } from "../src/lib/baja";

const prisma = new PrismaClient();

async function main() {
  const base = process.env.APP_BASE_URL ?? "https://republicacannabis.com.ar";
  if (!process.env.BAJA_SECRET && !process.env.AUTH_SECRET) {
    console.error("Falta BAJA_SECRET (o AUTH_SECRET): sin secreto los links no valen.");
    process.exit(1);
  }

  const socios = await prisma.member.findMany({
    where: { status: "ACTIVO" },
    orderBy: { legajo: "asc" },
    select: {
      id: true,
      legajo: true,
      firstName: true,
      lastName: true,
      email: true,
      consents: { where: { purpose: "COMUNICACIONES" }, select: { revokedAt: true } },
    },
  });

  const pendientes = socios.filter((s) => !s.consents.some((c) => !c.revokedAt));
  console.log(`Socios activos: ${socios.length} · ya reciben la carta: ${socios.length - pendientes.length} · a preguntar: ${pendientes.length}`);
  if (!pendientes.length) return;

  let sinEmail = 0;
  for (const s of pendientes) {
    if (!s.email) sinEmail += 1;
    const link = urlAltaCarta(s.id, base);
    console.log(`${String(s.legajo).padStart(3, " ")}  ${`${s.firstName} ${s.lastName}`.padEnd(28, " ")} ${s.email ?? "(sin email)"}`);
    console.log(`     ${link ?? "(sin secreto configurado)"}`);
  }
  if (sinEmail) console.log(`\nOjo: ${sinEmail} sin email. El link se les puede mandar por WhatsApp igual.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
