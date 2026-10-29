/* eslint-disable @next/next/no-img-element -- imágenes de marca servidas por /api/marca, ya dimensionadas */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Clock, HeartHandshake, Mail, MapPin, QrCode, ShieldCheck, Stethoscope, UserPlus } from "lucide-react";
import { getAnySession } from "@/lib/auth";
import { getBrandView } from "@/lib/brand-db";
import { prisma } from "@/lib/db";
import { CLUB_ID } from "@/lib/club";
import { whatsappHref } from "@/lib/brand";
import { catalogoDelClub } from "@/lib/variedades";
import { VariedadCard } from "@/components/variedad-card";
import { BrandMark } from "@/components/brand-mark";
import { SiteJoinFloat } from "@/components/site-join-float";
import "./sitio.css";

export async function generateMetadata(): Promise<Metadata> {
  const view = await getBrandView();
  const description = view.brand.lema || "Asociación civil de cultivo solidario bajo la Ley 27.350 y el REPROCANN.";
  return {
    title: { absolute: view.brand.lema ? `${view.nombre} · ${view.brand.lema}` : view.nombre },
    description,
    openGraph: { title: view.nombre, description, images: view.img.portada ? [view.img.portada] : undefined },
  };
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z" />
    </svg>
  );
}

const PILARES = [
  { icon: HeartHandshake, title: "Sin fines de lucro", text: "No vendemos. Los socios sostienen el cultivo con una cuota social y un aporte que cubre los costos." },
  { icon: Stethoscope, title: "Con indicación médica", text: "Para retirar hace falta el REPROCANN vigente y vinculado al club. Cada entrega respeta los topes que fija la comisión." },
  { icon: QrCode, title: "Trazable de punta a punta", text: "Cada planta, lote y gramo queda registrado: sabés qué retirás, de qué cosecha viene y quién lo liberó." },
  { icon: ShieldCheck, title: "Tus datos, protegidos", text: "La información de salud se trata con consentimiento informado y confidencialidad, como pide la Ley 25.326." },
];

export default async function SitioPage() {
  const [view, session, clubRow, variedades] = await Promise.all([
    getBrandView(),
    getAnySession(),
    prisma.club.findUnique({ where: { id: CLUB_ID }, select: { edadMinima: true } }).catch(() => null),
    catalogoDelClub(),
  ]);
  const club = { edadMinima: clubRow?.edadMinima ?? 18 };
  const { brand } = view;
  const isAdmin = session?.role === "ADMIN";
  if (!brand.sitio.publico && !isAdmin) redirect("/login");

  const wa = brand.contacto.whatsapp
    ? whatsappHref(brand.contacto.whatsapp, `Hola ${view.nombre}, tengo una consulta.`)
    : null;
  const ig = brand.contacto.instagram ? `https://www.instagram.com/${brand.contacto.instagram}/` : null;
  const parrafos = brand.presentacion.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  const lead = "Somos una asociación civil sin fines de lucro que cultiva cannabis para sus socios con indicación médica, bajo la Ley 27.350 y el REPROCANN.";
  const banda = [view.nombre, brand.lema, "Cultivo solidario", "Sin fines de lucro", "Ley 27.350"].filter(Boolean);
  const mark = { logo: view.img.logo, sigla: view.sigla, placa: brand.logoPlaca };

  return (
    <div className="sitio">
      {!brand.sitio.publico ? (
        <div className="s-preview" role="status">
          Vista previa: el sitio no está publicado. Activalo en <Link href="/configuracion?seccion=marca">Configuración › Marca y sitio</Link>.
        </div>
      ) : null}

      <header className="s-top">
        <div className="s-wrap">
          <Link href="/sitio" className="s-brand">
            <BrandMark info={mark} />
            <span className="s-brand-name s-wordmark">{view.nombre}</span>
          </Link>
          <nav className="s-nav" aria-label="Secciones">
            <a href="#que-es">Qué es</a>
            {variedades.length ? <a href="#variedades">Variedades</a> : null}
            <a href="#asociarse">Asociarse</a>
            {brand.sitio.envios ? <a href="#envios">Envíos</a> : null}
            <a href="#preguntas">Preguntas</a>
            <a href="#contacto">Contacto</a>
          </nav>
          <Link className="s-btn s-btn-ghost" href="/login">Ingresar</Link>
        </div>
      </header>

      <main>
        <section className="s-hero">
          <div className="s-wrap">
            <div>
              <h1 className="s-big">
                <small>Asociación civil · cultivo solidario</small>
                {brand.lema || view.nombre}
              </h1>
              <p className="s-lead">{parrafos[0] && parrafos[0].length <= 260 ? parrafos[0] : lead}</p>
              <div className="s-actions">
                <Link className="s-btn s-btn-firma" href="/login?alta=1"><UserPlus aria-hidden style={{ width: 17, height: 17 }} />Crear cuenta</Link>
                <Link className="s-btn s-btn-ghost" href="/login">Ya soy socio</Link>
              </div>
              <div className="s-facts">
                <span><i />Ley 27.350</span>
                <span><i />REPROCANN</span>
                {brand.contacto.zona ? <span><i />{brand.contacto.zona}</span> : null}
                {brand.contacto.horario ? <span><i />{brand.contacto.horario}</span> : null}
              </div>
            </div>
            <div className="s-visual">
              {view.img.portada ? (
                <div className="s-frame"><img src={view.img.portada} alt={`Foto de ${view.nombre}`} /></div>
              ) : (
                <div className="s-frame s-frame--mark" aria-hidden>
                  {view.img.logo ? <img src={view.img.logo} alt="" /> : <span className="s-sigla">{view.sigla}</span>}
                </div>
              )}
              {view.img.emblema ? <img className="s-sticker" src={view.img.emblema} alt="" /> : null}
            </div>
          </div>
        </section>

        <div className="s-band" aria-hidden>
          <div className="s-band-track">
            {[0, 1].map((k) => (
              <span key={k}>{[...banda, ...banda].map((t, i) => <span key={i}>{t}</span>)}</span>
            ))}
          </div>
        </div>

        <section className="s-sec" id="que-es">
          <div className="s-wrap s-two">
            <div>
              <h2 className="s-big"><small>Qué es un club de cultivo</small>Cultivamos juntos, con reglas claras</h2>
              <p className="s-intro">
                Un club de cultivo es una asociación civil que produce cannabis para uso medicinal de sus propios socios, dentro del
                marco del Programa de Cannabis Medicinal (REPROCANN). No es un comercio: no hay venta al público ni productos en vidriera.
              </p>
            </div>
            <ul className="s-pillars">
              {PILARES.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span><Icon aria-hidden /></span>
                  <div><b>{title}</b><p>{text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {variedades.length ? (
          <section className="s-sec" id="variedades">
            <div className="s-wrap">
              <div style={{ maxWidth: 640 }}>
                <h2 className="s-big"><small>Qué cultivamos</small>Las variedades del club</h2>
                <p className="s-intro">
                  Esto es lo que el club tiene cultivado hoy. No hay venta al público: cada socio retira su parte según su indicación y
                  el tope que fija la comisión. El estado se actualiza con el stock real.
                </p>
                <p className="s-note">Si una variedad figura sin stock, vuelve cuando se cierra la próxima cosecha.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16, marginTop: 28 }}>
                {variedades.map((v) => (
                  <VariedadCard key={v.id} v={v} tone="site" />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {parrafos.length ? (
          <section className="s-sec s-on-tint" id="quienes-somos">
            <div className="s-wrap s-about">
              <div>
                <h2 className="s-big" style={{ marginBottom: 28 }}><small>Quiénes somos</small><span className="s-wordmark">{view.nombre}</span></h2>
                {parrafos.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {view.img.emblema ? <img className="s-about-mark" src={view.img.emblema} alt="" /> : view.img.logo ? <img className="s-about-mark" src={view.img.logo} alt="" /> : null}
            </div>
          </section>
        ) : null}

        <section className="s-sec" id="asociarse">
          <div className="s-wrap">
            <h2 className="s-big"><small>Cómo asociarte</small>En {brand.sitio.pasos.length} pasos</h2>
            <p className="s-intro">El ingreso es personal y lo aprueba la comisión directiva. Tenés que ser mayor de {club.edadMinima} años.</p>
            <ol className="s-steps">
              {brand.sitio.pasos.map((p, i) => <li key={i} className="s-step">{p}</li>)}
            </ol>
            <div className="s-ready">
              <p>El alta en el club se hace online: entrás con Google y subís tu DNI y el REPROCANN.</p>
              <Link className="s-btn s-btn-firma" href="/login?alta=1">Crear cuenta</Link>
            </div>
          </div>
        </section>

        <section className="s-sec s-on-tint" id="antes-de-empezar">
          <div className="s-wrap">
            <h2 className="s-big"><small>Antes de empezar</small>Algo de info para entender</h2>
            <ul className="s-checks">
              <li><Check aria-hidden />Sólo podés estar vinculado a una ONG.</li>
              <li><Check aria-hidden />Podés dar de baja tu vinculación en cualquier momento.</li>
              <li><Check aria-hidden />Con la autorización vinculada a una ONG no podés ejercer tu cultivo domiciliario.</li>
              <li><Check aria-hidden />Podés transportar hasta 40 g de flores secas y 6 frascos de 30 ml de derivados.</li>
            </ul>
          </div>
        </section>

        {brand.sitio.envios ? (
          <section className="s-sec s-on-dark" id="envios">
            <div className="s-wrap s-two">
              <div>
                <h2 className="s-big"><small>Para socios</small>Envíos</h2>
                {brand.sitio.enviosTexto ? <p className="s-envio-text">{brand.sitio.enviosTexto}</p> : null}
              </div>
              <div>
                <ul className="s-checks">
                  <li><Check aria-hidden />Solo a socios con el REPROCANN vigente.</li>
                  <li><Check aria-hidden />Cada traslado viaja con su declaración jurada y su remito.</li>
                  <li><Check aria-hidden />Se entrega en mano y queda registrado como cualquier retiro.</li>
                </ul>
                <p className="s-note">Los envíos se coordinan desde el portal del socio o con la secretaría del club.</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="s-sec" id="preguntas">
          <div className="s-wrap">
            <h2 className="s-big"><small>Preguntas frecuentes</small>Lo que más nos consultan</h2>
            <div className="s-faq">
              <details>
                <summary>¿Puedo conseguir cannabis sin ser socio?</summary>
                <div className="s-a"><p>No. El club no vende ni entrega a terceros: solo a socios activos, con indicación médica y el REPROCANN vinculado.</p></div>
              </details>
              <details>
                <summary>¿Qué necesito para asociarme?</summary>
                <div className="s-a">
                  <p>Tu DNI, ser mayor de {club.edadMinima} años y contar con el REPROCANN (o iniciarlo con orientación del club). Firmás la solicitud de ingreso y el consentimiento informado.</p>
                </div>
              </details>
              <details>
                <summary>¿Cuánto puedo retirar?</summary>
                <div className="s-a"><p>Lo que indica tu REPROCANN, dentro de los topes que fija la comisión. El sistema del club controla cada entrega y no permite superarlos.</p></div>
              </details>
              <details>
                <summary>¿Cómo veo mis retiros y turnos?</summary>
                <div className="s-a"><p>Desde el portal del socio: tu carnet, lo que te queda en el mes, tus retiros y la reserva de turnos. Entrás con el usuario que te da el club.</p></div>
              </details>
              <details>
                <summary>¿Mis datos de salud son privados?</summary>
                <div className="s-a"><p>Sí. Se usan solo para la gestión del club, con tu consentimiento, y se conservan de forma segura. Podés pedir acceso o rectificación cuando quieras.</p></div>
              </details>
            </div>
          </div>
        </section>

        <section className="s-sec s-on-tint" id="contacto">
          <div className="s-wrap">
            <h2 className="s-big"><small>Contacto</small>Hablemos</h2>
            <div className="s-contact">
              {wa ? <a href={wa} target="_blank" rel="noreferrer"><small>WhatsApp</small><b>+{brand.contacto.whatsapp}</b></a> : null}
              {ig ? <a href={ig} target="_blank" rel="noreferrer"><small>Instagram</small><b>@{brand.contacto.instagram}</b></a> : null}
              {brand.contacto.email ? <a href={`mailto:${brand.contacto.email}`}><small><Mail aria-hidden style={{ width: 13, height: 13, display: "inline", verticalAlign: "-2px" }} /> Email</small><b>{brand.contacto.email}</b></a> : null}
              {brand.contacto.zona ? <div><small><MapPin aria-hidden style={{ width: 13, height: 13, display: "inline", verticalAlign: "-2px" }} /> Zona</small><b>{brand.contacto.zona}</b></div> : null}
              {brand.contacto.horario ? <div><small><Clock aria-hidden style={{ width: 13, height: 13, display: "inline", verticalAlign: "-2px" }} /> Atención</small><b>{brand.contacto.horario}</b></div> : null}
            </div>
          </div>
        </section>

        <section className="s-on-dark s-close">
          <div className="s-wrap">
            <h2 className="s-big"><small>{brand.lema || "Cultivo solidario"}</small>Sumate al club</h2>
            <div className="s-close-actions">
              <Link className="s-btn s-btn-firma" href="/login?alta=1">Quiero asociarme</Link>
              <Link className="s-btn s-btn-ghost" href="/login">Ingresar al portal</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="s-foot">
        <div className="s-wrap">
          <div>
            <b className="s-wordmark">{view.nombre}</b>
            <span>{view.nombreLegal}</span>
            {view.cuit ? <span> · CUIT {view.cuit}</span> : null}
            {view.reprocannNumber ? <span> · Inscripción REPROCANN {view.reprocannNumber}</span> : null}
          </div>
          <div>
            <b>Socios</b>
            <Link href="/login">Ingresar al portal</Link>
          </div>
          <p className="s-legal">
            Sitio informativo de una asociación civil sin fines de lucro. El club no comercializa ni publicita cannabis: el acceso es
            exclusivo para socios con indicación médica y REPROCANN vigente, conforme a la Ley 27.350 y su reglamentación.
          </p>
        </div>
      </footer>

      <SiteJoinFloat />
      {wa ? <a className="s-wa-float" href={wa} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><WhatsappIcon /></a> : null}
    </div>
  );
}
