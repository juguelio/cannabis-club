import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { buildReport, toCsv } from "@/lib/reports";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const { name } = await ctx.params;
    const report = await buildReport(name);
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
