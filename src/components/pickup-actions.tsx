"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * El único camino a RETIRADA es registrar la entrega.
 * Acá sólo se confirma la reserva y se abre el mostrador con ese contexto
 * (socio + reserva + gramos), para que la entrega cierre exactamente esa reserva.
 */
export function PickupActions({
  id,
  status,
  memberId,
}: {
  id: string;
  status: string;
  memberId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/pickups/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMADA" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.message ?? "No se pudo confirmar la reserva");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === "SOLICITADA" ? (
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={confirm}>
          Confirmar
        </button>
      ) : null}
      <Link className="btn btn-sm" href={`/dispensario?socio=${memberId}&pickup=${id}`}>
        Atender reserva
      </Link>
    </div>
  );
}
