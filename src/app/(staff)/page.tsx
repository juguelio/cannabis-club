import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CalendarPlus, CircleCheck, PackageOpen, Scale } from "lucide-react";
import { getSession } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { getClub } from "@/lib/club";
import { faltantesLegales } from "@/lib/datos-legales";
import { esEmailDePrueba, primerosPasos, progresoArranque } from "@/lib/primeros-pasos";
import { noticeBoard } from "@/lib/notices";
import { Avatar, Chip, Empty, Meter, Panel } from "@/components/ui";
import { APPOINTMENT_STATUS, daysToExpiry, fmtGrams, fmtLongDay, fmtWhen, plural, reprocannIssue, STAGE } from "@/lib/labels";

export const metadata = { title: "Panel" };

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(now));
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const now = new Date();
  const [d, notices, altas, club, variedades, lotes, equipo] = await Promise.all([
    dashboardData(now),
    noticeBoard(),
    session.role === "ADMIN" ? prisma.accessRequest.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    getClub(),
    session.role === "ADMIN" ? prisma.strain.count({ where: { active: true } }) : Promise.resolve(0),
    session.role === "ADMIN" ? prisma.batch.count() : Promise.resolve(0),
    session.role === "ADMIN"
      ? prisma.user.findMany({ where: { role: { in: ["ADMIN", "OPERADOR", "DISPENSADOR"] }, active: true }, select: { email: true } })
      : Promise.resolve([]),
  ]);
  // Recordatorio de llenado: los datos legales que sólo el club puede declarar y todavía faltan.
  const legales = session.role === "ADMIN" ? faltantesLegales(club).length : 0;
  const arranque = primerosPasos({
    legalesFaltantes: legales,
    variedades,
    lotes,
    socios: d.members.total,
    equipoReal: equipo.filter((u) => !esEmailDePrueba(u.email)).length,
  });
  const avance = progresoArranque(arranque);

  const attention = d.blocked.length + d.expiring.length;
  const maxBar = Math.max(1, ...d.series.map((p) => p.grams));
  const nextIndex = d.agenda.findIndex((a) => ["PENDIENTE", "CONFIRMADO"].includes(a.status) && new Date(a.at).getTime() >= now.getTime() - 20 * 60_000);
  const weekDelta = d.prevWeek > 0 ? Math.round(((d.week - d.prevWeek) / d.prevWeek) * 100) : null;
  const firstName = session.name.split(" ")[0];

  return (
    <>
      <div className="today-head">
        <h1 className="today-date">
          <small>{greeting(now)}, {firstName}.</small>
          <span>{fmtLongDay(d.today).replace(/^./, (c) => c.toUpperCase())}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-quiet" href="/turnos"><CalendarPlus aria-hidden />Agendar turno</Link>
        </div>
      </div>

      <div className="facts" style={{ marginBottom: 16 }}>
        {altas > 0 ? (
          <Link className="fact" href="/socios?ver=altas" data-tone="warn">
            <div className="fact-label">Altas por revisar</div>
            <div className="fact-value">{altas}</div>
            <div className="fact-hint">{plural(altas, "persona esperando", "personas esperando")}</div>
          </Link>
        ) : null}
        {legales > 0 ? (
          <Link className="fact" href="/configuracion?seccion=legales" data-tone="warn">
            <div className="fact-label">Datos legales</div>
            <div className="fact-value">{legales}</div>
            <div className="fact-hint">{legales === 1 ? "dato sin completar" : "datos sin completar"}</div>
          </Link>
        ) : null}
        <Link className="fact" href="/dispensario">
          <div className="fact-label">Entregado hoy</div>
          <div className="fact-value">{fmtGrams(d.todayPoint.grams).replace(" g", "")}<small>g</small></div>
          <div className="fact-hint">{d.todayPoint.count ? plural(d.todayPoint.count, "entrega", "entregas") : "Todavía ninguna entrega"}</div>
        </Link>
        <Link className="fact" href="/stock">
          <div className="fact-label">Stock para entregar</div>
          <div className="fact-value">{fmtGrams(d.stockG).replace(" g", "")}<small>g</small></div>
          <div className="fact-hint">{plural(d.available.length, "lote disponible", "lotes disponibles")}</div>
        </Link>
        <Link className="fact" href="/socios?estado=ACTIVO">
          <div className="fact-label">Socios activos</div>
          <div className="fact-value">{d.members.active}</div>
          <div className="fact-hint">{d.members.pending ? `${plural(d.members.pending, "pendiente", "pendientes")} de alta` : `${d.members.total} en el padrón`}</div>
        </Link>
        <Link className="fact" href="/avisos" data-tone={notices.urgent ? "danger" : notices.total ? "warn" : undefined}>
          <div className="fact-label">Avisos pendientes</div>
          <div className="fact-value">{notices.total}</div>
          <div className="fact-hint">
            {notices.urgent ? `${plural(notices.urgent, "urgente", "urgentes")} · ${plural(notices.sinAvisar, "sin avisar", "sin avisar")}` : notices.total ? `${plural(notices.sinAvisar, "sin avisar", "sin avisar")}` : "Nadie pendiente"}
          </div>
        </Link>
        <Link className="fact" href="/socios?filtro=reprocann" data-tone={d.blocked.length ? "danger" : d.expiring.length ? "warn" : undefined}>
          <div className="fact-label">REPROCANN a revisar</div>
          <div className="fact-value">{attention}</div>
          <div className="fact-hint">
            {d.blocked.length ? `${plural(d.blocked.length, "no puede", "no pueden")} retirar` : d.expiring.length ? `${plural(d.expiring.length, "vence", "vencen")} en 30 días` : "Todos al día"}
          </div>
        </Link>
      </div>

      {session.role === "ADMIN" && !avance.completo ? (
        <div style={{ marginBottom: 16 }}>
          <Panel
            title="Primeros pasos del club"
            subtitle={`${avance.hechos} de ${avance.total} listos. Cuando estén los cinco, esta tarjeta no vuelve a aparecer.`}
          >
            <div className="panel-body">
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
                {arranque.map((p) => (
                  <li key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, opacity: p.hecho ? 0.6 : 1 }}>
                    <CircleCheck
                      aria-hidden
                      style={{ width: 18, height: 18, flex: "0 0 auto", color: p.hecho ? "var(--ok, #2f7d4f)" : "var(--line)" }}
                    />
                    <Link href={p.href} style={{ fontWeight: 600 }}>{p.label}</Link>
                    <span className="cell-meta">{p.hecho ? "listo" : p.hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="stack">
          <Panel
            title="Agenda de hoy"
            subtitle={d.agenda.length ? `${plural(d.agenda.filter((a) => ["PENDIENTE", "CONFIRMADO"].includes(a.status) && new Date(a.at).getTime() > now.getTime()).length, "socio por llegar", "socios por llegar")} · ${d.pickups ? plural(d.pickups, "reserva del portal abierta", "reservas del portal abiertas") : "sin reservas abiertas"}` : undefined}
            action={<Link className="btn btn-sm btn-quiet" href="/turnos">Ver turnos</Link>}
          >
            {d.agenda.length === 0 ? (
              <Empty icon={CalendarClock} title="Sin turnos para hoy">Los socios pueden reservar desde el portal o se agendan desde Turnos.</Empty>
            ) : (
              <div className="agenda">
                {d.agenda.map((a, i) => {
                  const done = ["ATENDIDO", "AUSENTE"].includes(a.status);
                  return (
                    <Link
                      key={a.id}
                      className="agenda-item"
                      data-state={done ? "done" : i === nextIndex ? "next" : undefined}
                      href={done ? `/socios/${a.memberId}` : `/dispensario?socio=${a.memberId}`}
                    >
                      <span className="agenda-time">{a.time}</span>
                      <span className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</span>
                      <span className="cell-meta">
                        {a.pickupG ? `Reservó ${fmtGrams(a.pickupG)}` : `Legajo ${a.legajo}`}
                        {i === nextIndex ? " · sigue" : ""}
                      </span>
                      {done || a.status === "CONFIRMADO" ? (
                        <span style={{ marginTop: 4 }}><Chip tone={APPOINTMENT_STATUS[a.status]?.tone}>{APPOINTMENT_STATUS[a.status]?.label}</Chip></span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            title="Entregas de las últimas dos semanas"
            subtitle={
              <>
                {fmtGrams(d.week)} en los últimos 7 días
                {weekDelta != null ? `, ${weekDelta >= 0 ? `${weekDelta}% más` : `${Math.abs(weekDelta)}% menos`} que la semana anterior` : ""}. Neto de anulaciones.
              </>
            }
          >
            <div className="bars" role="img" aria-label={`Gramos entregados por día. Hoy: ${fmtGrams(d.todayPoint.grams)}.`}>
              {d.series.map((p, i) => (
                <div key={p.day} className="bar" data-today={i === d.series.length - 1} title={`${p.day.split("-").reverse().slice(0, 2).join("/")}: ${fmtGrams(p.grams)} en ${plural(p.count, "entrega", "entregas")}`}>
                  <i style={{ height: `${Math.max(2, (p.grams / maxBar) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="bar-axis" aria-hidden>
              {d.series.map((p, i) => {
                const [, , dd] = p.day.split("-");
                const wd = new Date(`${p.day}T12:00:00Z`).getUTCDay();
                return <span key={p.day}>{i === d.series.length - 1 ? "hoy" : wd === 1 || i === 0 ? Number(dd) : ""}</span>;
              })}
            </div>
          </Panel>

          <Panel title="Stock para entregar" subtitle="Saldo del libro de cada lote disponible, sobre su peso seco." action={<Link className="btn btn-sm btn-quiet" href="/stock">Ver lotes</Link>}>
            {d.available.length === 0 ? (
              <Empty icon={PackageOpen} title="No hay lotes disponibles">Registrá el peso seco de un lote en Stock para habilitarlo.</Empty>
            ) : (
              <ul className="rows">
                {d.available.map((b) => {
                  const low = d.lowStock.some((l) => l.id === b.id);
                  return (
                    <li key={b.id}>
                      <Link className="rowlink" href={`/stock/${b.id}`}>
                        <div className="grow">
                          <div className="flex items-baseline justify-between gap-3">
                            <span><span className="cell-main">{b.code}</span> <span className="cell-meta">{b.strain}{b.thcPct != null ? `, ${b.thcPct}% THC` : ""}</span></span>
                            <span className="tnum" style={{ fontWeight: 650 }}>{fmtGrams(b.balanceG)}</span>
                          </div>
                          <div style={{ marginTop: 7 }}><Meter value={b.balanceG} max={b.dryG || b.balanceG} tone={low ? "warn" : "ok"} /></div>
                          {low ? <div className="cell-meta" style={{ marginTop: 4, color: "var(--warn)" }}>Queda poco: planificá el próximo lote.</div> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Antes de entregar" subtitle="Socios activos con el REPROCANN vencido o por vencer.">
            {attention === 0 ? (
              <Empty icon={CircleCheck} title="Todos habilitados">Ningún socio activo tiene el REPROCANN vencido ni por vencer en 30 días.</Empty>
            ) : (
              <ul className="rows">
                {[...d.blocked, ...d.expiring].slice(0, 7).map((m) => {
                  const issue = reprocannIssue(m);
                  const days = daysToExpiry(m.reprocannExpiresAt);
                  return (
                    <li key={m.id}>
                      <Link className="rowlink" href={`/socios/${m.id}`}>
                        <Avatar first={m.firstName} last={m.lastName} tone={issue.tone === "danger" ? "danger" : "warn"} />
                        <div className="grow">
                          <div className="cell-main truncate">{m.lastName}, {m.firstName}</div>
                          <div className="cell-meta">Legajo {m.legajo}{days != null && days >= 0 ? ` · vence en ${plural(days, "día", "días")}` : ""}</div>
                        </div>
                        <Chip tone={issue.tone}>{issue.tone === "danger" ? issue.label.replace("REPROCANN ", "") : "Por vencer"}</Chip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Últimas entregas" action={<Link className="btn btn-sm btn-quiet" href="/dispensario#libro">Libro</Link>}>
            {d.latest.length === 0 ? (
              <Empty icon={Scale} title="Sin entregas todavía">La primera entrega aparece acá con su lote y operador.</Empty>
            ) : (
              <ul className="rows">
                {d.latest.map((x) => (
                  <li key={x.id} className={x.voidedAt ? "voided" : undefined}>
                    <Link className="rowlink" href={`/socios/${x.member.id}`}>
                      <div className="grow">
                        <div className="cell-main truncate" style={x.voidedAt ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>
                          {x.member.lastName}, {x.member.firstName}
                        </div>
                        <div className="cell-meta truncate">{fmtWhen(x.occurredAt, now)} · {x.batch.strain.name} · {x.operator.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="tnum" style={{ fontWeight: 650 }}>{fmtGrams(x.grams)}</div>
                        {x.voidedAt ? <div className="cell-meta">anulada</div> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {d.growing.length ? (
            <Panel title="En cultivo" subtitle="Lotes que todavía no acreditan stock.">
              <ul className="rows">
                {d.growing.map((b) => (
                  <li key={b.id}>
                    <Link className="rowlink" href={`/stock/${b.id}`}>
                      <div className="grow"><span className="cell-main">{b.code}</span> <span className="cell-meta">{b.strain}</span></div>
                      <Chip tone={STAGE[b.stage]?.tone}>{STAGE[b.stage]?.label}</Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
