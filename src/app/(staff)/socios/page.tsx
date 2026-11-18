import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { FileUp, Search, UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { maskDoc } from "@/lib/privacy";
import { getSession } from "@/lib/auth";
import { getClub, limitsFromClub } from "@/lib/club";
import { monthUsageByMember } from "@/lib/usage";
import { memberIdsByName } from "@/lib/member-search";
import { componerDireccion } from "@/lib/direccion";
import { Avatar, Chip, Empty, Meter, PageHead, Panel } from "@/components/ui";
import { AccessRequests } from "@/components/access-requests";
import { ValidacionAcciones } from "@/components/validacion-acciones";
import { colaVerificaciones } from "@/lib/verificacion";
import { estadoVerificacion } from "@/lib/verificacion-rules";
import { age, fmtGrams, MEMBER_STATUS, reprocannIssue } from "@/lib/labels";
import { esDespacho, esSucursal } from "@/lib/entrega";

export const metadata = { title: "Socios" };
const PAGE = 50;

export default async function SociosPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; filtro?: string; p?: string; ver?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q, estado, filtro, p, ver } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  // Las altas viven en Socios, no en Configuración: se aprueban donde se ve el padrón que van a engrosar.
  const altas = session.role === "ADMIN" ? await prisma.accessRequest.count({ where: { status: "PENDIENTE" } }) : 0;
  // La re-validación de los legajos que ya existen se revisa al lado del padrón, no en Configuración.
  const porValidar =
    session.role === "ADMIN" ? await prisma.memberVerification.count({ where: { status: "EN_REVISION" } }) : 0;
  const tabAltas = (
    <Link href="/socios?ver=altas" aria-current={ver === "altas" ? "true" : undefined}>
      Altas <span className="count">{altas}</span>
    </Link>
  );
  const tabValidaciones = (
    <Link href="/socios?ver=validaciones" aria-current={ver === "validaciones" ? "true" : undefined}>
      Validaciones <span className="count">{porValidar}</span>
    </Link>
  );
  if (ver === "altas" && session.role === "ADMIN") {
    return (
      <>
        <PageHead
          title="Socios"
          subtitle="Altas: la persona ya se registró con Google y subió su documentación. Aprobar crea el legajo."
          actions={<Link className="btn btn-quiet" href="/socios">Volver al padrón</Link>}
        />
        <nav className="seg" aria-label="Socios" style={{ marginBottom: 14 }}>
          <Link href="/socios">Padrón</Link>
          {tabAltas}
        </nav>
        <AccessRequests />
      </>
    );
  }

  if (ver === "validaciones" && session.role === "ADMIN") {
    const { revision, sinPresentar } = await colaVerificaciones();
    return (
      <>
        <PageHead
          title="Socios"
          subtitle="Validaciones: el socio presentó su DNI y su REPROCANN. Aprobar es lo único que carga esos datos al legajo."
          actions={<Link className="btn btn-quiet" href="/socios">Volver al padrón</Link>}
        />
        <nav className="seg" aria-label="Socios" style={{ marginBottom: 14 }}>
          <Link href="/socios">Padrón</Link>
          {tabValidaciones}
          {tabAltas}
        </nav>

        <Panel
          title="Presentaciones por revisar"
          subtitle={
            revision.length === 0
              ? "Nada esperando: el socio aparece acá cuando presenta sus datos y sus archivos."
              : `${revision.length} ${revision.length === 1 ? "legajo" : "legajos"} esperando que alguien mire los documentos`
          }
        >
          {revision.length === 0 ? (
            <Empty icon={Users} title="Sin presentaciones pendientes">
              Cuando un socio suba su DNI y su REPROCANN desde el portal, aparece en esta cola.
            </Empty>
          ) : (
            <ul className="rows">
              {revision.map((r) => (
                <li key={r.id} style={{ display: "block" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>
                      {r.member.lastName}, {r.member.firstName}
                    </b>
                    <span className="cell-meta">legajo {r.member.legajo}</span>
                    <Chip tone="warn">En revisión</Chip>
                    <span className="cell-meta">
                      presentado {r.submittedAt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · DNI{" "}
                      ····{r.docLast4} · nace {r.birthDate.toISOString().slice(0, 10).split("-").reverse().join("/")}
                    </span>
                  </div>
                  <div className="cell-meta" style={{ marginTop: 4 }}>
                    REPROCANN {r.reprocannNumber} · vence {r.reprocannExpiresAt.toISOString().slice(0, 10).split("-").reverse().join("/")}
                    {r.member.email ? ` · ${r.member.email}` : ""}
                  </div>
                  {/* Cómo recibe y a dónde: sin localidad y CP no hay envío, y el club tiene que verlo al aprobar. */}
                  <div className="cell-meta" style={{ marginTop: 2 }}>
                    {esDespacho(r.deliveryMode)
                      ? r.address && r.postalCode
                        ? `${esSucursal(r.deliveryMode) ? "Sucursal Andreani" : "Envío"} · ${componerDireccion(r.address, r.locality, r.province)} · CP ${r.postalCode}`
                        : "Envío · falta domicilio o código postal: pedile que lo complete antes de aprobar"
                      : `Retiro en el club${r.address ? ` · domicilio declarado: ${componerDireccion(r.address)}` : ""}`}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                    {["DNI_FRENTE", "DNI_DORSO", "REPROCANN"].map((tipo) => {
                      const doc = r.documents.find((d) => d.tipo === tipo);
                      const label = tipo === "REPROCANN" ? "REPROCANN" : tipo === "DNI_FRENTE" ? "DNI frente" : "DNI dorso";
                      return doc ? (
                        <a
                          key={tipo}
                          className="btn btn-quiet btn-sm"
                          href={`/api/verificaciones/${r.id}/documentos/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {label}
                        </a>
                      ) : (
                        <span key={tipo} className="chip chip-mute">
                          {label}: falta
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <ValidacionAcciones
                      id={r.id}
                      faltantesTexto={
                        r.documents.length < 3 ? `Faltan ${3 - r.documents.length} de los tres archivos: no se puede aprobar.` : ""
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Socios sin validar"
          subtitle={`${sinPresentar.length} ${sinPresentar.length === 1 ? "legajo" : "legajos"} del padrón que todavía no presentaron nada`}
        >
          {sinPresentar.length === 0 ? (
            <Empty icon={Users} title="Todos los legajos están validados">
              No queda nadie pendiente en el padrón.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Legajo</th>
                    <th>Socio</th>
                    <th>Email</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sinPresentar.map((m) => {
                    const est = estadoVerificacion(m.verificationStatus);
                    return (
                      <tr key={m.id}>
                        <td className="tnum">{m.legajo}</td>
                        <td className="cell-main">
                          {m.lastName}, {m.firstName}
                        </td>
                        <td className="cell-meta">{m.email ?? "—"}</td>
                        <td>
                          <Chip tone={est.tone}>{est.label}</Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </>
    );
  }

  const reprocannWhere: Prisma.MemberWhereInput = {
    status: "ACTIVO",
    OR: [{ reprocannStatus: { not: "VIGENTE" } }, { reprocannExpiresAt: { lt: in30 } }],
  };
  const query = q?.trim();
  const digits = query?.replace(/[.\s-]/g, "") ?? "";
  const searchWhere: Prisma.MemberWhereInput | undefined = query
    ? {
        OR: [
          ...(/^\d{1,6}$/.test(digits) ? [{ legajo: Number(digits) }] : []),
          ...(digits ? [{ docLast4: { contains: digits } }] : []),
          { reprocannNumber: { contains: query, mode: "insensitive" } },
          { id: { in: await memberIdsByName(query) } },
        ],
      }
    : undefined;
  const statusWhere: Prisma.MemberWhereInput =
    filtro === "reprocann" ? reprocannWhere : ["ACTIVO", "PENDIENTE", "SUSPENDIDO", "BAJA"].includes(estado ?? "") ? { status: estado as never } : {};
  const where: Prisma.MemberWhereInput = { AND: [statusWhere, ...(searchWhere ? [searchWhere] : [])] };

  const [members, total, counts, reprocannCount, club] = await Promise.all([
    prisma.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { user: { select: { active: true } } },
    }),
    prisma.member.count({ where }),
    prisma.member.groupBy({ by: ["status"], _count: { _all: true }, ...(searchWhere ? { where: searchWhere } : {}) }),
    prisma.member.count({ where: { AND: [reprocannWhere, ...(searchWhere ? [searchWhere] : [])] } }),
    getClub(),
  ]);
  const usage = await monthUsageByMember(members.map((m) => m.id), club.timezone);
  const limits = limitsFromClub(club);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((a, c) => a + c._count._all, 0);

  const activeKey = filtro === "reprocann" ? "reprocann" : estado ?? "";
  const filters = [
    { key: "", label: "Todos", n: all },
    { key: "ACTIVO", label: "Activos", n: count("ACTIVO") },
    { key: "PENDIENTE", label: "Pendientes", n: count("PENDIENTE") },
    { key: "reprocann", label: "REPROCANN a revisar", n: reprocannCount },
    { key: "SUSPENDIDO", label: "Suspendidos", n: count("SUSPENDIDO") },
    { key: "BAJA", label: "Bajas", n: count("BAJA") },
  ];
  const href = (key: string, extra: Record<string, string | number | undefined> = {}) => {
    const sp = new URLSearchParams();
    if (key === "reprocann") sp.set("filtro", "reprocann");
    else if (key) sp.set("estado", key);
    if (query) sp.set("q", query);
    for (const [k, v] of Object.entries(extra)) if (v != null) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/socios?${s}` : "/socios";
  };
  const pages = Math.ceil(total / PAGE);

  return (
    <>
      <PageHead
        title="Socios"
        subtitle={`${club.maxSocios ? `${count("ACTIVO")} activos de un cupo de ${club.maxSocios}. ` : ""}El legajo es la llave del mostrador: buscalo por número, apellido o DNI.`}
        actions={
          <>
            {session.role === "ADMIN" ? <Link className="btn btn-quiet" href="/configuracion?seccion=importar"><FileUp aria-hidden />Importar padrón</Link> : null}
            <Link className="btn" href="/socios/nuevo"><UserPlus aria-hidden />Nuevo socio</Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 14 }}>
        <nav className="seg" aria-label="Filtrar padrón">
          {session.role === "ADMIN" ? tabValidaciones : null}
          {session.role === "ADMIN" ? tabAltas : null}
          {filters.map((f) => (
            <Link key={f.key || "todos"} href={href(f.key)} aria-current={activeKey === f.key ? "true" : undefined}>
              {f.label} <span className="count">{f.n}</span>
            </Link>
          ))}
        </nav>
        <form action="/socios" role="search" className="flex items-center gap-2" style={{ marginLeft: "auto", flex: "1 1 260px", maxWidth: 380 }}>
          {estado ? <input type="hidden" name="estado" value={estado} /> : null}
          {filtro ? <input type="hidden" name="filtro" value={filtro} /> : null}
          <div style={{ position: "relative", flex: 1 }}>
            <Search aria-hidden style={{ position: "absolute", left: 11, top: 12, width: 17, height: 17, color: "var(--muted)" }} />
            <input className="input" name="q" defaultValue={query ?? ""} aria-label="Buscar en el padrón" placeholder="Legajo, apellido, DNI o REPROCANN" style={{ paddingLeft: 36 }} />
          </div>
        </form>
      </div>

      <Panel>
        {members.length === 0 ? (
          <Empty
            icon={Users}
            title={query ? `Nadie coincide con “${query}”` : "No hay socios en esta vista"}
            action={<Link className="btn btn-quiet" href={query ? href(activeKey) : "/socios/nuevo"}>{query ? "Limpiar búsqueda" : "Dar de alta un socio"}</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th className="hide-sm">DNI</th>
                  <th className="hide-sm">Edad</th>
                  <th className="hide-sm">Estado</th>
                  <th>REPROCANN</th>
                  <th className="hide-sm" style={{ width: 170 }}>Retirado este mes</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const st = MEMBER_STATUS[m.status] ?? { label: m.status, tone: "mute" as const };
                  const issue = reprocannIssue(m);
                  const years = m.birthDate ? age(m.birthDate) : null;
                  const monthLimit =
                    years !== null && years < limits.edadLimiteMenor
                      ? Math.min(limits.limiteMenorG, limits.limiteMensualG)
                      : limits.limiteMensualG;
                  const used = usage.get(m.id) ?? 0;
                  return (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/socios/${m.id}`} className="row-link flex items-center gap-3">
                          <Avatar first={m.firstName} last={m.lastName} tone={m.status === "ACTIVO" ? (issue.tone === "danger" ? "danger" : undefined) : "mute"} />
                          <span style={{ minWidth: 0 }}>
                            <span className="cell-main" style={{ display: "block" }}>{m.lastName}, {m.firstName}</span>
                            <span className="cell-meta">Legajo {m.legajo}{m.status !== "ACTIVO" ? <span className="show-sm"> · {st.label.toLowerCase()}</span> : null}{m.user?.active ? " · usa el portal" : ""}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="tnum hide-sm">{maskDoc(m.docLast4)}</td>
                      <td className="tnum hide-sm">{years}</td>
                      <td className="hide-sm"><Chip tone={st.tone}>{st.label}</Chip></td>
                      <td><Chip tone={issue.tone}>{issue.label.replace("REPROCANN ", "")}</Chip></td>
                      <td className="hide-sm">
                        {m.status === "ACTIVO" ? (
                          <>
                            <div className="flex justify-between cell-meta tnum" style={{ marginBottom: 5 }}>
                              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{fmtGrams(used)}</span>
                              <span>de {fmtGrams(monthLimit)}</span>
                            </div>
                            <Meter value={used} max={monthLimit} />
                          </>
                        ) : (
                          <span className="cell-meta">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="panel-foot">
            <span className="cell-meta">Mostrando {(page - 1) * PAGE + 1}–{Math.min(total, page * PAGE)} de {total}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link className="btn btn-sm btn-quiet" href={href(activeKey, { p: page - 1 })}>Anterior</Link> : null}
              {page < pages ? <Link className="btn btn-sm btn-quiet" href={href(activeKey, { p: page + 1 })}>Siguiente</Link> : null}
            </div>
          </div>
        ) : null}
      </Panel>
    </>
  );
}
