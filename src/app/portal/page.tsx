import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portalOverview } from "@/lib/pickups";
import { recalledBatchesForMember } from "@/lib/batch-quality";
import QRCode from "qrcode";
import Link from "next/link";
import { ArrowRight, MapPin, PackageCheck, Stethoscope, Truck } from "lucide-react";
import { WizardReprocann } from "@/components/wizard-reprocann";
import { POR_QUE_LA_GUIA, pantallaDeEntrada } from "@/lib/reprocann-entrada";
import { MemberPortal } from "@/components/member-portal";
import { VerificacionPanel } from "@/components/verificacion-panel";
import { PageHead } from "@/components/ui";
import { verificacionDelSocio } from "@/lib/verificacion";
import { estadoVerificacion } from "@/lib/verificacion-rules";
import { catalogoDelClub } from "@/lib/variedades";

export const metadata = { title: "Mi portal" };

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/portal/clave");

  // Un legajo sin DNI y REPROCANN validados empieza por el trámite: sin eso no puede pedir, y el
  // servidor se lo va a rechazar igual. Se le muestra el formulario, no una pantalla vacía.
  const verificacion = await verificacionDelSocio(session.memberId);
  const pantalla = pantallaDeEntrada({
    verificacion: verificacion.member.verificationStatus,
    declaracion: verificacion.member.reprocannDeclaracion,
  });

  // Paso 1: la pregunta. Sin saber si tiene REPROCANN no se le puede pedir nada, y pedirle el DNI a
  // alguien que todavía no hizo el trámite es mandarlo a un formulario que no puede completar.
  if (pantalla === "preguntar") {
    return (
      <>
        <PageHead
          title="Empecemos por tu REPROCANN"
          subtitle="Una pregunta para empezar: según lo que respondas te mostramos lo que sigue. Si todavía no lo tenés, no es un problema."
        />
        <WizardReprocann inicial={null} />
      </>
    );
  }

  // Paso 2 (camino sin REPROCANN): la guía es la pantalla, no un link escondido al final.
  if (pantalla === "guia") {
    return (
      <>
        <PageHead title="Tu REPROCANN" subtitle={POR_QUE_LA_GUIA} />
        <WizardReprocann inicial="NO_TIENE" />
        <section className="member-shortcut-reprocann member-cta-guia">
          <span className="wiz-paso">Paso 2</span>
          <Stethoscope aria-hidden size={20} />
          <span>
            <b>Cómo sacarlo, paso a paso</b>
            <small>Turno médico, carga del trámite, por qué se traba y qué hacer en cada caso</small>
          </span>
          <Link href="/portal/reprocann" className="btn btn-sm">
            Ver la guía
          </Link>
        </section>
        <p className="member-guia-pie">
          Cuando lo tengas, volvés acá, elegís «Sí, ya lo tengo» y subís el DNI y la credencial: el club revisa y
          habilita el retiro.
        </p>
      </>
    );
  }

  if (pantalla === "validar") {
    const estado = estadoVerificacion(verificacion.member.verificationStatus);
    return (
      <>
        <PageHead
          title="Validá tus datos"
          subtitle="Una vez por legajo: tu DNI y tu REPROCANN. Sin eso no se puede pedir ni retirar, por más que tu ficha exista."
        />
        <WizardReprocann inicial="TIENE" />
        <VerificacionPanel
          inicial={{
            estado: verificacion.member.verificationStatus,
            label: estado.label,
            detalle: estado.detalle,
            motivoRechazo: verificacion.ultima?.rejectionReason ?? null,
            presentacion: verificacion.ultima
              ? {
                  id: verificacion.ultima.id,
                  enviada: verificacion.ultima.submittedAt.toISOString(),
                  documentos: verificacion.ultima.documents.map((d) => ({
                    id: d.id,
                    tipo: d.tipo,
                    size: d.size,
                    subido: d.uploadedAt.toISOString(),
                  })),
                }
              : null,
            faltan: verificacion.faltan,
            faltantesTexto: verificacion.faltantesTexto,
            legajo: {
              numero: verificacion.member.legajo,
              docLast4: verificacion.member.docLast4,
              venceReprocann: verificacion.member.reprocannExpiresAt
                ? verificacion.member.reprocannExpiresAt.toISOString().slice(0, 10)
                : null,
            },
          }}
        />
      </>
    );
  }

  const [overview, deliveries, recalled, variedades] = await Promise.all([
    portalOverview(session.memberId),
    prisma.dispensation.findMany({
      where: { memberId: session.memberId },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { id: true, occurredAt: true, grams: true, voidedAt: true, batch: { select: { code: true, strain: { select: { name: true } } } } },
    }),
    recalledBatchesForMember(session.memberId),
    catalogoDelClub(),
  ]);
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const qr = await QRCode.toString(`${base}/dispensario?socio=${session.memberId}`, { type: "svg", margin: 0, color: { dark: "#10231b", light: "#ffffff" } });

  return (
    <>
      <Link href="/portal#mis-pedidos" className="member-shortcut-datos">
        <PackageCheck aria-hidden size={18} />
        <span>
          <b>Mis pedidos</b>
          <small>Retiros y envíos, con su estado y su fecha.</small>
        </span>
      </Link>

      <Link href="/portal/envios" className="member-shortcut-datos">
        <Truck aria-hidden size={18} />
        <span>
          <b>Envíos</b>
          <small>Zonas, costos, demora y mínimo — antes de armar el pedido.</small>
        </span>
      </Link>

      <Link href="/portal/datos" className="member-shortcut-datos">
        <MapPin aria-hidden size={18} />
        <span>
          <b>Mis datos</b>
          <small>Domicilio, código postal y teléfono — lo que hace falta para un envío.</small>
        </span>
      </Link>

      <Link href="/portal/reprocann" className="member-shortcut-reprocann">
        <Stethoscope aria-hidden size={18} />
        <span>
          <b>¿Necesitás tu REPROCANN?</b>
          <small>Cómo sacarlo, cuánto tarda y por qué no avanza</small>
        </span>
        <ArrowRight aria-hidden size={18} />
      </Link>
      <MemberPortal
        initial={overview}
        recalled={recalled}
        qr={qr}
        history={deliveries.map((d) => ({ id: d.id, at: d.occurredAt.toISOString(), grams: Number(d.grams), strain: d.batch.strain.name, batch: d.batch.code, voided: Boolean(d.voidedAt) }))}
        variedades={variedades}
      />
    </>
  );
}
