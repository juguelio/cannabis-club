import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MemberForm } from "@/components/forms";

export default async function NuevoSocio() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Alta de socio</h1>
      <p className="muted text-sm">
        El legajo se asigna solo. La identidad se compone de DNI + REPROCANN: sin REPROCANN vigente el dispensario rechaza la entrega.
      </p>
      <MemberForm />
    </div>
  );
}
