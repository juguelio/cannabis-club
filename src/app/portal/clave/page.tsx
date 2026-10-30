import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password";

export const metadata = { title: "Cambiar la clave" };
export const dynamic = "force-dynamic";

/** Primera vez en el portal: la clave que dictó el mostrador es temporal y hay que cambiarla. */
export default async function ChangePasswordPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect("/portal");

  return (
    <main className="member-main" style={{ maxWidth: 460, margin: "0 auto", padding: "36px 18px 60px" }}>
      <p className="panel-sub" style={{ margin: 0 }}>Primer ingreso</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: "-.02em", margin: "6px 0 8px" }}>Elegí tu clave</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        La clave que te dio el club es temporal: vence a los 3 días y tenés que reemplazarla antes de continuar. Elegí una que puedas recordar.
      </p>
      <ChangePasswordForm />
    </main>
  );
}
