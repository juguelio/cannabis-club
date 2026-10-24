import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const fdate = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(d) : "—");

export default async function SociosPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q, status } = await searchParams;

  const members = await prisma.member.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { docNumber: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Socios</h1>
        <Link className="btn" href="/socios/nuevo">Nuevo socio</Link>
      </div>

      <form className="flex gap-2" action="/socios">
        <input className="input" name="q" defaultValue={q ?? ""} placeholder="Buscar por nombre, apellido o documento" />
        <select className="select" name="status" defaultValue={status ?? ""} style={{ maxWidth: 180 }}>
          <option value="">Todos los estados</option>
          {["PENDIENTE", "ACTIVO", "SUSPENDIDO", "BAJA"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost">Buscar</button>
      </form>

      <div className="card p-2 overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Legajo</th><th>Socio</th><th>Documento</th><th>Nacimiento</th><th>Estado</th>
              <th>REPROCANN</th><th>Vence</th><th>Consumo</th><th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.legajo}</td>
                <td>{m.lastName}, {m.firstName}</td>
                <td>{m.docNumber}</td>
                <td>{fdate(m.birthDate)}</td>
                <td><span className="badge">{m.status}</span></td>
                <td>{m.reprocannStatus}{m.reprocannNumber ? ` · ${m.reprocannNumber}` : ""}</td>
                <td>{fdate(m.reprocannExpiresAt)}</td>
                <td>{m.consumptionType}</td>
                <td><Link className="underline text-xs" href={`/socios/${m.id}`}>Ver</Link></td>
              </tr>
            ))}
            {members.length === 0 ? <tr><td colSpan={9} className="muted">Sin resultados.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
