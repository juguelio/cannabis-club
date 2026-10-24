import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";

const REPORTS = [
  {
    slug: "padron",
    title: "Padrón de socios",
    purpose: "Mostrar quién está habilitado y con qué REPROCANN, ante el club o una inspección.",
    items: ["Legajo y documento", "Estado y fecha de alta", "REPROCANN, estado y vencimiento", "Consentimiento firmado"],
  },
  {
    slug: "dispensaciones",
    title: "Libro de dispensaciones",
    purpose: "El registro que se pide primero: qué se entregó, a quién, cuándo y con qué THC.",
    items: ["Nombre y año de nacimiento", "Gramos, cepa y lote", "THC promedio", "Operador, firma y anulaciones"],
  },
  {
    slug: "stock",
    title: "Stock por lote",
    purpose: "Conciliar lo cultivado contra lo entregado y lo destruido, lote por lote.",
    items: ["Ingresado y dispensado", "Destruido y saldo", "Etapa y sala", "Cosecha"],
  },
  {
    slug: "destrucciones",
    title: "Libro de destrucciones",
    purpose: "Justificar cada gramo que salió del stock sin haberse entregado.",
    items: ["Fecha y lote", "Gramos y motivo", "Responsable"],
  },
  {
    slug: "informe-anual",
    title: "Informe anual por variedad",
    purpose: "Cerrar el año: cultivado, entregado, destruido y stock final por variedad, con THC y CBD.",
    items: ["Cosechado seco", "Entregado y destruido", "Stock final del libro", "THC y CBD promedio"],
  },
];

export default async function ReportesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <>
      <PageHead
        title="Reportes y libros"
        subtitle="CSV con separador “;” y BOM UTF-8: abre en Excel y se presenta tal cual."
      />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
        {REPORTS.map((r) => (
          <div key={r.slug} className="card card-pad flex flex-col gap-3">
            <div>
              <div className="section-title">{r.title}</div>
              <p className="section-sub mt-1">{r.purpose}</p>
            </div>
            <ul className="text-[12.5px] flex flex-col gap-1" style={{ color: "#475569" }}>
              {r.items.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
            <a className="btn btn-secondary btn-sm self-start mt-auto" href={`/api/reports/${r.slug}`}>
              Descargar CSV
            </a>
          </div>
        ))}
      </div>
    </>
  );
}
