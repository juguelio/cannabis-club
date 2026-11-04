import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { GuiaReprocann } from "@/components/guia-reprocann";

export const metadata = { title: "Tu REPROCANN" };
export const dynamic = "force-dynamic";

/**
 * La guía dentro del portal: el socio llega desde el wizard de entrada o desde el atajo del inicio.
 * El contenido es el mismo que el del sitio público (`/reprocann`); acá cambia sólo el «volver».
 */
export default async function GuiaReprocannPortalPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  return <GuiaReprocann volver={{ href: "/portal", label: "Volver al portal" }} />;
}
