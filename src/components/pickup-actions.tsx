"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { ReasonDialog } from "./dialog";
import { useToast } from "./toast";

/** Reserva del portal: el mostrador confirma, entrega (en el dispensario) o cancela con motivo. */
export function PickupActions({
  id,
  status,
  memberId,
  puedeForzar = false,
}: {
  id: string;
  status: string;
  memberId: string;
  /** Sólo ADMIN: confirmar sin comprobante, con motivo y auditoría. */
  puedeForzar?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [forzar, setForzar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar(sinComprobanteMotivo?: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/pickups/${id}/status`, { body: { status: "CONFIRMADA", sinComprobanteMotivo } });
      toast({ tone: "ok", title: "Reserva confirmada", text: "El socio la ve confirmada en su portal." });
      setForzar(false);
      router.refresh();
    } catch (err) {
      const texto = errMsg(err);
      // Sin comprobante: si el usuario es ADMIN se le ofrece la excepción con motivo; si no, se explica.
      if (puedeForzar && /comprobante/i.test(texto)) {
        setForzar(true);
      } else {
        toast({ tone: "bad", title: "No se pudo confirmar", text: texto });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "SOLICITADA" ? (
        <button className="btn btn-sm btn-quiet" disabled={busy} onClick={() => void confirmar()}>
          Confirmar
        </button>
      ) : null}
      <Link className="btn btn-sm" href={`/dispensario?socio=${memberId}&pickup=${id}`}>Atender</Link>
      <button className="btn btn-sm btn-ghost" onClick={() => { setError(null); setCancel(true); }} disabled={busy}>Cancelar</button>
      <ReasonDialog
        open={forzar}
        onClose={() => setForzar(false)}
        title="Confirmar sin comprobante"
        description="El pedido no tiene comprobante de la transferencia. Si ya está acreditada, dejá el motivo: queda en la auditoría con tu usuario."
        confirmLabel="Confirmar igual"
        reasonLabel="Motivo"
        busy={busy}
        error={error}
        onConfirm={async (reason) => confirmar(reason)}
      />
      <ReasonDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancelar la reserva"
        description="El socio la ve cancelada en el portal, con el motivo. Su turno también se libera."
        confirmLabel="Cancelar reserva"
        reasonLabel="Motivo"
        danger
        busy={busy}
        error={error}
        onConfirm={async (reason) => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/pickups/${id}/cancel`, { body: { reason } });
            toast({ tone: "ok", title: "Reserva cancelada" });
            setCancel(false);
            router.refresh();
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
