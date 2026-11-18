import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { monthlyTotals } from "@/lib/monthly-close";

const cell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Cierre del período en CSV, para guardar o presentar. */
export async function GET(_req: Request, ctx: { params: Promise<{ period: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { period } = await ctx.params;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-MM.");
    const t = await monthlyTotals(period);

    const rows: [string, string | number | null][] = [
      ["Período", t.periodo],
      ["Club", t.club.nombre],
      ["CUIT", t.club.cuit],
      ["Director médico", t.club.directorMedico],
      ["Responsable técnico", t.club.responsableTecnico],
      ["Tope por pedido (g)", t.topes.diarioG],
      ["Tope mensual (g)", t.topes.mensualG],
      ["Entregas", t.entregas.cantidad],
      ["Gramos entregados", t.entregas.gramos],
      ["Socios que retiraron", t.entregas.sociosDistintos],
      ["Lotes usados", t.entregas.lotesDistintos],
      ["Anulaciones", t.anulaciones.cantidad],
      ["Gramos anulados", t.anulaciones.gramos],
      ["Cosechado seco (g)", t.cosechadoG],
      ["Destruido (g)", t.destruidoG],
      ["Stock al cierre (g)", t.stockAlCierreG],
      ["Cargos del mes ($)", t.cuenta.cargos],
      ["Pagos del mes ($)", t.cuenta.pagos],
      ["Lotes liberados", t.calidad.lotesLiberados],
      ["Recalls", t.calidad.recalls],
      ["Socios activos", t.socios.ACTIVO ?? 0],
      ["Socios suspendidos", t.socios.SUSPENDIDO ?? 0],
      ["Socios de baja", t.socios.BAJA ?? 0],
      ["Generado", t.generadoEl],
    ];

    const csv = "\uFEFF" + ["Concepto;Valor", ...rows.map(([k, v]) => `${cell(k)};${cell(v)}`)].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cierre-${period}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
