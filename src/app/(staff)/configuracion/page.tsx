import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClub } from "@/lib/club";
import { prisma } from "@/lib/db";
import { PageHead, Panel } from "@/components/ui";
import { ClubSettingsForm } from "@/components/club-settings-form";
import { TeamManager } from "@/components/team-manager";
import { PadronImport } from "@/components/padron-import";
import { AUDIT_ACTION, fmtWhen } from "@/lib/labels";

export const metadata = { title: "Configuración" };

const TABS = [
  { key: "club", label: "Club y reglas" },
  { key: "equipo", label: "Equipo" },
  { key: "importar", label: "Importar padrón" },
  { key: "actividad", label: "Actividad" },
];
const ENTITY: Record<string, string> = { Member: "Socios", Dispensation: "Entregas", Batch: "Lotes", StockMovement: "Stock", Club: "Club", User: "Cuentas", PickupRequest: "Reservas", Appointment: "Turnos" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ seccion?: string; tipo?: string; desde?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.seccion) ? sp.seccion! : "club";

  let body: React.ReactNode = null;
  if (tab === "club") {
    const club = await getClub();
    body = (
      <ClubSettingsForm
        initial={{
          nombre: club.nombre, cuit: club.cuit ?? "", directorMedico: club.directorMedico ?? "", responsableTecnico: club.responsableTecnico ?? "",
          reprocannNumber: club.reprocannNumber ?? "", reprocannCode: club.reprocannCode ?? "", limiteDiarioG: Number(club.limiteDiarioG),
          limiteMensualG: Number(club.limiteMensualG), limiteMenorG: Number(club.limiteMenorG), edadMinima: club.edadMinima,
          edadLimiteMenor: club.edadLimiteMenor, thcMaxMenor: club.thcMaxMenor == null ? null : Number(club.thcMaxMenor),
          maxSocios: club.maxSocios, requiereReprocann: club.requiereReprocann,
        }}
      />
    );
  } else if (tab === "equipo") {
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OPERADOR"] } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true },
    });
    body = <TeamManager meId={user.id} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))} />;
  } else if (tab === "importar") {
    body = <PadronImport />;
  } else {
    const take = 50;
    const rows = await prisma.auditLog.findMany({
      where: sp.tipo ? { entity: sp.tipo } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(sp.desde ? { cursor: { id: sp.desde }, skip: 1 } : {}),
      include: { actor: { select: { name: true } } },
    });
    const items = rows.slice(0, take);
    const next = rows.length > take ? items[items.length - 1].id : null;
    body = (
      <Panel
        title="Actividad del club"
        subtitle="Cada acción con su autor, hora y origen. No se puede editar ni borrar."
        action={
          <nav className="seg" aria-label="Filtrar actividad">
            <Link href="/configuracion?seccion=actividad" aria-current={!sp.tipo ? "true" : undefined}>Todo</Link>
            {["Dispensation", "Member", "Batch", "User"].map((e) => (
              <Link key={e} href={`/configuracion?seccion=actividad&tipo=${e}`} aria-current={sp.tipo === e ? "true" : undefined}>{ENTITY[e]}</Link>
            ))}
          </nav>
        }
      >
        <ul className="rows">
          {items.map((a) => {
            const p = (a.payload ?? {}) as Record<string, unknown>;
            const href = a.entity === "Member" && a.entityId ? `/socios/${a.entityId}` : a.entity === "Batch" && a.entityId ? `/stock/${a.entityId}` : null;
            const detail = a.action === "LOGIN_FAILED" ? String(p.email ?? "") : typeof p.reason === "string" && p.reason ? `“${p.reason}”` : typeof p.code === "string" ? p.code : "";
            return (
              <li key={a.id}>
                <div className="grow">
                  <div style={{ fontWeight: 550, color: a.action === "LOGIN_FAILED" ? "var(--danger)" : undefined }}>
                    {AUDIT_ACTION[a.action] ?? a.action}
                    {href ? <> · <Link href={href}>ver</Link></> : null}
                  </div>
                  <div className="cell-meta">{a.actor?.name ?? "Sistema o socio"} · {fmtWhen(a.createdAt)}{a.ip ? ` · ${a.ip}` : ""}{detail ? ` · ${detail}` : ""}</div>
                </div>
              </li>
            );
          })}
        </ul>
        {next ? (
          <div className="panel-foot"><span className="cell-meta">Mostrando {items.length}</span><Link className="btn btn-sm btn-quiet" href={`/configuracion?seccion=actividad${sp.tipo ? `&tipo=${sp.tipo}` : ""}&desde=${next}`}>Más antiguas</Link></div>
        ) : null}
      </Panel>
    );
  }

  return (
    <>
      <PageHead title="Configuración" subtitle="Datos legales, reglas de entrega, equipo y registro de actividad del club." />
      <nav className="seg" aria-label="Secciones" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/configuracion?seccion=${t.key}`} aria-current={tab === t.key ? "true" : undefined}>{t.label}</Link>
        ))}
      </nav>
      <div style={{ maxWidth: tab === "actividad" || tab === "equipo" ? undefined : 960 }}>{body}</div>
    </>
  );
}
