"use client";

import { useRef, useState } from "react";
import { Camera, FileText, Upload } from "lucide-react";
import { errMsg } from "@/lib/client";
import { formatearCbu } from "@/lib/cbu";
import { ESTADO_PAGO_LABEL, detalleEsperado, esperadoDelPedido, type EstadoPago } from "@/lib/comprobante-rules";
import { validarComprobante, type ArchivoElegido } from "@/lib/comprobante-cliente";

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
 *
 * El archivo se valida **antes** de subirlo (tipo y 6 MB, el mismo límite que el servidor) para no
 * hacer esperar a nadie por un error que se sabe en el primer segundo. Desde el celular se ofrece la
 * cámara y la galería por separado: «elegir archivo» en un iPhone abre una lista que asusta.
 */
export function ComprobantePago({
  pickupId,
  aporteEstimado,
  envioArs,
  modo,
  pago,
  pagoMotivo,
  cobro,
  onSubido,
  repetirCobro = true,
}: {
  pickupId: string;
  aporteEstimado: number | null;
  envioArs?: number | null;
  /** El modo del pedido: sin esto un envío sin costo cargado se confundiría con un retiro. */
  modo?: "RETIRO" | "ENVIO" | "SUCURSAL";
  pago: EstadoPago;
  pagoMotivo?: string | null;
  cobro: CobroClub;
  onSubido: () => void;
  /** `false` cuando la pantalla ya muestra alias y CBU arriba: repetirlos es ruido. */
  repetirCobro?: boolean;
}) {
  // Mismo cálculo que el tablero y la cola de aportes: el monto que se le pide al socio y el que el
  // club compara salen de la misma función (`esperadoDelPedido`), no de una suma hecha en cada pantalla.
  const esperado = esperadoDelPedido({
    aporte: aporteEstimado,
    envio: envioArs ?? null,
    modo: modo ?? (envioArs != null ? "ENVIO" : "RETIRO"),
  });
  const total = esperado.esperado;
  const detalle = detalleEsperado(esperado, (n) => MONEY.format(n));
  // El monto sugerido es el total a transferir: pedir 199 y esperar 224 es el bug que reportó el club.
  const [monto, setMonto] = useState(total != null ? String(Math.round(total)) : "");
  const [otroMonto, setOtroMonto] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const hayCobro = Boolean(cobro.alias || cobro.cbu);

  if (pago === "APROBADO")
    return <p className="note note-ok" style={{ marginTop: 8 }}>El club aprobó tu comprobante: el aporte está registrado.</p>;

  if (pago === "EN_REVISION" || listo)
    return (
      <p className="note note-mute" style={{ marginTop: 8 }}>
        Comprobante recibido. El club lo revisa y te avisa; mientras tanto el pedido queda reservado.
      </p>
    );

  async function elegir(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    const r = await validarComprobante(file);
    if (!r.ok) {
      setArchivo(null);
      setError(r.motivo);
      return;
    }
    setArchivo(r.archivo);
  }

  async function subir() {
    if (!archivo) {
      setError("Primero subí el comprobante.");
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
        headers: { "Content-Type": archivo.tipo || "application/octet-stream" },
        body: archivo.file,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        // Nunca «Error interno»: si el servidor no explica, se dice qué hacer.
        throw new Error(
          json?.message ??
            (res.status >= 500
              ? "El club no pudo recibir el archivo. Probá de nuevo en un minuto o mandalo por WhatsApp."
              : "No pudimos subir el comprobante."),
        );
      }
      setListo(true);
      setArchivo(null);
      if (camara.current) camara.current.value = "";
      if (galeria.current) galeria.current.value = "";
      onSubido();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comprobante" style={{ marginTop: 8, display: "grid", gap: 10 }}>
      {pago === "RECHAZADO" ? (
        <span className="chip chip-danger">Comprobante rechazado{pagoMotivo ? `: ${pagoMotivo}` : ""}</span>
      ) : null}

      <div>
        <b>{total != null ? `Transferí ${MONEY.format(total)}` : "Transferí el aporte"}</b>
        {detalle ? <span className="muted"> ({detalle})</span> : null}
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

      {/* Zona del archivo: se puede tocar, soltar o sacar una foto. */}
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(ev) => void elegir(ev.target.files?.[0])}
        className="sr-only"
        aria-label="Sacar una foto del comprobante"
      />
      <input
        ref={galeria}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(ev) => void elegir(ev.target.files?.[0])}
        className="sr-only"
        id={`comprobante-file-${pickupId}`}
        aria-label="Elegir una captura o un PDF del comprobante"
      />

      {archivo ? (
        <div className="comprobante-archivo">
          {archivo.preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={archivo.preview} alt="Comprobante elegido" />
          ) : (
            <span className="comprobante-pdf">
              <FileText aria-hidden size={20} /> PDF
            </span>
          )}
          <div className="comprobante-archivo-datos">
            <b>{archivo.nombre}</b>
            <small>{archivo.peso}</small>
          </div>
          <button type="button" className="cobro-copiar" onClick={() => galeria.current?.click()}>
            cambiar
          </button>
          <button
            type="button"
            className="cobro-copiar"
            onClick={() => {
              setArchivo(null);
              setError(null);
              if (camara.current) camara.current.value = "";
              if (galeria.current) galeria.current.value = "";
            }}
          >
            quitar
          </button>
        </div>
      ) : (
        <div
          className={`comprobante-zona${arrastrando ? " comprobante-zona--over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void elegir(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="comprobante-zona-txt">
            Arrastrá la foto o el PDF acá
            <small>JPG, PNG, WEBP o PDF · hasta 6 MB</small>
          </span>
          <div className="comprobante-zona-botones">
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => camara.current?.click()}>
              <Camera aria-hidden size={15} /> Sacar foto
            </button>
            <button type="button" className="btn btn-sm" onClick={() => galeria.current?.click()}>
              <Upload aria-hidden size={15} /> Captura o PDF
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
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
        {otroMonto ? (
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
        ) : (
          <button type="button" className="cobro-copiar" style={{ alignSelf: "end" }} onClick={() => setOtroMonto(true)}>
            Transferí otro monto
          </button>
        )}
      </div>

      {error ? <p className="form-error" style={{ margin: 0 }} role="alert">{error}</p> : null}

      <button type="button" className="btn btn-lg btn-block" disabled={busy || !archivo} onClick={subir}>
        {busy ? "Subiendo…" : archivo ? "Subir comprobante" : "Primero subí el comprobante"}
      </button>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {ESTADO_PAGO_LABEL[pago]}. Sin comprobante el pedido no se cierra.
      </p>
    </div>
  );
}
