import Link from "next/link";
import { prisma } from "@/lib/db";
import { DOC_TIPO_LABEL, type DocTipo } from "@/lib/docs-crypto";
import { APPOINTMENT_STATUS, auditAction, fmtDate, fmtDateTime, fmtGrams } from "@/lib/labels";
import { VoidButton } from "./forms";
import { ValidacionAcciones } from "./validacion-acciones";
import { faltanDocumentos, textoFaltantes } from "@/lib/verificacion-rules";
import { FIELD_LABEL, MEMBER_STATUS, SIGNATURE } from "@/lib/labels";
import { rutaLegajo, secciones, type Seccion } from "@/lib/legajo-secciones";
import { Panel } from "./ui";

const texto = (value: string) => value.replaceAll("_", " ").toLocaleLowerCase("es-AR");
const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const expediente = {
  id: true, status: true, submittedAt: true, reviewedAt: true, rejectionReason: true,
  reviewedBy: { select: { name: true } }, birthDate: true, reprocannNumber: true, reprocannExpiresAt: true,
  address: true, locality: true,
  documents: { orderBy: { uploadedAt: "asc" }, select: { id: true, tipo: true, uploadedAt: true } },
} as const;

export async function DocumentacionSocio({ memberId }: { memberId: string }) {
  const [alta, revisiones] = await Promise.all([
    prisma.accessRequest.findUnique({ where: { memberId }, select: expediente }),
    prisma.memberVerification.findMany({ where: { memberId }, orderBy: { submittedAt: "desc" }, select: { ...expediente, supersededAt: true } }),
  ]);
  const tramites = [
    ...(alta ? [{ ...alta, revisable: false, titulo: "Solicitud de alta", ruta: "solicitudes" }] : []),
    ...revisiones.map(r => ({ ...r, revisable: r.status === "EN_REVISION" && !r.supersededAt, titulo: "Verificación", ruta: "verificaciones" })),
  ];
  return <Panel title="Documentación del socio">
    <div className="panel-body stack">
      {tramites.length === 0 && <p>Este legajo todavía no tiene expedientes digitales.</p>}
      {tramites.map(t => <section key={t.ruta + t.id}>
        <h3>{t.titulo} · {texto(t.status)}</h3>
        <p className="cell-meta">Presentada el {fmtDateTime(t.submittedAt)}
          {t.reviewedAt && <> · Revisada el {fmtDateTime(t.reviewedAt)}{t.reviewedBy && ` por ${t.reviewedBy.name}`}</>}</p>
        {t.rejectionReason && <p>Motivo: {t.rejectionReason}</p>}
        <details><summary>Datos declarados</summary>
          <dl className="dl"><dt>Nacimiento</dt><dd>{fmtDate(t.birthDate)}</dd>
            <dt>REPROCANN</dt><dd>{t.reprocannNumber}</dd><dt>Vencimiento</dt><dd>{fmtDate(t.reprocannExpiresAt)}</dd><dt>Domicilio declarado</dt><dd>{[t.address, t.locality].filter(Boolean).join(", ") || "—"}</dd></dl>
        </details>
        {t.documents.length ? <ul className="rows">{t.documents.map(d => <li key={d.id}>
          <a href={`/api/${t.ruta}/${t.id}/documentos/${d.id}`} target="_blank" rel="noreferrer">
            {DOC_TIPO_LABEL[d.tipo as DocTipo] ?? d.tipo}
          </a><span className="cell-meta">{fmtDateTime(d.uploadedAt)}</span>
        </li>)}</ul> : <p className="cell-meta">Sin archivos cargados.</p>}
        {t.revisable && <ValidacionAcciones id={t.id} faltantesTexto={textoFaltantes(faltanDocumentos(t.documents.map(d => d.tipo)))} />}
      </section>)}
    </div>
  </Panel>;
}

export const porPagina = 20;
type Historial = Extract<Seccion, "pedidos" | "envios" | "turnos" | "entregas" | "cambios" | "avisos">;

async function filas(memberId: string, seccion: Historial, pagina: number, admin: boolean) {
  const filtro = { where: { memberId }, take: porPagina + 1, skip: (pagina - 1) * porPagina };
  switch (seccion) {
    case "pedidos": {
      const pedidos = await prisma.pickupRequest.findMany({ ...filtro, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true, deliveryMode: true, status: true, grams: true, deliveryAddress: true, cancelReason: true,
          items: { select: { strainName: true, grams: true } }, aporteEstimado: true,
          paymentProofs: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, montoArs: true, motivo: true } } } });
      return pedidos.map(p => <li key={p.id}><div><b>{p.deliveryMode === "ENVIO" ? "Envío a domicilio" : "Retiro en sede"} · {fmtGrams(p.grams)}</b>
        <div>{fmtDateTime(p.createdAt)} · {texto(p.status)} {p.cancelReason}</div>
        {p.deliveryAddress && <div>{p.deliveryAddress}</div>}
        {p.items.map((i, k) => <div key={k}>{i.strainName} · {fmtGrams(i.grams)}</div>)}
        {p.aporteEstimado != null && <div>Aporte estimado: {pesos.format(Number(p.aporteEstimado))}</div>}
        {p.paymentProofs.map(c => <div key={c.id}><a href={`/api/comprobantes/${c.id}`} target="_blank" rel="noreferrer">Ver comprobante</a> · {texto(c.status)} · {fmtDateTime(c.createdAt)} {c.montoArs != null && pesos.format(Number(c.montoArs))} {c.motivo}</div>)}
      </div></li>);
    }
    case "envios": {
      const items = await prisma.shipmentItem.findMany({ ...filtro, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
        id: true, grams: true, ddjjSignedAt: true, batch: { select: { code: true } }, shipment: { select: {
          id: true, code: true, status: true, mode: true, toAddress: true, createdAt: true, departedAt: true, deliveredAt: true } } } });
      return items.map(({ shipment: s, ...i }) => <li key={i.id}><div><Link href={`/traslados/${s.id}`}>{s.code}</Link> · {texto(s.status)} · {texto(s.mode)}
        <div>{s.toAddress} · Lote {i.batch.code} · {fmtGrams(i.grams)}</div>
        <div className="cell-meta">Creado {fmtDateTime(s.createdAt)}{s.departedAt && ` · Despacho ${fmtDateTime(s.departedAt)}`}{s.deliveredAt && ` · Entrega ${fmtDateTime(s.deliveredAt)}`}{i.ddjjSignedAt && ` · DDJJ firmada ${fmtDate(i.ddjjSignedAt)}`}</div>
      </div></li>);
    }
    case "turnos": {
      const turnos = await prisma.appointment.findMany({ ...filtro, orderBy: [{ scheduledAt: "desc" }, { id: "desc" }], select: { id: true, scheduledAt: true, status: true, notes: true, cancelReason: true } });
      return turnos.map(t => <li key={t.id}><div>{fmtDateTime(t.scheduledAt)} · {APPOINTMENT_STATUS[t.status]?.label ?? texto(t.status)} <div>{t.cancelReason ?? t.notes}</div></div></li>);
    }
    case "entregas": {
      const entregas = await prisma.dispensation.findMany({ ...filtro, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], select: {
        id: true, occurredAt: true, grams: true, signatureType: true, thcPct: true, voidedAt: true, voidReason: true, operator: { select: { name: true } }, batch: { select: { code: true, id: true, strain: { select: { name: true } } } } } });
      return entregas.map(d => <li key={d.id}><div>{fmtDateTime(d.occurredAt)} · {fmtGrams(d.grams)} · <Link href={`/stock/${d.batch.id}`}>{d.batch.code}</Link> · {d.batch.strain.name}{d.thcPct != null && ` · ${d.thcPct}% THC`}
        <div className="cell-meta">{d.operator.name} · {SIGNATURE[d.signatureType]}{d.voidedAt && ` · Anulada: ${d.voidReason ?? fmtDate(d.voidedAt)}`}</div></div>{admin && !d.voidedAt && <VoidButton id={d.id} label={`${fmtGrams(d.grams)} de ${d.batch.code}`} />}</li>);
    }
    case "cambios": {
      const registros = await prisma.auditLog.findMany({ where: { entity: "Member", entityId: memberId }, skip: filtro.skip, take: filtro.take,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, action: true, payload: true, createdAt: true, actor: { select: { name: true } } } });
      return registros.map(a => {
        const detail = (a.payload ?? {}) as { reason?: string; changes?: Record<string, { to: string }> };
        return <li key={a.id}><div><b>{auditAction(a.action)}</b>
          {a.action === "MEMBER_STATUS" && detail.changes?.status && ` · ${MEMBER_STATUS[detail.changes.status.to]?.label ?? detail.changes.status.to}`}
          <div className="cell-meta">{fmtDateTime(a.createdAt)} · {a.actor?.name ?? "Sistema"}</div>
          {a.action === "MEMBER_UPDATE" && Object.keys(detail.changes ?? {}).map(k => FIELD_LABEL[k] ?? k).join(", ")}
          {detail.reason && <p>{detail.reason}</p>}
        </div></li>;
      });
    }
    case "avisos": {
      const avisos = await prisma.noticeLog.findMany({ ...filtro, orderBy: [{ sentAt: "desc" }, { id: "desc" }], select: { id: true, sentAt: true, kind: true, channel: true, note: true } });
      return avisos.map(a => <li key={a.id}><div>{fmtDateTime(a.sentAt)} · {texto(a.kind)} · {texto(a.channel)}<div>{a.note}</div></div></li>);
    }
  }
}

export function PaginacionLegajo({ id, seccion, pagina, siguiente }: { id: string; seccion: Seccion; pagina: number; siguiente: boolean }) {
  if (pagina === 1 && !siguiente) return null;
  return <nav aria-label="Páginas de registros" className="panel-body flex gap-2">
    {pagina > 1 && <Link href={rutaLegajo(id, seccion, pagina - 1)}>Anterior</Link>}
    <span>Página {pagina}</span>
    {siguiente && <Link href={rutaLegajo(id, seccion, pagina + 1)}>Siguiente</Link>}
  </nav>;
}

export async function HistorialSocio({ memberId, seccion, pagina, admin }: { memberId: string; seccion: Historial; pagina: number; admin: boolean }) {
  const registros = await filas(memberId, seccion, pagina, admin);
  return <Panel title={secciones[seccion]}><div className="panel-body stack">
    {seccion === "envios" && <p className="cell-meta">Los pedidos a domicilio que esperan despacho aparecen en <Link href={rutaLegajo(memberId, "pedidos")}>Pedidos</Link>.</p>}
    {registros.length ? <ul className="rows">{registros.slice(0, porPagina)}</ul> : <p>Sin registros en esta página.</p>}
    <PaginacionLegajo id={memberId} seccion={seccion} pagina={pagina} siguiente={registros.length > porPagina} />
  </div></Panel>;
}
