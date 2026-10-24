import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { buildReport, toCsv } from "@/lib/reports";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { name } = await ctx.params;
    // El informe anual necesita saber de qué año habla; por defecto, el año en curso.
    const yearParam = new URL(req.url).searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
    const report = await buildReport(name, { year });
    const csv = toCsv(report);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.filename}"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
