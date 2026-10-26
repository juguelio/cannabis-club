"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip, Empty, Panel } from "@/components/ui";
import { Inbox } from "lucide-react";

type Doc = { id: string; tipo: string; mime: string; size: number };
type Solicitud = {
  id: string;
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
                          : s.documents.map((d) => (
                              <a
                                key={d.id}
                                href={`/api/solicitud/documentos?id=${d.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ marginRight: 12 }}
                              >
                                {DOC_LABEL[d.tipo] ?? d.tipo}
                              </a>
                            ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {abierta === s.id ? (
                  <div className="stack">
                    <label className="label">
                      Motivo del rechazo (lo va a leer la persona)
                      <textarea
                        className="textarea"
                        rows={3}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="El DNI está ilegible: mandá una foto derecha y con luz."
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="btn" type="button" disabled={ocupada === s.id} onClick={() => actuar(s.id, "rechazar")}>
                        Confirmar rechazo
                      </button>
                      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAbierta(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
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
