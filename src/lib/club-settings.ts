import { z } from "zod";

export const clubSettingsFields = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre del club").max(160),
  nombreCorto: z.string().trim().max(40).nullable().optional(),
  cuit: z.string().trim().max(20),
  directorMedico: z.string().trim().max(120),
  directorMedicoMatricula: z.string().trim().max(60).default(""),
  responsableTecnico: z.string().trim().max(120),
  responsableTecnicoTitulo: z.string().trim().max(120).default(""),
  reprocannNumber: z.string().trim().max(100),
  reprocannCode: z.string().trim().max(100),
  /** Personería jurídica: número y fecha de la resolución (IGJ o registro provincial). */
  personeria: z.string().trim().max(160).default(""),
  /** REPS: inscripción provincial en el registro de cannabis. */
  reps: z.string().trim().max(160).default(""),
  domicilioLegal: z.string().trim().max(200).default(""),
  limiteDiarioG: z.number().positive().max(100000),
  limiteMensualG: z.number().positive().max(100000),
  limiteMenorG: z.number().positive().max(100000),
  edadMinima: z.number().int().min(18).max(100),
  edadLimiteMenor: z.number().int().min(18).max(100),
  thcMaxMenor: z.number().min(0).max(100).nullable(),
  maxSocios: z.number().int().positive().max(100000),
  requiereReprocann: z.boolean(),
  /** Prorrateo de costos, no precio: aporte por gramo y cuota social mensual. */
  aportePorGramo: z.number().min(0).max(10_000_000).nullable(),
  cuotaSocialArs: z.number().min(0).max(10_000_000).nullable(),
  cuotaIngresoArs: z.number().min(0).max(10_000_000).nullable(),
  /** Exigir la firma de liberación del lote antes de entregar. */
  requiereLiberacion: z.boolean(),
});
export const clubSettings = clubSettingsFields.refine(v => v.limiteDiarioG <= v.limiteMensualG, { message: "El tope diario no puede superar el mensual", path: ["limiteDiarioG"] })
  .refine(v => v.limiteMenorG <= v.limiteMensualG, { message: "El tope para menores debe ser igual o inferior al general", path: ["limiteMenorG"] })
  .refine(v => v.edadLimiteMenor >= v.edadMinima, { message: "La edad de corte debe ser igual o mayor a la edad mínima", path: ["edadLimiteMenor"] });

export type ClubSettings = z.infer<typeof clubSettings>;

