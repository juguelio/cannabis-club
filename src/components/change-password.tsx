"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";

/** Cambio de clave propio: al guardar, el servidor invalida las sesiones viejas. */
export function ChangePasswordForm({ redirectTo = "/portal", label = "Guardar clave" }: { redirectTo?: string; label?: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) {
      setError("Las dos claves nuevas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", { body: { current, next } });
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <div>
        <label className="label" htmlFor="pw-current">Clave actual (la temporal)</label>
        <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pw-next">Clave nueva</label>
        <input id="pw-next" className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        <span className="hint">Mínimo 8 caracteres, con letras. No puede ser sólo números.</span>
      </div>
      <div>
        <label className="label" htmlFor="pw-repeat">Repetir la clave nueva</label>
        <input id="pw-repeat" className="input" type="password" autoComplete="new-password" minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
      </div>
      {error ? <div className="note note-warn" role="alert">{error}</div> : null}
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Guardando…" : label}</button>
      </div>
      <p className="cell-meta" style={{ margin: 0 }}>
        Si perdiste el acceso, pedí una clave nueva en la secretaría del club: no se puede recuperar por email.
      </p>
    </form>
  );
}
