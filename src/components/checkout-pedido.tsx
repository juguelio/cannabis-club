"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Copy, MapPin, Store, Truck } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { aEnviar } from "@/lib/carrito";
import { useCarrito } from "@/lib/carrito-cliente";
import { faltaParaMinimo } from "@/lib/envios";
import { ComprobantePago } from "@/components/comprobante-pago";
import { useToast } from "@/components/toast";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type ZonaEnvio = { zona: string; precioArs: number; demora: string; transportista?: string | null };
export type CheckoutData = {
  tope: number;
  aportePorGramo: number | null;
  minimoEnvioG: number;
  topeEnvioG: number;
  envios: ZonaEnvio[];
  cobro: { alias: string | null; cbu: string | null; titular: string | null; banco: string | null; nota: string | null } | null;
  cobertura:
    | { estado: "CUBIERTA"; cp: string; zona: ZonaEnvio; aproximada: boolean; motivo: string }
    | { estado: "SIN_CP" }
    | { estado: "SIN_ZONAS" }
    | { estado: "SIN_COBERTURA"; cp: string; motivo: string };
  /** Aldea: lo que el club ya sabe del domicilio. */
  member: { address: string | null; locality: string | null; province: string | null; postalCode: string | null };
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type Day = { key: string; label?: string; estado?: string };

const PASOS = ["Entrega", "Pago", "Confirmado"] as const;

/**
 * El pedido en tres pasos, con la cuenta hecha antes de confirmar.
 *
 * El problema que resuelve: antes se elegía todo en una pantalla larga y el botón creaba el pedido sin
 * decir cuánto había que transferir ni a dónde. Acá el socio ve el desglose, el total, el alias, y
 * recién ahí confirma; la confirmación existe como pantalla, no como un toast que se va.
 */
export function CheckoutPedido({
  data,
  nombreDe,
}: {
  data: CheckoutData;
  nombreDe: Record<string, string>;
}) {
  const router = useRouter();
  const { items, total, listo, vaciar } = useCarrito(data.tope);
  const toast = useToast();

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [modo, setModo] = useState<"RETIRO" | "ENVIO">("RETIRO");

  // Retiro
  const [day, setDay] = useState<string>("");
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [closedDay, setClosedDay] = useState(false);

  // Envío
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
  const [creado, setCreado] = useState<{
    id: string;
    modo: "RETIRO" | "ENVIO";
    gramos: number;
    aporte: number | null;
    envio: number;
    total: number;
    cuando: string | null;
  } | null>(null);

  const nombre = (id: string) => nombreDe[id] ?? "Variedad";
  const zonaElegida = data.envios.find((z) => z.zona === zona);
  const falta = faltaParaMinimo(total, data.minimoEnvioG);
  const costoEnvio = modo === "ENVIO" ? (zonaElegida?.precioArs ?? 0) : 0;
  const subtotal = data.aportePorGramo != null ? data.aportePorGramo * total : null;
  const totalPagar = (subtotal ?? 0) + costoEnvio;
  const direccion = [calle.trim(), localidad.trim(), provincia.trim(), cp.trim()].filter(Boolean).join(", ");
  const chosen = slots.find((s) => s.startMin === slot);

  useEffect(() => {
    let vivo = true;
    api<{ slots: Slot[]; days: Day[]; closed?: boolean }>(`/api/portal/slots?date=${day || ""}`)
      .then((d) => {
        if (!vivo) return;
        setSlots(d.slots ?? []);
        setDays(d.days ?? []);
        setClosedDay(Boolean(d.closed));
        // Se arranca en el primer día que tenga horarios libres: si son las 21, el de hoy no sirve y
        // el socio no debería tener que descubrirlo tocando un día cerrado.
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

  const resolverCp = async (valor: string) => {
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
  };

  const entregaLista =
    modo === "RETIRO" ? slot != null : Boolean(zonaElegida) && calle.trim().length >= 4 && cp.trim().length === 4;
  const puedeConfirmar = total > 0 && (modo === "RETIRO" || (falta === 0 && total <= data.topeEnvioG + 1e-9));

  // Se calcula en cada render a propósito: es una cadena corta y memoizarla dependía de un objeto
  // (`zonaElegida`) que cambia de identidad siempre, así que el compilador no podía preservarla.
  const cuando = (() => {
    if (modo === "ENVIO") return zonaElegida ? `${zonaElegida.zona} · ${zonaElegida.demora}` : null;
    const d = days.find((x) => x.key === day);
    return d && chosen ? `${d.label ?? day} a las ${chosen.label}` : null;
  })();

  async function confirmar() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ pickup: { id: string } }>("/api/portal/pickups", {
        body:
          modo === "ENVIO"
            ? { mode: "ENVIO", grams: total, items: aEnviar(items), zona, direccion }
            : { mode: "RETIRO", grams: total, items: aEnviar(items), date: day, startMin: slot },
      });
      setCreado({
        id: r.pickup.id,
        modo,
        gramos: total,
        aporte: subtotal,
        envio: costoEnvio,
        total: totalPagar,
        cuando,
      });
      setPaso(3);
      vaciar();
      toast({ tone: "ok", title: "Pedido confirmado" });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!listo) return null;

  if (items.length === 0 && paso !== 3) {
    return (
      <section className="panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="panel-body" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
          <h1 className="panel-title" style={{ fontSize: 20 }}>Tu basket está vacío</h1>
          <p className="hint" style={{ margin: 0 }}>Elegí variedades y volvé para hacer el pedido.</p>
          <Link href="/portal" className="btn">Ver variedades</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <ol className="pasos" aria-label="Pasos del pedido">
        {PASOS.map((p, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const estado = paso === n ? "actual" : paso > n ? "hecho" : "pendiente";
          return (
            <li key={p} className={`paso paso--${estado}`} aria-current={estado === "actual" ? "step" : undefined}>
              <span className="paso-num">{estado === "hecho" ? <Check aria-hidden size={13} /> : n}</span>
              <span>{p}</span>
            </li>
          );
        })}
      </ol>

      <div className="checkout-grid">
        <div>
          {paso === 1 ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h1 className="panel-title" style={{ fontSize: 19 }}>¿Cómo lo recibís?</h1>
                  <p className="panel-sub">Es lo único que falta para calcular el total.</p>
                </div>
              </div>
              <div className="panel-body" style={{ display: "grid", gap: 16 }}>
                <div className="entrega-opciones" role="radiogroup" aria-label="Forma de entrega">
                  {([
                    { id: "RETIRO" as const, icono: <Store aria-hidden size={18} />, t: "Retiro en el club", d: "Sin costo, con turno" },
                    { id: "ENVIO" as const, icono: <Truck aria-hidden size={18} />, t: "Envío a domicilio", d: data.envios[0] ? `Desde ${MONEY.format(data.envios[0].precioArs)}` : "Consultar" },
                  ]).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      className="entrega-op"
                      aria-pressed={modo === op.id}
                      onClick={() => setModo(op.id)}
                    >
                      {op.icono}
                      <b>{op.t}</b>
                      <small>{op.d}</small>
                    </button>
                  ))}
                </div>

                {modo === "RETIRO" ? (
                  <>
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
                        <p className="muted" style={{ margin: 0 }}>{closedDay ? "El club no atiende ese día." : "No hay horarios disponibles."}</p>
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
                  </>
                ) : (
                  <>
                    {data.cobertura.estado === "CUBIERTA" ? (
                      <p className="note note-ok" style={{ margin: 0 }}>
                        <MapPin aria-hidden />
                        <span>
                          Enviamos a <b>{data.cobertura.zona.zona}</b>: {MONEY.format(data.cobertura.zona.precioArs)} · {data.cobertura.zona.demora}
                          {data.cobertura.aproximada ? ` (${data.cobertura.motivo})` : ""}. Mínimo {g(data.minimoEnvioG)}.
                        </span>
                      </p>
                    ) : null}

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
                        <label className="label" htmlFor="c-loc">Localidad {cpEstado === "buscando" ? <span className="cell-meta">buscando…</span> : null}</label>
                        {localidades.length > 1 ? (
                          <select id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)}>
                            <option value="">Elegí tu localidad</option>
                            {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        ) : (
                          <input id="c-loc" className="input" value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Sale del código postal" />
                        )}
                      </div>
                      <div>
                        <label className="label" htmlFor="c-prov">Provincia</label>
                        <input id="c-prov" className="input" value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Sale del código postal" />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="c-dir">Calle y número</label>
                      <input id="c-dir" className="input" value={calle} onChange={(e) => setCalle(e.target.value)} placeholder="Los Notros 195, piso 2 depto B" />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-zona">Zona</label>
                      <select id="c-zona" className="input" value={zona} onChange={(e) => setZona(e.target.value)}>
                        {data.envios.map((z) => (
                          <option key={z.zona} value={z.zona}>{z.zona} · {MONEY.format(z.precioArs)} · {z.demora}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button type="button" className="btn btn-lg btn-block" disabled={!entregaLista} onClick={() => setPaso(2)}>
                  Continuar al pago
                </button>
              </div>
            </section>
          ) : null}

          {paso === 2 ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h1 className="panel-title" style={{ fontSize: 19 }}>La cuenta</h1>
                  <p className="panel-sub">Esto es lo que vas a transferir. El club confirma cuando ve el comprobante.</p>
                </div>
              </div>
              <div className="panel-body" style={{ display: "grid", gap: 14 }}>
                <ul className="cuenta">
                  {items.map((i) => (
                    <li key={i.strainId}>
                      <span>{nombre(i.strainId)} · {g(i.gramos)}</span>
                      <span className="tnum">{data.aportePorGramo != null ? MONEY.format(data.aportePorGramo * i.gramos) : "—"}</span>
                    </li>
                  ))}
                  {modo === "ENVIO" ? (
                    <li>
                      <span>Envío a {zonaElegida?.zona}</span>
                      <span className="tnum">{MONEY.format(costoEnvio)}</span>
                    </li>
                  ) : null}
                  <li className="cuenta-total">
                    <span>Total a transferir</span>
                    <span className="tnum">{MONEY.format(totalPagar)}</span>
                  </li>
                </ul>

                {data.cobro?.alias || data.cobro?.cbu ? (
                  <div className="cobro-caja">
                    <b>Transferí a estos datos</b>
                    {data.cobro.alias ? (
                      <div className="cobro-dato">
                        <span>Alias</span>
                        <code>{data.cobro.alias}</code>
                        <button
                          type="button"
                          className="cobro-copiar"
                          onClick={() => void navigator.clipboard?.writeText(data.cobro!.alias!)}
                          aria-label="Copiar el alias"
                        >
                          <Copy aria-hidden size={13} /> Copiar
                        </button>
                      </div>
                    ) : null}
                    {data.cobro.cbu ? (
                      <div className="cobro-dato"><span>CBU</span><code>{data.cobro.cbu}</code></div>
                    ) : null}
                    {data.cobro.titular ? <div className="cobro-dato"><span>Titular</span><b>{data.cobro.titular}</b></div> : null}
                    <span className="cell-meta">Después de confirmar podés subir el comprobante desde el pedido.</span>
                  </div>
                ) : (
                  <p className="note note-warn" style={{ margin: 0 }}>
                    <CircleAlert aria-hidden />
                    <span>El club no cargó los datos de cobro: pedí el alias en la secretaría antes de transferir.</span>
                  </p>
                )}

                {error ? <div className="note note-danger" role="alert">{error}</div> : null}

                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-quiet" onClick={() => setPaso(1)}>Volver</button>
                  <button type="button" className="btn btn-lg" style={{ flex: 1 }} disabled={busy || !puedeConfirmar} onClick={confirmar}>
                    {busy ? "Confirmando…" : `Confirmar pedido · ${MONEY.format(totalPagar)}`}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {paso === 3 && creado ? (
            <section className="panel">
              <div className="panel-body" style={{ display: "grid", gap: 14, justifyItems: "start" }}>
                <span className="chip chip-ok" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Check aria-hidden size={14} /> Pedido confirmado
                </span>
                <h1 className="panel-title" style={{ fontSize: 21 }}>Listo: {g(creado.gramos)} a {creado.total === 0 ? "confirmar" : MONEY.format(creado.total)}</h1>
                <p className="hint" style={{ margin: 0 }}>
                  {creado.modo === "ENVIO"
                    ? `Lo despachamos a ${creado.cuando ?? "tu domicilio"}.`
                    : `Te esperamos ${creado.cuando ?? "en el club"}. Traé tu DNI.`}{" "}
                  El club lo confirma cuando ve el comprobante.
                </p>
                <ul className="cuenta" style={{ width: "100%" }}>
                  <li><span>Aporte</span><span className="tnum">{creado.aporte != null ? MONEY.format(creado.aporte) : "—"}</span></li>
                  {creado.envio > 0 ? <li><span>Envío</span><span className="tnum">{MONEY.format(creado.envio)}</span></li> : null}
                  <li className="cuenta-total"><span>Total</span><span className="tnum">{MONEY.format(creado.total)}</span></li>
                </ul>
                <div style={{ width: "100%" }}>
                  <ComprobantePago
                    pickupId={creado.id}
                    aporteEstimado={creado.aporte ?? creado.total}
                    envioArs={creado.envio > 0 ? creado.envio : null}
                    pago="PENDIENTE"
                    pagoMotivo={null}
                    cobro={data.cobro ?? { alias: null, cbu: null, titular: null, banco: null, nota: null }}
                    onSubido={() => router.refresh()}
                  />
                </div>
                <Link href="/portal#mis-pedidos" className="btn">Ver mis pedidos</Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="checkout-resumen" aria-label="Resumen del pedido">
          <div className="panel">
            <div className="panel-body" style={{ display: "grid", gap: 8 }}>
              <b style={{ fontSize: 14 }}>Tu pedido</b>
              <ul className="cuenta">
                {items.length === 0 && creado ? (
                  <li><span>{g(creado.gramos)}</span><span className="tnum">{MONEY.format(creado.total)}</span></li>
                ) : (
                  items.map((i) => (
                    <li key={i.strainId}>
                      <span>{nombre(i.strainId)} · {g(i.gramos)}</span>
                      <span className="tnum">{data.aportePorGramo != null ? MONEY.format(data.aportePorGramo * i.gramos) : ""}</span>
                    </li>
                  ))
                )}
                {modo === "ENVIO" && paso < 3 ? <li><span>Envío</span><span className="tnum">{MONEY.format(costoEnvio)}</span></li> : null}
                <li className="cuenta-total">
                  <span>Total</span>
                  <span className="tnum">{MONEY.format(paso === 3 && creado ? creado.total : totalPagar)}</span>
                </li>
              </ul>
              <span className="cell-meta">{g(total)} de {g(data.tope)} de tu saldo</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
