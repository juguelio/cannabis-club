"use client";

import { ValidatedForm, Input, Select, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";
import { MemberPicker } from "@/components/member-picker";

type PickerMember = { id: string; legajo: number; name: string; docLast4?: string | null };
type BatchOption = { id: string; code: string; strain: string; available: number };

/** Carga un paciente en el traslado: lote, gramos y, después, la DDJJ firmada. */
export function ShipmentItemForm({
  shipmentId,
  members,
  batches,
}: {
  shipmentId: string;
  members: PickerMember[];
  batches: BatchOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [memberId, setMemberId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [grams, setGrams] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(_: FormSubmission, reportFields: ReportFields) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/shipments/${shipmentId}/items`, {
        body: { memberId, batchId, grams: Number(grams.replace(",", ".")) },
      });
      toast({ tone: "ok", title: "Paciente agregado", text: "Falta la DDJJ firmada para que el traslado pueda salir." });
      setGrams("");
      setMemberId("");
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="stack" style={{ gap: 10 }} onSubmit={submit}>
      <MemberPicker members={members} value={memberId} onChange={setMemberId} />
      <div className="grid-2">
        <div>
          <label className="label" htmlFor="si-batch">Lote</label>
          <Select className="input" id="si-batch" name="batchId" value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
            <option value="">Elegir lote…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} · {b.strain} · {b.available} g</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="si-grams">Gramos</label>
          <Input className="input" id="si-grams" inputMode="decimal" name="grams" value={grams} onChange={(e) => setGrams(e.target.value)} required />
        </div>
      </div>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div>
        <button className="btn" type="submit" disabled={busy || !memberId || !batchId || !grams}>{busy ? "Agregando…" : "Agregar al traslado"}</button>
      </div>
    </ValidatedForm>
  );
}
