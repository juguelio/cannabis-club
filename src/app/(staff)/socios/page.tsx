import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Chip, Empty, PageHead, Section } from "@/components/ui";
import { age, CONSUMPTION, fmtDate, fmtGrams, MEMBER_STATUS, reprocannIssue } from "@/lib/labels";

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "ACTIVO", label: "Activos" },
  { key: "PENDIENTE", label: "Pendientes de alta" },
  { key: "SUSPENDIDO", label: "Suspendidos" },
  { key: "BAJA", label: "Bajas" },
  { key: "reprocann", label: "REPROCANN a regularizar" },
];

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; filtro?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q, estado, filtro } = await searchParams;

  const members = await prisma.member.findMany({
    where: {
      ...(["ACTIVO", "PENDIENTE", "SUSPENDIDO", "BAJA"].includes(estado ?? "") ? { status: estado as never } : {}),
      ...(filtro === "reprocann"
        ? { status: "ACTIVO", OR: [{ reprocannStatus: { not: "VIGENTE" } }, { reprocannExpiresAt: { lt: new Date() } }] }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { docNumber: { contains: q } },
                  { reprocannNumber: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 300,
  });

  const activeKey = filtro === "reprocann" ? "reprocann" : estado ?? "";

  return (
    <>
      <PageHead
        title="Socios"
        subtitle={`${members.length} registros en esta vista · el legajo es la llave que usa el mostrador`}
        actions={<Link className="btn" href="/socios/nuevo">Nuevo socio</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTERS.map((f) => {
          const href = f.key === "" ? "/socios" : f.key === "reprocann" ? "/socios?filtro=reprocann" : `/socios?estado=${f.key}`;
          const active = activeKey === f.key;
          return (
            <Link key={f.key || "todos"} href={href} className="chip" style={active ? { background: "var(--brand)", color: "#f0fdf4", borderColor: "var(--brand)" } : undefined}>
              {f.label}
            </Link>
          );
        })}
        <form action="/socios" className="member-search ml-auto flex items-center gap-2">
          {estado ? <input type="hidden" name="estado" value={estado} /> : null}
          {filtro ? <input type="hidden" name="filtro" value={filtro} /> : null}
          <input className="input" name="q" defaultValue={q ?? ""} aria-label="Buscar socios" placeholder="Nombre, documento o REPROCANN" />
          <button className="btn btn-secondary">Buscar</button>
        </form>
      </div>

      <Section title="Padrón" subtitle="Estado del socio, habilitación para retirar y previsión declarada">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Documento</th>
                <th>Edad</th>
                <th>Estado</th>
                <th>Habilitación</th>
                <th>Consumo</th>
                <th>Alta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const st = MEMBER_STATUS[m.status] ?? { label: m.status, tone: "mute" as const };
                const issue = reprocannIssue(m);
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="cell-main">{m.lastName}, {m.firstName}</div>
                      <div className="cell-meta">Legajo {m.legajo}{m.reprocannNumber ? ` · ${m.reprocannNumber}` : ""}</div>
                    </td>
                    <td className="tnum">{m.docType} {m.docNumber}</td>
                    <td className="tnum">{age(m.birthDate)}</td>
                    <td><Chip tone={st.tone}>{st.label}</Chip></td>
                    <td><Chip tone={issue.tone}>{issue.label}</Chip></td>
                    <td>
                      <div>{CONSUMPTION[m.consumptionType] ?? m.consumptionType}</div>
                      <div className="cell-meta">{m.monthlyForecastG ? `${fmtGrams(m.monthlyForecastG)}/mes` : "sin previsión"}</div>
                    </td>
                    <td className="cell-meta">{fmtDate(m.admittedAt)}</td>
                    <td className="num"><Link className="underline text-[12px]" href={`/socios/${m.id}`}>Ver</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length === 0 ? <Empty>No hay socios con este filtro. Probá “Todos” o cargá uno nuevo.</Empty> : null}
        </div>
      </Section>
    </>
  );
}
