import { describe, expect, it } from "vitest";
import { clubSettings, clubSettingsFields } from "../club-settings";
import { calendarDate, gramsAmount } from "../validation";
const valid = { nombre: "Club de prueba", cuit: "", directorMedico: "", responsableTecnico: "", reprocannNumber: "", reprocannCode: "", limiteDiarioG: 25, limiteMensualG: 50, limiteMenorG: 30, edadMinima: 18, edadLimiteMenor: 21, thcMaxMenor: 10, maxSocios: 100, requiereReprocann: true, aportePorGramo: 1200, cuotaSocialArs: 8000, cuotaIngresoArs: null, requiereLiberacion: true };
describe("configuración del club", () => {
  it("permite completar la identidad gradualmente", () => expect(clubSettings.safeParse(valid).success).toBe(true));
  it.each([{ limiteDiarioG: 60 }, { limiteMenorG: 60 }, { edadMinima: 22 }, { nombre: "  " }, { thcMaxMenor: 101 }])("rechaza reglas contradictorias: %j", patch => expect(clubSettings.safeParse({ ...valid, ...patch }).success).toBe(false));
  it("valida un PATCH después de combinarlo con la configuración actual", () => {
    const patch = clubSettingsFields.partial().parse({ limiteMensualG: 20 });
    expect(clubSettings.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("permite desactivar el tope adicional de THC", () => expect(clubSettings.safeParse({ ...valid, thcMaxMenor: null }).success).toBe(true));
});
describe("datos operativos", () => {
  it.each(["2026-02-30", "2026-13-01", "no es fecha", "2026-1-1"])("rechaza fechas inválidas %s", value => expect(calendarDate.safeParse(value).success).toBe(false));
  it("acepta el día bisiesto", () => expect(calendarDate.safeParse("2024-02-29").success).toBe(true));
  it.each([0, -1, 0.001, 1.999, Infinity])("rechaza gramos que se perderían al redondear: %s", value => expect(gramsAmount.safeParse(value).success).toBe(false));
  it.each([0.01, 5, 10.12])("acepta gramos válidos: %s", value => expect(gramsAmount.safeParse(value).success).toBe(true));
});
