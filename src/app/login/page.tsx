import { redirect } from "next/navigation";
import { getAnySession } from "@/lib/auth";
import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/forms";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const session = await getAnySession();
  if (session) redirect(session.role === "SOCIO" ? "/portal" : "/");
  const view = await getBrandView();

  return (
    <div className="auth">
      <section className="auth-side">
        {view.img.portada ? <div className="auth-portada" style={{ backgroundImage: `url(${view.img.portada})` }} aria-hidden /> : null}
        <div className="flex items-center gap-3">
          <BrandMark info={{ logo: view.img.logo, sigla: view.sigla, placa: view.brand.logoPlaca }} size="lg" />
          <div>
            <div className="auth-club wordmark">{view.nombre}</div>
            {view.brand.lema ? <div style={{ fontSize: 13.5, color: "var(--on-dark-3)", marginTop: 2 }}>{view.brand.lema}</div> : null}
          </div>
        </div>
        <div style={{ margin: "48px 0" }}>
          <h1>Cada gramo, con nombre y fecha.</h1>
          <p>
            Padrón, cultivo y entregas del club en un solo registro. Cada entrega se valida contra el REPROCANN del socio y
            los topes que fija el club; corregir es un contra-asiento, nunca un borrado.
          </p>
        </div>
        <p className="auth-foot" style={{ fontSize: 13, margin: 0 }}>
          Datos de salud tratados con consentimiento informado y conservados 5 años.
          {view.brand.sitio.publico ? <> · <Link href="/sitio" style={{ color: "var(--on-dark-2)" }}>Conocé el club</Link></> : null}
        </p>
        <svg className="auth-ledger" viewBox="0 0 380 210" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(0 ${i * 42})`} opacity={1 - i * 0.17}>
              <rect width="380" height="34" rx="8" fill="var(--pine-2)" />
              <rect x="14" y="13" width="34" height="8" rx="4" fill="var(--dark-line-2)" />
              <rect x="62" y="13" width={[120, 96, 140, 108, 88][i]} height="8" rx="4" fill="var(--dark-line)" />
              <rect x="300" y="11" width="62" height="12" rx="6" fill={i === 0 ? "var(--accent-on-dark)" : "var(--dark-line)"} />
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
