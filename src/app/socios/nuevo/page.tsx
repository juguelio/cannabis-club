import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MemberForm } from "@/components/forms";
import { PageHead, Section } from "@/components/ui";

export default async function NuevoSocio() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <>
      <PageHead
        title="Alta de socio"
        subtitle="La identidad se compone de DNI + REPROCANN: sin REPROCANN vigente el dispensario rechaza la entrega."
        actions={<Link className="btn btn-secondary" href="/socios">Volver al padrón</Link>}
      />
      <Section title="Datos del socio" subtitle="Lo que no sepas ahora se completa después; el alta queda auditada igual">
        <div className="px-4 pb-4">
          <MemberForm />
        </div>
      </Section>
    </>
  );
}
