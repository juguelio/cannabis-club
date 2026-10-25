"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type Delivery = { itemId: string; ok: boolean; error?: string; message?: string };

/** DDJJ por paciente: se marca acá, en el momento en que el paciente la firma. */
export function DdjjToggle({ shipmentId, itemId, signed }: { shipmentId: string; itemId: string; signed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/shipments/${shipmentId}/items/${itemId}`, { method: "PATCH", body: { ddjjSigned: !signed } });
      toast({ tone: "ok", title: signed ? "DDJJ desmarcada" : "DDJJ marcada", text: signed ? "El traslado no puede salir sin ella." : "Queda registrada la fecha de la firma." });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo marcar", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={signed ? "btn btn-sm btn-quiet" : "btn btn-sm"} onClick={toggle} disabled={busy}>
      {signed ? "Quitar DDJJ" : "Marcar DDJJ"}
    </button>
  );
}

/** Despachar (sale) y entregar (registra cada entrega en el libro, con todos los controles). */
export function ShipmentActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "dispatch" | "deliver">(null);

  async function dispatch() {
    if (!window.confirm("¿Sale el traslado? A partir de acá no se agregan ni se quitan pacientes.")) return;
    setBusy("dispatch");
    try {
      await api(`/api/shipments/${id}/dispatch`, { method: "POST" });
      toast({ tone: "ok", title: "Traslado despachado", text: "Queda registrado quién lo despachó y a qué hora." });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No salió", text: errMsg(err) });
    } finally {
      setBusy(null);
    }
  }

  async function deliver() {
    if (!window.confirm("¿Registrar la entrega de todos los pacientes? Cada uno pasa por los controles del dispensario y deja asiento en el libro.")) return;
    setBusy("deliver");
    try {
      const res = await api<{ delivery: Delivery[]; status: string }>(`/api/shipments/${id}/deliver`, { method: "POST" });
      const failed = res.delivery.filter((d) => !d.ok);
      if (failed.length === 0) {
        toast({ tone: "ok", title: "Traslado entregado", text: `${res.delivery.length} entrega(s) registradas en el libro.` });
      } else {
        toast({ tone: "bad", title: `${failed.length} no se pudo entregar`, text: failed.map((f) => f.message ?? f.error ?? "Error").join(" · ") });
      }
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo entregar", text: errMsg(err) });
    } finally {
      setBusy(null);
    }
  }

  if (status === "PREPARACION") {
    return <button className="btn" onClick={dispatch} disabled={busy !== null}>{busy === "dispatch" ? "Despachando…" : "Despachar traslado"}</button>;
  }
  if (status === "DESPACHADO") {
    return <button className="btn" onClick={deliver} disabled={busy !== null}>{busy === "deliver" ? "Registrando…" : "Registrar entrega"}</button>;
  }
  return null;
}
