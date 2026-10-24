import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Empty, PageHead, Section } from "@/components/ui";
import { fmtDate, fmtGrams } from "@/lib/labels";

const DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

export default async function ControlPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hoy = new Date();
  const en30 = new Date(hoy.getTime() + DIAS * DIA_MS);
  const hace3 = new Date(hoy.getTime() - 3 * DIA_MS);

  const [reprocann, sinConsentimiento, lotesSinAnalisis, reservas, turnosHoy] = await Promise.all([
    prisma.member.findMany({
      where: {
        status: "ACTIVO",
        OR: [{ reprocannExpiresAt: { lt: hoy } }, { reprocannExpiresAt: { lte: en30 } }, { reprocannExpiresAt: null }],
      },
      orderBy: { reprocannExpiresAt: "asc" },
      take: 40,
    }),
    prisma.member.findMany({ where: { status: "ACTIVO", consentSignedAt: null }, orderBy: { legajo: "asc" }, take: 40 }),
    prisma.batch.findMany({
      where: { thcPct: null, stage: { in: ["DISPONIBLE", "CURADO"] } },
      include: { strain: true, movements: { select: { type: true, grams: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.pickupRequest.findMany({
      where: { OR: [{ status: "VENCIDA" }, { status: "SOLICITADA", createdAt: { lt: hace3 } }] },
      include: { member: true, appointment: true },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
    prisma.appointment.findMany({
      where: { status: "PENDIENTE" },
      include: { member: true },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
  ]);

  const vencidos = reprocann.filter((m) => !m.reprocannExpiresAt || m.reprocannExpiresAt < hoy);
  const porVencer = reprocann.filter((m) => m.reprocannExpiresAt && m.reprocannExpiresAt >= hoy);
  const sinConsumo = lotesSinAnalisis.map((b) => ({
    ...b,
    saldo:
      Math.round(
        b.movements.reduce((a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams), 0) * 100,
      ) / 100,
  })).filter((b) => b.saldo > 0);

  const bloqueantes = vencidos.length + sinConsumo.length;
  const pendientes = porVencer.length + sinConsentimiento.length + reservas.length;

  return (
    <>
      <PageHead
        title="Control del club"
        subtitle={
          bloqueantes > 0
            ? `${bloqueantes} asuntos bloquean o pueden bloquear entregas · ${pendientes} para revisar`
            : `${pendientes} asuntos para revisar · nada bloquea entregas hoy`
        }
      />

      <Section title="No pueden retirar" subtitle="REPROCANN vencido o sin fecha, y lotes con stock sin análisis de THC">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card card-pad">
            <div className="section-title">REPROCANN vencido o incompleto ({vencidos.length})</div>
            {vencidos.length === 0 ? (
              <Empty>Nadie con el REPROCANN vencido.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {vencidos.map((m) => (
                    <tr key={m.id}>
                      <td className="tnum">{m.legajo}</td>
                      <td><Link href={`/socios/${m.id}`}>{m.lastName}, {m.firstName}</Link></td>
                      <td className="cell-meta">{m.reprocannExpiresAt ? fmtDate(m.reprocannExpiresAt) : "sin fecha"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card card-pad">
            <div className="section-title">Lotes con stock sin THC ({sinConsumo.length})</div>
            {sinConsumo.length === 0 ? (
              <Empty>Todos los lotes disponibles tienen análisis cargado.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {sinConsumo.map((b) => (
                    <tr key={b.id}>
                      <td><Link href={`/stock/${b.id}`}>{b.code}</Link></td>
                      <td className="cell-meta">{b.strain.name}</td>
                      <td className="tnum">{fmtGrams(b.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Section>

      <Section title="Para revisar" subtitle="Vencimientos cercanos, consentimientos, reservas y turnos">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card card-pad">
            <div className="section-title">REPROCANN vence en {DIAS} días ({porVencer.length})</div>
            {porVencer.length === 0 ? (
              <Empty>Sin vencimientos próximos.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {porVencer.map((m) => (
                    <tr key={m.id}>
                      <td className="tnum">{m.legajo}</td>
                      <td><Link href={`/socios/${m.id}`}>{m.lastName}, {m.firstName}</Link></td>
                      <td className="cell-meta">{m.reprocannExpiresAt ? fmtDate(m.reprocannExpiresAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">Sin consentimiento firmado ({sinConsentimiento.length})</div>
            {sinConsentimiento.length === 0 ? (
              <Empty>Todos los socios activos tienen consentimiento.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {sinConsentimiento.map((m) => (
                    <tr key={m.id}>
                      <td className="tnum">{m.legajo}</td>
                      <td><Link href={`/socios/${m.id}`}>{m.lastName}, {m.firstName}</Link></td>
                      <td className="cell-meta">alta {fmtDate(m.admittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">Reservas vencidas o sin atender ({reservas.length})</div>
            {reservas.length === 0 ? (
              <Empty>Ninguna reserva quedó colgada.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {reservas.map((p) => (
                    <tr key={p.id}>
                      <td className="tnum">{p.member.legajo}</td>
                      <td><Link href={`/dispensario?socio=${p.memberId}&pickup=${p.id}`}>{p.member.lastName}, {p.member.firstName}</Link></td>
                      <td className="tnum">{fmtGrams(p.grams)}</td>
                      <td><Chip tone={p.status === "VENCIDA" ? "warn" : "mute"}>{p.status}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">Turnos sin confirmar ({turnosHoy.length})</div>
            {turnosHoy.length === 0 ? (
              <Empty>Sin turnos pendientes.</Empty>
            ) : (
              <table className="data mt-2">
                <tbody>
                  {turnosHoy.map((a) => (
                    <tr key={a.id}>
                      <td className="cell-meta">{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(a.scheduledAt)}</td>
                      <td><Link href={`/turnos?d=${a.scheduledAt.toISOString().slice(0, 10)}`}>{a.member.lastName}, {a.member.firstName}</Link></td>
                      <td><Chip tone="mute">{a.channel}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
