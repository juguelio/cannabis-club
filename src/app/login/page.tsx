import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/forms";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
      <div className="hidden md:flex flex-col justify-between p-10" style={{ background: "var(--brand)", color: "#ecfdf5" }}>
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span style={{ fontSize: 20 }}>🌿</span> Club de cultivo
        </div>
        <div>
          <p className="text-[26px] leading-tight font-semibold" style={{ letterSpacing: "-0.01em" }}>
            Padrón, stock y registro de entregas en un solo libro.
          </p>
          <p className="mt-3 text-[13.5px]" style={{ color: "#c7e5d3" }}>
            Cada entrega se valida contra el estado del socio, su REPROCANN y los topes del club. Corregir es un
            contra-asiento, nunca un borrado.
          </p>
        </div>
        <p className="text-[11.5px]" style={{ color: "#9dc7ae" }}>
          Los datos de salud se tratan con consentimiento y retención de 5 años.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <LoginForm />
      </div>
    </div>
  );
}
