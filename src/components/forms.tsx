"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data;
}

async function patch(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data;
}

function Msg({ error, ok }: { error: string | null; ok: string | null }) {
  if (!error && !ok) return null;
  return (
    <p className="text-sm mt-2" style={{ color: error ? "#fca5a5" : "#5eead4" }}>
      {error ?? ok}
    </p>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card card-pad space-y-3 w-full" style={{ maxWidth: 400 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await post("/api/auth/login", { email: f.get("email"), password: f.get("password") });
          router.push("/");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-[17px] font-semibold">Ingreso al club</h1>
        <p className="cell-meta mt-1">Usá la cuenta que te dio la coordinación del club.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" defaultValue="admin@club.test" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" required />
      </div>
      <button className="btn w-full justify-center" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
      <Msg error={error} ok={null} />
    </form>
  );
}

export function MemberForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        setOk(null);
        try {
          const res = await post("/api/members", {
            firstName: f.get("firstName"),
            lastName: f.get("lastName"),
            docNumber: f.get("docNumber"),
            birthDate: f.get("birthDate"),
            phone: f.get("phone") || undefined,
            address: f.get("address") || undefined,
            reprocannNumber: f.get("reprocannNumber") || undefined,
            reprocannStatus: f.get("reprocannStatus"),
            reprocannExpiresAt: f.get("reprocannExpiresAt") || undefined,
            consumptionType: f.get("consumptionType"),
            monthlyForecastG: f.get("monthlyForecastG") ? Number(f.get("monthlyForecastG")) : undefined,
            consentSignedAt: f.get("consentSignedAt") || undefined,
            status: f.get("status"),
          });
          setOk(`Socio ${res.member.legajo} creado.`);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div><label className="label">Nombre</label><input className="input" name="firstName" required /></div>
      <div><label className="label">Apellido</label><input className="input" name="lastName" required /></div>
      <div><label className="label">Documento</label><input className="input" name="docNumber" required /></div>
      <div><label className="label">Nacimiento</label><input className="input" name="birthDate" type="date" required /></div>
      <div><label className="label">Teléfono</label><input className="input" name="phone" /></div>
      <div><label className="label">Domicilio</label><input className="input" name="address" /></div>
      <div><label className="label">N° REPROCANN</label><input className="input" name="reprocannNumber" /></div>
      <div>
        <label className="label">Estado REPROCANN</label>
        <select className="select" name="reprocannStatus" defaultValue="EN_TRAMITE">
          {["NO_APORTA", "EN_TRAMITE", "VIGENTE", "VENCIDO", "RECHAZADO"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div><label className="label">Vence REPROCANN</label><input className="input" name="reprocannExpiresAt" type="date" /></div>
      <div>
        <label className="label">Tipo de consumo</label>
        <select className="select" name="consumptionType"><option>LUDICO</option><option>TERAPEUTICO</option></select>
      </div>
      <div><label className="label">Previsión g/mes</label><input className="input" name="monthlyForecastG" type="number" step="0.01" min="0" /></div>
      <div><label className="label">Consentimiento firmado</label><input className="input" name="consentSignedAt" type="date" /></div>
      <div>
        <label className="label">Estado del socio</label>
        <select className="select" name="status" defaultValue="ACTIVO">
          {["PENDIENTE", "ACTIVO", "SUSPENDIDO", "BAJA"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="md:col-span-2 flex items-center gap-3">
        <button className="btn">Guardar socio</button>
        <span className="cell-meta">El legajo se asigna solo.</span>
        <Msg error={error} ok={ok} />
      </div>
    </form>
  );
}

export function MemberActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const next = status === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO";
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost"
        onClick={async () => {
          try {
            await patch(`/api/members/${id}`, { status: next, statusReason: "Cambio manual desde panel" });
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        Pasar a {next}
      </button>
      <Msg error={error} ok={null} />
    </div>
  );
}

export function BatchForm({ strains }: { strains: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null); setOk(null);
        try {
          await post("/api/batches", {
            code: f.get("code"),
            strainId: f.get("strainId"),
            originType: f.get("originType"),
            originProviderName: f.get("originProviderName") || undefined,
            plantsCount: f.get("plantsCount") ? Number(f.get("plantsCount")) : undefined,
            room: f.get("room") || undefined,
            stage: f.get("stage"),
            thcPct: f.get("thcPct") ? Number(f.get("thcPct")) : undefined,
            cbdPct: f.get("cbdPct") ? Number(f.get("cbdPct")) : undefined,
            dryWeightG: f.get("dryWeightG") ? Number(f.get("dryWeightG")) : undefined,
          });
          setOk("Lote creado.");
          router.refresh();
        } catch (err) { setError((err as Error).message); }
      }}
    >
      <div><label className="label">Código de lote</label><input className="input" name="code" placeholder="L-2026-004" required /></div>
      <div>
        <label className="label">Cepa</label>
        <select className="select" name="strainId" required>
          {strains.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Origen del material</label>
        <select className="select" name="originType"><option>ESQUEJE</option><option>SEMILLA</option><option>COSECHA_PROPIA</option><option>PROVEEDOR_EXTERNO</option></select>
      </div>
      <div><label className="label">Proveedor / origen</label><input className="input" name="originProviderName" /></div>
      <div><label className="label">Plantas</label><input className="input" name="plantsCount" type="number" min="0" /></div>
      <div><label className="label">Sala</label><input className="input" name="room" /></div>
      <div><label className="label">THC %</label><input className="input" name="thcPct" type="number" step="0.01" /></div>
      <div><label className="label">CBD %</label><input className="input" name="cbdPct" type="number" step="0.01" /></div>
      <div><label className="label">Peso seco (g) — solo si ya está cosechado</label><input className="input" name="dryWeightG" type="number" step="0.01" /></div>
      <div>
        <label className="label">Etapa</label>
        <select className="select" name="stage" defaultValue="PROPAGACION">
          {["PROPAGACION","VEGETATIVO","FLORACION","COSECHA","CURADO","DISPONIBLE"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="md:col-span-3 flex items-center gap-3"><button className="btn">Crear lote</button><Msg error={error} ok={ok} /></div>
    </form>
  );
}

export function HarvestForm({ batches }: { batches: { id: string; code: string; wetWeightG?: number | null }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-4 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null); setOk(null);
        try {
          await post(`/api/batches/${f.get("batchId")}/harvest`, {
            wetWeightG: f.get("wetWeightG") ? Number(f.get("wetWeightG")) : undefined,
            dryWeightG: f.get("dryWeightG") ? Number(f.get("dryWeightG")) : undefined,
          });
          setOk("Cosecha registrada.");
          router.refresh();
        } catch (err) { setError((err as Error).message); }
      }}
    >
      <div>
        <label className="label">Lote</label>
        <select className="select" name="batchId" required>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code}{b.wetWeightG ? ` · húmedo ${b.wetWeightG} g cargado` : ""}
            </option>
          ))}
        </select>
      </div>
      <div><label className="label">Peso húmedo (g)</label><input className="input" name="wetWeightG" type="number" step="0.01" /></div>
      <div><label className="label">Peso seco (g) → acredita stock</label><input className="input" name="dryWeightG" type="number" step="0.01" /></div>
      <div className="flex items-end"><button className="btn">Registrar</button></div>
      <div className="md:col-span-4"><Msg error={error} ok={ok} /></div>
    </form>
  );
}

export function MovementForm({ batches }: { batches: { id: string; code: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-4 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null); setOk(null);
        try {
          await post("/api/movements", {
            batchId: f.get("batchId"),
            type: f.get("type"),
            grams: Number(f.get("grams")),
            reason: f.get("reason"),
          });
          setOk("Movimiento registrado.");
          router.refresh();
        } catch (err) { setError((err as Error).message); }
      }}
    >
      <div>
        <label className="label">Lote</label>
        <select className="select" name="batchId" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
      </div>
      <div>
        <label className="label">Tipo</label>
        <select className="select" name="type">
          <option value="AJUSTE_POSITIVO">Ajuste positivo (aparece mercadería)</option>
          <option value="AJUSTE_NEGATIVO">Ajuste negativo (faltante)</option>
          <option value="DESTRUCCION">Destrucción (descarte documentado)</option>
          <option value="TRANSFERENCIA">Transferencia (sale del club)</option>
        </select>
      </div>
      <div><label className="label">Gramos</label><input className="input" name="grams" type="number" step="0.01" required /></div>
      <div><label className="label">Motivo</label><input className="input" name="reason" required /></div>
      <div className="md:col-span-4 flex items-center gap-3"><button className="btn">Registrar movimiento</button><Msg error={error} ok={ok} /></div>
    </form>
  );
}

export function VoidButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={async () => {
          const reason = window.prompt("Motivo de anulación (queda en el libro)");
          if (!reason) return;
          try {
            await post(`/api/dispensations/${id}/void`, { reason });
            router.refresh();
          } catch (err) { setError((err as Error).message); }
        }}
      >
        Anular
      </button>
      <Msg error={error} ok={null} />
    </>
  );
}
