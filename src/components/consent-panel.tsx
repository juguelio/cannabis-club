"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Chip } from "@/components/ui";

type Item = {
  purpose: string;
  label: string;
  detail: string;
  granted: boolean;
  grantedAt: Date | string | null;
  by: string | null;
  version: string | null;
  revokedAt: Date | string | null;
};

const when = (value: Date | string | null) =>
  value ? new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "";

/** Consentimiento por finalidad (REA 4): se registra y se revoca por separado. */
export function ConsentPanel({ memberId, initial, isAdmin }: { memberId: string; initial: Item[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(purpose: string, grant: boolean) {
    setBusy(purpose);
    try {
      const res = grant
        ? await api<{ consents: Item[] }>(`/api/members/${memberId}/consents`, { body: { purpose } })
        : await api<{ consents: Item[] }>(`/api/members/${memberId}/consents?purpose=${purpose}`, { method: "DELETE" });
      setItems(res.consents);
      toast({ tone: "ok", title: grant ? "Consentimiento registrado" : "Consentimiento revocado", text: `Queda auditado con la fecha.` });
      router.refresh();
    } catch (err) {
      toast({ tone: "bad", title: "No se pudo registrar", text: errMsg(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <table className="table">
      <tbody>
        {items.map((item) => (
          <tr key={item.purpose}>
            <td>
              <div>{item.label}</div>
              <div className="cell-meta">{item.detail}</div>
              {item.granted ? <div className="cell-meta">Registrado {when(item.grantedAt)}{item.by ? ` · ${item.by}` : ""}</div> : null}
            </td>
            <td style={{ width: 120 }}>
              {item.granted ? <Chip tone="ok">Registrado</Chip> : item.revokedAt ? <Chip tone="warn">Revocado</Chip> : <Chip tone="mute">Falta</Chip>}
            </td>
            <td style={{ width: 130 }}>
              {item.granted ? (
                isAdmin ? <button className="btn btn-sm btn-quiet" disabled={busy === item.purpose} onClick={() => change(item.purpose, false)}>Revocar</button> : null
              ) : (
                <button className="btn btn-sm btn-quiet" disabled={busy === item.purpose} onClick={() => change(item.purpose, true)}>Registrar</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
