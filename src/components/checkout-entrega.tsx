"use client";

import { ValidatedForm, Input, Select } from "./validated-form";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, MapPin, MapPinned, Pencil, Store, Truck } from "lucide-react";
import { esDespacho, esSucursal, type ModoEntrega } from "@/lib/entrega";
import { api, errMsg } from "@/lib/client";
import { aEnviar } from "@/lib/carrito";
import { useCarrito } from "@/lib/carrito-cliente";
import { componerDireccion } from "@/lib/direccion";
import { PasosPedido } from "@/components/checkout-pasos";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type ZonaEnvio = { zona: string; precioArs: number; demora: string; transportista?: string | null };
export type CheckoutData = {
  tope: number;
  aportePorGramo: number | null;
  minimoEnvioG: number;
  topeEnvioG: number;
  envios: ZonaEnvio[];
  cobertura:
    | { estado: "CUBIERTA"; cp: string; zona: ZonaEnvio; aproximada: boolean; motivo: string }
    | { estado: "SIN_CP" }
    | { estado: "SIN_ZONAS" }
    | { estado: "SIN_COBERTURA"; cp: string; motivo: string };
  member: { address: string | null; locality: string | null; province: string | null; postalCode: string | null };
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type Day = { key: string; label?: string; estado?: string };

/** Cuántos horarios se muestran por franja antes del «+ N más». */
const POR_FRANJA = 6;
const MEDIODIA = 13 * 60;

/**
 * Paso 1: la entrega, y nada más.
 *
 * Un solo trabajo en esta pantalla. Si es retiro, día y horario —agrupados en mañana y tarde, porque
 * veintisiete botones seguidos no se leen— con el próximo turno libre a un toque. Si es envío, la
 * dirección que el club ya tiene como tarjeta (no cuatro campos vacíos) y lo que cuesta antes de ir a
 * pagar. Abajo, el total: el socio sabe desde acá cuánto va a transferir.
 */
export function CheckoutEntrega({
  data,
  nombreDe,
  pendiente,
}: {
  data: CheckoutData;
  nombreDe: Record<string, string>;
  /** Pedido anterior que quedó esperando el comprobante, si hay uno. */
  pendiente: { id: string; grams: number } | null;
}) {
  const router = useRouter();
  const { items, total, listo, vaciar } = useCarrito(data.tope);

  const [modo, setModo] = useState<ModoEntrega>("RETIRO");

  const [day, setDay] = useState<string>("");
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [closedDay, setClosedDay] = useState(false);
  const [verTodos, setVerTodos] = useState({ manana: false, tarde: false });

  // Envío: la dirección guardada se muestra como tarjeta; el formulario aparece con «Cambiar».
  // El padrón trae socios con la localidad y la provincia ya dentro de `address`: se compone
  // sin repetir partes en vez de concatenar los cuatro campos tal cual.
  const guardada = componerDireccion(
    data.member.address,
    data.member.locality,
    data.member.province,
    data.member.postalCode,
  );
  const [editando, setEditando] = useState(!guardada);

  const sugerida = data.cobertura.estado === "CUBIERTA" ? data.cobertura.zona.zona : (data.envios[0]?.zona ?? "");
  const [zona, setZona] = useState<string>(sugerida);
  const [cp, setCp] = useState<string>(data.member.postalCode ?? "");
  const [localidad, setLocalidad] = useState<string>(data.member.locality ?? "");
  const [provincia, setProvincia] = useState<string>(data.member.province ?? "");
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [calle, setCalle] = useState<string>(data.member.address ?? "");
  const [indicaciones, setIndicaciones] = useState("");
  const [cpEstado, setCpEstado] = useState<"idle" | "buscando" | "ok" | "no-resuelto">("idle");
  const ultimoCp = useRef("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ slots: Slot[]; days: Day[]; closed?: boolean }>(`/api/portal/slots?date=${day || ""}`)
      .then((d) => {
        if (!vivo) return;
        setSlots(d.slots ?? []);
        setDays(d.days ?? []);
        setClosedDay(Boolean(d.closed));
        if (!day) {
          const abierto = (d.days ?? []).find((x) => (x.estado ?? "abierto") === "abierto");
          setDay(abierto?.key ?? d.days?.[0]?.key ?? "");
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [day]);

  const zonaElegida = data.envios.find((z) => z.zona === zona);
  const direccion = componerDireccion(calle, localidad, provincia, cp);
  const [revisados, setRevisados] = useState({ cp: false, calle: false });
  const errorCp = revisados.cp && cp.length !== 4;
  const errorCalle = revisados.calle && calle.trim().length < 4;
  const entregaLista =
    modo === "RETIRO" ? slot != null : Boolean(zonaElegida) && calle.trim().length >= 4 && cp.trim().length === 4;

  const libre = slots.filter((s) => !s.past && !s.full);
  const proximo = libre[0] ?? null;
  const manana = libre.filter((s) => s.startMin < MEDIODIA);
  const tarde = libre.filter((s) => s.startMin >= MEDIODIA);
  // Sucursal paga la misma zona que el domicilio: el paquete viaja igual, cambia dónde se retira.
  const costoEnvio = esDespacho(modo) ? (zonaElegida?.precioArs ?? 0) : 0;
  const aporte = data.aportePorGramo != null ? data.aportePorGramo * total : null;
  const totalPagar = (aporte ?? 0) + costoEnvio;

  async function resolverCp(valor: string) {
    const limpio = valor.replace(/\D/g, "");
    if (limpio.length < 4) return;
    setCpEstado("buscando");
    try {
      const r = await api<{ estado: string; localidades: string[]; provincia: string | null }>(`/api/portal/cp?cp=${limpio}`);
      setLocalidades(r.localidades ?? []);
      if (r.provincia) setProvincia(r.provincia);
      if (r.localidades?.length === 1) setLocalidad(r.localidades[0]);
      else if (r.localidades?.length > 1 && !r.localidades.includes(localidad)) setLocalidad("");
      setCpEstado(r.estado === "OK" ? "ok" : "no-resuelto");
    } catch {
      setCpEstado("no-resuelto");
    }
  }

  async function continuar() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ pickup: { id: string } }>("/api/portal/pickups", {
        body:
          esDespacho(modo)
            ? {
                mode: modo,
                grams: total,
                items: aEnviar(items),
                zona,
                direccion,
                notes: indicaciones.trim() || undefined,
              }
            : { mode: "RETIRO", grams: total, items: aEnviar(items), date: day, startMin: slot },
      });
      vaciar();
      router.push(`/portal/pedido/pago/${r.pickup.id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  if (!listo) return null;

  if (items.length === 0) {
    return (
      <div className="checkout-paso">
        <PasosPedido actual={1} />
        <div className="checkout-head">
          <h1 className="checkout-title">Tu pedido está vacío</h1>
          <p className="checkout-sub">Elegí variedades del catálogo y volvé para hacer el pedido.</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/portal" className="btn">Ver variedades</Link>
          {pendiente ? (
            <Link href={`/portal/pedido/pago/${pendiente.id}`} className="btn btn-quiet">
              Terminar el pedido de {g(pendiente.grams)}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <ValidatedForm onSubmit={continuar} className="checkout-paso">
      <PasosPedido actual={1} />

      <div className="checkout-head">
        <h1 className="checkout-title">¿Cómo lo recibís?</h1>
        <p className="checkout-sub">
          {items.map((i) => `${nombreDe[i.strainId] ?? "Variedad"} ${g(i.gramos)}`).join(" · ")}
        </p>
      </div>

      <div className="entrega-opciones" role="radiogroup" aria-label="Forma de entrega">
        {([
          { id: "RETIRO" as const, icono: <Store aria-hidden size={18} />, t: "Retiro en el club", d: "Sin costo, con turno" },
          { id: "ENVIO" as const, icono: <Truck aria-hidden size={18} />, t: "Envío a domicilio", d: data.envios[0] ? `Desde ${MONEY.format(data.envios[0].precioArs)}` : "Consultar" },
          {
            id: "SUCURSAL" as const,
            icono: <MapPinned aria-hidden size={18} />,
            t: "Retiro en sucursal Andreani",
            d: "Lo llevamos a la más cercana",
          },
        ]).map((op) => (
          <button key={op.id} type="button" className="entrega-op" aria-pressed={modo === op.id} onClick={() => setModo(op.id)}>
            {op.icono}
            <b>{op.t}</b>
            <small>{op.d}</small>
          </button>
        ))}
      </div>

      {modo === "RETIRO" ? (
        <div className="checkout-bloque">
          <div>
            <span className="label">¿Qué día?</span>
            <div className="days" role="radiogroup" aria-label="Día del retiro">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="day"
                  aria-pressed={d.key === day}
                  aria-disabled={(d.estado ?? "abierto") !== "abierto"}
                  style={(d.estado ?? "abierto") !== "abierto" ? { opacity: 0.45 } : undefined}
                  onClick={() => {
                    setDay(d.key);
                    setSlot(null);
                    setVerTodos({ manana: false, tarde: false });
                  }}
                >
                  <small>{(d.label ?? "").split(" ")[0]}</small>
                  <b className="tnum">{d.key.slice(-2)}</b>
                </button>
              ))}
            </div>
          </div>

          {proximo && slot == null ? (
            <button type="button" className="atajo-turno" onClick={() => setSlot(proximo.startMin)}>
              <CalendarCheck2 aria-hidden size={16} />
              <span>
                Próximo libre: <b>{proximo.label}</b>
              </span>
              <span className="atajo-turno-cta">Tomarlo</span>
            </button>
          ) : null}

          <div>
            <span className="label">¿A qué hora?</span>
            {slots.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>{closedDay ? "El club no atiende ese día." : "No hay horarios disponibles."}</p>
            ) : libre.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>Ese día ya está completo. Probá con otro.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {([
                  ["Mañana", manana, "manana"],
                  ["Tarde", tarde, "tarde"],
                ] as const).map(([titulo, grupo, clave]) =>
                  grupo.length ? (
                    <div key={titulo}>
                      <span className="franja-horarios">{titulo}</span>
                      <div className="slot-grid" role="radiogroup" aria-label={`Horarios de la ${titulo.toLowerCase()}`}>
                        {(verTodos[clave] ? grupo : grupo.slice(0, POR_FRANJA)).map((s) => (
                          <button
                            key={s.startMin}
                            type="button"
                            className="slot"
                            aria-pressed={s.startMin === slot}
                            onClick={() => setSlot(s.startMin)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      {grupo.length > POR_FRANJA && !verTodos[clave] ? (
                        <button
                          type="button"
                          className="slot-mas"
                          onClick={() => setVerTodos((v) => ({ ...v, [clave]: true }))}
                        >
                          + {grupo.length - POR_FRANJA} más
                        </button>
                      ) : null}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>

          <p className="hint" style={{ margin: 0 }}>
            Traé tu DNI: en el club se verifica tu identidad y tu REPROCANN antes de entregarte.
          </p>
        </div>
      ) : (
        <div className="checkout-bloque">
          {data.cobertura.estado === "CUBIERTA" ? (
            <p className="note note-ok" style={{ margin: 0 }}>
              <MapPin aria-hidden />
              <span>
                Enviamos a <b>{data.cobertura.zona.zona}</b>: {MONEY.format(data.cobertura.zona.precioArs)} · {data.cobertura.zona.demora}
                {data.cobertura.aproximada ? ` (${data.cobertura.motivo})` : ""}. Mínimo {g(data.minimoEnvioG)}.
              </span>
            </p>
          ) : data.cobertura.estado === "SIN_COBERTURA" ? (
            <p className="note note-warn" style={{ margin: 0 }}>
              <span>
                No llegamos a {data.cobertura.cp}: {data.cobertura.motivo}. Podés retirar en el club sin costo.
              </span>
            </p>
          ) : null}

          {esSucursal(modo) ? (
            <p className="note" style={{ margin: 0 }}>
              <MapPinned aria-hidden />
              <span>
                Dejamos el pedido en la sucursal de Andreani más cercana a esta dirección y lo retirás ahí con tu DNI.
                Necesitamos tu domicilio para buscarla.
              </span>
            </p>
          ) : null}

          {/* La dirección que el club ya tiene, no cuatro campos vacíos. */}
          {guardada && !editando ? (
            <div className="dir-tarjeta">
              <div>
                <small>{esSucursal(modo) ? "Sucursal Andreani más cercana a" : "Entregamos en"}</small>
                <b>{guardada}</b>
              </div>
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => setEditando(true)}>
                <Pencil aria-hidden size={14} /> Cambiar
              </button>
            </div>
          ) : (
            <>
              <div className="dir-grid">
                <div>
                  <label className="label" htmlFor="c-cp">Código postal</label>
                  <Input
                    id="c-cp"
                    onBlur={() => setRevisados(r => ({ ...r, cp: true }))}
                    aria-invalid={errorCp || undefined} aria-describedby={errorCp ? "error-cp" : undefined}
                    className="input tnum"
                    inputMode="numeric"
                    maxLength={4}
                    value={cp}
                    placeholder="8370"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCp(v);
                      if (v.length === 4 && v !== ultimoCp.current) {
                        ultimoCp.current = v;
                        void resolverCp(v);
                      }
                    }}
                  />
                  {errorCp && <small className="field-error" id="error-cp">Ingresá los cuatro números del código postal.</small>}
                </div>
                <div>
                  <label className="label" htmlFor="c-loc">Localidad</label>
                  {localidades.length > 1 ? (
                    <Select id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)}>
                      <option value="">Elegí tu localidad</option>
                      {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  ) : (
                    <Input id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Sale del código" />
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="c-prov">Provincia</label>
                  <Input id="c-prov" className="input" value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Sale del código" />
                </div>
              </div>
              {cpEstado === "buscando" ? <span className="cell-meta">Buscando la localidad…</span> : null}
              {cpEstado === "no-resuelto" ? <span className="cell-meta">No pudimos resolver ese código: escribí la localidad y la provincia.</span> : null}

              <div>
                <label className="label" htmlFor="c-dir">Calle y número</label>
                <Input id="c-dir" onBlur={() => setRevisados(r => ({ ...r, calle: true }))} aria-invalid={errorCalle || undefined} aria-describedby={errorCalle ? "error-calle" : undefined} className="input" value={calle} onChange={(e) => setCalle(e.target.value)} placeholder="Los Notros 195, piso 2 depto B" />
                {errorCalle && <small className="field-error" id="error-calle">Ingresá calle y número, con al menos cuatro caracteres.</small>}
              </div>
            </>
          )}

          {data.envios.length > 1 ? (
            <div>
              <span className="label">Zona</span>
              <div className="zona-grid" role="radiogroup" aria-label="Zona de envío">
                {data.envios.map((z) => (
                  <button key={z.zona} type="button" className="zona-op" aria-pressed={zona === z.zona} onClick={() => setZona(z.zona)}>
                    <b>{z.zona}</b>
                    <small className="tnum">{MONEY.format(z.precioArs)} · {z.demora}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="c-ind">Indicaciones para quien entrega (opcional)</label>
            <Input
              id="c-ind"
              className="input"
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Timbre 2B, dejar en portería, llamar al llegar…"
              maxLength={300}
            />
          </div>

          {/* La cuenta antes de ir a pagar: acá se decide si el envío conviene. */}
          <ul className="cuenta" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            <li><span>Aporte de cultivo</span><span className="tnum">{aporte != null ? MONEY.format(aporte) : "—"}</span></li>
            <li>
              <span>{esSucursal(modo) ? "Envío a sucursal" : "Envío"} a {zonaElegida?.zona ?? "—"}</span><span className="tnum">{zonaElegida ? MONEY.format(zonaElegida.precioArs) : "—"}</span></li>
            <li className="cuenta-total"><span>Total</span><span className="tnum">{zonaElegida ? MONEY.format(totalPagar) : "—"}</span></li>
          </ul>
        </div>
      )}

      {error ? <div className="note note-danger" role="alert">{error}</div> : null}

      <div className="checkout-cta">
        <button type="submit" className="btn btn-lg btn-block" disabled={!entregaLista || busy}>
          {busy
            ? "Reservando…"
            : aporte != null
              ? `Continuar al pago · ${MONEY.format(totalPagar)}`
              : "Continuar al pago"}
        </button>
        <span className="cell-meta">
          {entregaLista
            ? `El comprobante se sube en el paso siguiente.`
            : modo === "RETIRO"
              ? "Elegí un horario para continuar."
              : !zonaElegida ? "Elegí una zona de envío para continuar." : "Completá el código postal y la calle."}
        </span>
      </div>
    </ValidatedForm>
  );
}
