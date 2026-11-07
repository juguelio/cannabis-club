import { NextResponse } from "next/server";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrandView } from "@/lib/brand-db";
import { labelOf } from "@/lib/appointments";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha en UTC con formato ICS: 20261106T134000Z. */
function icsFecha(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

/** ICS escapa comas, punto y coma, barras y saltos de línea. */
const esc = (t: string) => t.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

/**
 * El turno del retiro como archivo de calendario.
 *
 * Un socio que reserva para el jueves a las 10 no tiene por qué copiar la fecha a mano: se descarga el
 * `.ics` y queda en el calendario del teléfono. Sólo aplica al retiro —un envío no tiene hora— y sólo
 * al pedido de quien lo pide.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const pedido = await prisma.pickupRequest.findFirst({
    where: { id, memberId: session.memberId },
    select: {
      deliveryMode: true,
      deliveryZona: true,
      appointment: { select: { scheduledAt: true } },
    },
  });
  if (!pedido) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (pedido.deliveryMode !== "RETIRO" || !pedido.appointment) {
    return NextResponse.json({ error: "SIN_TURNO", message: "Este pedido no tiene turno en el club." }, { status: 404 });
  }

  const brand = await getBrandView().catch(() => null);
  const club = brand?.nombre ?? "El club";
  const inicio = pedido.appointment.scheduledAt;
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);

  const cuerpo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hermes//Portal del socio//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:pickup-${id}@republicacannabis`,
    `DTSTAMP:${icsFecha(new Date())}`,
    `DTSTART:${icsFecha(inicio)}`,
    `DTEND:${icsFecha(fin)}`,
    `SUMMARY:${esc(`Retiro en ${club} · ${labelOf(inicio)}`)}`,
    `DESCRIPTION:${esc("Traé tu DNI. En el club se verifica tu identidad y tu REPROCANN antes de entregarte.")}`,
    `LOCATION:${esc(club)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`Hoy retirás en ${club}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(cuerpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="retiro-${id.slice(-6)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
