import { z } from "zod";

/** Los límites viven acá y en `cartas-rules.ts`: la ruta valida lo mismo que explica la pantalla. */
const http = (s: string) => /^https?:\/\/[^\s]+$/.test(s);

const enlace = z.object({
  texto: z.string().trim().min(1, "El enlace necesita un texto.").max(60),
  url: z.string().trim().refine(http, "La dirección tiene que empezar con http:// o https://"),
});

const bloque = z.object({
  titulo: z.string().trim().min(1, "El bloque necesita título.").max(120),
  texto: z.string().trim().min(1, "El bloque necesita texto.").max(900),
  enlace: enlace.optional(),
});

export const contenidoCarta = z.object({
  edicion: z.string().trim().min(1, "Falta el nombre de la edición.").max(60),
  titulo: z.string().trim().min(1, "Falta el título.").max(90),
  copete: z.string().trim().min(1, "Falta la bajada.").max(240),
  apertura: z.array(z.string().trim().max(900)).min(1, "Falta el primer párrafo.").max(6),
  bloques: z.array(bloque).min(1, "Falta al menos un bloque.").max(6),
  cta: enlace.optional(),
});

export const crearCarta = contenidoCarta;

export const aprobarCarta = z.object({
  /** ISO. Si viene vacío, la carta queda aprobada para que el cron la mande en la próxima pasada. */
  programadaPara: z.string().trim().min(1).optional(),
});

export type ContenidoCartaInput = z.infer<typeof contenidoCarta>;
