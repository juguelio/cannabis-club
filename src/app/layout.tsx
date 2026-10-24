import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/forms";

export const metadata: Metadata = {
  title: "Club de cultivo — gestión",
  description: "Padrón de socios, stock y registro de entregas para asociaciones de cultivo.",
};

const NAV = [
  ["/", "Panel"],
  ["/socios", "Socios"],
  ["/stock", "Stock"],
  ["/dispensario", "Dispensario"],
  ["/reportes", "Reportes"],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="es">
      <body className="min-h-screen">
        {session ? (
          <header className="border-b" style={{ borderColor: "var(--line)" }}>
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
              <span className="font-semibold tracking-tight">🌱 Club</span>
              <nav className="flex gap-4 text-sm muted">
                {NAV.map(([href, label]) => (
                  <a key={href} href={href} className="hover:text-white">
                    {label}
                  </a>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="muted">
                  {session.name} · {session.role}
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
