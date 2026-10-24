import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, History, Scale } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getClub, limitsFromClub } from "@/lib/club";
import { memberUsage } from "@/lib/dispensary";
import { Avatar, Chip, Empty, Meter, Note, Panel } from "@/components/ui";
import { VoidButton } from "@/components/forms";
import { MemberEditor, MemberStatusActions, PortalAccess } from "@/components/member-editor";
import {
  age, AUDIT_ACTION, CONSUMPTION, daysToExpiry, FIELD_LABEL, fmtDate, fmtGrams, fmtWhen, MEMBER_STATUS, plural, reprocannIssue,
} from "@/lib/labels";

export const metadata = { title: "Legajo" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function SocioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [member, club] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, active: true, lastLoginAt: true } },
        dispensations: { orderBy: { occurredAt: "desc" }, take: 30, include: { batch: { include: { strain: true } }, operator: { select: { name: true } } } },
        pickups: { where: { status: { in: ["SOLICITADA", "CONFIRMADA"] } }, include: { appointment: { select: { scheduledAt: true } } } },
      },
    }),
    getClub(),
  ]);
  if (!member) notFound();

  const [usage, activity] = await Promise.all([
    memberUsage(prisma, member.id, club.timezone),
    prisma.auditLog.findMany({ where: { entity: "Member", entityId: member.id }, orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
  ]);
  const limits = limitsFromClub(club);
  const years = age(member.birthDate);
  const minor = years < limits.edadLimiteMenor;
  const monthLimit = minor ? Math.min(limits.limiteMenorG, limits.limiteMensualG) : limits.limiteMensualG;
  const st = MEMBER_STATUS[member.status] ?? { label: member.status, tone: "mute" as const };
  const issue = reprocannIssue(member);
  const canRetire = member.status === "ACTIVO" && issue.tone !== "danger";
  const days = daysToExpiry(member.reprocannExpiresAt);
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const qr = await QRCode.toString(`${base}/dispensario?socio=${member.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#10231b", light: "#ffffff" } });
  const pickup = member.pickups[0];

  return (
    <>
      <Link className="crumb" href="/socios"><ArrowLeft aria-hidden /> Socios</Link>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="profile">
          <Avatar first={member.firstName} last={member.lastName} size="lg" tone={member.status !== "ACTIVO" ? "mute" : issue.tone === "danger" ? "danger" : undefined} />
          <div style={{ minWidth: 0 }}>
            <h1 className="profile-name">{member.lastName}, {member.firstName}</h1>
            <div className="profile-meta">
              <span>Legajo {member.legajo}</span>
              <span>DNI {member.docNumber}</span>
              <span>{years} años</span>
              <span>{CONSUMPTION[member.consumptionType]}</span>
            </div>
            <div className="profile-chips">
              <Chip tone={st.tone}>{st.label}</Chip>
              <Chip tone={issue.tone}>{issue.label}</Chip>
              {member.consentSignedAt ? <Chip tone="ok">Consentimiento firmado</Chip> : <Chip tone="warn">Sin consentimiento</Chip>}
              {minor ? <Chip tone="warn">Menor de {limits.edadLimiteMenor}: tope reducido</Chip> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" style={{ justifyContent: "flex-end" }}>
            {canRetire ? <Link className="btn" href={`/dispensario?socio=${member.id}`}><Scale aria-hidden />Entregar</Link> : null}
            <MemberStatusActions id={member.id} status={member.status} />
            <MemberEditor
              id={member.id}
              isAdmin={session.role === "ADMIN"}
              initial={{
                firstName: member.firstName,
                lastName: member.lastName,
                birthDate: iso(member.birthDate),
                phone: member.phone ?? "",
                email: member.email ?? "",
                address: member.address ?? "",
                reprocannNumber: member.reprocannNumber ?? "",
                reprocannStatus: member.reprocannStatus,
                reprocannExpiresAt: iso(member.reprocannExpiresAt),
                consentSignedAt: iso(member.consentSignedAt),
                consumptionType: member.consumptionType,
                monthlyForecastG: member.monthlyForecastG == null ? "" : String(Number(member.monthlyForecastG)),
                notes: member.notes ?? "",
              }}
            />
          </div>
        </div>
        {member.statusReason && member.status !== "ACTIVO" ? (
          <div style={{ padding: "0 20px 18px" }}><Note tone={member.status === "BAJA" ? undefined : "warn"}>Motivo: {member.statusReason}</Note></div>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="stack">
          <Panel title="Este mes" subtitle={member.monthlyForecastG ? `Previsión declarada: ${fmtGrams(member.monthlyForecastG)} por mes.` : "Sin previsión declarada."}>
            <div className="panel-body stack" style={{ gap: 14 }}>
              <div>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
                  <span className="big-g">{fmtGrams(usage.monthGrams).replace(" g", "")}<small>g</small></span>
                  <span className="cell-meta">de {fmtGrams(monthLimit)} del mes · quedan {fmtGrams(Math.max(0, monthLimit - usage.monthGrams))}</span>
                </div>
                <Meter value={usage.monthGrams} max={monthLimit} />
              </div>
              <div>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 6, fontSize: 14 }}>
                  <span><b className="tnum">{fmtGrams(usage.dayGrams)}</b> hoy</span>
                  <span className="cell-meta">tope diario {fmtGrams(limits.limiteDiarioG)}</span>
                </div>
                <Meter value={usage.dayGrams} max={limits.limiteDiarioG} />
              </div>
              {pickup ? (
                <Note>
                  Tiene una reserva del portal por <b>{fmtGrams(pickup.grams)}</b>
                  {pickup.appointment ? ` para ${fmtWhen(pickup.appointment.scheduledAt)}` : ""}. Se cierra sola al registrar la entrega.
                </Note>
              ) : null}
            </div>
          </Panel>

          <Panel title="Entregas" subtitle="Cada fila es un asiento del libro. Las anuladas quedan tachadas con su contra-asiento.">
            {member.dispensations.length === 0 ? (
              <Empty icon={Scale} title="Todavía no retiró nada">{canRetire ? <Link href={`/dispensario?socio=${member.id}`}>Registrar la primera entrega</Link> : null}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Cuándo</th><th>Lote</th><th className="num">Gramos</th><th className="hide-sm">Registró</th><th /></tr>
                  </thead>
                  <tbody>
                    {member.dispensations.map((d) => (
                      <tr key={d.id} className={d.voidedAt ? "voided" : undefined}>
                        <td className="cell-meta" style={{ whiteSpace: "nowrap" }}>{fmtWhen(d.occurredAt)}</td>
                        <td><div className="cell-main">{d.batch.strain.name}</div><div className="cell-meta">{d.batch.code}{d.thcPct ? `, ${Number(d.thcPct)}% THC` : ""}</div></td>
                        <td className="num"><span className="cell-main tnum">{fmtGrams(d.grams)}</span>{d.voidedAt ? <div className="cell-meta" title={d.voidReason ?? ""}>anulada</div> : null}</td>
                        <td className="cell-meta hide-sm">{d.operator.name}</td>
                        <td className="num">{session.role === "ADMIN" && !d.voidedAt ? <VoidButton id={d.id} label={`${fmtGrams(d.grams)} de ${d.batch.code}`} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Historial del legajo" subtitle="Altas, cambios de estado y de datos, con quién los hizo.">
            {activity.length === 0 ? (
              <Empty icon={History}>Sin cambios registrados.</Empty>
            ) : (
              <ul className="rows">
                {activity.map((a) => {
                  const payload = (a.payload ?? {}) as { changes?: Record<string, { from: unknown; to: unknown }>; reason?: string | null };
                  const changed = payload.changes ? Object.keys(payload.changes).map((k) => FIELD_LABEL[k] ?? k) : [];
                  return (
                    <li key={a.id}>
                      <div className="grow">
                        <div style={{ fontWeight: 550 }}>
                          {AUDIT_ACTION[a.action] ?? a.action}
                          {a.action === "MEMBER_STATUS" && payload.changes?.status ? `: ${MEMBER_STATUS[String(payload.changes.status.to)]?.label ?? payload.changes.status.to}` : ""}
                        </div>
                        <div className="cell-meta">
                          {a.actor?.name ?? "Sistema"} · {fmtWhen(a.createdAt)}
                          {changed.length && a.action === "MEMBER_UPDATE" ? ` · ${changed.join(", ")}` : ""}
                          {payload.reason ? ` · “${payload.reason}”` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Carnet" subtitle="Escaneado desde el celular del mostrador abre la entrega de este socio.">
            <div className="panel-body carnet">
              <div className="qr-box" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`Código QR del legajo ${member.legajo}`} role="img" />
              <dl className="dl" style={{ gridTemplateColumns: "auto 1fr" }}>
                <dt>Legajo</dt><dd className="tnum" style={{ fontWeight: 650 }}>{member.legajo}</dd>
                <dt>Alta</dt><dd>{fmtDate(member.admittedAt)}</dd>
                <dt>REPROCANN</dt><dd>{member.reprocannNumber ?? "—"}</dd>
                <dt>Vence</dt><dd>{fmtDate(member.reprocannExpiresAt)}{days != null && days >= 0 && days <= 30 ? ` (en ${plural(days, "día", "días")})` : ""}</dd>
              </dl>
            </div>
          </Panel>

          <Panel title="Datos de contacto">
            <div className="panel-body">
              <dl className="dl">
                <dt>Teléfono</dt><dd>{member.phone ? <a href={`tel:${member.phone.replace(/\s/g, "")}`}>{member.phone}</a> : "—"}</dd>
                <dt>Email</dt><dd>{member.email ?? "—"}</dd>
                <dt>Domicilio</dt><dd>{member.address ?? "—"}</dd>
                <dt>Nacimiento</dt><dd>{fmtDate(member.birthDate)}</dd>
                <dt>Consentimiento</dt><dd>{member.consentSignedAt ? `Firmado el ${fmtDate(member.consentSignedAt)}` : "Falta firmar"}</dd>
              </dl>
              {member.notes ? <p className="muted" style={{ margin: "14px 0 0", fontSize: 14, whiteSpace: "pre-line" }}>{member.notes}</p> : null}
            </div>
          </Panel>

          <Panel title="Portal del socio">
            <div className="panel-body">
              <PortalAccess id={member.id} email={member.user?.email ?? member.email} hasAccess={Boolean(member.user?.active)} canGrant={member.status === "ACTIVO"} />
              {member.user?.lastLoginAt ? <p className="cell-meta" style={{ margin: "10px 0 0" }}>Último ingreso: {fmtWhen(member.user.lastLoginAt)}</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
