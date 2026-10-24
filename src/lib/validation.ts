import { z } from "zod";

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usá una fecha válida")
  .refine(value => { const date = new Date(`${value}T00:00:00.000Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "La fecha no existe");
export const optionalDate = calendarDate.or(z.literal(""));
export const gramsAmount = z.number().positive().max(99999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Usá como máximo dos decimales para los gramos");
