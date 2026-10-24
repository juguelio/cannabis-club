"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Plus, Scale, Scissors, SlidersHorizontal, Undo2 } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { STAGE } from "@/lib/labels";
import { Dialog, ReasonDialog } from "./dialog";
import { BatchForm, HarvestForm, MovementForm } from "./forms";
import { useToast } from "./toast";

export function NewBatchButton({ strains }: { strains: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><Plus aria-hidden />Nuevo lote</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo lote" labelledBy="nb-title" className="dlg-wide">
        <div className="dlg-body" style={{ paddingBottom: 20 }}>
          <p className="muted" style={{ marginTop: 0 }}>El origen del material de propagación es el primer dato de la trazabilidad.</p>
          <BatchForm strains={strains} onDone={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}

export function MovementButton({ batches, batchId, label = "Ajuste o destrucción" }: { batches?: { id: string; code: string }[]; batchId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-quiet" onClick={() => setOpen(true)}><SlidersHorizontal aria-hidden />{label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Movimiento de stock" labelledBy="mv-title">
        <div className="dlg-body" style={{ paddingBottom: 20 }}>
          <p className="muted" style={{ marginTop: 0 }}>Queda en el libro con tu nombre. Para corregir un error se registra el movimiento opuesto: nada se borra.</p>
          <MovementForm batches={batches} batchId={batchId} onDone={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}

export function HarvestButton({ batch }: { batch: { id: string; code: string; stage: string; wetWeightG: number | null } }) {
  const [open, setOpen] = useState(false);
  const dry = batch.wetWeightG != null;
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>{dry ? <Scale aria-hidden /> : <Scissors aria-hidden />}{dry ? "Registrar peso seco" : "Registrar cosecha"}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={dry ? `Peso seco de ${batch.code}` : `Cosecha de ${batch.code}`} labelledBy="hv-title">
        <div className="dlg-body" style={{ paddingBottom: 20 }}>
          <HarvestForm batch={batch} onDone={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}

const STAGE_VERB: Record<string, string> = {
  VEGETATIVO: "Pasar a vegetativo",
  FLORACION: "Pasar a floración",
  CURADO: "Pasar a curado",
  AGOTADO: "Dar por agotado",
  DISPONIBLE: "Reabrir para entregas",
  DESTRUIDO: "Destruir lote",
};

export function StageActions({ id, code, next, balanceG, isAdmin }: { id: string; code: string; next: string[]; balanceG: number; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(to: string, reason?: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/batches/${id}`, { method: "PATCH", body: { stage: to, reason } });
      toast({ tone: "ok", title: `${code}: ${STAGE[to]?.label ?? to}` });
      setTarget(null);
      router.refresh();
    } catch (err) {
      if (target) setError(errMsg(err));
      else toast({ tone: "bad", title: "No se pudo cambiar la etapa", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  const visible = next.filter((s) => (s === "DESTRUIDO" ? isAdmin : true)).filter((s) => !(s === "AGOTADO" && balanceG > 0));
  return (
    <>
      {visible.map((s) => {
        const Icon = s === "DESTRUIDO" ? Flame : s === "DISPONIBLE" ? Undo2 : ArrowRight;
        return (
          <button
            key={s}
            className={`btn ${s === "DESTRUIDO" ? "btn-danger" : "btn-quiet"}`}
            disabled={busy}
            onClick={() => (s === "DESTRUIDO" ? (setError(null), setTarget(s)) : move(s))}
          >
            <Icon aria-hidden />{STAGE_VERB[s] ?? s}
          </button>
        );
      })}
      <ReasonDialog
        open={target === "DESTRUIDO"}
        onClose={() => setTarget(null)}
        title={`Destruir ${code}`}
        description={balanceG > 0 ? `Se registra la destrucción de los ${balanceG} g que quedan en el libro de destrucciones, y el lote se cierra.` : "El lote se cierra como destruido."}
        confirmLabel="Destruir lote"
        reasonLabel="Motivo de la destrucción"
        danger
        busy={busy}
        error={error}
        onConfirm={(reason) => move("DESTRUIDO", reason)}
      />
    </>
  );
}
