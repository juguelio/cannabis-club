import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const REPORTS = [
  ["padron", "Padrón de socios", "Legajo, documento, REPROCANN, estado, consentimiento."],
  ["dispensaciones", "Libro de dispensaciones", "Nombre, año de nacimiento, gramos, THC promedio, fecha, firma y anulaciones."],
  ["stock", "Stock por lote", "Ingresado, dispensado, destruido y saldo por lote."],
  ["destrucciones", "Libro de destrucciones", "Qué se destruyó, cuándo, cuánto y quién lo hizo."],
  ["informe-anual", "Informe anual por variedad", "Cosechado, entregado, destruido y stock final por variedad con THC/CBD."],
];

export default async function ReportesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reportes y libros</h1>
      <p className="muted text-sm">CSV con separador “;” y BOM UTF-8, listo para abrir en Excel y para presentar ante la autoridad.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map(([slug, title, desc]) => (
          <div key={slug} className="card p-4 flex flex-col gap-2">
            <div className="font-semibold">{title}</div>
            <div className="muted text-sm flex-1">{desc}</div>
            <a className="btn btn-ghost self-start" href={`/api/reports/${slug}`}>Descargar CSV</a>
          </div>
        ))}
      </div>
    </div>
  );
}
