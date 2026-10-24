"use client";

import { useEffect, useRef } from "react";

/** Diálogo modal nativo (<dialog>): foco atrapado, Esc para cerrar, sin librerías. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className = "",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dlg ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <>
          {title ? (
            <div className="dlg-head">
              <h2 className="dlg-title" id={labelledBy}>{title}</h2>
            </div>
          ) : null}
          {children}
          {footer ? <div className="dlg-foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

/** Diálogo de confirmación con motivo opcional u obligatorio. */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  reasonLabel = "Motivo",
  reasonRequired = true,
  danger,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} labelledBy="reason-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
          onConfirm(v);
        }}
      >
        <div className="dlg-body stack" style={{ gap: 12 }}>
          {description ? <div className="muted" style={{ fontSize: 14 }}>{description}</div> : null}
          <div>
            <label className="label" htmlFor="reason">{reasonLabel}</label>
            <textarea id="reason" name="reason" className="textarea" required={reasonRequired} minLength={reasonRequired ? 5 : undefined} autoFocus />
            {reasonRequired ? <span className="hint">Queda en el registro, con tu nombre y la hora.</span> : null}
          </div>
          {error ? <div className="note note-danger">{error}</div> : null}
        </div>
        <div className="dlg-foot">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Volver</button>
          <button className={`btn ${danger ? "btn-danger-solid" : ""}`} disabled={busy}>{busy ? "Guardando…" : confirmLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
