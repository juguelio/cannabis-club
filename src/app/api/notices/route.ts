import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { logNotice, noticeBoard, isNoticeChannel, isNoticeKind } from "@/lib/notices";

const Body = z.object({
  memberId: z.string().min(1),
  kind: z.string(),
  channel: z.string().default("WHATSAPP"),
  episode: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function GET() {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    const board = await noticeBoard();
    return json({ total: board.total, urgent: board.urgent, sinAvisar: board.sinAvisar, rows: board.rows });
  } catch (error) {
    return fail(error);
  }
}

/** Registrar que se avisó: no envía nada, deja constancia de quién avisó y por dónde. */
export async function POST(req: Request) {
  try {
    const session = await requireUser(["ADMIN", "OPERADOR"]);
    const body = Body.parse(await req.json());
    if (!isNoticeKind(body.kind)) throw badRequest("INVALID_KIND", "Motivo de aviso desconocido.");
    if (!isNoticeChannel(body.channel)) throw badRequest("INVALID_CHANNEL", "Canal desconocido.");
    const row = await logNotice({ memberId: body.memberId, kind: body.kind, channel: body.channel, episode: body.episode ?? null, actorId: session.id, note: body.note });
    return json({ log: { id: row.id, sentAt: row.sentAt.toISOString(), channel: row.channel } }, 201);
  } catch (error) {
    return fail(error);
  }
}
