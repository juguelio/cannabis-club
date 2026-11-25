"use client";

import { ValidatedForm, Input, Select, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { validarSolicitud } from "@/lib/access-request";
import { z } from "zod";
import Link from "next/link";

const solicitudSchema = z.record(z.string(), z.unknown()).superRefine((values, ctx) => {
  for (const { campo, mensaje } of validarSolicitud(values)) {
    ctx.addIssue({ code: "custom", path: [campo], message: mensaje });
  }
});

type Documento = { id: string; tipo: string; mime: string; size: number };
export type EstadoSolicitud = {
  status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  firstName: string;
  lastName: string;
  reprocannNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  documents: Documento[];
};

const DOCS = [
  { tipo: "DNI_FRENTE", label: "DNI (frente)", ayuda: "Foto derecha, con los datos legibles." },
  { tipo: "DNI_DORSO", label: "DNI (dorso)", ayuda: "Donde está el número de trámite." },
  { tipo: "REPROCANN", label: "Credencial REPROCANN", ayuda: "La credencial vigente a tu nombre." },
];
const MAX = 6 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];


export type PadronPrevio = {
  legajo: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  locality: string | null;
  province: string | null;
  postalCode: string | null;
  verificationStatus: string;
} | null;

export function SolicitudForm({
  email,
  solicitud,
  club,
  padron,
}: {
  email: string;
  solicitud: EstadoSolicitud | null;
  club: string;
  /** Si el email ya está en el padrón, esto es un reclamo de ese legajo, no un alta nueva. */
  padron?: PadronPrevio;
}) {
  const [estado, setEstado] = useState<EstadoSolicitud | null>(solicitud);
  // Sin REPROCANN el alta no se puede completar: el número y el vencimiento son obligatorios. Se
  // pregunta antes de mostrar el formulario, para no hacerlo llenar seis campos y chocar al final.
  const [tieneReprocann, setTieneReprocann] = useState<"SI" | "NO" | null>(null);
  // Se pregunta siempre que no haya una solicitud ya presentada: el número de REPROCANN es obligatorio
  // también para el socio del padrón que viene a reclamar su legajo.
  const pideGate = !estado;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivoConError, setArchivoConError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Record<string, string>>({});
  const datosIniciales = {
    // El padrón ya sabe nombre, teléfono y domicilio: se precargan y la persona corrige lo que falte.
    firstName: padron?.firstName ?? "",
    lastName: padron?.lastName ?? "",
    birthDate: "",
    phone: padron?.phone ?? "",
    address: padron?.address ?? "",
    locality: [padron?.locality, padron?.province].filter(Boolean).join(", ") ?? "",
    docNumber: "",
    reprocannNumber: "",
    reprocannExpiresAt: "",
    consumptionType: "LUDICO",
  };

  const campos = (k: keyof typeof datosIniciales) => ({
    name: k,
    defaultValue: datosIniciales[k],
  });

  async function presentar({ values: datos }: FormSubmission, reportFields: ReportFields) {
    setError(null);
    setEnviando(true);
    try {
      try {
        await api("/api/solicitud", { body: { ...datos, locality: datos.locality || null } });
      } catch (err) {
        if (reportFields(err)) return;
        if (!(err instanceof ApiError) || (err.status > 0 && err.status < 500 && err.code !== "YA_PRESENTADA")) {
          setError(err instanceof Error ? err.message : "No pudimos presentar la solicitud. Volvé a intentar.");
          return;
        }
        // Un envío interrumpido puede haberse guardado. Consultar su estado antes de pedir otro intento.
      }
      try {
        const fresco = await api<{ solicitud: EstadoSolicitud | null }>("/api/solicitud");
        if (fresco.solicitud && fresco.solicitud.status !== "RECHAZADA") {
          setEstado(fresco.solicitud);
        } else {
          setError("La solicitud no quedó presentada. El servicio de altas no pudo completar el envío. Tus datos siguen en esta pantalla. Volvé a intentar en unos minutos.");
        }
      } catch {
        setError("No pudimos confirmar si el club recibió la solicitud. Conservamos lo que escribiste en esta pantalla. Revisá tu conexión y volvé a intentar en unos minutos.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function subir(tipo: string, file: File | undefined) {
    if (!file) return;
    setArchivoConError(tipo);
    setError(null);
    if (file.size > MAX) return setError("El archivo supera los 6 MB.");
    if (!MIMES.includes(file.type)) return setError("Sólo JPG, PNG, WEBP o PDF.");
    if (file.type.startsWith("image/")) {
      setPrevia((p) => ({ ...p, [tipo]: URL.createObjectURL(file) }));
    }
    setSubiendo(tipo);
    try {
      const r = await fetch(`/api/solicitud/documentos?tipo=${tipo}`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? "No pudimos subir el archivo.");
      const fresco = await fetch("/api/solicitud").then((x) => x.json());
      setEstado(fresco.solicitud);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
    } finally {
      setSubiendo(null);
    }
  }

  const cargado = (tipo: string) => !!estado?.documents.some((d) => d.tipo === tipo);

  // Ya presentó y está en revisión (o aprobada): se muestra el estado, no el formulario.
  if (estado && estado.status !== "RECHAZADA") {
    const faltan = DOCS.filter((d) => !cargado(d.tipo));
    return (
      <div className="stack">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Solicitud recibida</h2>
            <p className="panel-sub">
              {estado.firstName} {estado.lastName} · {email}
            </p>
          </div>
          <div className="panel-body stack">
            <p>
              <b>El club va a chequear tu documentación.</b> Cuando esté aprobada, tu cuenta se habilita y vas a poder
              entrar al portal del socio con el mismo botón de Google.
            </p>
            <div className="stack">
              <p className="hint">
                {faltan.length > 0
                  ? `Todavía falta subir ${faltan.length === 1 ? "un archivo" : `${faltan.length} archivos`}.`
                  : "Ya están los tres. Si alguno salió movido o ilegible, podés reemplazarlo ahora."}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {DOCS.map((d) => (
                  <div key={d.tipo} style={{ border: `1px ${cargado(d.tipo) ? "solid" : "dashed"} var(--line)`, borderRadius: 10, padding: 12 }}>
                    {previa[d.tipo] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={previa[d.tipo]}
                        alt={d.label}
                        style={{ width: "100%", height: 120, objectFit: "contain", background: "var(--surface, #fff)", borderRadius: 8, border: "1px solid var(--line)", display: "block", marginBottom: 8 }}
                      />
                    ) : null}
                    <b style={{ display: "block", fontSize: 13.5 }}>{d.label}</b>
                    <small className="muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                      {(() => {
                        const doc = estado.documents.find((x) => x.tipo === d.tipo);
                        return doc ? `recibido · ${Math.max(1, Math.round(doc.size / 1024))} KB` : d.ayuda;
                      })()}
                    </small>
                    <label
                      className="btn btn-sm btn-quiet"
                      style={{ cursor: subiendo === d.tipo ? "progress" : "pointer", display: "inline-flex", opacity: subiendo === d.tipo ? 0.7 : 1 }}
                    >
                      {subiendo === d.tipo ? "Subiendo…" : cargado(d.tipo) ? "Reemplazar archivo" : "Subir archivo"}
                      <input
                        type="file"
                        aria-invalid={archivoConError === d.tipo && error ? true : undefined}
                        aria-describedby={archivoConError === d.tipo && error ? `archivo-error-${d.tipo}` : undefined}
                        accept={MIMES.join(",")}
                        disabled={subiendo === d.tipo}
                        onChange={(e) => subir(d.tipo, e.target.files?.[0])}
                        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
                        aria-label={`${cargado(d.tipo) ? "Reemplazar" : "Subir"} ${d.label}`}
                      />
                    </label>
                    {archivoConError === d.tipo && error && <small role="alert" className="field-error" id={`archivo-error-${d.tipo}`}>{error}</small>}
                    <small className="muted" style={{ fontSize: 11.5, display: "block", marginTop: 4 }}>
                      JPG, PNG o PDF · hasta 6 MB
                    </small>
                  </div>
                ))}
              </div>
            </div>
            <p className="hint">
              Podés reemplazar cualquier archivo mientras la solicitud está en revisión. Las fotos quedan cifradas y
              sólo las abre la persona que revisa tu legajo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sin solicitud (o rechazada): formulario.
  return (
    <ValidatedForm schema={solicitudSchema} className="stack" onChange={() => setError(null)} onSubmit={presentar}>
      {estado?.status === "RECHAZADA" && (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Tu solicitud fue rechazada</h2>
          </div>
          <div className="panel-body">
            <p className="note note-danger">{estado.rejectionReason}</p>
            <p className="hint">Corregí lo que indica el motivo y volvé a presentarla.</p>
          </div>
        </div>
      )}

      {pideGate && tieneReprocann === null ? (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Antes de empezar · ¿Tenés REPROCANN?</h2>
            <p className="panel-sub">
              Es el permiso del Ministerio de Salud que habilita el cultivo. Sin él el club no puede asociar a nadie, así
              que lo primero es saber en qué punto estás.
            </p>
          </div>
          <div className="panel-body">
            <div className="wiz-opciones">
              <button type="button" className="wiz-opcion" onClick={() => setTieneReprocann("SI")}>
                <span className="wiz-opcion-titulo">Sí, ya lo tengo</span>
                <span className="wiz-opcion-detalle">Sigo con el formulario de alta.</span>
              </button>
              <button type="button" className="wiz-opcion" onClick={() => setTieneReprocann("NO")}>
                <span className="wiz-opcion-titulo">No, todavía no</span>
                <span className="wiz-opcion-detalle">Ver cómo sacarlo, paso a paso.</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pideGate && tieneReprocann === "NO" ? (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Sin REPROCANN no podemos completar el alta</h2>
            <p className="panel-sub">
              No es una traba del club: el número y el vencimiento del trámite son obligatorios, y el Ministerio tiene que
              haberte autorizado antes de vincularte.
            </p>
          </div>
          <div className="panel-body stack">
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
              <li>Pedís un turno con el consultorio y hacés la consulta por videollamada.</li>
              <li>El consultorio carga el trámite y vos aceptás los términos en REPROCANN.</li>
              <li>El club te vincula, REPROCANN aprueba y descargás tu credencial.</li>
            </ol>
            <div>
              <Link className="btn btn-lg" href="/reprocann" target="_blank">
                Cómo sacarlo, paso a paso
              </Link>
            </div>
            <div>
              <button type="button" className="btn btn-quiet" onClick={() => setTieneReprocann("SI")}>
                Ya lo tengo: volver al formulario
              </button>
            </div>
            <p className="hint">
              Tu cuenta ya está creada. Cuando tengas el permiso volvés, entrás con el mismo botón y completás el alta:
              no perdés nada de lo que hiciste.
            </p>
          </div>
        </div>
      ) : null}

      {(!pideGate || tieneReprocann === "SI") ? (
      <>
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">1 · Tus datos</h2>
          <p className="panel-sub">Ingresaste como {email}. Estos datos van al legajo de {club}.</p>
        </div>
        <div className="panel-body stack">
          <div className="field-row">
            <label className="label">
              Nombre
              <Input className="input" required {...campos("firstName")} />
            </label>
            <label className="label">
              Apellido
              <Input className="input" required {...campos("lastName")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              Fecha de nacimiento
              <Input className="input" type="date" required {...campos("birthDate")} />
            </label>
            <label className="label">
              DNI
              <Input className="input tnum" inputMode="numeric" placeholder="30123456" required {...campos("docNumber")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              Teléfono
              <Input className="input" placeholder="294 412 3456" required {...campos("phone")} />
            </label>
            <label className="label">
              Localidad
              <Input className="input" placeholder="San Martín de los Andes" {...campos("locality")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              Domicilio
              <Input className="input" required {...campos("address")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              N° de REPROCANN
              <Input className="input tnum" required {...campos("reprocannNumber")} />
            </label>
            <label className="label">
              Vence
              <Input className="input" type="date" required {...campos("reprocannExpiresAt")} />
            </label>
          </div>
          <label className="label">
            Tipo de consumo
            <Select className="select" {...campos("consumptionType")}>
              <option value="LUDICO">Lúdico</option>
              <option value="TERAPEUTICO">Terapéutico</option>
            </Select>
          </label>
          <label className="check">
            <Input
              type="checkbox"
              name="affidavitAccepted" required
            />
            Declaro que los datos son verdaderos y que el cultivo es para mi consumo personal (Ley 27.350 y REPROCANN).
          </label>
          <p className="note" style={{ fontSize: 13, display: "block" }}>
            Al presentar la solicitud aceptás los{" "}
            <Link href="/terminos" target="_blank">
              Términos y Condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" target="_blank">
              Política de Privacidad
            </Link>{" "}
            del club.
          </p>
          {error && <p className="note note-danger" role="alert">{error}</p>}
          <div>
            <button className="btn btn-lg" type="submit" disabled={enviando}>
              {enviando ? "Presentando solicitud…" : "Presentar solicitud y subir documentos"}
            </button>
          </div>
        </div>
      </div>
      </>
      ) : null}
    </ValidatedForm>
  );
}
