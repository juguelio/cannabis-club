/**
 * Puesta en marcha del portal del socio en un club que ya está en producción.
 * No borra nada: agrega lo que falta.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/seed-portal.ts <aportePorGramo> [emailSocio] [passwordSocio]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [aporteArg, emailArg, passArg] = process.argv.slice(2);

  const club = await prisma.club.findUnique({ where: { id: "singleton" } });
  if (!club) throw new Error("No hay club configurado");

  const aporte = aporteArg ? Number(aporteArg) : null;
  if (aporte != null && Number.isFinite(aporte) && aporte > 0) {
    await prisma.club.update({ where: { id: club.id }, data: { aportePorGramo: aporte.toFixed(2) } });
    console.log(`aporte de cultivo por gramo: $${aporte}`);
  } else {
    console.log(`aporte por gramo sin cambios (actual: ${club.aportePorGramo ?? "sin definir"})`);
  }

  if (!emailArg) {
    console.log("sin email de socio: no creo usuario del portal");
    return;
  }

  const email = emailArg.trim().toLowerCase();
  const member = await prisma.member.findFirst({ where: { legajo: 1 } });
  if (!member) throw new Error("No hay socio con legajo 1 para vincular");

  const password = passArg ?? Math.random().toString(36).slice(2, 14);
  const existing = await prisma.user.findUnique({ where: { email } });
  const hash = await bcrypt.hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "SOCIO", memberId: member.id, passwordHash: hash, active: true },
    });
    console.log(`usuario socio actualizado: ${email} (legajo ${member.legajo})`);
  } else {
    await prisma.user.create({
      data: { email, name: `${member.firstName} ${member.lastName}`, passwordHash: hash, role: "SOCIO", memberId: member.id },
    });
    console.log(`usuario socio creado: ${email} (legajo ${member.legajo})`);
  }
  console.log(`clave del portal: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
