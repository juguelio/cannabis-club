import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { getAnySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MemberShell, Shell } from "@/components/shell";
import { addDaysKey, dayKeyOf, slotInstant } from "@/lib/appointments";

export const metadata: Metadata = {
  title: { default: "Club de cultivo", template: "%s · Club de cultivo" },
  description: "Padrón de socios, stock y registro de entregas para asociaciones de cultivo.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#10231b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAnySession();

  if (!session) {
    return (
      <html lang="es-AR">
        <body>{children}</body>
      </html>
    );
  }

  const club = await prisma.club.findUnique({ where: { id: "singleton" } });
  const clubName = club?.nombre ?? "Club de cultivo";

  if (session.role === "SOCIO") {
    return (
      <html lang="es-AR">
        <body>
          <MemberShell clubName={clubName} userName={session.name}>{children}</MemberShell>
        </body>
      </html>
    );
  }

  const today = dayKeyOf(new Date());
  const [pendingPickups, todayAppointments] = await Promise.all([
    prisma.pickupRequest.count({ where: { status: { in: ["SOLICITADA", "CONFIRMADA"] } } }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: slotInstant(today, 0), lt: slotInstant(addDaysKey(today, 1), 0) }, status: { in: ["PENDIENTE", "CONFIRMADO"] } },
    }),
  ]);

  return (
    <html lang="es-AR">
      <body>
        <Shell
          clubName={clubName}
          userName={session.name}
          userRole={session.role}
          clubConfigured={Boolean(club?.cuit && club?.directorMedico && club?.responsableTecnico)}
          pendingPickups={pendingPickups}
          todayAppointments={todayAppointments}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
