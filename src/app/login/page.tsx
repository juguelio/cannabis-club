import { redirect } from "next/navigation";
import { getAnySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/forms";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const session = await getAnySession();
  if (session) redirect(session.role === "SOCIO" ? "/portal" : "/");
  const club = await prisma.club.findUnique({ where: { id: "singleton" }, select: { nombre: true } }).catch(() => null);

  return (
    <div className="auth">
      <section className="auth-side">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 650, color: "#fff", fontSize: 16 }}>{club?.nombre ?? "Club de cultivo"}</div>
        <div style={{ margin: "48px 0" }}>
          <h1>Cada gramo, con nombre y fecha.</h1>
          <p>
            Padrón, cultivo y entregas del club en un solo registro. Cada entrega se valida contra el REPROCANN del socio y
            los topes que fija el club; corregir es un contra-asiento, nunca un borrado.
          </p>
        </div>
        <p className="auth-foot" style={{ fontSize: 13, margin: 0 }}>Datos de salud tratados con consentimiento informado y conservados 5 años.</p>
        <svg className="auth-ledger" viewBox="0 0 380 210" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(0 ${i * 42})`} opacity={1 - i * 0.17}>
              <rect width="380" height="34" rx="8" fill="#17342a" />
              <rect x="14" y="13" width="34" height="8" rx="4" fill="#3d6a57" />
              <rect x="62" y="13" width={[120, 96, 140, 108, 88][i]} height="8" rx="4" fill="#2f5546" />
              <rect x="300" y="11" width="62" height="12" rx="6" fill={i === 0 ? "#b99cf0" : "#2f5546"} />
            </g>
          ))}
        </svg>
      </section>
      <main className="auth-main">
        <div className="auth-card">
          <h2>Ingresar</h2>
          <p className="muted" style={{ margin: "0 0 22px", fontSize: 14.5 }}>Equipo del club y socios con acceso al portal.</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
