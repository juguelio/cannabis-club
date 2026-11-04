import { describe, expect, it } from "vitest";
import { pantallaDeEntrada, POR_QUE_LA_GUIA } from "../reprocann-entrada";

describe("entrada del socio al portal", () => {
  it("al que todavía no le preguntamos, se le pregunta", () => {
    expect(pantallaDeEntrada({ verificacion: "PENDIENTE", declaracion: null })).toBe("preguntar");
    expect(pantallaDeEntrada({ verificacion: "RECHAZADO", declaracion: null })).toBe("preguntar");
  });

  it("el que dijo que no tiene va a la guía, no al formulario de documentos", () => {
    // Este es el caso que importa: pedirle DNI y credencial a quien no tiene credencial es un callejón.
    expect(pantallaDeEntrada({ verificacion: "PENDIENTE", declaracion: "NO_TIENE" })).toBe("guia");
    expect(pantallaDeEntrada({ verificacion: "RECHAZADO", declaracion: "NO_TIENE" })).toBe("guia");
  });

  it("el que dijo que sí (o ya empezó) va a validar documentos", () => {
    expect(pantallaDeEntrada({ verificacion: "PENDIENTE", declaracion: "TIENE" })).toBe("validar");
    expect(pantallaDeEntrada({ verificacion: "EN_REVISION", declaracion: "TIENE" })).toBe("validar");
    expect(pantallaDeEntrada({ verificacion: "RECHAZADO", declaracion: "TIENE" })).toBe("validar");
  });

  it("el verificado entra directo: no se le vuelve a preguntar", () => {
    expect(pantallaDeEntrada({ verificacion: "VERIFICADO", declaracion: null })).toBe("portal");
    expect(pantallaDeEntrada({ verificacion: "VERIFICADO", declaracion: "TIENE" })).toBe("portal");
    expect(pantallaDeEntrada({ verificacion: "VERIFICADO", declaracion: "NO_TIENE" })).toBe("portal");
  });

  it("el motivo de la guía dice para qué sirve el permiso, no que sea obligatorio por el club", () => {
    expect(POR_QUE_LA_GUIA).toContain("cultivo");
    expect(POR_QUE_LA_GUIA).not.toMatch(/obligatorio/i);
  });
});
