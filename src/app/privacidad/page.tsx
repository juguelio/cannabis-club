import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";
import { CONSENT_PURPOSES, CONSENT_TEXTS, CONSENT_VERSION } from "@/lib/privacy";

export const metadata = {
  title: "Política de privacidad",
  description: "Datos del legajo, documentos, pagos, proveedores y derechos de las personas socias de República Cannabis. Ley 25.326.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://republicacannabis.com.ar/privacidad" },
};

const VERSION = "2026-11-03 · revisión 2";

export default async function PrivacidadPage() {
  const view = await getBrandView();
  const textos = CONSENT_TEXTS[CONSENT_VERSION];
  const propositos = Object.keys(CONSENT_PURPOSES) as (keyof typeof CONSENT_PURPOSES)[];
  const { email, whatsapp } = view.brand.contacto;

  return (
    <main className="wrap" style={{ padding: "56px 20px 80px", maxWidth: 760, margin: "0 auto" }}>
      <p style={{ margin: 0 }}><Link href="/sitio" className="muted">← {view.nombre}</Link></p>
      <h1 style={{ margin: "14px 0 6px" }}>Privacidad y datos personales</h1>
      <p className="muted">Versión de esta política: {VERSION}. Consentimientos registrados: {CONSENT_VERSION}.</p>
      <p>Esta política explica qué información recibe el club cuando consultás, solicitás el alta o usás el portal.
        Leerla o usar el sitio no equivale a autorizar publicidad, uso de tu imagen ni cualquier tratamiento de salud.</p>

      <h2>1. Responsable y contacto</h2>
      <p><b>{view.nombreLegal}</b>{view.cuit ? `, CUIT ${view.cuit}` : ""}, es responsable del tratamiento del
        padrón y de la gestión asociativa. Podés dirigir tus consultas y pedidos de derechos a los canales de contacto
        del final de esta página. Los proveedores tecnológicos no sustituyen al club como responsable.</p>
      {view.domicilioLegal ? <p>Domicilio legal: {view.domicilioLegal}.</p> :
        <p className="muted">Domicilio legal del responsable: pendiente de completar por el club.</p>}

      <h2>2. Datos que recibimos y para qué</h2>
      <ul>
        <li><b>Identidad y contacto:</b> nombre, fecha de nacimiento, documento, correo, teléfono y domicilio,
          para verificar identidad, tramitar el alta, evitar duplicados y gestionar el legajo.</li>
        <li><b>REPROCANN y vínculo:</b> número, estado, vencimiento, credencial, declaraciones y verificaciones,
          para revisar los requisitos de acceso y entrega. Esta información puede revelar datos de salud y requiere especial protección.</li>
        <li><b>Operación del club:</b> reservas, cantidades, lotes, entregas, dirección de envío, aportes,
          comprobantes de transferencia y sus revisiones, para coordinar pedidos, llevar la cuenta y conservar trazabilidad.</li>
        <li><b>Seguridad:</b> identificadores de cuenta, accesos y acciones, fechas y, en las operaciones que lo registran,
          dirección IP, para proteger las cuentas y auditar cambios.</li>
      </ul>
      <p>Los datos obligatorios se indican en cada trámite. Sin la información necesaria para identificarte y verificar
        tu habilitación no se puede completar el alta o la entrega. No envíes historias clínicas completas ni datos
        de terceros que el trámite no requiera. La consulta médica y su historia clínica tienen un responsable y
        deberes propios; el portal del club no reemplaza esa atención.</p>

      <h2>3. Documento, archivos y seguridad</h2>
      <p>En la ficha habitual del padrón se usa una huella del documento y sus últimos cuatro dígitos.
        <b> El número completo sí se conserva cifrado en los expedientes de alta y verificación</b>, junto con las
        imágenes del DNI y del REPROCANN que adjuntás. Los comprobantes de transferencia también se almacenan cifrados.
        La huella no vuelve anónimo el legajo ni elimina los datos de los archivos adjuntos.</p>
      <p>La aplicación limita el acceso por rol y registra las aperturas de documentación a través de sus rutas
        autorizadas. El cifrado protege los archivos almacenados, pero el personal autorizado puede leerlos para
        revisarlos. No implica que toda la base esté cifrada del mismo modo ni una garantía de seguridad absoluta.</p>

      <h2>4. Finalidades y consentimiento</h2>
      <p>El club debe informar el fundamento de cada tratamiento: consentimiento cuando corresponda, gestión del
        vínculo y obligaciones aplicables. Los datos de salud requieren además cumplir las reglas especiales de la
        Ley 25.326; una aceptación general de términos no reemplaza esos requisitos.</p>
      <p>El registro de consentimientos distingue estas finalidades. Los textos que identifica la versión
        {" "}{CONSENT_VERSION} son:</p>
      <ul>{propositos.map((p) => (
        <li key={p} style={{ marginBottom: 10 }}><b>{CONSENT_PURPOSES[p].label}.</b> {textos[p]}</li>
      ))}</ul>
      <p>El uso institucional de tu imagen debe autorizarse por separado; no es requisito para asociarte.
        Podés solicitar la revocación de un consentimiento, sin efecto retroactivo. El club debe explicar qué
        tratamiento cesa y qué información debe conservar por otro fundamento válido. Una nueva versión de esta
        política no modifica lo que quedó registrado como aceptado anteriormente.</p>
      <p>Los avisos de reservas, aportes y vencimientos son comunicaciones administrativas, no publicidad de terceros.
        Podés pedir revisar los canales de contacto y tus preferencias. No se venden datos ni se autoriza su uso
        publicitario por el solo hecho de presentar una solicitud.</p>

      <h2>5. Proveedores y destinatarios</h2>
      <ul>
        <li><b>Vercel y Neon:</b> alojamiento y base de datos de la aplicación; intervienen en el procesamiento
          técnico de la información del servicio.</li>
        <li><b>Resend:</b> proveedor de envío de correos que el club podrá usar cuando active los avisos por
          correo; recibe la dirección de destino y el contenido del mensaje. Hoy los avisos quedan registrados en el
          sistema y no se envían por correo. Un aviso de vencimiento del REPROCANN puede revelar tu vínculo con el club.</li>
        <li><b>Google:</b> si elegís ese ingreso, verifica tu cuenta. El club utiliza nombre, correo verificado e
          identificador de Google; no pide acceso a tus mensajes, contactos ni archivos.</li>
        <li><b>WhatsApp/Meta:</b> si usás ese canal, procesa la conversación según sus propias condiciones.
          Para documentación sensible, usá el trámite del portal en lugar de un chat.</li>
        <li><b>Transporte:</b> para coordinar un envío puede ser necesario comunicar identidad, contacto, destino
          y documentación exigible. Debe limitarse la información a lo necesario para esa operación.</li>
        <li><b>Autoridades y profesionales:</b> sólo cuando exista un fundamento legal, requerimiento válido o
          intervención profesional que corresponda, con las restricciones y confidencialidad aplicables.</li>
      </ul>
      <p>Google y Meta tienen también tratamientos propios: no corresponde presentarlos exclusivamente como
        encargados del club. Algunos servicios pueden procesar información fuera de Argentina. El club debe verificar
        países de destino, subproveedores y garantías aplicables antes de transferir datos; esta política no constituye
        una autorización genérica a transferencias internacionales.</p>

      <h2>6. Conservación y baja</h2>
      <p>La baja de la asociación no borra automáticamente el legajo. Se debe conservar sólo lo necesario para la
        finalidad vigente y las obligaciones que correspondan, y suprimir o disociar el resto. No se establece aquí
        un plazo universal de cinco años: cada categoría necesita un plazo y fundamento propios.</p>
      <p>La aplicación tiene una tarea para eliminar los archivos adjuntos de solicitudes de alta rechazadas una vez
        transcurridos 30 días desde su revisión. Su ejecución depende de la configuración operativa. Esa tarea no
        borra todo el expediente, el número cifrado, los archivos de verificaciones de socios ni los comprobantes
        de pago. No hay un borrado general automático al darse de baja.</p>
      <p>Podés pedir que el club revise qué conserva sobre vos y por qué. Si corresponde conservar un registro por una
        obligación, debe explicarlo y restringir su uso. La eliminación en copias de respaldo requiere considerar
        también su ciclo de conservación; no se promete una eliminación inmediata de todos los respaldos.</p>

      <h2>7. Acceso, corrección, supresión y reclamos</h2>
      <p>Podés solicitar acceso, rectificación, actualización y, cuando corresponda, supresión de tus datos, además
        de revocar consentimientos. Para evitar entregar información a otra persona, el club puede pedir una
        acreditación de identidad proporcionada al trámite.</p>
      <ul>
        <li><b>Acceso:</b> respuesta dentro de diez días corridos desde la solicitud fehaciente. Es gratuito a
          intervalos no inferiores a seis meses, y antes si acreditás un interés legítimo.</li>
        <li><b>Rectificación, actualización o supresión:</b> corresponde actuar en un máximo de cinco días hábiles
          desde el reclamo o desde que se advierta el error, según el artículo 16 de la Ley 25.326.</li>
      </ul>
      <p>Conservar la trazabilidad de un libro no impide corregir datos personales ni atender una supresión cuando
        corresponda. Si existe una obligación de conservación o derechos de terceros que impidan borrar una parte,
        el club debe explicar el motivo.</p>
      <p>La <a href="https://www.argentina.gob.ar/aaip">Agencia de Acceso a la Información Pública (AAIP)</a>,
        autoridad de control de la Ley 25.326, recibe denuncias y reclamos por incumplimientos de las normas de
        protección de datos personales. También podés consultar el
        {" "}<a href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/texto">texto de la ley</a>.</p>

      <h2 id="cookies">8. Cookies y navegador</h2>
      <p>La aplicación utiliza cookies técnicas para el acceso:</p>
      <ul>
        <li><code>cc_session</code>: sesión del portal o consola, hasta 8 horas.</li>
        <li><code>cc_solicitud</code>: acceso al trámite de alta, hasta 4 horas.</li>
        <li><code>cc_oauth</code>: verificación temporal del ingreso con Google, hasta 10 minutos.</li>
      </ul>
      <p>Son httpOnly: los scripts de la página no pueden leerlas, aunque el navegador las envía al servidor.
        Bloquearlas puede impedir iniciar sesión o completar el trámite. La aplicación no incorpora cookies de
        publicidad ni analítica de visitas. Los servicios externos que abras, como Google o WhatsApp, tienen sus
        propias políticas. Cualquier medición adicional requiere informar sus condiciones antes de activarla.</p>

      <h2>9. Contacto y cambios</h2>
      <p>Para ejercer derechos, revisar un aviso o consultar esta política:
        {email ? <> escribí a <a href={`mailto:${email}`}>{email}</a>.</> : " usá el canal de contacto del club."}
        {whatsapp ? <> También podés escribir por <a href={`https://wa.me/${whatsapp}`}>WhatsApp al +{whatsapp}</a>.</> : null}
        {" "}Indicá el pedido y un medio para responder; no adjuntes documentación sensible innecesaria.</p>
      <p>Los cambios se identifican con una nueva fecha. Un cambio de finalidad que requiera consentimiento necesita
        una autorización específica; seguir usando la app no la reemplaza.</p>
      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Borrador revisado: pendiente de validación de la comisión directiva y de asesoramiento legal,
        incluidos domicilio del responsable, retención y transferencias internacionales.{" "}
        <Link href="/terminos">Términos y Condiciones</Link> · <Link href="/sitio">Volver a la portada</Link>
      </p>
    </main>
  );
}
