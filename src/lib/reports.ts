import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CONSUMPTION, MEMBER_STATUS, REPROCANN_STATUS, STAGE } from "./labels";

export type ReportOptions = { from?: string | null; to?: string | null; year?: number | null };

/** Rango [desde, hasta] en hora del club (-03:00), inclusivo por día. */
export function rangeOf(opts: ReportOptions): { gte?: Date; lt?: Date } {
  const out: { gte?: Date; lt?: Date } = {};
  if (opts.from) out.gte = new Date(`${opts.from}T00:00:00-03:00`);
  if (opts.to) out.lt = new Date(new Date(`${opts.to}T00:00:00-03:00`).getTime() + 86_400_000);
  return out;
}

export type ReportRow = (string | number | null)[];
export type Report = { name: string; filename: string; headers: string[]; rows: ReportRow[] };

const fdate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(d) : "";
const fnum = (v: unknown) => (v == null ? "" : Math.round(Number(v) * 100) / 100);

export async function buildReport(name: string, opts: ReportOptions = {}): Promise<Report> {
  switch (name) {
    case "padron":
      return padron();
    case "dispensaciones":
      return dispensaciones(opts);
    case "stock":
      return stock();
    case "destrucciones":
      return destrucciones(opts);
    case "informe-anual":
      return informeAnual(opts.year ?? new Date().getFullYear());
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
      MEMBER_STATUS[m.status]?.label ?? m.status,
      m.reprocannNumber ?? "",
      REPROCANN_STATUS[m.reprocannStatus]?.label ?? m.reprocannStatus,
      fdate(m.reprocannExpiresAt),
      CONSUMPTION[m.consumptionType] ?? m.consumptionType,
      fnum(m.monthlyForecastG),
      fdate(m.admittedAt),
      fdate(m.leftAt),
      fdate(m.consentSignedAt),
    ]),
  };
}

async function dispensaciones(opts: ReportOptions): Promise<Report> {
  const range = rangeOf(opts);
  const rows = await prisma.dispensation.findMany({
    where: range.gte || range.lt ? { occurredAt: range } : {},
    include: { member: true, batch: { include: { strain: true } }, operator: true },
    orderBy: { occurredAt: "desc" },
  });
  return {
    name: "Libro de dispensaciones",
    filename: `libro-dispensaciones${opts.from ? `-${opts.from}` : ""}${opts.to ? `-a-${opts.to}` : ""}.csv`,
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
      new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(d.occurredAt),
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
        STAGE[b.stage]?.label ?? b.stage,
        b.plantsCount ?? "",
        b.room ?? "",
        fnum(sum(["INGRESO", "AJUSTE_POSITIVO"])),
        fnum(sum(["DISPENSACION"]) - sum(["DISPENSACION_REVERSA"])),
        fnum(sum(["DESTRUCCION"])),
        fnum(balance),
        fnum(b.thcPct),
        fdate(b.harvestedAt),
      ];
    }),
  };
}

async function destrucciones(opts: ReportOptions): Promise<Report> {
  const range = rangeOf(opts);
  const rows = await prisma.stockMovement.findMany({
    where: { type: "DESTRUCCION", ...(range.gte || range.lt ? { occurredAt: range } : {}) },
    include: { batch: { include: { strain: true } }, actor: true },
    orderBy: { occurredAt: "desc" },
  });
  return {
    name: "Libro de destrucciones",
    filename: "destrucciones.csv",
    headers: ["Fecha", "Lote", "Cepa", "Gramos", "Motivo", "Responsable"],
    rows: rows.map((m) => [
      new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(m.occurredAt),
      m.batch.code,
      m.batch.strain.name,
      fnum(m.grams),
      m.reason ?? "",
      m.actor.name,
    ]),
  };
}

/**
 * Informe anual por variedad, acotado al año pedido (hora del club):
 * cosechado = peso seco de lotes cosechados en el año; entregado/destruido = movimientos del año;
 * stock final = saldo del libro al cierre del año.
 */
async function informeAnual(year: number): Promise<Report> {
  const start = new Date(`${year}-01-01T00:00:00-03:00`);
  const end = new Date(`${year + 1}-01-01T00:00:00-03:00`);
  const strains = await prisma.strain.findMany({
    include: { batches: { where: { harvestedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } } },
    orderBy: { name: "asc" },
  });
  const sums = await prisma.$queryRaw<{ strainId: string; entregado: unknown; destruido: unknown; saldo: unknown }[]>(Prisma.sql`
    SELECT b."strainId" AS "strainId",
      COALESCE(SUM(CASE WHEN m."occurredAt" >= ${start} AND m."occurredAt" < ${end} AND m.type = 'DISPENSACION' THEN m.grams
                        WHEN m."occurredAt" >= ${start} AND m."occurredAt" < ${end} AND m.type = 'DISPENSACION_REVERSA' THEN -m.grams ELSE 0 END), 0) AS entregado,
      COALESCE(SUM(CASE WHEN m."occurredAt" >= ${start} AND m."occurredAt" < ${end} AND m.type = 'DESTRUCCION' THEN m.grams ELSE 0 END), 0) AS destruido,
      COALESCE(SUM(CASE WHEN m."occurredAt" < ${end} THEN
        CASE WHEN m.type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN m.grams ELSE -m.grams END ELSE 0 END), 0) AS saldo
    FROM "StockMovement" m JOIN "Batch" b ON b.id = m."batchId"
    GROUP BY b."strainId"
  `);
  const map = new Map(sums.map((r) => [r.strainId, r]));
  return {
    name: `Informe anual por variedad ${year}`,
    filename: `informe-anual-${year}.csv`,
    headers: ["Año", "Variedad", "Lotes cosechados", "Cosechado seco g", "Entregado g", "Destruido g", "Stock al cierre g", "THC % (referencia de la variedad)", "CBD % (referencia de la variedad)"],
    // Solo el peso seco acredita stock: el húmedo no cuenta como cosecha disponible.
    // THC/CBD son el valor declarado de la variedad, no un promedio de las entregas (R05).
    rows: strains.map((s) => {
      const r = map.get(s.id);
      const cosechado = s.batches.reduce((a, b) => a + Number(b.dryWeightG ?? 0), 0);
      return [
        year,
        s.name,
        s.batches.filter((b) => b.dryWeightG != null).length,
        fnum(cosechado),
        fnum(r?.entregado ?? 0),
        fnum(r?.destruido ?? 0),
        fnum(r?.saldo ?? 0),
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
