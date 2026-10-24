import { prisma } from "./db";

export type ReportRow = (string | number | null)[];
export type Report = { name: string; filename: string; headers: string[]; rows: ReportRow[] };

const fdate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(d) : "";
const fnum = (v: unknown) => (v == null ? "" : Math.round(Number(v) * 100) / 100);

export async function buildReport(name: string): Promise<Report> {
  switch (name) {
    case "padron":
      return padron();
    case "dispensaciones":
      return dispensaciones();
    case "stock":
      return stock();
    case "destrucciones":
      return destrucciones();
    case "informe-anual":
      return informeAnual();
    default:
      throw new Error(`Reporte desconocido: ${name}`);
  }
}

async function padron(): Promise<Report> {
  const members = await prisma.member.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  return {
    name: "Padrón de socios",
    filename: "padron-socios.csv",
    headers: [
      "Legajo",
      "Apellido",
      "Nombre",
      "Tipo doc",
      "Documento",
      "Nacimiento",
      "Estado",
      "REPROCANN",
      "Estado REPROCANN",
      "Vence REPROCANN",
      "Consumo",
      "Previsión g/mes",
      "Alta",
      "Baja",
      "Consentimiento",
    ],
    rows: members.map((m) => [
      m.legajo,
      m.lastName,
      m.firstName,
      m.docType,
      m.docNumber,
      fdate(m.birthDate),
      m.status,
      m.reprocannNumber ?? "",
      m.reprocannStatus,
      fdate(m.reprocannExpiresAt),
      m.consumptionType,
      fnum(m.monthlyForecastG),
      fdate(m.admittedAt),
      fdate(m.leftAt),
      fdate(m.consentSignedAt),
    ]),
  };
}

async function dispensaciones(): Promise<Report> {
  const rows = await prisma.dispensation.findMany({
    include: { member: true, batch: { include: { strain: true } }, operator: true },
    orderBy: { occurredAt: "desc" },
  });
  return {
    name: "Libro de dispensaciones",
    filename: "libro-dispensaciones.csv",
    headers: [
      "Fecha",
      "Apellido",
      "Nombre",
      "Año nacimiento",
      "Documento",
      "Cepa",
      "Lote",
      "Gramos",
      "THC %",
      "Operador",
      "Firma",
      "Anulada",
      "Motivo anulación",
    ],
    rows: rows.map((d) => [
      new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d.occurredAt),
      d.member.lastName,
      d.member.firstName,
      d.member.birthDate.getUTCFullYear(),
      d.member.docNumber,
      d.batch.strain.name,
      d.batch.code,
      fnum(d.grams),
      fnum(d.thcPct),
      d.operator.name,
      d.signatureType,
      d.voidedAt ? "SÍ" : "NO",
      d.voidReason ?? "",
    ]),
  };
}

async function stock(): Promise<Report> {
  const batches = await prisma.batch.findMany({
    include: { strain: true, movements: { select: { type: true, grams: true } } },
    orderBy: { code: "asc" },
  });
  return {
    name: "Stock por lote",
    filename: "stock-por-lote.csv",
    headers: ["Lote", "Cepa", "Etapa", "Plantas", "Sala", "Ingresado g", "Dispensado g", "Destruido g", "Saldo g", "THC %", "Cosecha"],
    rows: batches.map((b) => {
      const sum = (types: string[]) =>
        b.movements.filter((m) => types.includes(m.type)).reduce((a, m) => a + Number(m.grams), 0);
      const balance = b.movements.reduce(
        (a, m) =>
          a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
        0,
      );
      return [
        b.code,
        b.strain.name,
        b.stage,
        b.plantsCount ?? "",
        b.room ?? "",
        fnum(sum(["INGRESO", "AJUSTE_POSITIVO"])),
        fnum(sum(["DISPENSACION"])),
        fnum(sum(["DESTRUCCION"])),
        fnum(balance),
        fnum(b.thcPct),
        fdate(b.harvestedAt),
      ];
    }),
  };
}

async function destrucciones(): Promise<Report> {
  const rows = await prisma.stockMovement.findMany({
    where: { type: "DESTRUCCION" },
    include: { batch: { include: { strain: true } }, actor: true },
    orderBy: { occurredAt: "desc" },
  });
  return {
    name: "Libro de destrucciones",
    filename: "destrucciones.csv",
    headers: ["Fecha", "Lote", "Cepa", "Gramos", "Motivo", "Responsable"],
    rows: rows.map((m) => [
      new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(m.occurredAt),
      m.batch.code,
      m.batch.strain.name,
      fnum(m.grams),
      m.reason ?? "",
      m.actor.name,
    ]),
  };
}

async function informeAnual(): Promise<Report> {
  const strains = await prisma.strain.findMany({ include: { batches: true }, orderBy: { name: "asc" } });
  const entregas = await prisma.$queryRaw<{ strainId: string; total: unknown }[]>`
    SELECT b."strainId" AS "strainId", COALESCE(SUM(d.grams), 0) AS total
    FROM "Dispensation" d JOIN "Batch" b ON b.id = d."batchId"
    WHERE d."voidedAt" IS NULL
    GROUP BY b."strainId"
  `;
  const destruido = await prisma.$queryRaw<{ strainId: string; total: unknown }[]>`
    SELECT b."strainId" AS "strainId", COALESCE(SUM(m.grams), 0) AS total
    FROM "StockMovement" m JOIN "Batch" b ON b.id = m."batchId"
    WHERE m.type = 'DESTRUCCION'
    GROUP BY b."strainId"
  `;
  const eMap = new Map(entregas.map((r) => [r.strainId, Number(r.total)]));
  const dMap = new Map(destruido.map((r) => [r.strainId, Number(r.total)]));
  const saldo = await prisma.$queryRaw<{ strainId: string; total: unknown }[]>`
    SELECT b."strainId" AS "strainId",
      COALESCE(SUM(CASE WHEN m.type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN m.grams ELSE -m.grams END), 0) AS total
    FROM "StockMovement" m JOIN "Batch" b ON b.id = m."batchId"
    GROUP BY b."strainId"
  `;
  const sMap = new Map(saldo.map((r) => [r.strainId, Number(r.total)]));
  return {
    name: "Informe anual por variedad",
    filename: "informe-anual.csv",
    headers: ["Variedad", "Cosechado seco g", "Entregado g", "Destruido g", "Stock final g", "THC % prom", "CBD % prom"],
    // Solo el peso seco acredita stock: el húmedo no cuenta como cosecha disponible.
    rows: strains.map((s) => {
      const cosechado = s.batches.reduce((a, b) => a + Number(b.dryWeightG ?? 0), 0);
      return [
        s.name,
        fnum(cosechado),
        fnum(eMap.get(s.id) ?? 0),
        fnum(dMap.get(s.id) ?? 0),
        fnum(sMap.get(s.id) ?? 0),
        fnum(s.thcPct),
        fnum(s.cbdPct),
      ];
    }),
  };
}

export function toCsv(report: Report): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [report.headers.map(esc).join(";"), ...report.rows.map((r) => r.map(esc).join(";"))];
  return "\uFEFF" + lines.join("\n") + "\n";
}
