import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account-panel";
import { ConsentPanel } from "@/components/consent-panel";
import { DocumentacionSocio, HistorialSocio, PaginacionLegajo, porPagina } from "@/components/member-record";
import { Panel } from "@/components/ui";
import { memberAccount } from "@/lib/account";
import { memberConsents } from "@/lib/privacy";
import { paginaLegajo, puedeVer, secciones, type Seccion } from "@/lib/legajo-secciones";
import { contextoLegajo } from "../contexto";
import { DatosSocio } from "../datos";

type Params = Promise<{ id: string; seccion: string }>;
export async function generateMetadata({ params }: { params: Params }) {
  const { seccion } = await params;
  return { title: Object.hasOwn(secciones, seccion) ? secciones[seccion as Seccion] : "Legajo" };
}

export default async function SeccionSocio({ params, searchParams }: { params: Params; searchParams: Promise<{ pagina?: string }> }) {
  const [{ id, seccion: slug }, query] = await Promise.all([params, searchParams]);
  const { session } = await contextoLegajo(id);
  if (!Object.hasOwn(secciones, slug)) notFound();
  const seccion = slug as Seccion;
  if (seccion === "resumen" || !puedeVer(session.role, seccion)) notFound();
  const admin = session.role === "ADMIN";
  const pagina = paginaLegajo(query.pagina);
  switch (seccion) {
    case "datos": return <DatosSocio id={id} isAdmin={admin} />;
    case "documentacion": return <DocumentacionSocio memberId={id} />;
    case "consentimientos": return <Panel title="Consentimientos"><div className="panel-body">
      <ConsentPanel memberId={id} initial={await memberConsents(id)} isAdmin={admin} />
    </div></Panel>;
    case "cuenta": {
      const cuenta = await memberAccount(id, porPagina, (pagina - 1) * porPagina);
      return <Panel title="Cuenta corriente">
        <AccountPanel memberId={id} balance={cuenta.balance} entries={cuenta.entries.map(e => ({
          id: e.id, kind: e.kind, concept: e.concept, amountArs: Number(e.amountArs), period: e.period,
          occurredAt: e.occurredAt.toISOString(), note: e.note, voided: Boolean(e.voidedAt),
          reversed: e.reversalOfId != null, by: e.creator?.name ?? null,
        }))} canVoid={admin} />
        <PaginacionLegajo id={id} seccion={seccion} pagina={pagina} siguiente={cuenta.count > pagina * porPagina} />
      </Panel>;
    }
    default: return <HistorialSocio memberId={id} seccion={seccion} pagina={pagina} admin={admin} />;
  }
}
