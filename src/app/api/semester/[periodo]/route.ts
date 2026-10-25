import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { badRequest, notFound } from "@/lib/errors";
import { signedSemesterReport, semesterPayload } from "@/lib/semester-report";
import { isSemesterPeriod, semesterCsv } from "@/lib/semester-rules";

/** CSV del informe: el firmado si existe (con su huella), si no la vista previa. */
export async function GET(_req: Request, ctx: { params: Promise<{ periodo: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { periodo } = await ctx.params;
    if (!isSemesterPeriod(periodo)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-S1 o AAAA-S2.");
    const signed = await signedSemesterReport(periodo);
    const payload = signed ? (signed.payload as Awaited<ReturnType<typeof semesterPayload>>) : await semesterPayload(periodo);
    if (!payload) throw notFound("Sin datos para el período");
    const csv = `\uFEFF${semesterCsv(payload)}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="informe-semestral-${periodo}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
