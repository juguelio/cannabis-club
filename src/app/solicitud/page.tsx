import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBrandView } from "@/lib/brand-db";
import { leerSesionSolicitud } from "@/lib/onboarding";
import { SolicitudForm, type EstadoSolicitud } from "@/components/solicitud-form";

export const metadata = { title: "Solicitud de alta" };

/**
 * Onboarding del socio: la persona ya entró con Google (cookie `cc_solicitud`) pero
 * todavía no tiene legajo. Acá completa sus datos y sube la documentación; el club
 * decide. Si la cuenta ya está activa, va derecho al portal.
 */
export default async function SolicitudPage() {
  const userId = await leerSesionSolicitud();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, active: true } });
  if (!user) redirect("/login");
  if (user.active) redirect("/portal");

  // Si el email de la cuenta ya está en el padrón (los socios que vinieron de la planilla) no se crea
  // otro legajo: se reclama el que existe. El club sigue decidiendo; esto sólo evita el duplicado.
  const [club, solicitud, padron] = await Promise.all([
    getBrandView(),
    prisma.accessRequest.findUnique({
      where: { userId },
      select: {
        status: true, firstName: true, lastName: true, reprocannNumber: true, rejectionReason: true, submittedAt: true,
        documents: { select: { id: true, tipo: true, mime: true, size: true } },
      },
    }),
    prisma.member.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" }, user: { is: null } },
      select: {
        legajo: true, firstName: true, lastName: true, phone: true, address: true,
        locality: true, province: true, postalCode: true, verificationStatus: true,
      },
    }),
  ]);

  const estado: EstadoSolicitud | null = solicitud
    ? {
        status: solicitud.status,
        firstName: solicitud.firstName,
        lastName: solicitud.lastName,
        reprocannNumber: solicitud.reprocannNumber,
        rejectionReason: solicitud.rejectionReason,
        submittedAt: solicitud.submittedAt.toISOString(),
        documents: solicitud.documents,
      }
    : null;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 80px" }}>
      <header className="stack" style={{ marginBottom: 20 }}>
        <p className="muted" style={{ margin: 0 }}>
          {club.nombre} · alta de socios
        </p>
        <h1 style={{ margin: 0 }}>{padron ? "Activá tu acceso" : "Solicitud de alta"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {padron
            ? `Ya estás en el padrón del club como ${padron.firstName} ${padron.lastName} (legajo ${padron.legajo}). Confirmá tus datos y subí la documentación: el club lo revisa una vez y tu cuenta queda habilitada con el mismo ingreso de Google.`
            : "Tres pasos: tus datos, la documentación y la revisión del club. Cuando el club apruebe, tu cuenta queda habilitada con el mismo ingreso de Google."}
        </p>
      </header>

      <SolicitudForm email={user.email} solicitud={estado} club={club.nombre} padron={padron} />

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        ¿No sos vos? <Link href="/login">Entrá con otra cuenta</Link>. Tus datos se tratan según la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </main>
  );
}
