"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldQuestion, X } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { Chip, Empty, Panel } from "./ui";
import { ValidatedForm, Select } from "./validated-form";
import { useToast } from "./toast";

type Pendiente = {
  id: string;
  email: string;
  name: string;
  role: string;
  conGoogle: boolean;
  createdAt: string;
  sugerido: { id: string; legajo: number; nombre: string } | null;
};

type Candidato = { id: string; legajo: number; nombre: string };

/**
 * Cuentas que se crearon solas al entrar con Google. Google prueba el email;
 * el acceso lo da el club: acá se elige el legajo y recién ahí se habilita.
 */
export function PendingAccess({ pendientes, candidatos }: { pendientes: Pendiente[]; candidatos: Candidato[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [elegido, setElegido] = useState<Record<string, string>>({});

  if (!pendientes.length) {
    return (
      <Panel title="Accesos pendientes" subtitle="Cuentas creadas con Google esperando aprobación.">
        <Empty icon={ShieldQuestion} title="Nada pendiente">Cuando alguien pida acceso con Google, aparece acá para aprobarlo.</Empty>
      </Panel>
    );
  }

  const actuar = async (id: string, fn: () => Promise<void>, ok: { title: string; text: string }) => {
    setBusy(id);
    try {
      await fn();
      toast({ tone: "ok", ...ok });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo", text: errMsg(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Accesos pendientes"
      subtitle="Cuentas creadas con Google. Nadie entra hasta que acá se elija el legajo y se habilite."
      action={<Chip tone="warn">{pendientes.length}</Chip>}
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Pidieron acceso</th>
              <th>Legajo</th>
              <th style={{ textAlign: "right" }}>Decisión</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((p) => {
              const opciones = p.sugerido ? [p.sugerido, ...candidatos.filter((c) => c.id !== p.sugerido!.id)] : candidatos;
              const valor = elegido[p.id] ?? p.sugerido?.id ?? "";
              return (
                <tr key={p.id}>
                  <td>
                    <div className="cell-strong">{p.name}</div>
                    <div className="cell-meta">{p.email}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {p.conGoogle ? <Chip tone="brand">Google</Chip> : null}
                      <span className="cell-meta">{p.createdAt}</span>
                    </div>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <ValidatedForm id={`acceso-${p.id}`} onSubmit={({ values }) => actuar(
                      p.id,
                      () => api(`/api/users/${p.id}/approve`, { body: { memberId: values.memberId } }),
                      { title: "Acceso habilitado", text: `${p.email} ya puede entrar con Google.` },
                    )}>
                      <Select required name="memberId"
                        className="input"
                        value={valor}
                        aria-label={`Legajo para ${p.email}`}
                        onChange={(e) => setElegido((s) => ({ ...s, [p.id]: e.target.value }))}
                      >
                        <option value="">Elegí el legajo…</option>
                        {opciones.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.legajo} · {c.nombre}
                            {p.sugerido?.id === c.id ? " (email coincide)" : ""}
                          </option>
                        ))}
                      </Select>
                    </ValidatedForm>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        className="btn btn-sm"
                        disabled={busy === p.id || !valor}
                        type="submit" form={`acceso-${p.id}`}
                      >
                        <Check aria-hidden /> Habilitar
                      </button>
                      <button
                        className="btn btn-sm btn-quiet"
                        disabled={busy === p.id}
                        onClick={() =>
                          actuar(p.id, () => api(`/api/users/${p.id}/approve`, { method: "DELETE" }), {
                            title: "Pedido rechazado",
                            text: `Se borró la cuenta pendiente de ${p.email}.`,
                          })
                        }
                      >
                        <X aria-hidden /> Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
