import { requireUser } from "@/lib/auth";
import { route, searchParams } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { calendarDate } from "@/lib/validation";
import { buildReport, toCsv } from "@/lib/reports";

const NAMES = ["padron", "dispensaciones", "stock", "destrucciones", "informe-anual"];

/** Libros en CSV. Opcional: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (libros) · ?anio=2026 o ?year=2026 (informe anual). */
export const GET = route<{ name: string }>(async (req, { name }) => {
  await requireUser(["ADMIN", "OPERADOR"]);
  if (!NAMES.includes(name)) throw notFound("Ese libro no existe");
  const sp = searchParams(req);
  const from = sp.get("desde") ? calendarDate.parse(sp.get("desde")) : null;
  const to = sp.get("hasta") ? calendarDate.parse(sp.get("hasta")) : null;
  const yearRaw = Number(sp.get("anio") ?? sp.get("year"));
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : null;
  const report = await buildReport(name, { from, to, year });
  return new Response(toCsv(report), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
