import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

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
      { error: "VALIDATION", message: "Datos inválidos", details: error.issues },
      { status: 400 },
    );
  }
  console.error("[api] error no controlado", error);
  return NextResponse.json({ error: "INTERNAL", message: "Error interno" }, { status: 500 });
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
