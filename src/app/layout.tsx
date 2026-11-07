import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/montserrat";
import "@fontsource/unifrakturmaguntia/400.css";
import "./globals.css";
import { getAnySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrandView } from "@/lib/brand-db";
import { themeCss } from "@/lib/brand";
import { MemberShell, Shell } from "@/components/shell";
import type { BrandMarkInfo } from "@/components/brand-mark";
import { WebVitals } from "@/components/web-vitals";
import { addDaysKey, dayKeyOf, slotInstant } from "@/lib/appointments";

export async function generateMetadata(): Promise<Metadata> {
  const view = await getBrandView();
  return {
    // Sin `metadataBase`, Next emite OG y canonical relativos y los buscadores los ignoran.
    metadataBase: new URL(process.env.APP_BASE_URL ?? "https://republicacannabis.com.ar"),
    title: { default: `${view.nombre} · gestión del club`, template: `%s · ${view.nombre}` },
    description: "Padrón de socios, stock y registro de entregas para asociaciones de cultivo.",
    // La consola del club no se indexa. El sitio público sí: lo habilita su propio `generateMetadata`.
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { brand } = await getBrandView();
  return { themeColor: brand.colores.oscuro, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, view, hdrs] = await Promise.all([getAnySession(), getBrandView(), headers()]);
  const mark: BrandMarkInfo = { logo: view.img.logo, sigla: view.sigla, placa: view.brand.logoPlaca };
  const html = (body: React.ReactNode) => (
    <html lang="es-AR" data-estilo={view.brand.estilo} data-gotico={view.brand.nombreGotico ? "" : undefined}>
      <head>
        {/* Tema del club: variables CSS derivadas de su marca (vacío si usa la paleta por defecto). */}
        <style id="club-theme" dangerouslySetInnerHTML={{ __html: themeCss(view.brand) }} />
      </head>
      <body>
        {body}
        <WebVitals />
      </body>
    </html>
  );

  // Sin sesión, o en páginas que van sin shell (el sitio público), solo el tema.
  if (!session || hdrs.get("x-cc-bare") === "1") return html(children);

  if (session.role === "SOCIO") {
    return html(<MemberShell clubName={view.nombre} mark={mark} userName={session.name}>{children}</MemberShell>);
  }

  if (session.mustChangePassword) return html(children);

  const today = dayKeyOf(new Date());
  const [club, pendingPickups, todayAppointments] = await Promise.all([
    prisma.club.findUnique({ where: { id: "singleton" }, select: { cuit: true, directorMedico: true, responsableTecnico: true } }),
    prisma.pickupRequest.count({ where: { status: { in: ["SOLICITADA", "CONFIRMADA"] } } }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: slotInstant(today, 0), lt: slotInstant(addDaysKey(today, 1), 0) }, status: { in: ["PENDIENTE", "CONFIRMADO"] } },
    }),
  ]);

  return html(
    <Shell
      clubName={view.nombre}
      mark={mark}
      userName={session.name}
      userRole={session.role}
      clubConfigured={Boolean(club?.cuit && club?.directorMedico && club?.responsableTecnico)}
      pendingPickups={pendingPickups}
      todayAppointments={todayAppointments}
    >
      {children}
    </Shell>,
  );
}
