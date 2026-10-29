/**
 * Saca de una base los datos de demostración (socios, lotes, entregas, turnos, reservas, asientos, avisos)
 * y deja la configuración del club, la marca y el equipo de trabajo.
 *
 *   npx tsx scripts/limpiar-demo.ts                 # muestra qué borraría (no toca nada)
 *   npx tsx scripts/limpiar-demo.ts --si            # lo hace
 *   npx tsx scripts/limpiar-demo.ts --si --con-solicitudes   # borra también las solicitudes de alta
 *
 * No toca: Club (datos legales, topes, aportes), marca, ScheduleRule, ClosedDay, usuarios ADMIN/OPERADOR
 * ni el registro de auditoría.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const si = process.argv.includes("--si");
const conSolicitudes = process.argv.includes("--con-solicitudes");

async function main() {
  const [
    members, batches, strains, dispensations, movements, appointments,
    pickups, entries, notices, solicitudes, sociosConCuenta,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.batch.count(),
    prisma.strain.count(),
    prisma.dispensation.count(),
    prisma.stockMovement.count(),
    prisma.appointment.count(),
    prisma.pickupRequest.count(),
    prisma.accountEntry.count(),
    prisma.noticeLog.count(),
    prisma.accessRequest.count(),
    prisma.user.count({ where: { role: "SOCIO" } }),
  ]);

  const plan = [
    ["Entregas", dispensations],
    ["Movimientos de stock", movements],
    ["Asientos de cuenta", entries],
    ["Reservas de retiro", pickups],
    ["Turnos", appointments],
    ["Avisos registrados", notices],
    ["Lotes", batches],
    ["Variedades", strains],
    ["Socios", members],
    ["Cuentas de socio", sociosConCuenta],
    ...(conSolicitudes ? ([["Solicitudes de alta", solicitudes]] as [string, number][]) : []),
  ] as [string, number][];

  console.log(`Base: ${process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, "//***@") ?? "(sin DATABASE_URL)"}`);
  console.log(`\n${si ? "BORRANDO" : "Se borraría"} (quedan Club, marca, horarios, equipo y auditoría):`);
  for (const [label, n] of plan) console.log(`  ${String(n).padStart(5)}  ${label}`);
  console.log(`\nSe conservan: ${solicitudes - (conSolicitudes ? solicitudes : 0)} solicitudes de alta.`);

  if (!si) {
    console.log("\nNada cambió. Volvé a correr con --si para aplicar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.dispensation.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.accountEntry.deleteMany();
    await tx.pickupRequest.deleteMany();
    await tx.appointment.deleteMany();
    await tx.noticeLog.deleteMany();
    await tx.batch.deleteMany();
    await tx.strain.deleteMany();
    await tx.user.deleteMany({ where: { role: "SOCIO" } });
    await tx.member.deleteMany();
    if (conSolicitudes) await tx.accessRequest.deleteMany();
  }, { timeout: 120_000 });

  const quedan = await prisma.member.count();
  console.log(`\nListo. Socios en la base: ${quedan}.`);
}

main().finally(() => prisma.$disconnect());
