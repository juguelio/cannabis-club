"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleAlert, FileText, X } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";
import { ReasonDialog } from "@/components/dialog";
import { COLUMNAS, type ColumnaTablero, type ParaPreparar, type PedidoTablero } from "@/lib/tablero-pedidos";
import { detalleEsperado } from "@/lib/comprobante-rules";
import { esDespacho, esSucursal } from "@/lib/entrega";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/**
 * Listado de pedidos por estado con un panel de detalle.
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
  // El filtro «Envíos» agrupa domicilio y sucursal: los dos salen del club.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = pedidos.filter((p) =>
    filtro === "TODOS" ? true : filtro === "ENVIO" ? esDespacho(p.mode) : !esDespacho(p.mode),
  );
  const sel = pedidos.find((p) => p.id === abierto) ?? null;
  // Mismo cálculo y mismo formateador que el total: el desglose no puede decir otra cosa.
  const detalle = sel ? detalleEsperado(sel.esperado, (n) => MONEY.format(n)) : null;

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

      <div className="pedidos-listado">
        {visibles.length === 0 && <p className="pedidos-vacio">No hay pedidos para esta selección.</p>}
        {COLUMNAS.map((c) => {
          const lista = porColumna(c.key);
          if (!lista.length) return null;
          return (
            <section key={c.key} aria-labelledby={`col-${c.key}`}>
              <header className="pedidos-grupo">
                <h2 id={`col-${c.key}`}>{c.titulo} <span className="tnum">{lista.length}</span></h2>
                <small>{c.ayuda}</small>
              </header>
              <ul>
                {lista.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="pedidos-fila" onClick={() => { setError(null); setAbierto(p.id); }}>
                      <span className="pedidos-socio">
                        <b>{p.member.nombre}</b>
                        <small>Legajo {p.member.legajo}</small>
                      </span>
                      <strong className="pedidos-gramos tnum">{g(p.grams)}</strong>
                      <span className="pedidos-entrega">
                        {esDespacho(p.mode)
                          ? [esSucursal(p.mode) ? "Sucursal" : "Envío", p.zona].filter(Boolean).join(" · ")
                          : "Retiro en el club"}
                        <small>{p.cuando ?? "Sin horario"}</small>
                      </span>
                      <span className="pedidos-pago tnum">
                        {p.comprobante ? (
                          <>
                            {p.comprobante.monto != null ? MONEY.format(p.comprobante.monto) : "Sin monto"}
                            <small>Comprobante · {hora(p.comprobante.createdAt)}</small>
                          </>
                        ) : <small>Sin comprobante</small>}
                      </span>
                      <ChevronRight size={16} aria-hidden className="pedidos-abrir" />
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
                  <span className="tnum">
                    {sel.esperado.esperado != null ? MONEY.format(sel.esperado.esperado) : "—"}
                  </span>
                </li>
              </ul>
              {/* El desglose sale del mismo cálculo que el total: no puede decir otra cosa. */}
              {detalle ? <p className="cell-meta" style={{ margin: "2px 0 0" }}>{detalle}</p> : null}

              {sel.comprobante ? (
                <div className="tablero-comprobante">
                  <span className="chip">{sel.comprobante.estado === "EN_REVISION" ? "En revisión" : sel.comprobante.estado === "APROBADO" ? "Aprobado" : "Rechazado"}</span>
                  <div className="tablero-linea">
                    <span>Declaró</span>
                    <b className="tnum">{sel.comprobante.monto != null ? MONEY.format(sel.comprobante.monto) : "—"}</b>
                  </div>
                  {sel.comprobante.monto != null && sel.esperado.esperado != null ? (
                    <span
                      className={`cell-meta${
                        Math.abs(sel.comprobante.monto - sel.esperado.esperado) < 1 ? "" : " tablero-difiere"
                      }`}
                    >
                      {Math.abs(sel.comprobante.monto - sel.esperado.esperado) < 1
                        ? "Coincide con lo esperado."
                        : `Declaró ${MONEY.format(sel.comprobante.monto)} y se esperaban ${MONEY.format(sel.esperado.esperado)}.`}
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
