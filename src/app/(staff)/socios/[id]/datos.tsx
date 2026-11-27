import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui";
import { MemberEditor, MemberStatusActions, PortalAccess } from "@/components/member-editor";
import { daysToExpiry, fmtDate, fmtWhen, plural } from "@/lib/labels";
import { maskDoc } from "@/lib/privacy";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";

export async function DatosSocio({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const member = await prisma.member.findUnique({ where: { id }, include: {
    user: { select: { email: true, active: true, lastLoginAt: true } },
  } });
  if (!member) notFound();
  const days = daysToExpiry(member.reprocannExpiresAt);
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const qr = await QRCode.toString(`${base}/dispensario?socio=${member.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#10231b", light: "#ffffff" } });
  return <div className="stack"><Panel title="Datos del socio"><div className="panel-body flex flex-wrap gap-2">
            <MemberStatusActions id={member.id} status={member.status} />
            <MemberEditor
              id={member.id}
              isAdmin={isAdmin}
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
    </div></Panel>
          <Panel title="Datos de contacto">
            <div className="panel-body">
              <dl className="dl">
                <dt>Teléfono</dt><dd>{member.phone ? <a href={`tel:${member.phone.replace(/\s/g, "")}`}>{member.phone}</a> : "—"}</dd>
                <dt>Email</dt><dd>{member.email ?? "—"}</dd>
                <dt>Domicilio</dt><dd>{[member.address, member.locality, member.province, member.postalCode].filter(Boolean).join(", ") || "—"}</dd>
                <dt>Verificación</dt><dd>{member.verificationStatus.toLowerCase().replaceAll("_", " ")}{member.verificationAt && ` · ${fmtDate(member.verificationAt)}`}</dd>
                <dt>Nacimiento</dt><dd>{fmtDate(member.birthDate)}</dd>
                <dt>Documento</dt><dd>{maskDoc(member.docLast4)}{member.docVerifiedAt ? ` · verificado el ${fmtDate(member.docVerifiedAt)}` : ""}</dd>
              </dl>
              {member.notes ? <p className="muted" style={{ margin: "14px 0 0", fontSize: 14, whiteSpace: "pre-line" }}>{member.notes}</p> : null}
            </div>
          </Panel>

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

          <Panel title="Portal del socio">
            <div className="panel-body">
              <PortalAccess id={member.id} email={member.user?.email ?? member.email} hasAccess={Boolean(member.user?.active)} canGrant={member.status === "ACTIVO"} />
              {member.user?.lastLoginAt ? <p className="cell-meta" style={{ margin: "10px 0 0" }}>Último ingreso: {fmtWhen(member.user.lastLoginAt)}</p> : null}
            </div>
          </Panel>
    </div>;
}
