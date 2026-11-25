"use client";

import { ValidatedForm, Input, Select, Textarea } from "./validated-form";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "./toast";
import { ReasonDialog } from "./dialog";
import { ORIGIN, REPROCANN_STATUS, STAGE } from "@/lib/labels";

const num = (v: unknown) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? undefined : Number(s);
};
const str = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};
const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

/** La G de Google, en sus cuatro colores: es la marca del proveedor, no del club. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6c1.9-5.6 7.1-9.7 13.6-9.7z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.6-10.3 6.6-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.8A14.6 14.6 0 0 1 9.6 24c0-1.7.3-3.3.8-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.9l-7.6-5.9c-2 1.4-4.8 2.4-8.3 2.4-6.5 0-11.7-4.1-13.6-9.7l-7.8 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function LoginForm({ google = false }: { google?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <ValidatedForm method="post"
      className="stack"
      style={{ gap: 14 }}
      onSubmit={async (e, reportFields) => {
        const { values } = e;
        setBusy(true);
        setError(null);
        try {
          const data = await api<{ user: { role: string } }>("/api/auth/login", { body: { email: values.email, password: values.password } });
          router.push(data.user?.role === "SOCIO" ? "/portal" : "/");
          router.refresh();
        } catch (err) {
          if (!reportFields(err)) setError(errMsg(err));
          setBusy(false);
        }
      }}
    >
      {google ? (
        <>
          <a className="btn btn-lg btn-block" href="/api/auth/google" style={{ gap: 10 }}>
            <GoogleMark />
            Continuar con Google
          </a>
          <div className="muted" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, margin: "2px 0" }} aria-hidden>
            <span style={{ flex: 1, height: 1, background: "var(--line, currentColor)", opacity: 0.28 }} />
            o con tu clave
            <span style={{ flex: 1, height: 1, background: "var(--line, currentColor)", opacity: 0.28 }} />
          </div>
        </>
      ) : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <Input className="input" id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <div style={{ position: "relative" }}>
          <Input className="input" id="password" name="password" autoComplete="current-password" type={show ? "text" : "password"} required style={{ paddingRight: 44 }} />
          <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} style={{ position: "absolute", right: 3, top: 3 }}>
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </div>
      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <button className="btn btn-lg btn-block" disabled={busy}><LogIn aria-hidden />{busy ? "Ingresando…" : "Ingresar"}</button>
      <p className="hint" style={{ margin: 0 }}>¿Sos socio y no tenés acceso? Pedilo en la secretaría del club.</p>
    </ValidatedForm>
  );
}

/** Alta de socio en tres bloques: identidad, REPROCANN, consumo y consentimiento. */
export function MemberForm() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState("");
  return (
    <ValidatedForm method="post"
      className="stack"
      onSubmit={async (e, reportFields) => {
        const { values } = e;
        setError(null);
        setBusy(true);
        try {
          const res = await api<{ member: { id: string; legajo: number; lastName: string } }>("/api/members", {
            body: {
              firstName: values.firstName,
              lastName: values.lastName,
              docNumber: values.docNumber,
              birthDate: values.birthDate,
              phone: str(values.phone),
              email: str(values.email),
              address: str(values.address),
              reprocannNumber: str(values.reprocannNumber),
              reprocannStatus: values.reprocannStatus,
              reprocannExpiresAt: str(values.reprocannExpiresAt),
              consumptionType: values.consumptionType,
              monthlyForecastG: num(values.monthlyForecastG),
              consentSignedAt: str(values.consentSignedAt),
              notes: str(values.notes),
              status: values.activate === true && Boolean(consent) ? "ACTIVO" : "PENDIENTE",
            },
          });
          toast({ tone: "ok", title: `Legajo ${res.member.legajo} creado`, text: `${res.member.lastName} ya está en el padrón.` });
          router.push(`/socios/${res.member.id}`);
          router.refresh();
        } catch (err) {
          if (!reportFields(err)) setError(errMsg(err));
          setBusy(false);
        }
      }}
    >
      <fieldset className="panel" disabled={busy}>
        <div className="panel-head"><div><h2 className="panel-title">Identidad</h2><p className="panel-sub">Como figura en el DNI. El legajo se asigna solo.</p></div></div>
        <div className="panel-body field-row">
          <div><label className="label" htmlFor="lastName">Apellido</label><Input className="input" id="lastName" name="lastName" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="firstName">Nombre</label><Input className="input" id="firstName" name="firstName" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="docNumber">DNI</label><Input className="input tnum" id="docNumber" name="docNumber" inputMode="numeric" required placeholder="30111222" /></div>
          <div><label className="label" htmlFor="birthDate">Nacimiento</label><Input className="input" id="birthDate" name="birthDate" type="date" max={today()} required /></div>
          <div><label className="label" htmlFor="phone">Teléfono</label><Input className="input" id="phone" name="phone" type="tel" autoComplete="off" /></div>
          <div><label className="label" htmlFor="email">Email</label><Input className="input" id="email" name="email" type="email" autoComplete="off" /><span className="hint">Lo necesita para entrar al portal.</span></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="address">Domicilio</label><Input className="input" id="address" name="address" autoComplete="off" /></div>
        </div>
      </fieldset>

      <fieldset className="panel" disabled={busy}>
        <div className="panel-head"><div><h2 className="panel-title">REPROCANN</h2><p className="panel-sub">Sin REPROCANN vigente el dispensario no entrega, aunque el socio esté activo.</p></div></div>
        <div className="panel-body field-row">
          <div><label className="label" htmlFor="reprocannNumber">Número</label><Input className="input" id="reprocannNumber" name="reprocannNumber" autoComplete="off" /></div>
          <div>
            <label className="label" htmlFor="reprocannStatus">Estado</label>
            <Select className="select" id="reprocannStatus" name="reprocannStatus" defaultValue="EN_TRAMITE">
              {Object.entries(REPROCANN_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label.replace("REPROCANN ", "")}</option>)}
            </Select>
          </div>
          <div><label className="label" htmlFor="reprocannExpiresAt">Vence</label><Input className="input" id="reprocannExpiresAt" name="reprocannExpiresAt" type="date" /></div>
        </div>
      </fieldset>

      <fieldset className="panel" disabled={busy}>
        <div className="panel-head"><div><h2 className="panel-title">Consumo y consentimiento</h2><p className="panel-sub">La previsión ayuda a planificar el cultivo; no cambia los topes.</p></div></div>
        <div className="panel-body field-row">
          <div>
            <label className="label" htmlFor="consumptionType">Tipo de consumo</label>
            <Select className="select" id="consumptionType" name="consumptionType" defaultValue="TERAPEUTICO">
              <option value="TERAPEUTICO">Terapéutico</option>
              <option value="LUDICO">Lúdico</option>
            </Select>
          </div>
          <div><label className="label" htmlFor="monthlyForecastG">Previsión mensual (g)</label><Input className="input tnum" id="monthlyForecastG" name="monthlyForecastG" inputMode="decimal" /></div>
          <div>
            <label className="label" htmlFor="consentSignedAt">Consentimiento firmado el</label>
            <Input className="input" id="consentSignedAt" name="consentSignedAt" type="date" max={today()} value={consent} onChange={(e) => setConsent(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="notes">Notas internas</label><Textarea className="textarea" id="notes" name="notes" /></div>
          <label className="check" style={{ gridColumn: "1 / -1" }}>
            <Input type="checkbox" name="activate" disabled={!consent} />
            <span>
              Dar de alta como activo ahora
              <span className="hint">{consent ? "Si no lo marcás, queda pendiente de alta." : "Necesita la fecha del consentimiento firmado."}</span>
            </span>
          </label>
        </div>
      </fieldset>

      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-lg" disabled={busy}>{busy ? "Guardando…" : "Crear legajo"}</button>
        <span className="hint" style={{ margin: 0 }}>El alta queda en la auditoría con tu nombre.</span>
      </div>
    </ValidatedForm>
  );
}

const NEW_STAGES = ["PROPAGACION", "VEGETATIVO", "FLORACION", "COSECHA", "CURADO", "DISPONIBLE"];

export function BatchForm({ strains, onDone }: { strains: { id: string; name: string }[]; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("PROPAGACION");
  const [busy, setBusy] = useState(false);
  return (
    <ValidatedForm method="post"
      className="stack"
      style={{ gap: 14 }}
      onSubmit={async (e, reportFields) => {
        const form = e.form;
        const { values } = e;
        setError(null);
        setBusy(true);
        try {
          const res = await api<{ batch: { code: string } }>("/api/batches", {
            body: {
              code: values.code,
              strainId: values.strainId,
              originType: values.originType,
              originProviderName: str(values.originProviderName),
              plantsCount: num(values.plantsCount),
              room: str(values.room),
              stage,
              plantedAt: str(values.plantedAt),
              thcPct: num(values.thcPct),
              cbdPct: num(values.cbdPct),
              dryWeightG: stage === "DISPONIBLE" ? num(values.dryWeightG) : undefined,
            },
          });
          toast({ tone: "ok", title: `Lote ${res.batch.code} creado` });
          form.reset();
          setStage("PROPAGACION");
          onDone?.();
          router.refresh();
        } catch (err) {
          if (!reportFields(err)) setError(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="field-row">
        <div><label className="label" htmlFor="b-code">Código</label><Input className="input" id="b-code" name="code" placeholder="L-2026-004" required /></div>
        <div>
          <label className="label" htmlFor="b-strain">Cepa</label>
          <Select className="select" id="b-strain" name="strainId" required>
            {strains.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="b-origin">Origen del material</label>
          <Select className="select" id="b-origin" name="originType" defaultValue="ESQUEJE">
            {Object.entries(ORIGIN).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div><label className="label" htmlFor="b-prov">Proveedor u origen</label><Input className="input" id="b-prov" name="originProviderName" /></div>
        <div><label className="label" htmlFor="b-plants">Plantas</label><Input className="input tnum" id="b-plants" name="plantsCount" inputMode="numeric" /></div>
        <div><label className="label" htmlFor="b-room">Sala</label><Input className="input" id="b-room" name="room" /></div>
        <div><label className="label" htmlFor="b-planted">Siembra</label><Input className="input" id="b-planted" name="plantedAt" type="date" /></div>
        <div><label className="label" htmlFor="b-thc">THC %</label><Input className="input tnum" id="b-thc" name="thcPct" inputMode="decimal" /></div>
        <div><label className="label" htmlFor="b-cbd">CBD %</label><Input className="input tnum" id="b-cbd" name="cbdPct" inputMode="decimal" /></div>
        <div>
          <label className="label" htmlFor="b-stage">Etapa actual</label>
          <Select className="select" id="b-stage" name="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            {NEW_STAGES.map((s) => <option key={s} value={s}>{STAGE[s]?.label ?? s}</option>)}
          </Select>
        </div>
        {stage === "DISPONIBLE" ? (
          <div><label className="label" htmlFor="b-dry">Peso seco (g)</label><Input className="input tnum" id="b-dry" name="dryWeightG" inputMode="decimal" required /><span className="hint">Acredita stock al crear el lote.</span></div>
        ) : null}
      </fieldset>
      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <div><button className="btn" disabled={busy}>{busy ? "Creando…" : "Crear lote"}</button></div>
    </ValidatedForm>
  );
}

export function HarvestForm({ batch, onDone }: { batch: { id: string; code: string; stage: string; wetWeightG: number | null }; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dryStep = batch.wetWeightG != null;
  return (
    <ValidatedForm method="post"
      className="stack"
      style={{ gap: 12 }}
      onSubmit={async (e, reportFields) => {
        const { values } = e;
        setError(null);
        setBusy(true);
        try {
          await api(`/api/batches/${batch.id}/harvest`, {
            body: dryStep
              ? { dryWeightG: num(values.dryWeightG), thcPct: num(values.thcPct), cbdPct: num(values.cbdPct) }
              : { wetWeightG: num(values.wetWeightG), harvestedAt: str(values.harvestedAt) },
          });
          toast({ tone: "ok", title: dryStep ? `Peso seco registrado: ${batch.code} disponible` : `Cosecha de ${batch.code} registrada` });
          onDone?.();
          router.refresh();
        } catch (err) {
          if (!reportFields(err)) setError(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {dryStep
          ? `Húmedo cargado: ${batch.wetWeightG} g. El peso seco acredita el stock y deja el lote disponible para entregar.`
          : "Primero el peso húmedo, al cortar. El seco se carga al terminar el secado."}
      </p>
      <fieldset disabled={busy} className="field-row">
        <div>
          <label className="label" htmlFor="h-g">{dryStep ? "Peso seco (g)" : "Peso húmedo (g)"}</label>
          <Input className="input tnum" id="h-g" name={dryStep ? "dryWeightG" : "wetWeightG"} inputMode="decimal" required autoFocus />
        </div>
        {dryStep ? (
          <>
            <div><label className="label" htmlFor="h-thc">THC % medido</label><Input className="input tnum" id="h-thc" name="thcPct" inputMode="decimal" /></div>
            <div><label className="label" htmlFor="h-cbd">CBD % medido</label><Input className="input tnum" id="h-cbd" name="cbdPct" inputMode="decimal" /></div>
          </>
        ) : (
          <div><label className="label" htmlFor="h-date">Fecha de corte</label><Input className="input" id="h-date" name="harvestedAt" type="date" defaultValue={today()} /></div>
        )}
      </fieldset>
      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <div><button className="btn" disabled={busy}>{busy ? "Registrando…" : dryStep ? "Registrar peso seco" : "Registrar cosecha"}</button></div>
    </ValidatedForm>
  );
}

export function MovementForm({ batches, batchId, onDone }: { batches?: { id: string; code: string }[]; batchId?: string; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <ValidatedForm method="post"
      className="stack"
      style={{ gap: 12 }}
      onSubmit={async (e, reportFields) => {
        const form = e.form;
        const { values } = e;
        setError(null);
        setBusy(true);
        try {
          await api("/api/movements", { body: { batchId: batchId ?? values.batchId, type: values.type, grams: num(values.grams), reason: values.reason } });
          toast({ tone: "ok", title: "Movimiento registrado en el libro" });
          form.reset();
          onDone?.();
          router.refresh();
        } catch (err) {
          if (!reportFields(err)) setError(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="field-row">
        {!batchId && batches ? (
          <div>
            <label className="label" htmlFor="mv-batch">Lote</label>
            <Select className="select" id="mv-batch" name="batchId" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</Select>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="mv-type">Tipo</label>
          <Select className="select" id="mv-type" name="type">
            <option value="AJUSTE_NEGATIVO">Ajuste negativo: faltante</option>
            <option value="AJUSTE_POSITIVO">Ajuste positivo: sobrante</option>
            <option value="DESTRUCCION">Destrucción documentada</option>
            <option value="TRANSFERENCIA">Transferencia fuera del club</option>
          </Select>
        </div>
        <div><label className="label" htmlFor="mv-g">Gramos</label><Input className="input tnum" id="mv-g" name="grams" inputMode="decimal" required /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="label" htmlFor="mv-reason">Motivo</label>
          <Input className="input" id="mv-reason" name="reason" required minLength={3} placeholder="Ej.: pesaje de control semanal" />
        </div>
      </fieldset>
      {error ? <div className="note note-danger" role="alert">{error}</div> : null}
      <div><button className="btn" disabled={busy}>{busy ? "Registrando…" : "Registrar movimiento"}</button></div>
    </ValidatedForm>
  );
}

export function VoidButton({ id, label }: { id: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="btn btn-sm btn-ghost" onClick={() => { setError(null); setOpen(true); }}>Anular</button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anular la entrega"
        description={<>Se registra un contra-asiento que devuelve los gramos al lote{label ? ` (${label})` : ""}. La entrega original queda en el libro, tachada.</>}
        confirmLabel="Anular entrega"
        reasonLabel="Motivo de la anulación"
        danger
        busy={busy}
        error={error}
        onConfirm={async (reason) => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/dispensations/${id}/void`, { body: { reason } });
            toast({ tone: "ok", title: "Entrega anulada", text: "El contra-asiento quedó en el libro." });
            setOpen(false);
            router.refresh();
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
