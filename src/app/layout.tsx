import type { Metadata } from "next";
import "./globals.css";
import { getAnySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MemberShell, Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: "Club de cultivo — gestión",
  description: "Padrón de socios, stock y registro de entregas para asociaciones de cultivo.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAnySession();
  const club = session ? await prisma.club.findUnique({ where: { id: "singleton" } }) : null;

  if (!session) {
    return (
      <html lang="es">
        <body>
          <main>{children}</main>
        </body>
      </html>
    );
  }

  const isMember = session.role === "SOCIO";

  return (
    <html lang="es">
      <body>
        {isMember ? (
          <MemberShell clubName={club?.nombre ?? "Club de cultivo"} userName={session.name}>
            {children}
          </MemberShell>
        ) : (
          <Shell
            clubName={club?.nombre ?? "Club de cultivo"}
            userName={session.name}
            userRole={session.role}
            clubConfigured={Boolean(club?.cuit && club?.directorMedico && club?.responsableTecnico)}
          >
            {children}
          </Shell>
        )}
      </body>
    </html>
  );
}
