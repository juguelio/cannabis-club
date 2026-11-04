import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck, ExternalLink, MessageCircle } from "lucide-react";
import { getMemberSession } from "@/lib/auth";
import {
  ESTADOS_TRABADOS,
  GUIA,
  INSTAGRAM_URL,
  NOTAS,
  PASOS,
  PROFESIONALES,
  TIEMPOS,
  pesos,
  whatsappGuia,
} from "@/lib/guia-reprocann";
import "./guia.css";

export const metadata = { title: "Tu REPROCANN" };
export const dynamic = "force-dynamic";

/**
 * Guía del trámite REPROCANN, para el socio.
 *
 * Es la página que contesta lo que hoy se pregunta por WhatsApp: cómo se saca, cuánto tarda, por qué
 * no avanza y con quién se pide el turno. El club no hace el trámite: lo hace el socio. Esta página
 * existe para que sepa qué le toca a él y qué le toca al club, porque el 90% de los trámites
 * trabados es gente que no aceptó los términos en REPROCANN.
 */
export default async function GuiaReprocannPage() {
  const session = await getMemberSession();
  if (!session) redirect("/login");

  return (
    <div className="guia">
      <section className="guia-hero">
        <div className="eyebrow">Cannabis medicinal · REPROCANN</div>
        <h1>Tu REPROCANN, paso a paso</h1>
        <p className="lead">
          El trámite lo hacés vos. El club te vincula y te avisa cuando vence, pero no puede iniciarlo ni aprobarlo por
          nadie.
        </p>
        <p className="hecho-por">
          Consulta médica y carga del trámite: {GUIA.consultorio} · {GUIA.modalidad}
        </p>
      </section>

      <div className="guia-facts">
        <div className="guia-fact">
          <small>Valor de la consulta</small>
          <b>{GUIA.publicarValores ? pesos(GUIA.valorConsultaArs) : "Te lo confirma el consultorio"}</b>
          <span>Consulta y carga del trámite</span>
        </div>
        <div className="guia-fact">
          <small>Modalidad</small>
          <b>Videollamada</b>
          <span>Google Meet, desde donde estés</span>
        </div>
        <div className="guia-fact">
          <small>Quién lo hace</small>
          <b>Vos</b>
          <span>El club vincula y avisa</span>
        </div>
      </div>

      <section className="guia-sec" id="pasos">
        <h2>Cómo es el trámite</h2>
        <p className="intro">
          Seis pasos, en este orden. La mayoría de los trámites que se frenan es porque se salteó el cuarto.
        </p>
        <ol className="guia-pasos">
          {PASOS.map((p) => (
            <li key={p.titulo}>
              <b>{p.titulo}</b>
              {p.texto}
            </li>
          ))}
        </ol>
        <p className="guia-nota">{NOTAS.quienHaceElTramite}</p>
      </section>

      <section className="guia-sec" id="turno">
        <h2>Reservá tu turno</h2>
        <p className="intro">
          Todos hacen la consulta y la carga del trámite completo, y demora lo mismo con cualquiera. Elegí por comodidad.
        </p>
        <div className="guia-turnos">
          {PROFESIONALES.map((p) => (
            <div className="guia-turno" key={p.nombre}>
              <div>
                <b>{p.nombre}</b>
                <span>{p.via}</span>
              </div>
              <a className="guia-btn" href={p.url} target="_blank" rel="noopener noreferrer">
                {p.via === "Turnos por WhatsApp" ? <MessageCircle aria-hidden /> : <CalendarCheck aria-hidden />}
                {p.via === "Turnos por WhatsApp" ? "Pedir turno" : "Reservar turno"}
                <ExternalLink aria-hidden width={13} height={13} />
              </a>
            </div>
          ))}
        </div>
        <p className="guia-nota">{NOTAS.club}</p>
      </section>

      <section className="guia-sec" id="trabado">
        <h2>Mi trámite no avanza</h2>
        <p className="intro">Mirá el estado en REPROCANN, en «Mis trámites», y buscá tu caso:</p>
        <ul className="guia-estados">
          {ESTADOS_TRABADOS.map((e) => (
            <li key={e.estado}>
              <b>{e.estado}</b>
              <span>{e.queHacer}</span>
            </li>
          ))}
        </ul>
        <p className="guia-nota">{NOTAS.trabado}</p>
      </section>

      <section className="guia-sec">
        <h2>Las dudas de siempre</h2>
        <div className="guia-faq">
          <details>
            <summary>¿Cómo es la consulta?</summary>
            <div className="respuesta">
              <p>
                Es una videollamada por Google Meet. El link te llega por mail y te lo recordamos el día anterior por
                WhatsApp.
              </p>
              <p>
                El médico repasa tus síntomas, antecedentes y medicación, arma tu historia clínica y te indica el
                tratamiento.
              </p>
            </div>
          </details>

          <details>
            <summary>¿Cuánto tarda la aprobación?</summary>
            <div className="respuesta">
              <p>Depende del tipo de trámite:</p>
              <ul>
                {TIEMPOS.map((t) => (
                  <li key={t.tipo}>
                    <b>{t.tipo}:</b> {t.texto}
                  </li>
                ))}
              </ul>
              <p>{NOTAS.tiempos}</p>
            </div>
          </details>

          <details>
            <summary>¿Cómo se paga?</summary>
            <div className="respuesta">
              <p>{NOTAS.pago}</p>
            </div>
          </details>

          <details>
            <summary>Ya tengo REPROCANN y me quiero sumar al club</summary>
            <div className="respuesta">
              <p>{NOTAS.vinculacion}</p>
              <p>
                {GUIA.publicarValores
                  ? `Es una consulta de vinculación de ${pesos(GUIA.valorVinculacionArs)} y después completás la documentación que te pida el club: DNI y credencial vigente.`
                  : "Es una consulta de vinculación (el valor te lo confirma el consultorio) y después completás la documentación que te pida el club: DNI y credencial vigente."}{" "}
                Se sube desde el portal, en «Validá tus datos».
              </p>
            </div>
          </details>

          <details>
            <summary>¿Tengo que hacer algo cada tanto?</summary>
            <div className="respuesta">
              <p>{NOTAS.control}</p>
            </div>
          </details>
        </div>
      </section>

      <section className="guia-sec">
        <h2>¿Otra duda?</h2>
        <p className="intro">Para el trámite, escribile al consultorio. Para tu legajo, al club.</p>
        <div className="guia-contacto">
          <a className="guia-btn guia-btn--wa" href={whatsappGuia()} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> WhatsApp del consultorio
          </a>
          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{GUIA.whatsappLegible}</span>
          </div>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <small>Instagram</small>
            <b>@{GUIA.instagram}</b>
          </a>
          <Link href="/portal" className="guia-btn guia-btn--quiet">
            <ArrowLeft aria-hidden /> Volver al portal
          </Link>
        </div>
      </section>

      <p className="guia-pie">
        {GUIA.director} · {GUIA.especialidad}. Los valores y los turnos los fija el consultorio médico; el club no
        interviene en el cobro de la consulta.
      </p>
    </div>
  );
}
