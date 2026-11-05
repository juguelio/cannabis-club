import type { Metadata } from "next";
import Link from "next/link";
import { getBrandView } from "@/lib/brand-db";
import { BrandMark } from "@/components/brand-mark";
import { GuiaReprocann } from "@/components/guia-reprocann";
import { siteUrl } from "@/lib/site";
import "../sitio/sitio.css";

const SITE_URL = siteUrl();

/**
 * La guía del REPROCANN, pública.
 *
 * Vive fuera del portal porque el que todavía no es socio es justamente el que la necesita: si la guía
 * sólo existiera detrás del login, el club estaría explicándole el trámite a quien ya lo hizo. Es la
 * página a la que apunta el «¿Sin REPROCANN?» del sitio y la que se comparte por WhatsApp.
 *
 * Indexable: contesta una búsqueda real («cómo sacar el REPROCANN», «cuánto tarda») mejor que la home.
 */
export async function generateMetadata(): Promise<Metadata> {
  const view = await getBrandView();
  return {
    title: { absolute: `Cómo sacar el REPROCANN, paso a paso · ${view.nombre}` },
    description:
      "Guía del trámite REPROCANN para pacientes de cannabis medicinal: consulta médica por videollamada, carga del trámite, vinculación con el club, tiempos y qué hacer si el trámite no avanza.",
    alternates: { canonical: `${SITE_URL}/reprocann` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Cómo sacar el REPROCANN, paso a paso · ${view.nombre}`,
      description: "Consulta médica, carga del trámite, vinculación con el club y qué hacer si no avanza.",
      url: `${SITE_URL}/reprocann`,
      type: "article",
      locale: "es_AR",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ReprocannPublicoPage() {
  const view = await getBrandView();
  const mark = { logo: view.img.logo, sigla: view.sigla, placa: view.brand.logoPlaca };

  return (
    <div className="sitio">
      <header className="s-top">
        <div className="s-wrap">
          <Link href="/sitio" className="s-brand">
            <BrandMark info={mark} />
            <span className="s-brand-name s-wordmark">{view.nombre}</span>
          </Link>
          <nav className="s-nav" aria-label="Secciones">
            <Link href="/sitio#que-es">Qué es</Link>
            <Link href="/sitio#variedades">Variedades</Link>
            <Link href="/sitio#asociarse">Asociarse</Link>
            <Link href="/reprocann" aria-current="page">
              REPROCANN
            </Link>
          </nav>
          <Link className="s-btn s-btn-ghost" href="/login?alta=1">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main>
        <div className="s-wrap s-guia">
          <GuiaReprocann volver={{ href: "/sitio", label: "Volver al sitio" }} />
        </div>
      </main>

      <footer className="s-foot">
        <div className="s-wrap">
          <p className="s-legal">
            Sitio informativo de una asociación civil sin fines de lucro. El club no comercializa ni publicita cannabis:
            el acceso es exclusivo para socios con indicación médica y REPROCANN vigente, conforme a la Ley 27.350 y su
            reglamentación.
          </p>
          <div>
            <b>Legales</b>
            <Link href="/terminos">Términos y Condiciones</Link>
            <Link href="/privacidad">Política de Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
