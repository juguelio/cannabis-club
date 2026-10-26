"use client";

import { useState } from "react";

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

async function post<T>(url: string, payload: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message ?? "No pudimos guardar los datos.");
  return data as T;
}

export function SolicitudForm({
  email,
  solicitud,
  club,
}: {
  email: string;
  solicitud: EstadoSolicitud | null;
  club: string;
}) {
  const [estado, setEstado] = useState<EstadoSolicitud | null>(solicitud);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [datos, setDatos] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    address: "",
    locality: "",
    docNumber: "",
    reprocannNumber: "",
    reprocannExpiresAt: "",
    consumptionType: "LUDICO",
    affidavitAccepted: false,
  });

  const campos = (k: keyof typeof datos) => ({
    value: datos[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDatos({ ...datos, [k]: e.target.value }),
  });

  async function presentar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await post("/api/solicitud", { ...datos, locality: datos.locality || null });
      const fresco = await fetch("/api/solicitud").then((r) => r.json());
      setEstado(fresco.solicitud);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los datos.");
    } finally {
      setEnviando(false);
    }
  }

  async function subir(tipo: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX) return setError("El archivo supera los 6 MB.");
    if (!MIMES.includes(file.type)) return setError("Sólo JPG, PNG, WEBP o PDF.");
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
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              {DOCS.map((d) => (
                <li key={d.tipo}>
                  {d.label}: {cargado(d.tipo) ? "recibido" : "falta"}
                </li>
              ))}
            </ul>
            {faltan.length > 0 && (
              <div className="stack">
                <p className="hint">Todavía falta subir {faltan.length === 1 ? "un archivo" : `${faltan.length} archivos`}:</p>
                {faltan.map((d) => (
                  <label key={d.tipo} className="label">
                    {d.label} — {d.ayuda}
                    <input
                      className="input"
                      type="file"
                      accept={MIMES.join(",")}
                      disabled={subiendo === d.tipo}
                      onChange={(e) => subir(d.tipo, e.target.files?.[0])}
                    />
                  </label>
                ))}
              </div>
            )}
            {error && <p className="note note-danger">{error}</p>}
            <p className="hint">
              Si necesitás corregir algo, escribile al club. Las fotos quedan cifradas y sólo las abre la persona que
              revisa tu legajo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sin solicitud (o rechazada): formulario.
  return (
    <form className="stack" onSubmit={presentar}>
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

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">1 · Tus datos</h2>
          <p className="panel-sub">Ingresaste como {email}. Estos datos van al legajo de {club}.</p>
        </div>
        <div className="panel-body stack">
          <div className="field-row">
            <label className="label">
              Nombre
              <input className="input" required {...campos("firstName")} />
            </label>
            <label className="label">
              Apellido
              <input className="input" required {...campos("lastName")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              Fecha de nacimiento
              <input className="input" type="date" required {...campos("birthDate")} />
            </label>
            <label className="label">
              DNI
              <input className="input tnum" inputMode="numeric" placeholder="30123456" required {...campos("docNumber")} />
            </label>
          </div>
          <div className="field-row">
            <label className="label">
              Teléfono
              <input className="input" placeholder="294 412 3456" required {...campos("phone")} />
            </label>
            <label className="label">
              Localidad
              <input className="input" placeholder="San Martín de los Andes" {...campos("locality")} />
            </label>
          </div>
          <label className="label">
            Domicilio
            <input className="input" required {...campos("address")} />
          </label>
          <div className="field-row">
            <label className="label">
              N° de REPROCANN
              <input className="input tnum" required {...campos("reprocannNumber")} />
            </label>
            <label className="label">
              Vence
              <input className="input" type="date" required {...campos("reprocannExpiresAt")} />
            </label>
          </div>
          <label className="label">
            Tipo de consumo
            <select className="select" value={datos.consumptionType} onChange={(e) => setDatos({ ...datos, consumptionType: e.target.value })}>
              <option value="LUDICO">Lúdico</option>
              <option value="TERAPEUTICO">Terapéutico</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={datos.affidavitAccepted}
              onChange={(e) => setDatos({ ...datos, affidavitAccepted: e.target.checked })}
            />
            Declaro que los datos son verdaderos y que el cultivo es para mi consumo personal (Ley 27.350 y REPROCANN).
          </label>
          {error && <p className="note note-danger">{error}</p>}
          <div>
            <button className="btn btn-lg" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Continuar a la documentación"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
