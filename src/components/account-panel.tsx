"use client";

import { ValidatedForm, Input, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

type Entry = {
  id: string;
  kind: "CARGO" | "PAGO";
  concept: "CUOTA_SOCIAL" | "CUOTA_INGRESO" | "APORTE_CULTIVO" | "AJUSTE";
  amountArs: number;
  period: string | null;
  occurredAt: string;
  note: string | null;
  voided: boolean;
  reversed: boolean;
  by?: string | null;
};

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const CONCEPT: Record<Entry["concept"], string> = {
  CUOTA_SOCIAL: "Cuota social",
  CUOTA_INGRESO: "Cuota de ingreso",
  APORTE_CULTIVO: "Aporte de cultivo",
  AJUSTE: "Ajuste",
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function AccountPanel({
  memberId,
  balance,
  entries,
  canVoid,
}: {
  memberId: string;
  balance: number;
  entries: Entry[];
  canVoid: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debe = balance > 0.009;
  const aFavor = balance < -0.009;

  async function pay(_: FormSubmission, reportFields: ReportFields) {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError(null);
      reportFields([{ campo: "amountArs", mensaje: "Ingresá el importe pagado como un número mayor que cero." }]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/members/${memberId}/account`, { body: { amountArs: value, note: note.trim() || undefined } });
      setAmount("");
      setNote("");
      toast({ tone: "ok", title: "Pago registrado", text: `${MONEY.format(value)} acreditados al socio.` });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function voidEntry(id: string) {
    const reason = window.prompt("Motivo de la anulación (queda en el libro):");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/account/entries/${id}/void`, { body: { reason: reason.trim() } });
      toast({ tone: "ok", title: "Asiento anulado", text: "Se registró el contra-asiento." });
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-body">
      <div className="flex flex-wrap items-end justify-between gap-3" style={{ marginBottom: 14 }}>
        <div>
          <div className="label">Saldo de la cuenta</div>
          <div className="tnum" style={{ fontSize: 28, fontWeight: 650, color: debe ? "var(--danger, #b3261e)" : aFavor ? "var(--ok, #14683f)" : undefined }}>
            {MONEY.format(Math.abs(balance))}
          </div>
          <div className="cell-meta">{debe ? "Adeuda" : aFavor ? "Saldo a favor" : "Al día"}</div>
        </div>
        <ValidatedForm onSubmit={pay} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="acc-amount">Registrar pago</label>
            <Input
              id="acc-amount"
              className="input tnum"
              inputMode="decimal"
              placeholder="$ 0"
              name="amountArs" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              style={{ width: 120 }}
            />
          </div>
          <Input
            className="input"
            placeholder="Detalle (opcional)"
            name="note" value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: 180 }}
            aria-label="Detalle del pago"
          />
          <button className="btn btn-sm" disabled={busy}>{busy ? "Guardando…" : "Acreditar"}</button>
        </ValidatedForm>
      </div>

      {error ? <div className="note note-bad" style={{ marginBottom: 12 }}>{error}</div> : null}

      {entries.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Sin movimientos todavía: la cuenta se abre con la primera cuota o el primer retiro.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th><th /></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={e.voided ? { opacity: 0.55 } : undefined}>
                <td className="tnum">{fmtDate(e.occurredAt)}</td>
                <td>
                  {CONCEPT[e.concept]}
                  {e.period ? <span className="cell-meta"> · {e.period}</span> : null}
                  {e.note ? <span className="cell-meta"> · {e.note}</span> : null}
                </td>
                <td className="num tnum" style={{ color: e.kind === "CARGO" ? undefined : "var(--ok, #14683f)" }}>
                  {e.kind === "CARGO" ? "" : "− "}{MONEY.format(e.amountArs)}
                </td>
                <td className="num">
                  {e.voided ? <span className="cell-meta">anulado</span> : null}
                  {!e.voided && !e.reversed && canVoid ? (
                    <button className="btn btn-sm btn-quiet" onClick={() => voidEntry(e.id)} disabled={busy}>Anular</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="cell-meta" style={{ marginTop: 12 }}>
        Los aportes son el prorrateo de los costos del cultivo, no el precio de una venta. Corregir un asiento es un
        contra-asiento: nunca se edita ni se borra.
      </p>
    </div>
  );
}
