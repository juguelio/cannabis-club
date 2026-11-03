import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";

export const metadata = {
  title: "Términos y Condiciones",
  description:
    "Condiciones de la relación asociativa de República Cannabis: requisitos para asociarse, aportes de costo, membresías y límites, retiro y envíos, reservas y cancelaciones, baja, datos personales y jurisdicción. Ley 24.240 y Ley 25.326.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://republicacannabis.com.ar/terminos" },
};

const VERSION = "3-nov-2026";

/**
 * Términos y Condiciones del vínculo entre el club y la persona socia.
 *
 * Reglas al escribirlo: cada cláusula describe lo que el sistema hace de verdad (membresía de 10 g, tope
 * por pedido, comprobante de transferencia aprobado por el club, bloqueo con REPROCANN vencido) y ninguna
 * renuncia a derechos: si el club cancela, devuelve o reprograma a elección del socio, y la revocación de
 * diez días del art. 34 de la Ley 24.240 se escribe explícita. Un texto con plazos o precios que el código
 * no sostiene es peor que no tener texto.
 */
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
        se asocia. Al completar la solicitud de ingreso aceptás este texto y la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>.
      </p>

      <h2>1. Qué es el club</h2>
      <p>
        Una asociación civil sin fines de lucro que organiza el cultivo de cannabis para sus propias personas socias,
        en el marco de la Ley 27.350, sus reglamentaciones y el Registro del Programa Cannabis (REPROCANN)
        {view.reprocannNumber ? `, donde está inscripta con el número ${view.reprocannNumber}` : ""}. Funciona con
        sede en San Telmo, Ciudad Autónoma de Buenos Aires, y acompaña a pacientes de todo el país.
      </p>

      <h2>2. Qué no es el club</h2>
      <p>
        El club <b>no vende cannabis</b> ni ningún producto: los aportes de las personas socias cubren los costos de
        producción. No es un dispensario comercial, no entrega a quien no es socio, no publicita precios de cannabis,
        no reemplaza a un médico y no atiende urgencias. Si tenés una urgencia, llamá al 107 (SAME) o al 911.
      </p>

      <h2>3. Requisitos para asociarse</h2>
      <ul>
        <li>Ser mayor de edad y tener documento argentino.</li>
        <li>Contar con indicación médica y con el REPROCANN vigente, con el club y el profesional vinculados en la plataforma oficial.</li>
        <li>Completar la solicitud de ingreso con datos verdaderos y firmar la declaración jurada y el consentimiento informado.</li>
        <li>Entregar la documentación que el club pida para el legajo (documento y credencial del REPROCANN). Los documentos se guardan cifrados y sólo los ve el personal autorizado.</li>
        <li>Aceptación del club: la solicitud no otorga la condición de socio hasta que la comisión directiva la apruebe.</li>
      </ul>

      <h2>4. Aportes: qué cubren y cómo se pagan</h2>
      <p>
        Cada persona socia cubre los costos de producción mediante un aporte. <b>El aporte no es el precio de compra
        de cannabis</b>: es la contribución proporcional al sostenimiento del cultivo asociativo, y el monto vigente se
        informa en el sitio y en el portal del socio antes de confirmar cualquier pedido.
      </p>
      <p>
        El pago se hace por <b>transferencia bancaria</b> a la cuenta que el club informa en el portal, y la persona
        socia <b>sube el comprobante</b> desde el portal. El pedido queda confirmado recién cuando el club aprueba ese
        comprobante. No se procesan pagos con tarjeta ni con billeteras virtuales, y el club no solicita datos de
        tarjeta en ningún caso. Si el comprobante no coincide con el aporte que corresponde, el club lo informa y
        decide si acepta la diferencia.
      </p>

      <h2>5. Membresías, cantidades y límites</h2>
      <ul>
        <li>La <b>membresía</b> es la unidad de retiro: una membresía equivale a 10 g de flores secas o su equivalente en extractos.</li>
        <li>Se pueden pedir hasta cuatro membresías por pedido (40 g), según la indicación médica y los topes que fija la comisión directiva.</li>
        <li>El sistema controla el stock y los topes de cada legajo y no permite superarlos. Si un pedido excede el límite, no se confirma.</li>
        <li>Las variedades disponibles dependen de la cosecha; se publican sin precios y el club informa qué hay disponible en cada momento.</li>
      </ul>

      <h2>6. Retiro en la sede y envíos</h2>
      <p>
        El retiro es personal, en la sede, dentro del horario de atención informado, y no tiene costo. Los envíos se
        hacen al domicilio que la persona socia declaró en su legajo, por el transporte que el club indique, con
        seguimiento; el costo depende de la zona y <b>se informa antes de confirmar el pedido</b>. Un envío no ocupa
        turno en la sede. Si el domicilio declarado está incompleto, el pedido no se puede confirmar hasta que se
        corrija.
      </p>
      <p>
        Sólo se entrega a la persona socia titular, con su documento, y queda registrado cada gramo entregado. El
        club no entrega a terceros, ni por encargo, ni a personas que no figuren en el padrón.
      </p>

      <h2>7. Reservas, turnos y cancelaciones</h2>
      <ul>
        <li>La reserva indica día y hora de retiro; no habilita el retiro por sí sola si el legajo no está validado o el REPROCANN está vencido.</li>
        <li>Podés cancelar tu reserva desde el portal mientras el pedido no haya salido de la sede.</li>
        <li>Un pedido que no se retira en el plazo informado vence y se libera el stock; el aporte se resuelve según el punto 8.</li>
        <li>Si el club cancela o no puede cumplir por una causa ajena a vos, <b>elegís</b> entre reprogramar sin costo o la devolución íntegra del aporte.</li>
      </ul>

      <h2>8. Derecho de revocación</h2>
      <p>
        Si contrataste a distancia, tenés derecho a revocar la aceptación dentro de los <b>diez (10) días corridos</b>
        desde que se formalizó el aporte, sin costo y sin expresar causa (art. 34, Ley 24.240), siempre que no hayas
        retirado el pedido. La devolución se hace por el mismo medio de pago, dentro de los plazos que fija la
        normativa. Pasado ese plazo, y si ya retiraste, el aporte se imputa al costo de producción ya realizado, que
        el club puede detallar si lo pedís.
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
        La persona socia puede pedir la baja en cualquier momento, sin expresión de causa, desde el portal o por
        WhatsApp; la baja no genera deuda ni cargo alguno. El club puede <b>suspender entregas</b> mientras el
        REPROCANN esté vencido, el legajo no esté validado o falte documentación, y puede suspender o expulsar a quien
        incumpla estos términos, aporte datos falsos o use lo retirado para fines distintos a los declarados. En todos
        los casos se informa el motivo, se escucha el descargo y la decisión se registra por escrito.
      </p>

      <h2>11. Datos personales</h2>
      <p>
        El tratamiento de datos, incluidas las imágenes del documento, la credencial del REPROCANN y los comprobantes
        de pago, se describe en la <Link href="/privacidad">Política de Privacidad</Link>. Los documentos se guardan
        cifrados, el acceso es sólo para personal autorizado y cada apertura queda registrada. Los datos de salud no se
        comparten con terceros y no se usan para publicidad.
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
        fecha. Si no estás de acuerdo, podés pedir la baja antes de que el cambio entre en vigencia.
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
            Por WhatsApp al <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">+{wa}</a>, o desde el
            portal del socio.
          </>
        ) : (
          <>Por WhatsApp o desde el portal del socio.</>
        )}{" "}
        Las consultas sobre este texto se responden por esos mismos canales.
      </p>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Versión {VERSION} · texto aprobado por la comisión directiva del club y pendiente de revisión legal
        profesional.{" "}
        <Link href="/privacidad">Privacidad</Link> · <Link href="/sitio">Volver a la portada</Link>
      </p>
    </main>
  );
}
