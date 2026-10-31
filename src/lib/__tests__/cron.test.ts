import { afterEach, describe, expect, it } from "vitest";
import { esCron } from "../cron";

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

const conSecreto = (valor: string, headers: Record<string, string>) => {
  process.env.CRON_SECRET = valor;
  return new Request("https://club.test/api/x", { headers });
};

describe("crons autenticados por secreto", () => {
  it("acepta el Bearer correcto", () => {
    expect(esCron(conSecreto("s3creto-de-prueba-largo", { authorization: "Bearer s3creto-de-prueba-largo" }))).toBe(true);
  });

  it("rechaza un secreto distinto y la ausencia de header", () => {
    expect(esCron(conSecreto("s3creto-de-prueba-largo", { authorization: "Bearer otro" }))).toBe(false);
    expect(esCron(conSecreto("s3creto-de-prueba-largo", {}))).toBe(false);
    expect(esCron(conSecreto("s3creto-de-prueba-largo", { authorization: "s3creto-de-prueba-largo" }))).toBe(false);
  });

  it("sin CRON_SECRET configurado no deja pasar a nadie (falla cerrado)", () => {
    process.env.CRON_SECRET = "";
    expect(esCron(new Request("https://club.test/api/x", { headers: { authorization: "Bearer " } }))).toBe(false);
    delete process.env.CRON_SECRET;
    expect(esCron(new Request("https://club.test/api/x", { headers: { authorization: "Bearer cualquier-cosa" } }))).toBe(false);
  });

  it("un secreto demasiado corto no se considera válido", () => {
    expect(esCron(conSecreto("corto", { authorization: "Bearer corto" }))).toBe(false);
  });
});
