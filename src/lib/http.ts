import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import { AppError } from "./errors";

// Mensajes de validación en castellano para todas las rutas.
z.config(z.locales.es());

const FIELD: Record<string, string> = {
  firstName: "Nombre", lastName: "Apellido", docNumber: "Documento", birthDate: "Nacimiento", email: "Email",
  grams: "Gramos", reason: "Motivo", code: "Código", password: "Contraseña", name: "Nombre",
  reprocannExpiresAt: "Vencimiento REPROCANN", consentSignedAt: "Consentimiento", dryWeightG: "Peso seco",
  wetWeightG: "Peso húmedo", limitePorPedidoG: "Tope por pedido", limiteMensualG: "Tope mensual", limiteMenorG: "Tope para menores",
};

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "VALIDATION",
        message: (() => {
          const issue = error.issues[0];
          const key = String(issue?.path?.[0] ?? "");
          return issue ? `${FIELD[key] ? `${FIELD[key]}: ` : ""}${issue.message}` : "Datos inválidos";
        })(),
        details: error.issues,
      },
      { status: 400 },
    );
  }
  if (error instanceof SyntaxError) {
    return json({ error: "INVALID_JSON", message: "No se pudo leer la solicitud. Revisá los datos e intentá de nuevo." }, 400);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const messages: Record<string, [number, string]> = {
      P2002: [409, "Ya existe un registro con esos datos. Revisá el documento o código."],
      P2025: [404, "El registro ya no está disponible. Actualizá la página."],
      P2003: [409, "El registro está relacionado con otros datos o ya no existe."],
      P2034: [409, "Otra operación modificó estos datos. Actualizá y volvé a intentar."],
    };
    const known = messages[error.code];
    if (known) return json({ error: error.code, message: known[1] }, known[0]);
  }
  console.error("[api] error no controlado", error);
  return NextResponse.json({ error: "INTERNAL", message: "Error interno" }, { status: 500 });
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
