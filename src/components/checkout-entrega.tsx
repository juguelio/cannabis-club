"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Store, Truck } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { aEnviar } from "@/lib/carrito";
import { useCarrito } from "@/lib/carrito-cliente";
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

/**
 * Paso 1: la entrega, y nada más.
 *
 * Antes esta pantalla mostraba el resumen del pedido al costado, la cuenta, los datos de transferencia
 * y el comprobante en la misma vista: cinco bloques compitiendo. Acá sólo se elige cómo llega —retiro
 * con turno o envío a domicilio— y se avanza. El pedido se crea al continuar y su número manda: el
 * paso siguiente se abre por esa dirección y se puede recargar sin perder nada.
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

  const [modo, setModo] = useState<"RETIRO" | "ENVIO">("RETIRO");

  const [day, setDay] = useState<string>("");
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [closedDay, setClosedDay] = useState(false);

  const sugerida = data.cobertura.estado === "CUBIERTA" ? data.cobertura.zona.zona : (data.envios[0]?.zona ?? "");
  const [zona, setZona] = useState<string>(sugerida);
  const [cp, setCp] = useState<string>(data.member.postalCode ?? "");
  const [localidad, setLocalidad] = useState<string>(data.member.locality ?? "");
  const [provincia, setProvincia] = useState<string>(data.member.province ?? "");
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [calle, setCalle] = useState<string>(data.member.address ?? "");
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
  const entregaLista =
    modo === "RETIRO" ? slot != null : Boolean(zonaElegida) && calle.trim().length >= 4 && cp.trim().length === 4;
  const direccion = [calle.trim(), localidad.trim(), provincia.trim(), cp.trim()].filter(Boolean).join(", ");

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

  /** El pedido se crea acá: lo que sigue es pagarlo, y para eso hace falta su número. */
  async function continuar() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ pickup: { id: string } }>("/api/portal/pickups", {
        body:
          modo === "ENVIO"
            ? { mode: "ENVIO", grams: total, items: aEnviar(items), zona, direccion }
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
    <div className="checkout-paso">
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
                  }}
                >
                  <small>{(d.label ?? "").split(" ")[0]}</small>
                  <b className="tnum">{d.key.slice(-2)}</b>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">¿A qué hora?</span>
            {slots.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>{closedDay ? "El club no atiende ese día." : "No hay horarios disponibles."}</p>
            ) : (
              <div className="slot-grid" role="radiogroup" aria-label="Horario del retiro">
                {slots.map((s) => (
                  <button key={s.startMin} type="button" className="slot" disabled={s.full || s.past} aria-pressed={s.startMin === slot} onClick={() => setSlot(s.startMin)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          ) : null}

          {/* El CP va primero: con los cuatro dígitos se completan localidad y provincia solas. */}
          <div className="dir-grid">
            <div>
              <label className="label" htmlFor="c-cp">Código postal</label>
              <input
                id="c-cp"
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
            </div>
            <div>
              <label className="label" htmlFor="c-loc">Localidad</label>
              {localidades.length > 1 ? (
                <select id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)}>
                  <option value="">Elegí tu localidad</option>
                  {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <input id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Sale del código" />
              )}
            </div>
            <div>
              <label className="label" htmlFor="c-prov">Provincia</label>
              <input id="c-prov" className="input" value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Sale del código" />
            </div>
          </div>
          {cpEstado === "buscando" ? <span className="cell-meta">Buscando la localidad…</span> : null}
          {cpEstado === "no-resuelto" ? <span className="cell-meta">No pudimos resolver ese código: escribí la localidad y la provincia.</span> : null}

          <div>
            <label className="label" htmlFor="c-dir">Calle y número</label>
            <input id="c-dir" className="input" value={calle} onChange={(e) => setCalle(e.target.value)} placeholder="Los Notros 195, piso 2 depto B" />
          </div>

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
        </div>
      )}

      {error ? <div className="note note-danger" role="alert">{error}</div> : null}

      <div className="checkout-cta">
        <button type="button" className="btn btn-lg btn-block" disabled={!entregaLista || busy} onClick={continuar}>
          {busy ? "Reservando…" : "Continuar al pago"}
        </button>
        <span className="cell-meta">El total y los datos para transferir están en el paso siguiente.</span>
      </div>
    </div>
  );
}
