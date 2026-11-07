"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, FileText, X } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ReasonDialog } from "@/components/dialog";
import { COLUMNAS, type ColumnaTablero, type ParaPreparar, type PedidoTablero } from "@/lib/tablero-pedidos";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/**
 * Tablero de pedidos: cinco columnas y un panel.
 *
 * Reemplaza el recorrido por `/aportes`, `/dispensario` y `/traslados` para seguir un pedido. La
 * decisión del comprobante es la misma de siempre —los mismos endpoints, las mismas reglas—; lo que
 * cambia es que ahora se toma mirando el pedido entero: quién es, qué pidió, cuánto declaró y cuánto
 * se esperaba.
 */
export function TableroPedidos({
  pedidos,
  paraPreparar,
}: {
  pedidos: PedidoTablero[];
  paraPreparar: ParaPreparar[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [filtro, setFiltro] = useState<"TODOS" | "RETIRO" | "ENVIO">("TODOS");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = pedidos.filter((p) => filtro === "TODOS" || p.mode === filtro);
  const sel = pedidos.find((p) => p.id === abierto) ?? null;

  async function decidir(decision: "APROBAR" | "RECHAZAR", motivo?: string) {
    if (!sel?.comprobante) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/comprobantes/${sel.comprobante.id}/decision`, {
        body: { decision, motivo: motivo ?? null },
      });
      toast({
        tone: "ok",
        title: decision === "APROBAR" ? "Comprobante aprobado" : "Comprobante rechazado",
        text: decision === "APROBAR" ? "El pedido pasó a preparar." : "El socio puede subir otro.",
      });
      setRechazar(false);
      setAbierto(null);
      router.refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const porColumna = (c: ColumnaTablero) => visibles.filter((p) => p.columna === c);

  return (
    <div className="tablero">
      <div className="tablero-barra">
        <div className="filtros" role="group" aria-label="Filtrar pedidos">
          {(
            [
              ["TODOS", `Todos (${pedidos.length})`],
              ["RETIRO", "Retiros"],
              ["ENVIO", "Envíos"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button key={valor} type="button" className="filtro-btn" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
              {etiqueta}
            </button>
          ))}
        </div>

        {paraPreparar.length ? (
          <div className="para-preparar">
            <b>Para preparar hoy</b>
            <ul>
              {paraPreparar.map((p) => (
                <li key={p.nombre}>
                  <span>{p.nombre}</span>
                  <span className="tnum">{g(p.gramos)}</span>
                  <small>{p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="tablero-columnas">
        {COLUMNAS.map((c) => {
          const lista = porColumna(c.key);
          return (
            <section key={c.key} className="tablero-col" aria-labelledby={`col-${c.key}`}>
              <header>
                <h2 id={`col-${c.key}`}>
                  {c.titulo} <span className="tnum">{lista.length}</span>
                </h2>
                <small>{c.ayuda}</small>
              </header>
              <ul>
                {lista.length === 0 ? <li className="tablero-vacio">Nada acá.</li> : null}
                {lista.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="tablero-card" onClick={() => setAbierto(p.id)}>
                      <span className="tablero-card-top">
                        <b>{p.member.nombre}</b>
                        <span className="cell-meta tnum">Legajo {p.member.legajo}</span>
                      </span>
                      <span className="tablero-card-datos">
                        <span className="tnum">{g(p.grams)}</span>
                        <span>{p.mode === "ENVIO" ? `Envío · ${p.zona ?? "zona"}` : "Retiro en el club"}</span>
                      </span>
                      <span className="tablero-card-pie">
                        <small>{p.cuando ?? "sin horario"}</small>
                        {p.comprobante ? (
                          <small className="tnum">
                            {p.comprobante.monto != null ? MONEY.format(p.comprobante.monto) : "sin monto"} · {hora(p.comprobante.createdAt)}
                          </small>
                        ) : (
                          <small>sin comprobante</small>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {sel ? (
        <div className="drawer-fondo" onClick={() => setAbierto(null)} role="presentation">
          <aside className="tablero-panel" onClick={(e) => e.stopPropagation()} aria-label={`Pedido de ${sel.member.nombre}`}>
            <header className="tablero-panel-head">
              <div>
                <b>{sel.member.nombre}</b>
                <span className="cell-meta">
                  Legajo {sel.member.legajo} · REPROCANN {sel.member.reprocann.toLowerCase()}
                  {sel.member.venceReprocann ? ` · vence ${sel.member.venceReprocann}` : ""}
                </span>
              </div>
              <button type="button" className="tablero-cerrar" onClick={() => setAbierto(null)} aria-label="Cerrar">
                <X aria-hidden size={18} />
              </button>
            </header>

            <div className="tablero-panel-body">
              <div className="tablero-linea">
                <span>{sel.mode === "ENVIO" ? "Envío" : "Retiro"}</span>
                <b>{sel.cuando ?? "sin horario"}</b>
              </div>
              {sel.mode === "ENVIO" && sel.direccion ? (
                <div className="tablero-linea"><span>Dirección</span><b>{sel.direccion}</b></div>
              ) : null}

              <ul className="cuenta">
                {sel.items.map((i) => (
                  <li key={i.nombre}>
                    <span>{i.nombre}</span>
                    <span className="tnum">{g(i.gramos)}</span>
                  </li>
                ))}
                <li className="cuenta-total">
                  <span>Esperado</span>
                  <span className="tnum">{sel.esperado != null ? MONEY.format(sel.esperado) : "—"}</span>
                </li>
              </ul>

              {sel.comprobante ? (
                <div className="tablero-comprobante">
                  <span className="chip">{sel.comprobante.estado === "EN_REVISION" ? "En revisión" : sel.comprobante.estado === "APROBADO" ? "Aprobado" : "Rechazado"}</span>
                  <div className="tablero-linea">
                    <span>Declaró</span>
                    <b className="tnum">{sel.comprobante.monto != null ? MONEY.format(sel.comprobante.monto) : "—"}</b>
                  </div>
                  {sel.comprobante.monto != null && sel.esperado != null ? (
                    <span className={`cell-meta${Math.abs(sel.comprobante.monto - sel.esperado) < 1 ? "" : " tablero-difiere"}`}>
                      {Math.abs(sel.comprobante.monto - sel.esperado) < 1
                        ? "Coincide con lo esperado."
                        : `Declaró ${MONEY.format(sel.comprobante.monto)} y se esperaban ${MONEY.format(sel.esperado)}.`}
                    </span>
                  ) : null}
                  <a
                    className="btn btn-sm btn-quiet"
                    href={`/api/comprobantes/${sel.comprobante.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText aria-hidden size={14} /> Ver el comprobante
                  </a>
                  <small className="cell-meta">Cada apertura queda auditada.</small>
                </div>
              ) : (
                <p className="note note-warn" style={{ margin: 0 }}>
                  <CircleAlert aria-hidden />
                  <span>El socio todavía no subió el comprobante: sin él no se aprueba ni se prepara.</span>
                </p>
              )}

              {error ? <p className="form-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
            </div>

            {sel.comprobante?.estado === "EN_REVISION" ? (
              <footer className="tablero-panel-pie">
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setRechazar(true)}>
                  Rechazar
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void decidir("APROBAR")}>
                  <Check aria-hidden size={15} /> {busy ? "Guardando…" : "Aprobar y pasar a preparar"}
                </button>
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}

      <ReasonDialog
        open={rechazar}
        onClose={() => setRechazar(false)}
        title="Rechazar el comprobante"
        description="El socio puede subir otro. Decile qué pasó para que lo corrija."
        confirmLabel="Rechazar"
        reasonLabel="Motivo"
        busy={busy}
        error={error}
        onConfirm={async (motivo) => decidir("RECHAZAR", motivo)}
      />
    </div>
  );
}
