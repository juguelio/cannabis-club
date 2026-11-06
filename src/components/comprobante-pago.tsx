"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { errMsg } from "@/lib/client";
import { formatearCbu } from "@/lib/cbu";
import { ESTADO_PAGO_LABEL, type EstadoPago } from "@/lib/comprobante-rules";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export type CobroClub = {
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  banco: string | null;
  nota: string | null;
};

/**
 * Comprobante del aporte: el socio transfiere y sube la foto, el club la mira y decide.
 * No hay pasarela de pago: esta pantalla es la que cierra el circuito.
 */
export function ComprobantePago({
  pickupId,
  aporteEstimado,
  envioArs,
  pago,
  pagoMotivo,
  cobro,
  onSubido,
  repetirCobro = true,
}: {
  pickupId: string;
  aporteEstimado: number | null;
  envioArs?: number | null;
  pago: EstadoPago;
  pagoMotivo?: string | null;
  cobro: CobroClub;
  onSubido: () => void;
  /** `false` cuando la pantalla ya muestra alias y CBU arriba: repetirlos es ruido. */
  repetirCobro?: boolean;
}) {
  const [monto, setMonto] = useState(aporteEstimado != null ? String(Math.round(aporteEstimado)) : "");
  const [referencia, setReferencia] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const total = aporteEstimado != null && envioArs != null ? aporteEstimado + envioArs : aporteEstimado;
  const hayCobro = Boolean(cobro.alias || cobro.cbu);

  if (pago === "APROBADO")
    return <p className="note note-ok" style={{ marginTop: 8 }}>El club aprobó tu comprobante: el aporte está registrado.</p>;

  if (pago === "EN_REVISION" || listo)
    return (
      <p className="note note-mute" style={{ marginTop: 8 }}>
        Comprobante recibido. El club lo revisa y te avisa; mientras tanto el pedido queda reservado.
      </p>
    );

  async function subir() {
    if (!archivo) {
      setError("Adjuntá la foto o el PDF del comprobante.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pickupId });
      if (monto.trim()) params.set("monto", monto.replace(",", "."));
      if (referencia.trim()) params.set("referencia", referencia.trim());
      const res = await fetch(`/api/portal/comprobante?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": archivo.type || "application/octet-stream" },
        body: archivo,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "No pudimos subir el comprobante.");
      }
      setListo(true);
      setArchivo(null);
      if (input.current) input.current.value = "";
      onSubido();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="note" style={{ marginTop: 8, display: "grid", gap: 8 }}>
      {pago === "RECHAZADO" ? (
        <span className="chip chip-danger">Comprobante rechazado{pagoMotivo ? `: ${pagoMotivo}` : ""}</span>
      ) : null}

      <div>
        <b>{total != null ? `Transferí ${MONEY.format(total)}` : "Transferí el aporte"}</b>
        {envioArs != null && aporteEstimado != null ? (
          <span className="muted"> ({MONEY.format(aporteEstimado)} de aporte + {MONEY.format(envioArs)} de envío)</span>
        ) : null}
      </div>

      {hayCobro && repetirCobro ? (
        <div className="cell-meta">
          {cobro.alias ? <>Alias <b>{cobro.alias}</b>{" · "}</> : null}
          {cobro.cbu ? <>CBU <b className="tnum">{formatearCbu(cobro.cbu)}</b>{" · "}</> : null}
          {cobro.titular ? <>{cobro.titular}{" · "}</> : null}
          {cobro.banco ?? ""}
        </div>
      ) : !hayCobro ? (
        <p className="muted" style={{ margin: 0 }}>
          El club todavía no cargó los datos para transferir. Pedíselos por WhatsApp y subí el comprobante cuando lo hagas.
        </p>
      ) : null}
      {cobro.nota ? <p className="muted" style={{ margin: 0 }}>{cobro.nota}</p> : null}

      <div className="flex items-center gap-2 flex-wrap">
        <label className="field" style={{ margin: 0 }}>
          <span>Monto transferido</span>
          <input
            className="input tnum"
            inputMode="decimal"
            value={monto}
            onChange={(ev) => setMonto(ev.target.value)}
            placeholder={aporteEstimado != null ? String(Math.round(total ?? aporteEstimado)) : "0"}
            style={{ maxWidth: 140 }}
          />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>N° de operación (opcional)</span>
          <input
            className="input"
            value={referencia}
            onChange={(ev) => setReferencia(ev.target.value)}
            placeholder="Ej. 0012345"
            style={{ maxWidth: 180 }}
          />
        </label>
      </div>

      {/* El control nativo dice «Choose file / No file chosen» en inglés y rompe el idioma de la
          pantalla: se usa un botón propio y el input queda sólo para el sistema. */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(ev) => setArchivo(ev.target.files?.[0] ?? null)}
          className="sr-only"
          id={`comprobante-file-${pickupId}`}
          aria-label="Foto o PDF del comprobante"
        />
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() => (archivo ? void subir() : input.current?.click())}
        >
          <Upload size={14} /> {busy ? "Subiendo…" : archivo ? "Subir comprobante" : "Elegir el comprobante"}
        </button>
        {archivo ? (
          <span className="cell-meta">
            {archivo.name.length > 28 ? `${archivo.name.slice(0, 26)}…` : archivo.name}
            {" · "}
            <button type="button" className="cobro-copiar" onClick={() => input.current?.click()}>
              cambiar
            </button>
          </span>
        ) : null}
      </div>

      {error ? <p className="form-error" style={{ margin: 0 }}>{error}</p> : null}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {ESTADO_PAGO_LABEL[pago]}. Se aceptan fotos (JPG, PNG, WEBP) o PDF de hasta 6 MB.
      </p>
    </div>
  );
}
