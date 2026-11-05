import { redirect } from "next/navigation";
import Link from "next/link";
import { getMemberSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MisDatos } from "@/components/mis-datos";

export const metadata = { title: "Mis datos" };
export const dynamic = "force-dynamic";

/**
 * El domicilio y el teléfono del socio, editables por él.
 *
 * Antes, el portal le decía «completalos en Validá tus datos» a un socio ya verificado —y esa
 * pantalla no existe para él—, así que el que tenía el código postal vacío no podía pedir un envío
 * ni tenía forma de arreglarlo sin escribirle a la secretaría.
 */
export default async function MisDatosPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: { address: true, locality: true, province: true, postalCode: true, phone: true },
  });
  if (!member) redirect("/portal");

  return (
    <main className="stack" style={{ gap: 18, paddingBottom: 40 }}>
      <nav className="cell-meta">
        <Link href="/portal">← Volver al portal</Link>
      </nav>
      <MisDatos inicial={member} volverHref="/portal" />
    </main>
  );
}
