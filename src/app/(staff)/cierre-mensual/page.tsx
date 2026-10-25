import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Chip, PageHead, Panel } from "@/components/ui";
import { CloseSign } from "@/components/close-sign";
import { currentPeriod, closeOf, integrity, listCloses, monthlyTotals } from "@/lib/monthly-close";
import { fmtGrams, fmtWhen } from "@/lib/labels";

export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default async function MonthlyClosePage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.periodo ?? "") ? sp.periodo! : currentPeriod();
  const [totals, close, closes] = await Promise.all([monthlyTotals(period), closeOf(period), listCloses(12)]);
  const check = close ? integrity(close) : null;

  const row = (label: string, value: string) => (
    <tr><td className="cell-meta">{label}</td><td className="num tnum">{value}</td></tr>
  );

  return (
    <>
      <PageHead
        title="Cierre mensual"
        subtitle="Los totales del período salen de los libros. Al firmarlos quedan congelados con una huella que permite detectar si algo se modificó."
        actions={<Link className="btn btn-sm btn-quiet" href={`/api/close/${period}`}>Descargar CSV</Link>}
      />

      <div className="flex flex-wrap items-end gap-2" style={{ marginBottom: 16 }}>
        {["2026-10", "2026-09", "2026-08"].map((p) => (
          <Link key={p} className={`btn btn-sm ${p === period ? "" : "btn-quiet"}`} href={`/cierre-mensual?periodo=${p}`}>{p}</Link>
        ))}
      </div>

      <div className="grid-2">
        <div className="stack">
          <Panel title={`Totales de ${period}`} subtitle="Entregas, stock, calidad y cuenta corriente del mes.">
            <div className="panel-body">
              <table className="table">
                <tbody>
                  {row("Entregas", `${totals.entregas.cantidad} · ${fmtGrams(totals.entregas.gramos)}`)}
                  {row("Socios que retiraron", String(totals.entregas.sociosDistintos))}
                  {row("Lotes usados", String(totals.entregas.lotesDistintos))}
                  {row("Anulaciones", `${totals.anulaciones.cantidad} · ${fmtGrams(totals.anulaciones.gramos)}`)}
                  {row("Cosechado seco", fmtGrams(totals.cosechadoG))}
                  {row("Destruido", fmtGrams(totals.destruidoG))}
                  {row("Stock al cierre", fmtGrams(totals.stockAlCierreG))}
                  {row("Cargos del mes", MONEY.format(totals.cuenta.cargos))}
                  {row("Pagos del mes", MONEY.format(totals.cuenta.pagos))}
                  {row("Lotes liberados", String(totals.calidad.lotesLiberados))}
                  {row("Recalls", String(totals.calidad.recalls))}
                  {row("Socios activos", String(totals.socios.ACTIVO ?? 0))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Estado del cierre">
            <div className="panel-body stack" style={{ gap: 12 }}>
              {close ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="ok">Firmado</Chip>
                    <span className="cell-meta">{fmtWhen(close.signedAt)} · {close.signer.name}</span>
                  </div>
                  <dl className="dl">
                    <dt>Huella</dt><dd className="tnum" style={{ wordBreak: "break-all" }}>{close.hash}</dd>
                    <dt>Integridad</dt><dd>{check?.ok ? "El contenido coincide con lo firmado" : "El contenido no coincide: revisar"}</dd>
                    {close.note ? <><dt>Nota</dt><dd>{close.note}</dd></> : null}
                  </dl>
                </>
              ) : session.role === "ADMIN" ? (
                <CloseSign period={period} />
              ) : (
                <p className="muted" style={{ margin: 0 }}>Sólo un administrador puede firmar el cierre del período.</p>
              )}
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Cierres firmados" subtitle="Lo cerrado no se edita: si hay que corregir, se firma un cierre nuevo.">
            <div className="panel-body">
              {closes.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Todavía no hay cierres firmados.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Período</th><th>Firmó</th><th>Huella</th></tr></thead>
                  <tbody>
                    {closes.map((c) => (
                      <tr key={c.id}>
                        <td><Link href={`/cierre-mensual?periodo=${c.period}`}>{c.period}</Link></td>
                        <td className="cell-meta">{c.signer.name}<br />{fmtWhen(c.signedAt)}</td>
                        <td className="cell-meta tnum">{c.hash.slice(0, 10)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>

          <Panel title="Modo inspección" subtitle="Una sola pantalla con lo que se muestra en una visita.">
            <div className="panel-body">
              <p className="cell-meta" style={{ marginTop: 0 }}>Identidad del club, topes vigentes, padrón, estado de los lotes y cierres firmados, sin nada editable.</p>
              <Link className="btn btn-sm btn-quiet" href="/inspeccion">Abrir modo inspección</Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
