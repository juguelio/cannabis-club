"use client";

import { ValidatedForm, Textarea } from "./validated-form";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, Empty, Panel } from "@/components/ui";
import { Inbox } from "lucide-react";

type Doc = { id: string; tipo: string; mime: string; size: number };
type Solicitud = {
  id: string;
  /** Presente cuando la solicitud reclama un legajo que ya está en el padrón. */
  memberId: string | null;
  status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  address: string;
  locality: string | null;
  docLast4: string;
  reprocannNumber: string;
  reprocannExpiresAt: string;
  consumptionType: string;
  submittedAt: string;
  rejectionReason: string | null;
  member: { legajo: number } | null;
  user: { email: string };
  documents: Doc[];
  faltantes: string[];
};

const DOC_LABEL: Record<string, string> = {
  DNI_FRENTE: "DNI frente",
  DNI_DORSO: "DNI dorso",
  REPROCANN: "REPROCANN",
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
// Las fechas sin hora (nacimiento, vencimiento) vienen en UTC: formatearlas en UTC evita el día de menos.
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/**
 * Cola de solicitudes de alta. Aprobar crea el legajo y habilita la cuenta;
 * rechazar exige un motivo que la persona va a leer en su pantalla.
 */
export function AccessRequests() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/solicitudes");
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setError(data.message ?? "No pudimos cargar las solicitudes.");
    setSolicitudes(data.solicitudes ?? []);
  }, []);

  useEffect(() => {
    // En un tick: el estado se setea después del fetch, no durante el render del efecto.
    const t = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(t);
  }, [cargar]);

  async function actuar(id: string, accion: "aprobar" | "rechazar") {
    setOcupada(id);
    setError(null);
    setAviso(null);
    try {
      const r = await fetch(`/api/solicitudes/${id}/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accion === "rechazar" ? { motivo } : {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? "No pudimos completar la acción.");
      setAviso(accion === "aprobar" ? data.mensaje ?? "Legajo creado." : "Solicitud rechazada. La persona puede corregir y volver a presentarla.");
      setAbierta(null);
      setMotivo("");
      await cargar();
      // La lista de «Accesos pendientes» la arma el servidor: hay que re-renderizarla.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar la acción.");
    } finally {
      setOcupada(null);
    }
  }

  const pendientes = solicitudes?.filter((s) => s.status === "PENDIENTE") ?? [];

  return (
    <Panel
      title="Solicitudes de alta"
      subtitle="Personas que entraron con Google y subieron su documentación. Aprobar crea el legajo."
    >
      {error && <p className="note note-danger">{error}</p>}
      {aviso && <p className="note">{aviso}</p>}
      {solicitudes === null ? (
        <p className="muted">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <Empty icon={Inbox} title="No hay solicitudes esperando">
          Cuando alguien se registre con Google y suba su DNI y REPROCANN, aparece acá.
        </Empty>
      ) : (
        <div className="stack">
          {pendientes.map((s) => (
            <div key={s.id} className="panel">
              <div className="panel-head">
                <h3 className="panel-title">
                  {s.firstName} {s.lastName}{" "}
                  {s.faltantes.length > 0 ? <Chip tone="warn">faltan archivos</Chip> : <Chip tone="ok">completa</Chip>}
                  {/* Si trae memberId, no crea un legajo nuevo: completa el que ya está en el padrón. */}
                  {s.memberId ? <Chip tone="mute">reclama un legajo del padrón</Chip> : null}
                </h3>
                <p className="panel-sub">
                  {s.user.email} · DNI •••{s.docLast4} · presentada el {fecha(s.submittedAt)}
                </p>
              </div>
              <div className="panel-body stack">
                <table>
                  <tbody>
                    <tr>
                      <th>Nacimiento</th>
                      <td>{dia(s.birthDate)}</td>
                    </tr>
                    <tr>
                      <th>Teléfono</th>
                      <td>{s.phone}</td>
                    </tr>
                    <tr>
                      <th>Domicilio</th>
                      <td>
                        {s.address}
                        {s.locality ? ` · ${s.locality}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <th>REPROCANN</th>
                      <td>
                        {s.reprocannNumber} · vence {dia(s.reprocannExpiresAt)}
                      </td>
                    </tr>
                    <tr>
                      <th>Consumo</th>
                      <td>{s.consumptionType === "TERAPEUTICO" ? "Terapéutico" : "Lúdico"}</td>
                    </tr>
                    <tr>
                      <th>Documentación</th>
                      <td>
                        {s.documents.length === 0
                          ? "sin archivos"
                          : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                              {s.documents.map((d) => {
                                const url = `/api/solicitudes/${s.id}/documentos/${d.id}`;
                                const esImagen = d.mime.startsWith("image/");
                                return (
                                  <a
                                    key={d.id}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: "block", textDecoration: "none", color: "inherit" }}
                                    title={`Abrir ${DOC_LABEL[d.tipo] ?? d.tipo}`}
                                  >
                                    {esImagen ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img
                                        src={url}
                                        alt={DOC_LABEL[d.tipo] ?? d.tipo}
                                        loading="lazy"
                                        decoding="async"
                                        style={{ width: "100%", height: 132, objectFit: "contain", background: "var(--surface, #fff)", borderRadius: 10, border: "1px solid var(--line)", display: "block" }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          height: 120, borderRadius: 10, border: "1px solid var(--line)",
                                          display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: ".04em",
                                        }}
                                      >
                                        PDF
                                      </div>
                                    )}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 6 }}>
                                      <b style={{ fontSize: 13 }}>{DOC_LABEL[d.tipo] ?? d.tipo}</b>
                                      <span style={{ fontSize: 11.5, fontWeight: 650, textDecoration: "underline", whiteSpace: "nowrap" }}>
                                        Abrir ↗
                                      </span>
                                    </div>
                                    <small className="muted" style={{ fontSize: 11.5 }}>
                                      {Math.max(1, Math.round(d.size / 1024))} KB
                                    </small>
                                  </a>
                                );
                              })}
                              {s.faltantes.map((f) => (
                                <div
                                  key={f}
                                  style={{
                                    height: 120, borderRadius: 10, border: "1px dashed var(--line)",
                                    display: "grid", placeItems: "center", fontSize: 12.5, opacity: .7,
                                  }}
                                >
                                  Falta {DOC_LABEL[f] ?? f}
                                </div>
                              ))}
                            </div>
                          )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {abierta === s.id ? (
                  <ValidatedForm className="stack" onSubmit={() => actuar(s.id, "rechazar")}>
                    <label className="label">
                      Motivo del rechazo (lo va a leer la persona)
                      <Textarea name="motivo" required minLength={10} maxLength={500}
                        className="textarea"
                        rows={3}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="El DNI está ilegible: mandá una foto derecha y con luz."
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="btn" type="submit" disabled={ocupada === s.id}>
                        Confirmar rechazo
                      </button>
                      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAbierta(null)}>
                        Cancelar
                      </button>
                    </div>
                  </ValidatedForm>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="btn"
                      type="button"
                      disabled={ocupada === s.id || s.faltantes.length > 0}
                      onClick={() => actuar(s.id, "aprobar")}
                      title={s.faltantes.length > 0 ? `Faltan: ${s.faltantes.map((f) => DOC_LABEL[f] ?? f).join(", ")}` : undefined}
                    >
                      {ocupada === s.id ? "Creando legajo…" : "Aprobar y crear legajo"}
                    </button>
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAbierta(s.id)}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
