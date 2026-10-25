/**
 * Reglas puras del informe semestral (sin Prisma, sin `server-only`): períodos, armado del payload
 * y CSV. La pantalla y el test miran exactamente los mismos números.
 *
 * Marco: Res. 1780/2025 — informe semestral en carácter de declaración jurada con cantidad de plantas
 * totales y en floración y la variedad genética registrada.
 */
import { badRequest } from "./errors";

const r2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Semestre de una fecha: S1 = enero-junio, S2 = julio-diciembre. */
export function semesterOf(date = new Date()): string {
  const year = date.getUTCFullYear();
  const half = date.getUTCMonth() < 6 ? 1 : 2;
  return `${year}-S${half}`;
}

export function isSemesterPeriod(period: string): boolean {
  return /^\d{4}-S[12]$/.test(period);
}

/** Límites del semestre en UTC (las fechas de lote son `date`, sin hora). */
export function semesterBounds(period: string) {
  if (!isSemesterPeriod(period)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-S1 o AAAA-S2.");
  const [yearRaw, halfRaw] = period.split("-S");
  const year = Number(yearRaw);
  const startMonth = halfRaw === "1" ? 0 : 6;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 6, 1));
  return { start, end };
}

export type CultivationBatch = {
  code: string;
  strain: string;
  genetics: string | null;
  room: string | null;
  stage: string;
  plants: number;
  plantedAt: Date | string | null;
  harvestedAt: Date | string | null;
  dryWeightG: number;
};

export type SemesterInput = {
  period: string;
  closedAt: Date;
  club: { nombre: string; cuit: string | null; reprocannNumber: string | null; directorMedico: string | null; responsableTecnico: string | null };
  cultivation: CultivationBatch[];
  varieties: { name: string; genetics: string | null; active: boolean }[];
  harvestedGrams: number;
  dispensedGrams: number;
  dispensations: number;
  recalledBatches: number;
};

export type SemesterPayload = ReturnType<typeof buildSemesterPayload>;

/**
 * Arma el contenido que se declara. Puro: recibe filas y devuelve exactamente lo que se firma,
 * así el test y la pantalla miran el mismo número.
 */
export function buildSemesterPayload(input: SemesterInput) {
  const { start, end } = semesterBounds(input.period);

  const byStage: Record<string, number> = { PROPAGACION: 0, VEGETATIVO: 0, FLORACION: 0 };
  const rooms = new Map<string, { room: string; plants: number; flowering: number }>();

  for (const b of input.cultivation) {
    byStage[b.stage] = (byStage[b.stage] ?? 0) + b.plants;
    const key = b.room?.trim() || "Sin sala asignada";
    const entry = rooms.get(key) ?? { room: key, plants: 0, flowering: 0 };
    entry.plants += b.plants;
    if (b.stage === "FLORACION") entry.flowering += b.plants;
    rooms.set(key, entry);
  }

  const plantsTotal = Object.values(byStage).reduce((acc, n) => acc + n, 0);
  const plantsFlowering = byStage.FLORACION ?? 0;

  const varieties = input.varieties.map((v) => {
    const mine = input.cultivation.filter((b) => b.strain === v.name);
    return {
      name: v.name,
      genetics: v.genetics,
      registered: v.active,
      plantsTotal: mine.reduce((acc, b) => acc + b.plants, 0),
      plantsFlowering: mine.filter((b) => b.stage === "FLORACION").reduce((acc, b) => acc + b.plants, 0),
      batches: mine.length,
    };
  });

  return {
    period: input.period,
    from: isoDay(start),
    to: isoDay(new Date(end.getTime() - 86_400_000)),
    closedAt: input.closedAt.toISOString(),
    club: input.club,
    cultivation: {
      plantsTotal,
      plantsFlowering,
      byStage,
      rooms: [...rooms.values()].sort((a, b) => a.room.localeCompare(b.room)),
      batches: input.cultivation
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((b) => ({
          code: b.code,
          strain: b.strain,
          genetics: b.genetics,
          room: b.room,
          stage: b.stage,
          plants: b.plants,
          plantedAt: isoDay(b.plantedAt ? new Date(b.plantedAt) : null),
          harvestedAt: isoDay(b.harvestedAt ? new Date(b.harvestedAt) : null),
          dryWeightG: r2(b.dryWeightG),
        })),
    },
    varieties,
    activity: {
      harvestedGrams: r2(input.harvestedGrams),
      dispensedGrams: r2(input.dispensedGrams),
      dispensations: input.dispensations,
      recalledBatches: input.recalledBatches,
    },
    // Lo que la app no sabe y por lo tanto no declara: se dice, no se inventa.
    gaps: [
      "La referencia de inscripción de cada variedad no está cargada en el sistema.",
      "El informe no incluye antecedentes penales ni documentación de las autoridades de la asociación.",
    ],
  };
}


/** CSV del informe para adjuntar al expediente (separador `;`, como el resto de los libros). */
export function semesterCsv(payload: SemesterPayload): string {
  const rows: string[][] = [
    ["Informe semestral (declaracion jurada)", payload.period],
    ["Desde", payload.from ?? ""],
    ["Hasta", payload.to ?? ""],
    ["Club", payload.club.nombre],
    ["CUIT", payload.club.cuit ?? ""],
    ["REPROCANN", payload.club.reprocannNumber ?? ""],
    ["Director Medico", payload.club.directorMedico ?? ""],
    ["Responsable Tecnico", payload.club.responsableTecnico ?? ""],
    [],
    ["Plantas totales", String(payload.cultivation.plantsTotal)],
    ["Plantas en floracion", String(payload.cultivation.plantsFlowering)],
    ["En propagacion", String(payload.cultivation.byStage.PROPAGACION ?? 0)],
    ["En vegetativo", String(payload.cultivation.byStage.VEGETATIVO ?? 0)],
    ["Cosechado en el semestre (g)", String(payload.activity.harvestedGrams)],
    ["Dispensado en el semestre (g)", String(payload.activity.dispensedGrams)],
    ["Entregas registradas", String(payload.activity.dispensations)],
    ["Lotes retirados", String(payload.activity.recalledBatches)],
    [],
    ["Sala", "Plantas", "En floracion"],
    ...payload.cultivation.rooms.map((r) => [r.room, String(r.plants), String(r.flowering)]),
    [],
    ["Variedad", "Genetica", "Plantas", "En floracion", "Lotes"],
    ...payload.varieties.map((v) => [v.name, v.genetics ?? "", String(v.plantsTotal), String(v.plantsFlowering), String(v.batches)]),
    [],
    ["Lote", "Variedad", "Sala", "Etapa", "Plantas", "Plantado", "Cosechado", "Peso seco (g)"],
    ...payload.cultivation.batches.map((b) => [
      b.code, b.strain, b.room ?? "", b.stage, String(b.plants), b.plantedAt ?? "", b.harvestedAt ?? "", String(b.dryWeightG),
    ]),
  ];
  return rows.map((r) => r.map((c) => (c.includes(";") ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}
