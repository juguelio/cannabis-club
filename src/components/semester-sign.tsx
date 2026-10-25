"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

/** Firmar el informe semestral: congela los números y deja la huella. */
export function SemesterSign({ period, signed }: { period: string; signed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function sign() {
    if (!window.confirm(`¿Firmar el informe ${period} en carácter de declaración jurada? Los números quedan congelados y no se editan.`)) return;
    setBusy(true);
    try {
      const res = await api<{ report: { hash: string } }>("/api/semester", { body: { periodo: period } });
      toast({ tone: "ok", title: "Informe firmado", text: `Huella ${res.report.hash.slice(0, 12)}… · queda en el libro.` });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo firmar", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  if (signed) return null;
  return (
    <button className="btn" onClick={sign} disabled={busy}>
      {busy ? "Firmando…" : "Firmar informe"}
    </button>
  );
}
