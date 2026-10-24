"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PickupActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(next: "CONFIRMADA" | "RETIRADA") {
    setBusy(true);
    try {
      await fetch(`/api/pickups/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === "SOLICITADA" ? (
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => move("CONFIRMADA")}>
          Confirmar
        </button>
      ) : null}
      <button className="btn btn-sm" disabled={busy} onClick={() => move("RETIRADA")}>
        Marcar retirada
      </button>
    </div>
  );
}
