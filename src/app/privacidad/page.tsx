import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";
import { CONSENT_PURPOSES, CONSENT_TEXTS, CONSENT_VERSION } from "@/lib/privacy";

export const metadata = {
  title: "Privacidad",
  description: "Qué datos trata el club, para qué, cuánto tiempo los conserva y cómo pedir acceso, corrección o baja.",
};

/**
 * Política de privacidad pública: describe lo que la app hace de verdad
 * (finalidades, retención y derechos salen del mismo código que firma los consentimientos).
 * El texto legal definitivo lo aprueba la comisión directiva del club.
 */
export default async function PrivacidadPage() {
  const view = await getBrandView();
  const textos = CONSENT_TEXTS[CONSENT_VERSION];
  const propositos = Object.keys(CONSENT_PURPOSES) as (keyof typeof CONSENT_PURPOSES)[];

  return (
    <main className="wrap" style={{ padding: "56px 20px 80px", maxWidth: 760, margin: "0 auto" }}>
      <p style={{ margin: 0 }}>
        <Link href="/sitio" className="muted">
          ← {view.nombre}
        </Link>
      </p>
      <h1 style={{ margin: "14px 0 6px" }}>Privacidad y datos personales</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {view.nombreLegal} · versión de consentimiento {CONSENT_VERSION}
      </p>

      <h2>Quién trata los datos</h2>
      <p>
        {view.nombreLegal}, asociación civil de cultivo sin fines de lucro. Los datos se tratan dentro del club, con acceso
        restringido según el rol de cada persona del equipo: administración, operación del dispensario y
        acompañamiento profesional.
      </p>

      <h2>Qué datos se tratan y para qué</h2>
      <p>El club pide consentimiento por separado para cada finalidad. Esto es exactamente lo que autoriza cada una:</p>
      <ul>
        {propositos.map((p) => (
          <li key={p} style={{ marginBottom: 10 }}>
            <b>{CONSENT_PURPOSES[p].label}.</b> {textos[p]}
          </li>
        ))}
      </ul>
      <p className="muted">
        Podés rechazar cualquier finalidad y el resto sigue funcionando; el club te va a explicar qué servicio queda
        limitado en ese caso.
      </p>

      <h2>Qué NO se guarda</h2>
      <ul>
        <li>
          <b>El número de documento no se almacena.</b> Para acreditar identidad se guarda una huella irreversible
          (hash) y los últimos cuatro dígitos; alcanza para verificar y no permite reconstruir el número.
        </li>
        <li>No se guardan imágenes del documento ni de la credencial REPROCANN dentro de la aplicación.</li>
        <li>No se usan los datos para publicidad ni se venden ni se ceden a terceros.</li>
      </ul>

      <h2>Cuánto tiempo</h2>
      <p>
        El registro de socios, entregas y libros se conserva mientras la persona sea socia y después durante los plazos
        que exige la normativa aplicable (hoy: 5 años). Los consentimientos quedan guardados con su fecha y su texto,
        porque son la prueba de qué autorizaste y cuándo.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir <b>acceso</b> a tus datos, su <b>rectificación</b>, la <b>actualización</b> y —cuando corresponda—
        la <b>supresión</b>, además de retirar un consentimiento en cualquier momento. La Ley 25.326 autoriza a
        presentar un reclamo ante la Agencia de Acceso a la Información Pública.
      </p>
      <p>
        El club responde por los canales que figuran en la portada. Cada consulta queda registrada para poder
        contestarla y, si hay una corrección, se hace como un asiento nuevo: el registro no se borra.
      </p>

      <h2>Ingreso con Google</h2>
      <p>
        Si elegís entrar con tu cuenta de Google, el club recibe únicamente tu dirección de correo verificada y tu
        nombre, para identificarte. No se pide acceso a contactos, correo ni archivos. Si el correo no figura en el
        padrón, la cuenta queda <b>pendiente</b> y no se habilita hasta que el club la apruebe.
      </p>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Texto pendiente de aprobación formal por la comisión directiva.{" "}
        <Link href="/sitio">Volver a la portada</Link>
      </p>
    </main>
  );
}
