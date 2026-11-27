import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Avatar, Chip, Note } from "@/components/ui";
import { LegajoNav } from "@/components/legajo-nav";
import { maskDoc } from "@/lib/privacy";
import { age, CONSUMPTION, MEMBER_STATUS, reprocannIssue } from "@/lib/labels";
import { getClub, limitsFromClub } from "@/lib/club";
import { estadoVerificacion } from "@/lib/verificacion-rules";
import { contextoLegajo } from "./contexto";
import "./legajo.css";

export default async function Layout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const [{ member, session }, club] = await Promise.all([contextoLegajo(id), getClub()]);
  const years = member.birthDate ? age(member.birthDate) : null;
  const limits = limitsFromClub(club);
  const minor = years !== null && years < limits.edadLimiteMenor;
  const verification = estadoVerificacion(member.verificationStatus);
  const st = MEMBER_STATUS[member.status];
  const issue = reprocannIssue(member);
  const canRetire = member.status === "ACTIVO" && issue.tone !== "danger";
  return <>
      <Link className="crumb" href="/socios"><ArrowLeft aria-hidden /> Socios</Link>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="profile">
          {member.archivos[0] ? <Image unoptimized width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }}
            src={`/api/members/${id}/archivos/PERFIL?v=${member.archivos[0].uploadedAt.getTime()}`} alt="Foto del socio" />
            : <Avatar first={member.firstName} last={member.lastName} size="lg" tone={member.status !== "ACTIVO" ? "mute" : issue.tone === "danger" ? "danger" : undefined} />}
          <div style={{ minWidth: 0 }}>
            <h1 className="profile-name">{member.lastName}, {member.firstName}</h1>
            <div className="profile-meta">
              <span>Legajo {member.legajo}</span>
              <span>{maskDoc(member.docLast4)}</span>
              {years !== null && <span>{years} años</span>}
              <span>{CONSUMPTION[member.consumptionType]}</span>
            </div>
            <div className="profile-chips">
              <Chip tone={st.tone}>Membresía · {st.label}</Chip>
              <Chip tone={verification.tone}>Verificación · {verification.label}</Chip>
              <Chip tone={issue.tone}>{issue.label}</Chip>
              {member.consentSignedAt ? <Chip tone="ok">Consentimiento firmado</Chip> : <Chip tone="warn">Sin consentimiento</Chip>}
              {minor ? <Chip tone="warn">Menor de {limits.edadLimiteMenor}: tope reducido</Chip> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" style={{ justifyContent: "flex-end" }}>
            {canRetire ? <Link className="btn" href={`/dispensario?socio=${member.id}`}><Scale aria-hidden />Entregar</Link> : null}
          </div>
        </div>
        {member.statusReason && member.status !== "ACTIVO" ? (
          <div style={{ padding: "0 20px 18px" }}><Note tone={member.status === "BAJA" ? undefined : "warn"}>Motivo: {member.statusReason}</Note></div>
        ) : null}
      </div>

    <div className="legajo-grid">
      <LegajoNav id={id} role={session.role} />
      <div className="legajo-contenido">{children}</div>
    </div>
  </>;
}
