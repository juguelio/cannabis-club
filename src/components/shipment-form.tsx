"use client";

import { ValidatedForm, Input, Select, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";

/** Alta de un traslado: destino, cómo viaja y quién lo lleva. Después se le cargan los pacientes. */
export function ShipmentForm({ defaultFrom }: { defaultFrom: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit({ values }: FormSubmission, reportFields: ReportFields) {
    setBusy(true);
    setError(null);
    try {
      const { mode, fromAddress, toAddress, carrierName, carrierDoc, plannedAt, noticeRef, notes } = values;
      const res = await api<{ shipment: { id: string; code: string } }>("/api/shipments", {
        body: { mode, fromAddress, toAddress, carrierName, carrierDoc: carrierDoc || undefined, plannedAt: plannedAt || undefined, noticeRef: noticeRef || undefined, notes: notes || undefined },
      });
      toast({ tone: "ok", title: `Traslado ${res.shipment.code} abierto`, text: "Ahora agregá los pacientes con su DDJJ." });
      router.push(`/traslados/${res.shipment.id}`);
    } catch (err) {
      if (!reportFields(err)) setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button className="btn" onClick={() => setOpen(true)}>Nuevo traslado</button>;
  }

  return (
    <ValidatedForm className="stack" style={{ gap: 12 }} onSubmit={submit}>
      <div className="grid-2">
        <div>
          <label className="label" htmlFor="sh-mode">Cómo viaja</label>
          <Select className="input" id="sh-mode" name="mode" defaultValue="TERRESTRE">
            <option value="TERRESTRE">Terrestre</option>
            <option value="AEREO">Aéreo</option>
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="sh-planned">Fecha prevista</label>
          <Input className="input" id="sh-planned" type="date" name="plannedAt" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sh-from">Sale desde</label>
        <Input className="input" id="sh-from" name="fromAddress" defaultValue={defaultFrom} maxLength={160} required />
      </div>
      <div>
        <label className="label" htmlFor="sh-to">Destino</label>
        <Input className="input" id="sh-to" placeholder="San Martín de los Andes, Neuquén" name="toAddress" maxLength={160} required />
      </div>
      <div className="grid-2">
        <div>
          <label className="label" htmlFor="sh-carrier">Quién lo lleva</label>
          <Input className="input" id="sh-carrier" placeholder="Nombre y apellido del responsable" name="carrierName" maxLength={120} required />
        </div>
        <div>
          <label className="label" htmlFor="sh-doc">Documento del responsable</label>
          <Input className="input" id="sh-doc" name="carrierDoc" maxLength={20} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sh-notice">Aviso previo a la autoridad</label>
        <Input className="input" id="sh-notice" placeholder="Número o constancia del aviso (si corresponde)" name="noticeRef" maxLength={120} />
        <span className="hint">Si el traslado lo requiere, dejá la constancia: es lo que se muestra en un control.</span>
      </div>
      <div>
        <label className="label" htmlFor="sh-notes">Notas</label>
        <Input className="input" id="sh-notes" name="notes" maxLength={400} />
      </div>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div className="flex gap-2">
        <button className="btn" type="submit" disabled={busy}>{busy ? "Abriendo…" : "Abrir traslado"}</button>
        <button className="btn btn-quiet" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
      </div>
    </ValidatedForm>
  );
}
