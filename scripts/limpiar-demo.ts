/**
 * Saca de una base los datos de demostración (socios, lotes, entregas, turnos, reservas, envíos, asientos, avisos,
 * cierres e informes) y deja la configuración del club, la marca, los horarios y el equipo de trabajo.
 *
 *   npx tsx scripts/limpiar-demo.ts                           # muestra qué borraría (no toca nada)
 *   npx tsx scripts/limpiar-demo.ts --si                      # lo hace
 *   npx tsx scripts/limpiar-demo.ts --si --con-expedientes    # borra también las solicitudes de alta
 *
 * No toca: Club (datos legales, topes, aportes), marca, ScheduleRule, ClosedDay, usuarios de equipo ni AuditLog.
 * Contra una base con datos reales, respaldá primero con `scripts/respaldo-datos.ts`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const si = process.argv.includes("--si");
const conExpedientes = process.argv.includes("--con-expedientes") || process.argv.includes("--con-solicitudes");

type Modelo = { count: () => Promise<number>; deleteMany: () => Promise<{ count: number }> };
const modelo = (tx: unknown, nombre: string) => (tx as Record<string, Modelo>)[nombre];

/** Orden que respeta las claves foráneas: primero lo que apunta, después lo apuntado. */
const ORDEN: { modelo: string; label: string }[] = [
  { modelo: "shipmentItem", label: "Ítems de envío" },
  { modelo: "dispensation", label: "Entregas" },
  { modelo: "stockMovement", label: "Movimientos de stock" },
  { modelo: "accountEntry", label: "Asientos de cuenta" },
  { modelo: "pickupRequest", label: "Reservas de retiro" },
  { modelo: "appointment", label: "Turnos" },
  { modelo: "noticeLog", label: "Avisos registrados" },
  { modelo: "consent", label: "Consentimientos" },
  { modelo: "shipment", label: "Envíos" },
  { modelo: "transport", label: "Traslados" },
  { modelo: "monthlyClose", label: "Cierres mensuales" },
  { modelo: "semesterReport", label: "Informes semestrales" },
  { modelo: "batch", label: "Lotes" },
  { modelo: "strain", label: "Variedades" },
];

async function main() {
  const counts = await Promise.all(ORDEN.map((t) => modelo(prisma, t.modelo).count()));
  const [members, expedientes, sociosConExpediente, equipo] = await Promise.all([
    prisma.member.count(),
    prisma.accessRequest.count(),
    prisma.user.count({ where: { role: "SOCIO", accessRequest: { isNot: null } } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "OPERADOR", "DISPENSADOR"] } } }),
  ]);

  console.log(`Base: ${(process.env.DATABASE_URL ?? "(sin DATABASE_URL)").replace(/\/\/[^@]*@/, "//***@").split("?")[0]}`);
  console.log(`\n${si ? "BORRANDO" : "Se borraría"} (quedan Club, marca, horarios, equipo y auditoría):`);
  ORDEN.forEach((t, i) => console.log(`  ${String(counts[i]).padStart(5)}  ${t.label}`));
  console.log(`  ${String(members).padStart(5)}  Socios`);
  console.log(
    `\nSe conservan ${conExpedientes ? 0 : expedientes} expediente(s) de alta, ${equipo} cuenta(s) de equipo y ` +
      `${sociosConExpediente} cuenta(s) de socio con expediente.`,
  );

  if (!si) {
    console.log("\nNada cambió. Volvé a correr con --si para aplicar.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const t of ORDEN) await modelo(tx, t.modelo).deleteMany();
      // Las cuentas con expediente de alta quedan: borrarlas se llevaría la solicitud.
      await tx.user.deleteMany({ where: { role: "SOCIO", accessRequest: { is: null } } });
      await tx.member.deleteMany();
      if (conExpedientes) await tx.accessRequest.deleteMany();
    },
    { timeout: 180_000 },
  );

  console.log(
    `\nListo. Socios: ${await prisma.member.count()} · lotes: ${await prisma.batch.count()} · ` +
      `entregas: ${await prisma.dispensation.count()} · expedientes: ${await prisma.accessRequest.count()} · ` +
      `equipo: ${await prisma.user.count({ where: { role: { in: ["ADMIN", "OPERADOR", "DISPENSADOR"] } } })}.`,
  );
}

main().finally(() => prisma.$disconnect());
