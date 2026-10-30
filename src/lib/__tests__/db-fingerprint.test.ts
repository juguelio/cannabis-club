import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { apuntaAProduccion, huellaBase } from "../db-fingerprint";

const PROD = "postgresql://u:p@ep-polished-mouse-b6pgnalj-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require";
const PREV = "postgresql://u:p@ep-polished-mouse-b6pgnalj-pooler.c-2.sa-east-1.aws.neon.tech/cannabis_club_preview?sslmode=require";

describe("huella de la base", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    delete process.env.PROD_DB_FINGERPRINT;
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  it("es estable y no expone la cadena de conexión", () => {
    const h = huellaBase(PROD);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(h).toBe(huellaBase(PROD));
    expect(h).not.toContain("neondb");
  });

  it("dos bases del mismo servidor dan huellas distintas", () => {
    expect(huellaBase(PROD)).not.toBe(huellaBase(PREV));
  });

  it("sin cadena de conexión no hay huella", () => {
    expect(huellaBase("")).toBeNull();
  });

  it("detecta cuando el entorno apunta a la base de producción", () => {
    process.env.PROD_DB_FINGERPRINT = huellaBase(PROD)!;
    expect(apuntaAProduccion(PROD)).toBe(true);
    expect(apuntaAProduccion(PREV)).toBe(false);
  });

  it("sin huella de producción configurada no bloquea nada", () => {
    expect(apuntaAProduccion(PROD)).toBe(false);
  });

  it("reconoce la misma base Neon por host directo o pooler sin cambiar huellas existentes", () => {
    const directa = PROD.replace("-pooler.", ".");
    process.env.PROD_DB_FINGERPRINT = huellaBase(PROD)!;
    expect(apuntaAProduccion(directa)).toBe(true);
    process.env.PROD_DB_FINGERPRINT = huellaBase(directa)!;
    expect(apuntaAProduccion(PROD)).toBe(true);
    expect(apuntaAProduccion(PREV)).toBe(false);
  });
});
