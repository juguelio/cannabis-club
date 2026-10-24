import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const fmt = (d: Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d);

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [activos, total, pendientes, reprocannVencidos, stock, lotes, ultimas, hoy] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVO" } }),
    prisma.member.count(),
    prisma.member.count({ where: { status: "PENDIENTE" } }),
    prisma.member.count({ where: { status: "ACTIVO", reprocannStatus: { not: "VIGENTE" } } }),
    prisma.$queryRaw<{ total: unknown }[]>`
      SELECT COALESCE(SUM(CASE WHEN type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN grams ELSE -grams END),0) AS total
      FROM "StockMovement"`,
    prisma.batch.findMany({ where: { stage: "DISPONIBLE" }, include: { strain: true }, orderBy: { code: "desc" } }),
    prisma.dispensation.findMany({ take: 6, orderBy: { occurredAt: "desc" }, include: { member: true, batch: { include: { strain: true } } } }),
    prisma.$queryRaw<{ grams: unknown }[]>`
      SELECT COALESCE(SUM(grams),0) AS grams FROM "StockMovement"
      WHERE type = 'DISPENSACION' AND ("occurredAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`,
  ]);

  const stockTotal = Math.round(Number(stock[0]?.total ?? 0) * 100) / 100;
  const entregadoHoy = Number(hoy[0]?.grams ?? 0);
  const balances = await Promise.all(
    lotes.map(async (b) => {
      const rows = await prisma.$queryRaw<{ balance: unknown }[]>`
        SELECT COALESCE(SUM(CASE WHEN type IN ('INGRESO','AJUSTE_POSITIVO','DISPENSACION_REVERSA') THEN grams ELSE -grams END),0) AS balance
        FROM "StockMovement" WHERE "batchId" = ${b.id}`;
      return { ...b, balance: Math.round(Number(rows[0]?.balance ?? 0) * 100) / 100 };
    }),
  );

  const cards = [
    { label: "Socios activos", value: activos, hint: `${total} en el padrón · ${pendientes} pendientes` },
    { label: "Stock total", value: `${stockTotal} g`, hint: `${lotes.length} lotes disponibles` },
    { label: "Entregado hoy", value: `${Math.round(entregadoHoy * 100) / 100} g`, hint: "suma de dispensaciones del día" },
    { label: "REPROCANN a regularizar", value: reprocannVencidos, hint: "socios activos sin REPROCANN vigente" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Panel</h1>
        <span className="muted text-sm">Los totales salen del libro de movimientos, no de campos editables.</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="muted text-xs">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
            <div className="muted text-xs mt-1">{c.hint}</div>
          </div>
        ))}
      </div>

      {reprocannVencidos > 0 ? (
        <div className="card p-4" style={{ borderColor: "#7f1d1d" }}>
          <strong>Atención:</strong>{" "}
          <span className="muted">
            hay {reprocannVencidos} socios activos sin REPROCANN vigente. El dispensario les va a rechazar la entrega.
          </span>
        </div>
      ) : null}

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Lotes disponibles</h2>
        <table className="data">
          <thead>
            <tr><th>Lote</th><th>Cepa</th><th>Sala</th><th>THC</th><th>Saldo</th></tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.id}>
                <td>{b.code}</td>
                <td>{b.strain.name}</td>
                <td>{b.room ?? "—"}</td>
                <td>{b.thcPct ? `${Number(b.thcPct)}%` : "—"}</td>
                <td><strong>{b.balance} g</strong></td>
              </tr>
            ))}
            {balances.length === 0 ? <tr><td colSpan={5} className="muted">Sin lotes disponibles.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Últimas entregas</h2>
        <table className="data">
          <thead>
            <tr><th>Fecha</th><th>Socio</th><th>Cepa</th><th>Gramos</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {ultimas.map((d) => (
              <tr key={d.id}>
                <td>{fmt(d.occurredAt)}</td>
                <td>{d.member.lastName}, {d.member.firstName}</td>
                <td>{d.batch.strain.name}</td>
                <td>{Number(d.grams)} g</td>
                <td>{d.voidedAt ? <span className="badge">anulada</span> : <span className="badge">vigente</span>}</td>
              </tr>
            ))}
            {ultimas.length === 0 ? <tr><td colSpan={5} className="muted">Todavía no hay entregas.</td></tr> : null}
          </tbody>
        </table>
        <p className="muted text-xs mt-3">
          El club debe aportar nombre, CUIT, Director Médico y Responsable Técnico; los topes de entrega son configuración
          y no reemplazan la indicación médica ni el encuadre legal.
        </p>
      </section>
    </div>
  );
}
