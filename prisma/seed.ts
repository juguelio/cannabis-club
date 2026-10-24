import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const D = (v: number) => new Prisma.Decimal(v.toFixed(2));
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function main() {
  await prisma.pickupRequest.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleRule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.dispensation.deleteMany();
  await prisma.transport.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.strain.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();
  await prisma.club.deleteMany();

  const club = await prisma.club.create({
    data: {
      id: "singleton",
      nombre: "Asociación Civil de Cultivo (demo)",
      cuit: "30-00000000-0",
      reprocannNumber: "REPROCANN-DEMO-0001",
      reprocannCode: "VINC-DEMO-2026",
      directorMedico: "Dra. Demo (mat. 0000)",
      responsableTecnico: "Ing. Agr. Demo (mat. 0000)",
      // topes tomados del estándar europeo como plantilla, NO como ley argentina
      limiteDiarioG: D(25),
      limiteMensualG: D(50),
      limiteMenorG: D(30),
      edadMinima: 18,
      edadLimiteMenor: 21,
      thcMaxMenor: D(10),
      maxSocios: 500,
      // aporte de cultivo por gramo: prorrateo de costos, NO precio de venta
      aportePorGramo: D(1200),
    },
  });

  // Franjas de atención: lunes a sábado de 10:00 a 19:00, turnos de 20 min, 2 socios por turno.
  for (let weekday = 1; weekday <= 6; weekday += 1) {
    await prisma.scheduleRule.create({
      data: { weekday, startMin: 10 * 60, endMin: 19 * 60, slotMin: 20, capacity: 2 },
    });
  }

  const adminPass = await bcrypt.hash("Admin1234!", 10);
  const opPass = await bcrypt.hash("Operador1234!", 10);

  const admin = await prisma.user.create({
    data: { email: "admin@club.test", name: "Admin Demo", passwordHash: adminPass, role: "ADMIN" },
  });
  const socioPass = await bcrypt.hash("Socio1234!", 10);
  const operador = await prisma.user.create({
    data: { email: "operador@club.test", name: "Operador Demo", passwordHash: opPass, role: "OPERADOR" },
  });

  const northern = await prisma.strain.create({
    data: { name: "Northern Lights", genetics: "Índica", thcPct: D(18.5), cbdPct: D(0.2) },
  });
  const lemon = await prisma.strain.create({
    data: { name: "Lemon Haze", genetics: "Sativa", thcPct: D(21), cbdPct: D(0.1) },
  });
  const cbdStrain = await prisma.strain.create({
    data: { name: "CBD Therapy", genetics: "Híbrida", thcPct: D(6), cbdPct: D(12) },
  });

  const b1 = await prisma.batch.create({
    data: {
      code: "L-2026-001",
      strainId: northern.id,
      originType: "ESQUEJE",
      originProviderName: "Vivero interno del club",
      originProviderAddress: "SMA, Neuquén",
      plantsCount: 18,
      room: "Sala A",
      stage: "DISPONIBLE",
      plantedAt: date("2026-05-02"),
      harvestedAt: date("2026-09-10"),
      wetWeightG: D(2400),
      dryWeightG: D(520),
      thcPct: D(18.5),
      cbdPct: D(0.2),
    },
  });
  const b2 = await prisma.batch.create({
    data: {
      code: "L-2026-002",
      strainId: lemon.id,
      originType: "SEMILLA",
      originProviderName: "Socio semillero N° 4",
      plantsCount: 12,
      room: "Sala B",
      stage: "DISPONIBLE",
      plantedAt: date("2026-05-20"),
      harvestedAt: date("2026-09-28"),
      wetWeightG: D(1500),
      dryWeightG: D(340),
      thcPct: D(21),
      cbdPct: D(0.1),
    },
  });
  await prisma.batch.create({
    data: {
      code: "L-2026-003",
      strainId: cbdStrain.id,
      originType: "COSECHA_PROPIA",
      plantsCount: 9,
      room: "Sala C",
      stage: "CURADO",
      plantedAt: date("2026-06-15"),
      wetWeightG: D(900),
      thcPct: D(6),
      cbdPct: D(12),
    },
  });

  const membersData = [
    {
      legajo: 1, firstName: "María", lastName: "Gómez", docNumber: "30111222", birthDate: date("1988-04-12"),
      status: "ACTIVO" as const, admittedAt: date("2026-02-01"), reprocannNumber: "REP-000111",
      reprocannStatus: "VIGENTE" as const, reprocannExpiresAt: date("2027-03-01"),
      consumptionType: "TERAPEUTICO" as const, monthlyForecastG: D(30), consentSignedAt: date("2026-02-01"),
      phone: "+54 9 294 400-0001",
    },
    {
      legajo: 2, firstName: "Julián", lastName: "Pérez", docNumber: "33555666", birthDate: date("1994-11-03"),
      status: "ACTIVO" as const, admittedAt: date("2026-03-15"), reprocannNumber: "REP-000222",
      reprocannStatus: "VIGENTE" as const, reprocannExpiresAt: date("2027-01-10"),
      consumptionType: "LUDICO" as const, monthlyForecastG: D(20), consentSignedAt: date("2026-03-15"),
    },
    {
      legajo: 3, firstName: "Ana", lastName: "Ruiz", docNumber: "28777888", birthDate: date("1981-07-22"),
      status: "ACTIVO" as const, admittedAt: date("2026-01-10"), reprocannNumber: "REP-000333",
      reprocannStatus: "VENCIDO" as const, reprocannExpiresAt: date("2026-08-01"),
      consumptionType: "TERAPEUTICO" as const, monthlyForecastG: D(30), consentSignedAt: date("2026-01-10"),
    },
    {
      legajo: 4, firstName: "Tomás", lastName: "Silva", docNumber: "45000111", birthDate: date("2007-02-18"),
      status: "ACTIVO" as const, admittedAt: date("2026-04-01"), reprocannNumber: "REP-000444",
      reprocannStatus: "VIGENTE" as const, reprocannExpiresAt: date("2027-04-01"),
      consumptionType: "LUDICO" as const, monthlyForecastG: D(15), consentSignedAt: date("2026-04-01"),
    },
    {
      legajo: 5, firstName: "Carla", lastName: "Méndez", docNumber: "39999000", birthDate: date("1996-09-30"),
      status: "PENDIENTE" as const, reprocannStatus: "EN_TRAMITE" as const,
      consumptionType: "LUDICO" as const, monthlyForecastG: D(10),
    },
  ];
  const members = [] as { id: string; legajo: number }[];
  for (const data of membersData) {
    const m = await prisma.member.create({ data });
    members.push({ id: m.id, legajo: m.legajo });
  }

  // Ingresos: el stock nace de un movimiento, nunca de un campo editable.
  await prisma.stockMovement.createMany({
    data: [
      { batchId: b1.id, type: "INGRESO", grams: D(520), actorId: admin.id, reason: "Cosecha seca L-2026-001" },
      { batchId: b2.id, type: "INGRESO", grams: D(340), actorId: admin.id, reason: "Cosecha seca L-2026-002" },
    ],
  });

  // Una entrega de ejemplo, con snapshot de límites
  const uso = {
    checkedAt: new Date().toISOString(),
    ageYears: 38,
    grams: 5,
    thcPct: 18.5,
    usageBefore: { dayGrams: 0, monthGrams: 0 },
    usageAfter: { dayGrams: 5, monthGrams: 5 },
    limitsApplied: { dailyG: 25, monthlyG: 50, thcMaxPct: null, sellsForMinor: false },
    reprocann: { status: "VIGENTE", expiresAt: "2027-03-01" },
    forecastG: 30,
  };
  const disp = await prisma.dispensation.create({
    data: {
      memberId: members[0].id,
      batchId: b1.id,
      grams: D(5),
      thcPct: D(18.5),
      operatorId: operador.id,
      signatureType: "PIN",
      limitSnapshot: uso,
    },
  });
  await prisma.stockMovement.create({
    data: {
      batchId: b1.id,
      type: "DISPENSACION",
      grams: D(5),
      memberId: members[0].id,
      actorId: operador.id,
      dispensationId: disp.id,
      reason: "Entrega a socio 1",
    },
  });

  // Turnos de demo: hoy en la zona del club (-03:00), en horarios de la franja.
  const todayKey = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekdayOfToday = new Date(`${todayKey}T00:00:00.000Z`).getUTCDay();
  if (weekdayOfToday >= 1 && weekdayOfToday <= 6) {
    const turnos = [
      { member: members[0], minutes: 10 * 60 + 20, status: "CONFIRMADO" as const, channel: "WHATSAPP" },
      { member: members[1], minutes: 11 * 60, status: "PENDIENTE" as const, channel: "TELEFONO" },
      { member: members[4], minutes: 16 * 60, status: "PENDIENTE" as const, channel: "MOSTRADOR" },
    ];
    for (const t of turnos) {
      await prisma.appointment.create({
        data: {
          memberId: t.member.id,
          scheduledAt: new Date(`${todayKey}T00:00:00-03:00`).getTime() + t.minutes * 60_000 > 0
            ? new Date(new Date(`${todayKey}T00:00:00-03:00`).getTime() + t.minutes * 60_000)
            : new Date(),
          status: t.status,
          channel: t.channel,
          operatorId: operador.id,
          createdById: admin.id,
        },
      });
    }
  }

  const socioUser = await prisma.user.create({
    data: {
      email: "maria@club.test",
      name: "María Gómez",
      passwordHash: socioPass,
      role: "SOCIO",
      memberId: members[0].id,
    },
  });

  console.log("Seed OK:", {
    club: club.nombre,
    portalSocio: `${socioUser.email} / Socio1234!`,
    usuarios: ["admin@club.test / Admin1234!", "operador@club.test / Operador1234!"],
    socios: members.length,
    lotes: 3,
    franjas: "lun-sáb 10:00-19:00 · 20 min · cupo 2",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
