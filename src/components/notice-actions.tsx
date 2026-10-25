"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type Channel = "WHATSAPP" | "LLAMADO" | "PRESENCIAL" | "EMAIL";

/**
 * Acciones de un aviso: abrir WhatsApp con el texto ya escrito (lo manda una persona)
 * y dejar constancia. La app no envía mensajes por sí sola.
 */
export function NoticeActions({
  memberId,
  kind,
  episode,
  label,
  waHref,
  lastSentAt,
}: {
  memberId: string;
  kind: string;
  /** Hecho concreto que se avisa (un vencimiento, una reserva): cada uno cuenta como episodio propio. */
  episode: string;
  label: string;
  waHref: string | null;
  lastSentAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function mark(channel: Channel) {
    setBusy(true);
    try {
      await api("/api/notices", { body: { memberId, kind, episode, channel } });
      toast({ tone: "ok", title: "Aviso registrado", text: `${label} · queda la constancia de quién lo hizo y cuándo. No es prueba de entrega.` });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo registrar", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ justifyContent: "flex-end" }}>
      {waHref ? (
        <a className="btn btn-sm btn-quiet" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>
      ) : (
        <button className="btn btn-sm btn-quiet" disabled={busy} onClick={() => mark("PRESENCIAL")}>Avisar en el club</button>
      )}
      <button className="btn btn-sm" disabled={busy} onClick={() => mark(waHref ? "WHATSAPP" : "LLAMADO")}>
        {lastSentAt ? "Avisé de nuevo" : "Ya lo avisé"}
      </button>
    </div>
  );
}
