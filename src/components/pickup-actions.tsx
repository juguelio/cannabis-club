"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { ReasonDialog } from "./dialog";
import { useToast } from "./toast";

/** Reserva del portal: el mostrador confirma, entrega (en el dispensario) o cancela con motivo. */
export function PickupActions({ id, status, memberId }: { id: string; status: string; memberId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "SOLICITADA" ? (
        <button
          className="btn btn-sm btn-quiet"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/api/pickups/${id}/status`, { body: { status: "CONFIRMADA" } });
              toast({ tone: "ok", title: "Reserva confirmada", text: "El socio la ve confirmada en su portal." });
              router.refresh();
            } catch (err) {
              toast({ tone: "bad", title: "No se pudo confirmar", text: errMsg(err) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirmar
        </button>
      ) : null}
      <Link className="btn btn-sm" href={`/dispensario?socio=${memberId}&pickup=${id}`}>Atender</Link>
      <button className="btn btn-sm btn-ghost" onClick={() => { setError(null); setCancel(true); }} disabled={busy}>Cancelar</button>
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
