import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { BatchForm, HarvestForm, MovementForm } from "@/components/forms";

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [strains, batches] = await Promise.all([
    prisma.strain.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.batch.findMany({ include: { strain: true, movements: { select: { type: true, grams: true } } }, orderBy: { code: "desc" } }),
  ]);

  const rows = batches.map((b) => {
    const balance = b.movements.reduce(
      (a, m) => a + (["INGRESO", "AJUSTE_POSITIVO", "DISPENSACION_REVERSA"].includes(m.type) ? 1 : -1) * Number(m.grams),
      0,
    );
    return { ...b, balance: Math.round(balance * 100) / 100 };
  });

  const disponibles = rows.filter((b) => b.stage === "DISPONIBLE").map((b) => ({ id: b.id, code: b.code }));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Stock y trazabilidad</h1>
      <p className="muted text-sm">
        El saldo es la suma del libro de movimientos. Un lote acredita stock recién con el peso seco.
      </p>

      <div className="card p-2 overflow-x-auto">
        <table className="data">
          <thead>
            <tr><th>Lote</th><th>Cepa</th><th>Etapa</th><th>Plantas</th><th>Sala</th><th>Húmedo</th><th>Seco</th><th>THC</th><th>Saldo</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.code}</td>
                <td>{b.strain.name}</td>
                <td><span className="badge">{b.stage}</span></td>
                <td>{b.plantsCount ?? "—"}</td>
                <td>{b.room ?? "—"}</td>
                <td>{b.wetWeightG ? `${Number(b.wetWeightG)} g` : "—"}</td>
                <td>{b.dryWeightG ? `${Number(b.dryWeightG)} g` : "—"}</td>
                <td>{b.thcPct ? `${Number(b.thcPct)}%` : "—"}</td>
                <td><strong>{b.balance} g</strong></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={9} className="muted">Sin lotes.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Nuevo lote</h2>
        <BatchForm strains={strains.map((s) => ({ id: s.id, name: s.name }))} />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Registrar cosecha (húmedo → seco)</h2>
        <HarvestForm batches={rows.filter((b) => !b.dryWeightG).map((b) => ({ id: b.id, code: b.code }))} />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Ajuste / destrucción / transferencia</h2>
        <MovementForm batches={disponibles} />
      </section>
    </div>
  );
}
