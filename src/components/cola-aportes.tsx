"use client";

import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { Chip } from "./ui";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export type ComprobanteEnCola = {
  id: string;
  pickupId: string;
  montoArs: number | null;
  referencia: string | null;
  mime: string;
  size: number;
  status: string;
  createdAt: string;
  analisis: { esperado: number | null; diferencia: number | null; cubreTotal: boolean | null };
  pickup: {
    id: string;
    grams: number;
    status: string;
    deliveryMode: string;
    aporteEstimado: number | null;
    deliveryZona: string | null;
    deliveryAddress: string | null;
    appointment: { scheduledAt: string } | null;
    member: { id: string; legajo: number; firstName: string; lastName: string; email: string | null; phone: string | null };
  };
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Cola de comprobantes del aporte: el club mira la transferencia y decide.
 * Aprobar confirma el pedido; rechazar pide el motivo porque el socio lo va a leer.
 */
export function ColaAportes({ inicial }: { inicial: ComprobanteEnCola[] }) {
  const [items, setItems] = useState(inicial);
  const [busy, setBusy] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function decidir(id: string, decision: "APROBAR" | "RECHAZAR", texto?: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await api<{ comprobantes: ComprobanteEnCola[]; confirmado?: boolean }>(`/api/comprobantes/${id}/decision`, {
        body: { decision, motivo: texto ?? null },
      });
      setItems(res.comprobantes);
      setAbierto(null);
      setMotivo("");
      setAviso(
        decision === "APROBAR"
          ? res.confirmado === false
            ? "Comprobante aprobado. El pedido ya estaba confirmado: no se tocó."
            : "Comprobante aprobado y pedido confirmado."
          : "Comprobante rechazado: el socio puede subir otro.",
      );
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  if (!items.length)
    return (
      <div className="empty">
        No hay comprobantes esperando revisión. Cuando un socio transfiera y suba el suyo, aparece acá.
      </div>
    );

  return (
    <>
      {aviso ? <p className="note note-ok">{aviso}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <ul className="rows">
        {items.map((c) => {
          const socio = `${c.pickup.member.firstName} ${c.pickup.member.lastName}`;
          const falta = c.analisis.diferencia != null && c.analisis.diferencia < -0.5;
          return (
            <li key={c.id} style={{ display: "block" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{socio}</b>
                    <span className="chip">legajo {c.pickup.member.legajo}</span>
                    <Chip tone={falta ? "danger" : c.analisis.cubreTotal === false ? "warn" : "ok"}>
                      {c.montoArs != null ? MONEY.format(c.montoArs) : "sin monto"}
                      {c.analisis.esperado != null ? ` de ${MONEY.format(c.analisis.esperado)}` : ""}
                    </Chip>
                    {falta ? <Chip tone="danger">faltan {MONEY.format(Math.abs(c.analisis.diferencia ?? 0))}</Chip> : null}
                  </div>
                  <div className="cell-meta">
                    {c.pickup.grams} g ·{" "}
                    {c.pickup.deliveryMode === "ENVIO"
                      ? `envío a ${c.pickup.deliveryZona ?? "domicilio"}`
                      : c.pickup.appointment
                        ? `retiro ${fecha(c.pickup.appointment.scheduledAt)}`
                        : "retiro sin turno"}{" "}
                    · subido {fecha(c.createdAt)}
                    {c.referencia ? ` · op. ${c.referencia}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                  >
                    <ExternalLink size={14} /> {abierto === c.id ? "Ocultar" : "Ver comprobante"}
                  </button>
                  <button className="btn btn-sm" type="button" disabled={busy === c.id} onClick={() => decidir(c.id, "APROBAR")}>
                    <Check size={14} /> Aprobar
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => setAbierto(abierto === c.id ? `motivo:${c.id}` : `motivo:${c.id}`)}
                  >
                    <X size={14} /> Rechazar
                  </button>
                </div>
              </div>

              {abierto === c.id || abierto === `motivo:${c.id}` ? (
                <div className="note" style={{ marginTop: 10 }}>
                  {c.mime === "application/pdf" ? (
                    <a className="btn btn-sm btn-ghost" href={`/api/comprobantes/${c.id}`} target="_blank" rel="noreferrer">
                      Abrir PDF
                    </a>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/comprobantes/${c.id}`}
                      alt={`Comprobante de ${socio}`}
                      loading="lazy"
                      decoding="async"
                      style={{ maxWidth: 360, width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  )}
                  {abierto === `motivo:${c.id}` ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Por qué se rechaza (lo lee el socio)</span>
                        <input
                          className="input"
                          value={motivo}
                          onChange={(ev) => setMotivo(ev.target.value)}
                          placeholder="Ej. el monto no cubre el aporte o el comprobante no se lee"
                        />
                      </label>
                      <button
                        className="btn btn-sm"
                        type="button"
                        disabled={busy === c.id || motivo.trim().length < 5}
                        onClick={() => decidir(c.id, "RECHAZAR", motivo)}
                      >
                        Confirmar rechazo
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
