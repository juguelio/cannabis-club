import { MemberEditor } from "@/components/member-editor";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Field, Meter, PageHead, Section } from "@/components/ui";
import { MemberActions } from "@/components/forms";

const SIGNATURE: Record<string, string> = {
  REGISTRO_OPERADOR: "Registrada por el operador",
  PIN: "PIN del socio",
  FIRMA_DIGITAL: "Firma digital",
  QR: "QR del carnet",
};
import { age, CONSUMPTION, fmtDate, fmtDateTime, fmtGrams, MEMBER_STATUS, reprocannIssue } from "@/lib/labels";
import { getClub, limitsFromClub } from "@/lib/club";
import { memberUsage } from "@/lib/dispensary";

export default async function SocioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [member, club] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
      include: {
        dispensations: { orderBy: { occurredAt: "desc" }, take: 40, include: { batch: { include: { strain: true } }, operator: true } },
      },
    }),
    getClub(),
  ]);
  if (!member) notFound();

  const usage = await memberUsage(prisma, member.id, club.timezone);
  const limits = limitsFromClub(club);
  const st = MEMBER_STATUS[member.status] ?? { label: member.status, tone: "mute" as const };
  const issue = reprocannIssue(member);
  const entregado = member.dispensations.filter((d) => !d.voidedAt).reduce((a, d) => a + Number(d.grams), 0);

  return (
    <>
      <PageHead
        title={`${member.lastName}, ${member.firstName}`}
        subtitle={`Legajo ${member.legajo} · ${member.docType} ${member.docNumber} · ${age(member.birthDate)} años`}
        actions={
          <>
            <MemberActions id={member.id} status={member.status} />
            <Link className="btn btn-secondary" href="/socios">Volver</Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Chip tone={st.tone}>{st.label}</Chip>
        <Chip tone={issue.tone}>{issue.label}</Chip>
        <Chip>{CONSUMPTION[member.consumptionType] ?? member.consumptionType}</Chip>
        {member.consentSignedAt ? <Chip tone="ok">Consentimiento firmado</Chip> : <Chip tone="warn">Sin consentimiento</Chip>}
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div className="card card-pad">
          <div className="section-title mb-2">Datos personales</div>
          <Field label="Nacimiento" value={fmtDate(member.birthDate)} />
          <Field label="Domicilio" value={member.address ?? "—"} />
          <Field label="Teléfono" value={member.phone ?? "—"} />
          <Field label="Email" value={member.email ?? "—"} />
        </div>
        <div className="card card-pad">
          <div className="section-title mb-2">REPROCANN</div>
          <Field label="Número" value={member.reprocannNumber ?? "—"} />
          <Field label="Estado" value={<Chip tone={issue.tone}>{issue.label}</Chip>} />
          <Field label="Vence" value={fmtDate(member.reprocannExpiresAt)} />
          <Field label="Previsión" value={member.monthlyForecastG ? `${fmtGrams(member.monthlyForecastG)}/mes` : "—"} />
        </div>
        <div className="card card-pad">
          <div className="section-title mb-2">Consumo del mes</div>
          <div className="flex items-baseline justify-between">
            <div className="text-[22px] tnum" style={{ fontWeight: 650 }}>{fmtGrams(usage.monthGrams)}</div>
            <div className="cell-meta">tope {fmtGrams(limits.limiteMensualG)}</div>
          </div>
          <div className="my-2"><Meter value={usage.monthGrams} max={limits.limiteMensualG} /></div>
          <div className="flex items-baseline justify-between mt-3">
            <div className="text-[15px] tnum" style={{ fontWeight: 600 }}>{fmtGrams(usage.dayGrams)}</div>
            <div className="cell-meta">hoy · tope {fmtGrams(limits.limiteDiarioG)}</div>
          </div>
          <div className="my-2"><Meter value={usage.dayGrams} max={limits.limiteDiarioG} /></div>
          <div className="cell-meta">Entregado en las últimas 40 operaciones: <span className="tnum">{fmtGrams(entregado)}</span></div>
        </div>
      </div>

      <MemberEditor id={member.id} initial={{ phone: member.phone ?? "", email: member.email ?? "", address: member.address ?? "", reprocannNumber: member.reprocannNumber ?? "", reprocannStatus: member.reprocannStatus, reprocannExpiresAt: member.reprocannExpiresAt?.toISOString().slice(0, 10) ?? "", consentSignedAt: member.consentSignedAt?.toISOString().slice(0, 10) ?? "" }} />
      <Section title="Entregas" subtitle="Cada fila es un asiento del libro; las anuladas conservan su contra-asiento">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cepa / lote</th>
                <th className="num">Gramos</th>
                <th className="num">THC</th>
                <th>Operador</th>
                <th>Firma</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {member.dispensations.map((d) => (
                <tr key={d.id}>
                  <td className="cell-meta">{fmtDateTime(d.occurredAt)}</td>
                  <td>
                    <div>{d.batch.strain.name}</div>
                    <div className="cell-meta">{d.batch.code}</div>
                  </td>
                  <td className="num tnum">{fmtGrams(d.grams)}</td>
                  <td className="num tnum">{d.thcPct ? `${Number(d.thcPct)}%` : "—"}</td>
                  <td className="cell-meta">{d.operator.name}</td>
                  <td className="cell-meta">{SIGNATURE[d.signatureType] ?? d.signatureType}</td>
                  <td>{d.voidedAt ? <Chip tone="danger">anulada</Chip> : <Chip tone="ok">vigente</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {member.dispensations.length === 0 ? <div className="empty">Todavía no retiró nada.</div> : null}
        </div>
      </Section>
    </>
  );
}
