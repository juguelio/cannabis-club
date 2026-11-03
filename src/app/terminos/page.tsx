import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";

export const metadata = {
  title: "Términos y Condiciones",
  description:
    "Condiciones de la relación asociativa de República Cannabis: requisitos para asociarse, aportes de costo, membresías y límites, retiro y envíos, reservas y cancelaciones, baja, datos personales y jurisdicción. Ley 24.240 y Ley 25.326.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://republicacannabis.com.ar/terminos" },
};

const VERSION = "2026-11-03 · revisión 2";

/** Borrador revisado: requiere validación institucional y jurídica antes de publicarse. */
export default async function TerminosPage() {
  const view = await getBrandView();
  const wa = view.brand.contacto.whatsapp;

  return (
    <main className="wrap" style={{ padding: "56px 20px 80px", maxWidth: 760, margin: "0 auto" }}>
      <p style={{ margin: 0 }}>
        <Link href="/sitio" className="muted">
          ← {view.nombre}
        </Link>
      </p>
      <h1 style={{ margin: "14px 0 6px" }}>Términos y Condiciones</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {view.nombreLegal}
        {view.cuit ? ` · CUIT ${view.cuit}` : ""} · versión {VERSION}
      </p>

      <p>
        Estas condiciones rigen la relación entre <b>{view.nombreLegal}</b> (en adelante, «el club») y cada persona que
        solicita el alta o utiliza sus servicios. La solicitud no equivale al alta aprobada. La información sobre
        datos personales se encuentra en la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>. Estos términos no sustituyen el estatuto,
        el reglamento asociativo ni los consentimientos específicos que correspondan.
      </p>

      <h2>1. Qué es el club</h2>
      <p>
        Una asociación civil sin fines de lucro que organiza el cultivo de cannabis para sus propias personas socias,
        en el marco de la Ley 27.350, sus reglamentaciones y el Registro del Programa Cannabis (REPROCANN)
        {view.reprocannNumber ? `, donde está inscripta con el número ${view.reprocannNumber}` : ""}. Funciona con
        sede en San Telmo, Ciudad Autónoma de Buenos Aires, y acompaña a pacientes de todo el país.
      </p>

      {view.domicilioLegal ? <p>Domicilio legal de la asociación: {view.domicilioLegal}.</p> :
        <p className="muted">Domicilio legal: pendiente de completar por el club.</p>}

      <h2>2. Qué no es el club</h2>
      <p>
        El club <b>no vende cannabis</b> ni ningún producto: los aportes de las personas socias cubren los costos de
        producción. No es un dispensario comercial, no entrega a quien no es socio, no reemplaza a un médico y no atiende urgencias. Ante una urgencia, acudí al servicio de emergencias
        de tu localidad. El carácter asociativo no elimina las obligaciones ni los derechos que resulten aplicables.
      </p>

      <h2>3. Requisitos para asociarse</h2>
      <ul>
        <li>Ser mayor de edad para utilizar este circuito de alta y acreditar identidad con la documentación requerida.
          La atención de menores necesita un procedimiento específico de representación y validación; este portal no lo ofrece.</li>
        <li>Contar con indicación médica y con el REPROCANN vigente, con el club y el profesional vinculados en la plataforma oficial.</li>
        <li>Completar la solicitud de ingreso con datos verdaderos y firmar la declaración jurada y el consentimiento informado.</li>
        <li>Entregar la documentación que el club pida para el legajo (documento y credencial del REPROCANN). Los documentos se guardan cifrados y sólo los ve el personal autorizado.</li>
        <li>Aceptación del club: la solicitud no otorga la condición de socio hasta su aprobación por el órgano o las personas competentes conforme al estatuto.
          Una cuenta de Google, un pago o una credencial del portal no reemplazan la autorización oficial vigente.</li>
      </ul>

      <h2>4. Aportes: qué cubren y cómo se pagan</h2>
      <p>
        Cada persona socia cubre los costos de producción mediante un aporte. <b>El aporte no es el precio de compra
        de cannabis</b>: es la contribución proporcional al sostenimiento del cultivo asociativo, y el monto aplicable debe
        informarse antes de confirmar el pedido, separando cultivo y transporte cuando corresponda.
        Si la referencia es en dólares, deben informarse también la fuente, fecha y cotización usada para el importe en pesos.
      </p>
      <p>
        El pago se hace por <b>transferencia bancaria</b> a la cuenta que el club informa en el portal, y la persona
        socia <b>sube el comprobante</b> desde el portal. El pedido queda confirmado recién cuando el club aprueba ese
        comprobante. El portal no tiene una pasarela de tarjetas ni solicita claves bancarias, códigos de seguridad o datos
        de tarjeta. Una transferencia puede originarse en la entidad o billetera que uses. Subir el comprobante no
        acredita por sí solo la recepción del dinero. Si hay una diferencia, el club debe explicarla y acordar su
        resolución; no habilita cargos adicionales sin informar. Conservá el comprobante y la confirmación.
      </p>

      <h2>5. Membresías, cantidades y límites</h2>
      <ul>
        <li>La <b>membresía</b> es la unidad de retiro: su cantidad se informa en la configuración vigente del club y antes del pedido.
          No constituye una autorización para superar la indicación médica ni los límites aplicables.</li>
        <li>El máximo por pedido depende de la configuración vigente, del legajo y de las condiciones autorizadas.
          No se establece una equivalencia automática entre gramos de flores y extractos: debe validarla el profesional competente.</li>
        <li>El sistema aplica controles de stock y topes, y el club vuelve a verificar los requisitos antes de entregar.
          Un error o una confirmación informática no autoriza una entrega contraria a esos requisitos.</li>
        <li>Las variedades disponibles dependen de la cosecha; se publican sin precios y el club informa qué hay disponible en cada momento.</li>
      </ul>

      <h2>6. Retiro en la sede y envíos</h2>
      <p>
        El retiro es personal, en la sede, dentro del horario de atención informado, y no tiene costo. Los envíos se
        coordinan al domicilio validado para el pedido, sujetos a la habilitación y documentación aplicables
        al traslado y al transporte elegido; el costo depende de la zona y <b>se informa antes de confirmar el pedido</b>. Un envío no ocupa
        turno en la sede. Si el domicilio declarado está incompleto, el pedido no se puede confirmar hasta que se
        corrija. La disponibilidad, el transportista, la fecha estimada y el seguimiento, si lo hubiera, se deben
        confirmar para cada envío; este texto no garantiza cobertura nacional ni un plazo único.
      </p>
      <p>
        Sólo se entrega a la persona socia titular, con su documento, y queda registrado cada gramo entregado. El
        club no entrega a terceros, ni por encargo, ni a personas que no figuren en el padrón.
      </p>

      <h2>7. Reservas, turnos y cancelaciones</h2>
      <ul>
        <li>La reserva para retiro indica día y hora; el envío se coordina sin turno en sede. Una reserva no habilita el retiro por sí sola si el legajo no está validado o el REPROCANN está vencido.</li>
        <li>Podés solicitar la cancelación antes del despacho, desde el portal cuando esté habilitada la opción
          o por contacto con el club. Si ya salió, consultá cómo coordinar la gestión; esto no limita el derecho de
          revocación ni los reclamos que correspondan.</li>
        <li>Un pedido que no se retira en el plazo informado vence y se libera el stock; el vencimiento de la reserva no implica por sí solo perder un aporte ya realizado. El club debe
          conciliar el saldo e informar la reprogramación o devolución que corresponda.</li>
        <li>Si el club cancela o no puede cumplir por una causa ajena a vos, <b>elegís</b> entre reprogramar sin costo o la devolución íntegra del aporte.</li>
      </ul>

      <h2>8. Revocación, devoluciones y reclamos</h2>
      <p>
        Cuando resulte aplicable el régimen de contratación a distancia de la Ley 24.240 (art. 34), podés revocar la
        aceptación sin responsabilidad durante diez días corridos desde la entrega del bien o la celebración del
        contrato, lo que ocurra después. El retiro no extingue por sí solo ese derecho. Las excepciones sólo pueden
        ser las previstas legalmente y no se presume una por tratarse de un aporte asociativo.
      </p>
      <p>
        Podés comunicarlo por los canales de contacto de esta página y conservar constancia del pedido. Cuando
        corresponda restituir lo recibido, se pone a disposición del club y los gastos de devolución quedan a su
        cargo. Coordiná previamente una devolución compatible con las reglas de transporte: no lo despaches por tu
        cuenta. No se te puede imponer un saldo a favor en reemplazo de una devolución que corresponda.
      </p>
      <p>
        Si hay una diferencia de cantidad, un problema de calidad, un paquete dañado o una entrega no recibida,
        contactá al club e indicá pedido, fecha y lote si lo conocés. Guardá el envase y los comprobantes disponibles.
        Esto facilita la investigación sin condicionar tus derechos a un plazo interno ni a una renuncia.
        Ante una alerta sobre un lote, seguí las indicaciones del club y del profesional que te atiende.
      </p>

      <h2>9. Obligaciones de la persona socia</h2>
      <ul>
        <li>No revender, ceder, donar ni compartir lo que retira, y no retirar para otras personas.</li>
        <li>Mantener el REPROCANN vigente e informar de inmediato cualquier cambio, vencimiento o baja.</li>
        <li>Mantener actualizados domicilio, teléfono y correo, porque por ahí se avisa el vencimiento y se confirman los pedidos.</li>
        <li>Usar el cannabis de forma responsable: no conducir ni operar maquinaria bajo sus efectos y consultar al profesional ante cualquier efecto adverso.</li>
        <li>Respetar al personal y a las demás personas socias en la sede.</li>
      </ul>

      <h2>10. Suspensión, baja y expulsión</h2>
      <p>
        La persona socia puede pedir la baja en cualquier momento, sin expresión de causa, por los canales de contacto del club; pedir la baja no tiene una penalidad propia.
        Los saldos anteriores y pedidos pendientes se deben conciliar, explicando su origen y las devoluciones
        que correspondan; no se extinguen ni se crean deudas automáticamente por la baja. El club puede <b>suspender entregas</b> mientras el
        REPROCANN esté vencido, el legajo no esté validado o falte documentación, y puede suspender o expulsar a quien
        incumpla estos términos, aporte datos falsos o use lo retirado para fines distintos a los declarados. Las medidas disciplinarias deben respetar el estatuto, la competencia del órgano que decide,
        la información del motivo, el derecho a descargo y las vías de revisión que correspondan.
        Un bloqueo preventivo de entregas por seguridad o falta de habilitación no equivale por sí solo a una expulsión.
      </p>

      <h2>11. Datos personales</h2>
      <p>
        El tratamiento de datos, incluidas las imágenes del documento, la credencial del REPROCANN y los comprobantes
        de pago, se describe en la <Link href="/privacidad">Política de Privacidad</Link>. Los documentos se guardan
        cifrados, el acceso es sólo para personal autorizado y cada apertura queda registrada. Los destinatarios y proveedores que intervienen están identificados en esa política; no se autoriza
        publicidad ni tratamiento de salud por una aceptación genérica de estos términos.
      </p>

      <h2>12. Responsabilidad</h2>
      <p>
        El club responde por la calidad y la trazabilidad de lo que cultiva y entrega, y por el cumplimiento de lo que
        ofrece en este sitio. El cannabis puede producir efectos adversos: la indicación, la dosis y el seguimiento
        corresponden al profesional que te atiende, no al club. Ninguna cláusula de este texto implica renuncia ni
        limitación de los derechos que la Ley 24.240 reconoce a la persona consumidora.
      </p>

      <h2>13. Cambios en estos términos</h2>
      <p>
        Si el club modifica estas condiciones, lo informa por los canales de contacto y en esta página, con al menos
        quince (15) días de anticipación cuando el cambio sea relevante. La versión vigente es la publicada acá, con su
        fecha. No se aplican cambios retroactivos que reduzcan derechos sobre pedidos ya confirmados.
        Si no estás de acuerdo, podés pedir la baja y resolver los pedidos pendientes. Un cambio que requiera
        consentimiento específico debe recabarse por separado.
      </p>

      <h2>14. Ley aplicable y jurisdicción</h2>
      <p>
        Este texto se rige por la ley argentina. Cualquier controversia se puede plantear ante los tribunales del
        domicilio de la persona socia o ante los organismos de defensa del consumidor; el club no impone otro
        domicilio. Para reclamos de datos personales, la Ley 25.326 habilita a presentar una denuncia ante la Agencia
        de Acceso a la Información Pública.
      </p>

      <h2>Cómo contactarnos</h2>
      <p>
        {wa ? (
          <>
            Por WhatsApp al <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">+{wa}</a>.
          </>
        ) : (
          <>Por los canales de contacto informados en la portada.</>
        )}{" "}
        {view.brand.contacto.email ? <>También por correo a <a href={`mailto:${view.brand.contacto.email}`}>{view.brand.contacto.email}</a>. </> : null}
        Indicá si se trata de una consulta, baja, cancelación, revocación o reclamo y conservá constancia del envío.
      </p>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Versión {VERSION} · borrador revisado, pendiente de validación de la comisión directiva y revisión
        legal profesional. No se acredita aprobación institucional mediante esta publicación.{" "}
        <Link href="/privacidad">Privacidad</Link> · <Link href="/sitio">Volver a la portada</Link>
      </p>
    </main>
  );
}
