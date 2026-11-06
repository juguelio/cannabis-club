import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portalOverview } from "@/lib/pickups";
import { PortalHeader } from "@/components/portal-header";

export const dynamic = "force-dynamic";

/**
 * El portal tiene navegación arriba en todas sus pantallas —catálogo, basket, envíos, datos—, no sólo
 * en la primera. El layout es el lugar donde eso se cumple una vez y no se olvida en la próxima ruta.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getMemberSession();
  if (!session) return <>{children}</>;

  const [member, overview] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: { firstName: true, locality: true, province: true, postalCode: true },
    }),
    portalOverview(session.memberId).catch(() => null),
  ]);

  return (
    <>
      <PortalHeader
        nombre={member?.firstName ?? "socio"}
        localidad={member?.locality ?? null}
        cp={member?.postalCode ?? null}
        tope={overview?.tope ?? 0}
        activos={overview?.pickupTotals?.activos ?? 0}
      />
      {children}
    </>
  );
}
