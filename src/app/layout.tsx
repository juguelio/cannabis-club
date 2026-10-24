import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: "Club de cultivo — gestión",
  description: "Padrón de socios, stock y registro de entregas para asociaciones de cultivo.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const club = session ? await prisma.club.findUnique({ where: { id: "singleton" } }) : null;

  return (
    <html lang="es">
      <body>
        {session ? (
          <Shell
            clubName={club?.nombre ?? "Club de cultivo"}
            userName={session.name}
            userRole={session.role}
            clubConfigured={Boolean(club?.cuit && club?.directorMedico && club?.responsableTecnico)}
          >
            {children}
          </Shell>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
