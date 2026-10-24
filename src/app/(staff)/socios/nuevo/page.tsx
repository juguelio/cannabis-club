import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MemberForm } from "@/components/forms";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Nuevo socio" };

export default async function NuevoSocio() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div style={{ maxWidth: 880 }}>
      <PageHead
        back={{ href: "/socios", label: "Socios" }}
        title="Alta de socio"
        subtitle="Lo que no tengas a mano se completa después desde el legajo. Para retirar, el socio necesita estar activo y con REPROCANN vigente."
      />
      <MemberForm />
    </div>
  );
}
