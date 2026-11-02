import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BellRing } from "lucide-react";
import { Chip, Empty, PageHead, Panel } from "@/components/ui";
import { NoticeActions } from "@/components/notice-actions";
import { NOTICE_KINDS, noticeBoard, waLink } from "@/lib/notices";
import { mailerConfigured } from "@/lib/mailer";
import { fmtWhen } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SEVERITY_TONE = { danger: "danger", warn: "warn", mute: "mute" } as const;

/**
 * Avisos a socios: la cola de "a quién hay que escribirle y por qué".
 * El envío lo hace una persona; acá se prepara el mensaje y se deja registro.
 */
export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; solo?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const tipo = sp.tipo && sp.tipo in NOTICE_KINDS ? sp.tipo : null;
  const soloSinAvisar = sp.solo === "sin-avisar";
  const board = await noticeBoard();

  const rows = board.rows
    .map((r) => ({ ...r, notices: r.notices.filter((n) => (!tipo || n.kind === tipo) && (!soloSinAvisar || !n.lastSentAt)) }))
    .filter((r) => r.notices.length > 0);

  const counts = Object.keys(NOTICE_KINDS).map((kind) => ({
    kind,
    label: NOTICE_KINDS[kind as keyof typeof NOTICE_KINDS].label,
    count: board.rows.reduce((acc, r) => acc + r.notices.filter((n) => n.kind === kind).length, 0),
  }));

  return (
    <>
      <PageHead
        title="Avisos"
        subtitle="A quién hay que escribirle y por qué. La app prepara el mensaje y registra quién avisó: no manda WhatsApp sola."
        actions={<Link className="btn btn-sm btn-quiet" href="/socios?filtro=reprocann">Padrón filtrado</Link>}
      />

      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 16 }}>
        <Link className={`btn btn-sm ${!tipo && !soloSinAvisar ? "" : "btn-quiet"}`} href="/avisos">Todos ({board.total})</Link>
        {counts.filter((c) => c.count > 0).map((c) => (
          <Link key={c.kind} className={`btn btn-sm ${tipo === c.kind ? "" : "btn-quiet"}`} href={`/avisos?tipo=${c.kind}`}>
            {c.label} ({c.count})
          </Link>
        ))}
        <Link className={`btn btn-sm ${soloSinAvisar ? "" : "btn-quiet"}`} href="/avisos?solo=sin-avisar">
          Sin avisar ({board.sinAvisar})
        </Link>
      </div>

      {board.urgent > 0 ? (
        <div className="note note-bad" style={{ marginBottom: 16 }}>
          <div>
            <b>{board.urgent} aviso{board.urgent === 1 ? "" : "s"} urgente{board.urgent === 1 ? "" : "s"}.</b>{" "}
            Son socios que hoy no pueden retirar hasta regularizar.
          </div>
        </div>
      ) : null}

      <div className={mailerConfigured() ? "note" : "note note-warn"}>
        <div>
          {mailerConfigured()
            ? `El vencimiento del REPROCANN se avisa solo: sale un email cuando le faltan ${board.umbral} días o menos, una vez por vencimiento. Abajo quedan los demás motivos, que los avisa una persona.`
            : `El aviso de vencimiento está listo pero el correo saliente no está configurado, así que no sale solo. Los socios por vencer aparecen igual en esta cola (a ${board.umbral} días) para avisarles a mano.`}
        </div>
      </div>

      <Panel title="Cola de avisos" subtitle="Ordenada por urgencia: primero lo que bloquea una entrega.">
        <div className="panel-body">
          {rows.length === 0 ? (
            <Empty icon={BellRing} title="Nada pendiente">No hay avisos con ese filtro. Si el padrón está al día, esto queda vacío.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Socio</th><th>Motivo</th><th>Último aviso</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  r.notices.map((n) => (
                    <tr key={`${r.memberId}-${n.kind}`}>
                      <td>
                        <Link className="rowlink" href={`/socios/${r.memberId}`}>{r.name}</Link>
                        <div className="cell-meta">Legajo {r.legajo}{r.phone ? ` · ${r.phone}` : " · sin teléfono"}</div>
                      </td>
                      <td>
                        <Chip tone={SEVERITY_TONE[n.severity]}>{n.label}</Chip>
                        <div className="cell-meta" style={{ marginTop: 4 }}>{n.detail} · {n.why}</div>
                      </td>
                      <td className="cell-meta">
                        {n.lastSentAt ? <>{fmtWhen(n.lastSentAt)}<br />{n.lastChannel?.toLowerCase()}</> : "Sin avisar"}
                      </td>
                      <td>
                        <NoticeActions
                          memberId={r.memberId}
                          kind={n.kind}
                          episode={n.episode}
                          label={n.label}
                          waHref={waLink(r.phone, n.message)}
                          lastSentAt={n.lastSentAt}
                        />
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <Panel title="El mensaje que se manda" subtitle="Sale del motivo, así no hay que redactarlo cada vez.">
        <div className="panel-body">
          <p className="cell-meta" style={{ marginTop: 0 }}>
            «Hola {"{nombre}"}, tu REPROCANN vence en {"{N}"} días. Si no lo renovás, no vas a poder retirar. Te conviene
            iniciar el trámite ahora.»
          </p>
          <p className="cell-meta" style={{ marginBottom: 0 }}>
            WhatsApp abre el chat con el texto cargado y lo envía la persona que atiende. Cada envío queda registrado con
            quién lo hizo y por qué canal; si el socio no tiene teléfono, el aviso se marca como «en el club».
          </p>
        </div>
      </Panel>
    </>
  );
}
