import { describe, expect, it, beforeAll } from "vitest";
import { memberNotices, waLink, NOTICE_KINDS, type NoticeInput } from "../notices";

beforeAll(() => {
  process.env.DOC_HASH_KEY = "clave-de-prueba";
});

const day = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * day);

const base: NoticeInput = {
  firstName: "María",
  reprocannStatus: "VIGENTE",
  reprocannExpiresAt: inDays(200),
  docHash: "abc",
  consents: ["DATOS_PERSONALES", "SALUD"],
  balanceArs: 0,
  openPickups: [],
  status: "ACTIVO",
};

describe("avisos a socios", () => {
  it("un socio al día no genera avisos", () => {
    expect(memberNotices(base)).toEqual([]);
  });

  it("REPROCANN por vencer dentro de 30 días es urgente para el mostrador", () => {
    const n = memberNotices({ ...base, reprocannExpiresAt: inDays(12) });
    expect(n[0].kind).toBe("REPROCANN_POR_VENCER");
    expect(n[0].severity).toBe("warn");
    expect(n[0].detail).toContain("12 días");
    expect(n[0].message).toContain("María");
  });

  it("pasado el vencimiento es danger y dice cuántos días hace", () => {
    const n = memberNotices({ ...base, reprocannExpiresAt: inDays(-5) });
    expect(n[0].kind).toBe("REPROCANN_VENCIDO");
    expect(n[0].severity).toBe("danger");
    expect(n[0].detail).toContain("5 días");
  });

  it("vigente sin fecha también es un aviso: el dato falta", () => {
    const n = memberNotices({ ...base, reprocannExpiresAt: null });
    expect(n.map((x) => x.kind)).toContain("REPROCANN_SIN_FECHA");
  });

  it("falta de consentimiento y de documento se avisan por separado", () => {
    const n = memberNotices({ ...base, consents: [], docHash: null });
    const kinds = n.map((x) => x.kind);
    expect(kinds).toContain("CONSENTIMIENTO_FALTANTE");
    expect(kinds).toContain("DOCUMENTO_SIN_VERIFICAR");
  });

  it("una reserva de menos de 3 días todavía no se reclama", () => {
    expect(memberNotices({ ...base, openPickups: [{ grams: 5, days: 2 }] })).toEqual([]);
    expect(memberNotices({ ...base, openPickups: [{ grams: 5, days: 4 }] })[0].kind).toBe("RESERVA_SIN_RETIRAR");
  });

  it("saldo pendiente genera aviso con el monto", () => {
    const n = memberNotices({ ...base, balanceArs: 8000 });
    expect(n[0].kind).toBe("CUENTA_CON_SALDO");
    expect(n[0].detail).toContain("8.000");
  });

  it("ordena lo urgente primero", () => {
    const n = memberNotices({ ...base, reprocannExpiresAt: inDays(-2), balanceArs: 1000 });
    expect(n[0].severity).toBe("danger");
    expect(n[n.length - 1].kind).toBe("CUENTA_CON_SALDO");
  });

  it("un socio de baja no recibe avisos", () => {
    expect(memberNotices({ ...base, status: "BAJA", reprocannExpiresAt: inDays(-40), balanceArs: 5000 })).toEqual([]);
  });

  it("todos los motivos tienen texto listo para mandar", () => {
    for (const meta of Object.values(NOTICE_KINDS)) {
      expect(meta.template("Ana", "detalle").length).toBeGreaterThan(40);
    }
  });
});

describe("enlace de WhatsApp", () => {
  it("normaliza un celular argentino con 0 y espacios", () => {
    expect(waLink("0 294 400 0001", "hola")).toContain("https://wa.me/5492944000001?text=hola");
  });

  it("respeta el 54 9 si ya viene completo", () => {
    expect(waLink("+54 9 294 400-0001", "hola")).toContain("wa.me/5492944000001");
  });

  it("sin teléfono no hay enlace", () => {
    expect(waLink(null, "hola")).toBeNull();
    expect(waLink("", "hola")).toBeNull();
  });

  it("escapa el texto del mensaje", () => {
    expect(waLink("2944000001", "hola, ¿cómo va?")).toContain("hola%2C%20%C2%BFc%C3%B3mo%20va%3F");
  });
});
