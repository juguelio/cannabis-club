import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";
import { CONSENT_PURPOSES, CONSENT_TEXTS, CONSENT_VERSION } from "@/lib/privacy";

export const metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos personales y de salud trata República Cannabis, con qué finalidad, cuánto tiempo los conserva y cómo pedir acceso, corrección o baja. Ley 25.326.",
  // La consola no se indexa; esta página sí, porque es la que respalda el tratamiento de datos.
  robots: { index: true, follow: true },
  alternates: { canonical: "https://republicacannabis.com.ar/privacidad" },
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
        <li>No se usan los datos para publicidad, no se venden y no se ceden a terceros ajenos al club.</li>
      </ul>

      <h2>Los documentos del legajo y los comprobantes</h2>
      <p>
        Para validar el legajo, el club pide la foto del documento (frente y dorso) y de la credencial del REPROCANN.
        Esos archivos se guardan <b>cifrados</b> en la base del club, no en un servicio de archivos de terceros: sólo
        los abre el personal autorizado, desde la consola y con su usuario, y <b>cada apertura queda registrada</b> en
        la auditoría con fecha, persona y motivo. Los comprobantes de transferencia que subís por el portal se guardan
        con el mismo cifrado y la misma regla de acceso.
      </p>
      <p className="muted">
        Se conservan mientras el legajo esté activo y durante el plazo legal que exige la normativa; cuando el legajo
        se da de baja, el club elimina los archivos y conserva sólo el registro de que existieron y quién los consultó.
      </p>

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

      <h2 id="cookies">Cookies y almacenamiento del navegador</h2>
      <p>
        El sitio del club <b>no usa cookies de publicidad ni de analítica</b>, y no hay rastreadores de terceros. Las
        únicas cookies son técnicas y las pone el propio sitio para que la sesión funcione:
      </p>
      <ul>
        <li>
          <b><code>cc_session</code></b> — mantiene la sesión abierta en la consola y en el portal del socio. Es
          httpOnly, no se puede leer desde el navegador y dura 8 horas.
        </li>
        <li>
          <b><code>cc_solicitud</code></b> — recuerda una solicitud de ingreso a medio completar, mientras subís la
          documentación. Dura unas horas y se borra al aprobarse la solicitud.
        </li>
      </ul>
      <p>
        Sin esas cookies no se puede iniciar sesión, así que no hay un interruptor para apagarlas por separado. Si
        alguna vez el club suma una medición de visitas, esta página lo va a decir antes de activarla, con la opción de
        rechazarla.
      </p>

      <h2>Quiénes intervienen en el tratamiento</h2>
      <p>
        El club no vende datos ni los cede. Para que la app funcione hay proveedores que sólo procesan información por
        cuenta del club: <b>Vercel</b> (alojamiento del sitio), <b>Neon</b> (base de datos), <b>Google</b> (sólo si
        elegís ingresar con tu cuenta) y <b>WhatsApp/Meta</b> (si nos escribís por ese canal, con sus propias
        condiciones). Los documentos y comprobantes están cifrados con una clave que administra el club, de modo que la
        base por sí sola no los muestra.
      </p>

      <h2>Cómo ejercer tus derechos</h2>
      <p>
        Escribinos por WhatsApp al número que figura en la portada, o pedilo desde el portal del socio. El club
        responde dentro de los diez (10) días corridos que fija la Ley 25.326, y deja registrado el pedido y la
        respuesta.
      </p>

      <h2>Ingreso con Google</h2>
      <p>
        Si elegís entrar con tu cuenta de Google, el club recibe únicamente tu dirección de correo verificada y tu
        nombre, para identificarte. No se pide acceso a contactos, correo ni archivos. Si el correo no figura en el
        padrón, la cuenta queda <b>pendiente</b> y no se habilita hasta que el club la apruebe.
      </p>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Texto pendiente de aprobación formal por la comisión directiva.{" "}
        <Link href="/terminos">Términos y Condiciones</Link> · <Link href="/sitio">Volver a la portada</Link>
      </p>
    </main>
  );
}
