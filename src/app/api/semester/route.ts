import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clientIp, fail, json } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { listSemesterReports, semesterIntegrity, semesterPayload, signSemesterReport, signedSemesterReport } from "@/lib/semester-report";
import { isSemesterPeriod, semesterOf } from "@/lib/semester-rules";

const SignBody = z.object({
  periodo: z.string().trim(),
  note: z.string().trim().max(300).optional(),
  supersedesId: z.string().trim().optional(),
});

/** Vista previa del semestre: lo que se va a declarar, antes de firmar. */
export async function GET(req: Request) {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const url = new URL(req.url);
    const period = url.searchParams.get("periodo") ?? semesterOf();
    if (!isSemesterPeriod(period)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-S1 o AAAA-S2.");
    const [payload, signed, reports] = await Promise.all([semesterPayload(period), signedSemesterReport(period), listSemesterReports()]);
    return json({
      period,
      payload,
      signed: signed ? { id: signed.id, hash: signed.hash, signedAt: signed.signedAt, signer: signed.signer.name, note: signed.note } : null,
      integrity: signed ? semesterIntegrity(signed.payload, signed.hash) : null,
      reports: reports.map((r) => ({ id: r.id, period: r.period, hash: r.hash, signedAt: r.signedAt, signer: r.signer.name })),
    });
  } catch (error) {
    return fail(error);
  }
}

/** Firmar el informe: queda congelado con firma y huella. Sólo ADMIN. */
export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN"]);
    const body = SignBody.parse(await req.json());
    if (!isSemesterPeriod(body.periodo)) throw badRequest("INVALID_PERIOD", "El período tiene que ser AAAA-S1 o AAAA-S2.");
    const report = await signSemesterReport({ period: body.periodo, actorId: session.id, note: body.note, supersedesId: body.supersedesId });
    await clientIp(req);
    return json({ report: { id: report.id, period: report.period, hash: report.hash, signedAt: report.signedAt } }, 201);
  } catch (error) {
    return fail(error);
  }
}
