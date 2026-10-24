import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { fmtDate } from "@/lib/labels";
import { dayKeyOf } from "@/lib/appointments";

export const metadata = { title: "Libros" };

type Report = { slug: string; title: string; purpose: string; columns: string; filter?: "range" | "year" };
const REPORTS: Report[] = [
  { slug: "dispensaciones", title: "Libro de dispensaciones", purpose: "El registro que se pide primero: qué se entregó, a quién, cuándo y con qué THC.", columns: "Fecha, socio, año de nacimiento, documento, cepa, lote, gramos, THC, operador, firma y anulaciones.", filter: "range" },
  { slug: "padron", title: "Padrón de socios", purpose: "Quién está habilitado y con qué REPROCANN, para el club o una inspección.", columns: "Legajo, documento, nacimiento, estado, REPROCANN y vencimiento, consumo, previsión, alta, baja y consentimiento." },
  { slug: "stock", title: "Stock por lote", purpose: "Conciliar lo cultivado contra lo entregado y lo destruido, lote por lote.", columns: "Lote, cepa, etapa, plantas, sala, ingresado, dispensado neto, destruido, saldo, THC y cosecha." },
  { slug: "destrucciones", title: "Libro de destrucciones", purpose: "Justificar cada gramo que salió del stock sin haberse entregado.", columns: "Fecha, lote, cepa, gramos, motivo y responsable.", filter: "range" },
  { slug: "informe-anual", title: "Informe anual por variedad", purpose: "Cerrar el año: cosechado, entregado, destruido y stock al cierre, por variedad.", columns: "Año, variedad, lotes cosechados, cosechado seco, entregado, destruido, stock al cierre, y THC/CBD de referencia de la variedad (no es un promedio de entregas).", filter: "year" },
];

/** Primer día del mes en curso, hora del club. */
function monthStartKey() {
  return `${dayKeyOf(new Date()).slice(0, 8)}01`;
}

export default async function ReportesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const first = await prisma.stockMovement.findFirst({ orderBy: { occurredAt: "asc" }, select: { occurredAt: true } });
  const thisYear = new Date().getFullYear();
  const firstYear = first ? Math.min(thisYear, first.occurredAt.getFullYear()) : thisYear;
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
  const monthStart = monthStartKey();

  return (
    <>
      <PageHead
        title="Libros"
        subtitle={`Se descargan en CSV con separador “;” y acentos correctos: abren directo en Excel. ${first ? `Hay registros desde el ${fmtDate(first.occurredAt)}.` : "Todavía no hay movimientos."}`}
      />
      <div className="grid-auto">
        {REPORTS.map((r) => (
          <section key={r.slug} className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-head"><div><h2 className="panel-title">{r.title}</h2><p className="panel-sub">{r.purpose}</p></div></div>
            <div className="panel-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <p className="cell-meta" style={{ margin: 0 }}>Columnas: {r.columns}</p>
              <form action={`/api/reports/${r.slug}`} method="get" className="stack" style={{ gap: 10, marginTop: "auto" }}>
                {r.filter === "range" ? (
                  <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div><label className="label" htmlFor={`${r.slug}-d`}>Desde</label><input className="input" id={`${r.slug}-d`} type="date" name="desde" defaultValue={monthStart} /></div>
                    <div><label className="label" htmlFor={`${r.slug}-h`}>Hasta</label><input className="input" id={`${r.slug}-h`} type="date" name="hasta" /></div>
                  </div>
                ) : null}
                {r.filter === "year" ? (
                  <div><label className="label" htmlFor={`${r.slug}-y`}>Año</label>
                    <select className="select" id={`${r.slug}-y`} name="anio" defaultValue={thisYear}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                  </div>
                ) : null}
                <div><button className="btn btn-quiet"><Download aria-hidden />Descargar CSV</button></div>
                {r.filter === "range" ? <span className="hint" style={{ marginTop: -4 }}>Dejá las fechas vacías para el libro completo.</span> : null}
              </form>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
