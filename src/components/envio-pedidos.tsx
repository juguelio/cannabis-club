"use client";

import { ValidatedForm, Select, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type Pedido = {
  id: string;
  memberId: string;
  memberName: string;
  legajo: number;
  grams: number;
  zona: string | null;
  costoArs: number | null;
  direccion: string | null;
  creado: string;
};
type Traslado = { id: string; code: string };
type Lote = { id: string; code: string; strain: string; available: number };

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

/**
 * Pedidos de envío que hizo el socio desde el portal.
 *
 * No se entregan desde acá: se cargan en un traslado, con lote, y ese ítem queda atado al pedido.
 * Entregar el traslado cierra la reserva del socio; sin esa atadura el pedido quedaría abierto
 * para siempre y el socio vería "en preparación" algo que ya recibió.
 */
export function EnvioPedidos({ pedidos, traslados, lotes }: { pedidos: Pedido[]; traslados: Traslado[]; lotes: Lote[] }) {
  const router = useRouter();
  const toast = useToast();
  const [shipmentId, setShipmentId] = useState<Record<string, string>>({});
  const [batchId, setBatchId] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  async function cargar(pedido: Pedido, report: ReportFields) {
    const ship = shipmentId[pedido.id] ?? traslados[0]?.id ?? "";
    const batch = batchId[pedido.id] ?? "";
    setBusy(pedido.id);
    setError((e) => ({ ...e, [pedido.id]: "" }));
    try {
      await api(`/api/shipments/${ship}/items`, {
        body: { memberId: pedido.memberId, batchId: batch, grams: pedido.grams, pickupRequestId: pedido.id },
      });
      toast({ tone: "ok", title: "Cargado en el traslado", text: "Falta la DDJJ del socio para despachar." });
      router.refresh();
    } catch (err) {
      if (!report(err)) setError((e) => ({ ...e, [pedido.id]: errMsg(err) }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="rows">
      {pedidos.map((p) => (
        <li key={p.id} style={{ display: "block" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <b>{p.memberName}</b>
            <span className="cell-meta">legajo {p.legajo}</span>
            <span className="chip chip-brand">{g(p.grams)}</span>
            {p.zona ? <span className="chip">{p.zona}</span> : null}
            {p.costoArs != null ? <span className="cell-meta">envío {MONEY.format(p.costoArs)}</span> : null}
            <span className="cell-meta">{p.creado}</span>
          </div>
          <div className="cell-meta" style={{ marginTop: 4 }}>
            {p.direccion ?? "sin dirección"}
          </div>
          <ValidatedForm onSubmit={(_, report) => cargar(p, report)} className="flex items-end gap-2 flex-wrap" style={{ marginTop: 10 }}>
            <label className="stack" style={{ gap: 4 }}>
              <span className="cell-meta">Traslado</span>
              <Select required name="shipmentId"
                className="input"
                value={shipmentId[p.id] ?? traslados[0]?.id ?? ""}
                onChange={(e) => setShipmentId((s) => ({ ...s, [p.id]: e.target.value }))}
              >
                {traslados.map((t) => (
                  <option key={t.id} value={t.id}>{t.code}</option>
                ))}
              </Select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="cell-meta">Lote</span>
              <Select required name="batchId" className="input" value={batchId[p.id] ?? ""} onChange={(e) => setBatchId((s) => ({ ...s, [p.id]: e.target.value }))}>
                <option value="">Elegir lote…</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.strain} · {g(l.available)}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" className="btn btn-sm" disabled={busy === p.id}>
              {busy === p.id ? "Cargando…" : "Cargar en el traslado"}
            </button>
          </ValidatedForm>
          {error[p.id] ? <div className="note note-danger" role="alert" style={{ marginTop: 8 }}>{error[p.id]}</div> : null}
        </li>
      ))}
    </ul>
  );
}
