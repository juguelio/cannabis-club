import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { memberUsage } from "@/lib/dispensary";
import { memberBalance } from "@/lib/account";
import { getClub, limitsFromClub } from "@/lib/club";
import { age, fmtGrams, fmtWhen } from "@/lib/labels";
import { Meter, Panel } from "@/components/ui";
import { faltanDocumentos } from "@/lib/verificacion-rules";
import { paginaLegajo, rutaLegajo, type Seccion } from "@/lib/legajo-secciones";
import { contextoLegajo } from "./contexto";

export const metadata = { title: "Resumen del socio" };

export default async function Resumen({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ historial?: string; pagina?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { member, session } = await contextoLegajo(id);
  if (query.historial && ["pedidos","envios","turnos","entregas","cuenta","cambios","avisos"].includes(query.historial)) {
    redirect(rutaLegajo(id, query.historial as Seccion, paginaLegajo(query.pagina)));
  }
  const club = await getClub();
  const limits = limitsFromClub(club);
  const minor = member.birthDate && age(member.birthDate) < limits.edadLimiteMenor;
  const monthLimit = minor ? Math.min(limits.limiteMenorG, limits.limiteMensualG) : limits.limiteMensualG;
  const admin = session.role === "ADMIN";
  const open = { memberId: id, status: { in: ["SOLICITADA", "CONFIRMADA"] as ("SOLICITADA" | "CONFIRMADA")[] } };
  const [usage, balance, pedidos, reserva, turno, revision] = await Promise.all([
    memberUsage(prisma, id, club.timezone),
    session.role === "DISPENSADOR" ? 0 : memberBalance(id),
    admin ? prisma.pickupRequest.count({ where: open }) : 0,
    prisma.pickupRequest.findFirst({ where: open, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { grams: true } }),
    prisma.appointment.findFirst({ where: { memberId: id, scheduledAt: { gte: new Date() }, status: { in: ["PENDIENTE", "CONFIRMADO"] } }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true } }),
    admin && member.verificationStatus === "EN_REVISION" ? prisma.memberVerification.findFirst({
      where: { memberId: id, supersededAt: null, status: "EN_REVISION" }, orderBy: { submittedAt: "desc" },
      select: { documents: { select: { tipo: true } } },
    }) : null,
  ]);
  const pendientes: { label: string; seccion: Seccion }[] = [];
  if (admin && member.verificationStatus !== "VERIFICADO") {
    const lista = revision && !faltanDocumentos(revision.documents.map(d => d.tipo)).length;
    pendientes.push({ label: lista ? "Documentación lista para revisar" : member.verificationStatus === "RECHAZADO" ? "Esperando correcciones del socio" : "Esperando documentación del socio", seccion: "documentacion" });
  }
  if (pedidos) pendientes.push({ label: pedidos === 1 ? "1 pedido abierto" : `${pedidos} pedidos abiertos`, seccion: "pedidos" });
  if (balance > 0) pendientes.push({ label: `Saldo deudor · ${balance.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`, seccion: "cuenta" });
  return <div className="stack">
    <Panel title="Requiere atención">
      {pendientes.length ? <ul className="legajo-tareas">{pendientes.map(p => <li key={p.seccion}>
        <Link href={rutaLegajo(id, p.seccion)}>{p.label}<span aria-hidden>→</span></Link>
      </li>)}</ul> : <p className="panel-body">Sin pendientes</p>}
    </Panel>
    {(turno || reserva) && <Panel title="Próxima atención"><div className="panel-body">
      {turno && <p>Próximo turno · {fmtWhen(turno.scheduledAt)}</p>}
      {reserva && <p>Reserva abierta · {fmtGrams(reserva.grams)}</p>}
    </div></Panel>}
          <Panel title="Este mes" subtitle={member.monthlyForecastG ? `Previsión declarada: ${fmtGrams(member.monthlyForecastG)} por mes.` : "Sin previsión declarada."}>
            <div className="panel-body stack" style={{ gap: 14 }}>
              <div>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
                  <span className="big-g">{fmtGrams(usage.monthGrams).replace(" g", "")}<small>g</small></span>
                  <span className="cell-meta">de {fmtGrams(monthLimit)} del mes · quedan {fmtGrams(Math.max(0, monthLimit - usage.monthGrams))}</span>
                </div>
                <Meter value={usage.monthGrams} max={monthLimit} />
              </div>
              <div className="cell-meta" style={{ fontSize: 14 }}>
                <b className="tnum">{fmtGrams(usage.dayGrams)}</b> retirados hoy · sin tope diario: el club limita{" "}
                {fmtGrams(limits.limitePorPedidoG)} por pedido
              </div>
            </div>
          </Panel>
  </div>;
}
