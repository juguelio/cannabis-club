import { redirect } from "next/navigation";
import { getAnySession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password";

export const metadata = { title: "Cambiar la clave" };
export const dynamic = "force-dynamic";

export default async function StaffPasswordPage() {
  const session = await getAnySession();
  if (!session) redirect("/login");
  if (session.role === "SOCIO") redirect("/portal/clave");
  return (
    <main className="member-main" style={{ maxWidth: 460, margin: "0 auto", padding: "36px 18px 60px" }}>
      <h1>Elegí tu clave</h1>
      <p>La clave que te dio administración es temporal. Cambiala antes de continuar.</p>
      <ChangePasswordForm redirectTo="/" />
      <form action="/api/auth/logout" method="post"><button className="btn btn-quiet">Cerrar sesión</button></form>
    </main>
  );
}
