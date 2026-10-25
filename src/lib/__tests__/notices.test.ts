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
    expect(memberNotices({ ...base, openPickups: [{ id: "p1", grams: 5, days: 2 }] })).toEqual([]);
    expect(memberNotices({ ...base, openPickups: [{ id: "p1", grams: 5, days: 4 }] })[0].kind).toBe("RESERVA_SIN_RETIRAR");
  });

  it("dos reservas distintas son dos episodios", () => {
    const n = memberNotices({ ...base, openPickups: [{ id: "p1", grams: 5, days: 4 }, { id: "p2", grams: 2, days: 9 }] });
    const episodes = n.filter((x) => x.kind === "RESERVA_SIN_RETIRAR").map((x) => x.episode);
    expect(episodes).toHaveLength(2);
    expect(new Set(episodes).size).toBe(2);
  });

  it("renovar el REPROCANN abre un episodio nuevo, no reusa el aviso anterior", () => {
    const a = memberNotices({ ...base, reprocannStatus: "VIGENTE", reprocannExpiresAt: inDays(10) })[0];
    const b = memberNotices({ ...base, reprocannStatus: "VIGENTE", reprocannExpiresAt: inDays(400) })[0];
    expect(a.kind).toBe("REPROCANN_POR_VENCER");
    expect(b).toBeUndefined();
    const c = memberNotices({ ...base, reprocannStatus: "VIGENTE", reprocannExpiresAt: inDays(20) })[0];
    expect(c.episode).not.toBe(a.episode);
  });

  it("el mismo hecho conserva el episodio (no se re-avisa por abrir la pantalla)", () => {
    const first = memberNotices({ ...base, reprocannStatus: "VENCIDO", reprocannExpiresAt: inDays(-5) })[0];
    const again = memberNotices({ ...base, reprocannStatus: "VENCIDO", reprocannExpiresAt: inDays(-5) })[0];
    expect(first.episode).toBe(again.episode);
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

  it("EN_TRAMITE no se anuncia como vencido", () => {
    const n = memberNotices({ ...base, reprocannStatus: "EN_TRAMITE", reprocannExpiresAt: null });
    expect(n[0].kind).toBe("REPROCANN_NO_VIGENTE");
    expect(n[0].detail).toContain("en tramite");
    expect(n[0].message.toLowerCase()).not.toContain("vencido");
  });

  it("RECHAZADO se nombra como rechazado, sin inventar vencimiento", () => {
    const n = memberNotices({ ...base, reprocannStatus: "RECHAZADO", reprocannExpiresAt: null });
    expect(n[0].kind).toBe("REPROCANN_NO_VIGENTE");
    expect(n[0].detail).toContain("rechazado");
  });

  it("sin REPROCANN declarado se dice «sin declarar»", () => {
    const n = memberNotices({ ...base, reprocannStatus: "NO_APORTA", reprocannExpiresAt: null });
    expect(n[0].kind).toBe("REPROCANN_NO_VIGENTE");
    expect(n[0].detail).toContain("sin declarar");
  });

  it("VENCIDO es vencido aunque falte la fecha", () => {
    const n = memberNotices({ ...base, reprocannStatus: "VENCIDO", reprocannExpiresAt: null });
    expect(n[0].kind).toBe("REPROCANN_VENCIDO");
    expect(n[0].detail).toContain("registro");
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
