"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CircleAlert, Leaf, PackageCheck, QrCode, Truck } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { memberDocumentStatus } from "@/lib/member-document-status";
import { Chip } from "./ui";
import type { Variedad } from "@/lib/variedad-rules";
import { aEnviar, disponibleCarrito, gramosDe, moverItem, PASO_G, totalCarrito, type ItemCarrito } from "@/lib/carrito";
import { faltaParaMinimo, type Cobertura } from "@/lib/envios";
import { esActivo, estadoPedido } from "@/lib/pedidos-estado";
import { VariedadCard } from "@/components/variedad-card";
import { CarritoDrawer } from "@/components/carrito-drawer";
import { ComprobantePago } from "@/components/comprobante-pago";
import { ReasonDialog } from "./dialog";
import { useToast } from "./toast";

type Overview = {
  cuenta?: { saldo: number; periodo: string; aportesDelMes: number };
  member: {
    legajo: number;
    status: string;
    firstName: string;
    lastName: string;
    reprocannStatus: string;
    reprocannNumber: string | null;
    reprocannExpiresAt: string | null;
    reprocannOk: boolean;
    reprocannDays: number | null;
    address: string | null;
    locality: string | null;
    postalCode: string | null;
  };
  club: {
    nombre: string;
    aportePorGramo: number | null;
    /** Zonas de envío con costo y demora; vacío = el club sólo entrega en sede. */
    envios: { zona: string; precioArs: number; demora: string; transportista?: string | null }[];
    cobro?: { alias: string | null; cbu: string | null; titular: string | null; banco: string | null; nota: string | null };
    /** Cuántos gramos entran en un envío (membresías por caja × gramos de la membresía). */
    topeEnvioG: number;
    /** Piso del envío: por debajo no se despacha. Lo decide el club. */
    minimoEnvioG: number;
    /** Qué zona le toca según su código postal (o por qué no le toca ninguna). */
    cobertura?: Cobertura;
  };
  limits: { monthLimitG: number; dayLimitG: number; isMinor: boolean; thcMaxPct: number | null };
  usage: { dayGrams: number; monthGrams: number };
  pendingGrams: number;
  disponibleMes: number;
  disponibleDia: number;
  stock: number;
  tope: number;
  topeMotivo: "mes" | "dia" | "stock";
  aporteEstimadoTope: number | null;
  pickups: {
    id: string;
    grams: number;
    status: string;
    createdAt: string;
    pickupLabel: string | null;
    aporteEstimado: number | null;
    cancelReason: string | null;
    deliveryMode?: "RETIRO" | "ENVIO";
    deliveryZona?: string | null;
    deliveryCostoArs?: number | null;
    pago: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
    pagoMotivo: string | null;
  }[];
  /** Totales reales de la base, no de la lista recortada. */
  pickupTotals?: { todos: number; activos: number; cerrados: number };
  /** Cuántos pedidos entran en `pickups`: si el total es mayor, la lista es un recorte. */
  pickupsLimit?: number;
};

type Slot = { startMin: number; label: string; free: number; past: boolean; full: boolean };
type EstadoDia = "abierto" | "cerrado" | "sin-franja" | "hoy-sin-horario";
type Day = { key: string; weekday: number; estado?: EstadoDia; label?: string };

const MOTIVO_DIA: Record<EstadoDia, string> = {
  abierto: "",
  cerrado: "El club no atiende ese día",
  "sin-franja": "Ese día el club no atiende",
  "hoy-sin-horario": "Hoy ya no quedan horarios",
};

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;
const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WDL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dayParts = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { wd: WD[wd], long: `${WDL[wd]} ${d}/${m}`, d };
};


export type MemberHistory = { id: string; at: string; grams: number; strain: string; batch: string; voided: boolean }[];
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso)) : "—";

export function MemberPortal({
  initial,
  initialSlots,
  initialDay,
  recalled = [],
  consents = [],
  consentTexts = {},
  qr,
  history,
  consentDate,
  variedades = [],
}: {
  initial: Overview;
  initialSlots: Slot[];
  initialDay: string;
  consents?: { purpose: string; label: string; detail: string; granted: boolean; grantedAt: string | null; by: string | null; version: string | null; revokedAt: string | null }[];
  consentTexts?: Record<string, Record<string, string>>;
  recalled?: { code: string; strain: string; grams: number; occurredAt: string; reason: string | null; recalledAt: string | null }[];
  qr: string;
  history: MemberHistory;
  consentDate: string | null;
  variedades?: Variedad[];
}) {
  const toast = useToast();
  const [data, setData] = useState<Overview>(initial);
  const [day, setDay] = useState(initialDay);
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  // El combo se arma en el catálogo de variedades, no en un campo de gramos suelto: el socio elige
  // de qué cepas quiere y el total sale de ahí.
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [filtroPedidos, setFiltroPedidos] = useState<"TODOS" | "ACTIVOS" | "CERRADOS">("TODOS");
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [closedDay, setClosedDay] = useState(false);
  // Cómo llega el producto: al club con turno, o a la casa del socio por envío.
  const [modo, setModo] = useState<"RETIRO" | "ENVIO">("RETIRO");
  // La carta del club la decide el socio, no la secretaría: se pide y se retira desde acá.
  const [carta, setCarta] = useState<boolean>(consents.some((c) => c.purpose === "COMUNICACIONES" && c.granted));
  const [cartaBusy, setCartaBusy] = useState(false);
  // La zona arranca en la que corresponde a su código postal, no en la primera de la lista: el socio
  // de Neuquén no debería ver «CABA $20.000» preseleccionado y descubrirlo al pagar.
  const [zona, setZona] = useState<string>(
    data.club.cobertura?.estado === "CUBIERTA" ? data.club.cobertura.zona.zona : (data.club.envios[0]?.zona ?? ""),
  );
  const [direccion, setDireccion] = useState<string>(data.member.address ?? "");
  const documentStatus = memberDocumentStatus(data.member);
  const visibleHistory = history.filter((item) => historyFilter === "all" || (historyFilter === "voided" ? item.voided : !item.voided));

  useEffect(() => {
    let alive = true;
    api<{ slots: Slot[]; days: Day[]; closed?: boolean }>(`/api/portal/slots?date=${day}`)
      .then((d) => {
        if (!alive) return;
        setSlots(d.slots ?? []);
        setDays(d.days ?? []);
        setClosedDay(Boolean(d.closed));
        setSlot(null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [day]);

  const open = data.member.reprocannOk && data.member.status === "ACTIVO" && data.tope > 0;
  const gramsNum = totalCarrito(carrito);
  const validGrams = gramsNum > 0 && gramsNum <= data.tope + 1e-9;
  const puedeSubir = (id: string) => gramosDe(carrito, id) > 0 || disponibleCarrito(carrito, data.tope) >= PASO_G;
  const estimated = data.club.aportePorGramo != null && validGrams ? data.club.aportePorGramo * gramsNum : null;
  const cepaNombre = (id: string) => variedades.find((v) => v.id === id)?.nombre ?? "Variedad";
  const chosen = slots.find((s) => s.startMin === slot);
  const activos = data.pickups.filter((p) => esActivo(p.status));
  const totales = data.pickupTotals ?? {
    todos: data.pickups.length,
    activos: activos.length,
    cerrados: data.pickups.length - activos.length,
  };
  const pickupsVisibles = data.pickups.filter((p) =>
    filtroPedidos === "TODOS" ? true : filtroPedidos === "ACTIVOS" ? esActivo(p.status) : !esActivo(p.status),
  );
  const zonaElegida = data.club.envios.find((z) => z.zona === zona);
  const cobertura = data.club.cobertura;
  const faltanParaEnvio = faltaParaMinimo(gramsNum, data.club.minimoEnvioG ?? 0);
  const gramosFaltanEnvio = faltanParaEnvio;
  const costoEnvio = modo === "ENVIO" ? (zonaElegida?.precioArs ?? 0) : 0;
  const totalACubrir = (estimated ?? 0) + costoEnvio;
  const envioValido =
    modo === "ENVIO" &&
    validGrams &&
    zonaElegida != null &&
    direccion.trim().length >= 8 &&
    gramsNum <= data.club.topeEnvioG + 1e-9 &&
    faltanParaEnvio === 0;
  const puedePedir = validGrams && (modo === "RETIRO" ? slot != null : envioValido);

  async function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (!puedePedir) return;
    setBusy(true);
    setError(null);
    try {
      const json = await api<{ overview: Overview }>("/api/portal/pickups", {
        body:
          modo === "ENVIO"
            ? { mode: "ENVIO", grams: gramsNum, items: aEnviar(carrito), zona, direccion: direccion.trim() }
            : { mode: "RETIRO", grams: gramsNum, items: aEnviar(carrito), date: day, startMin: slot },
      });
      setData(json.overview);
      setCarrito([]);
      setSlot(null);
      toast(
        modo === "ENVIO"
          ? { tone: "ok", title: "Pedido de envío tomado", text: "El club lo prepara y lo despacha a tu domicilio. Te avisa cuando sale." }
          : { tone: "ok", title: "Reserva tomada", text: "El club la confirma y te espera en el horario elegido." },
      );
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function recargar() {
    try {
      const json = await api<{ overview: Overview }>("/api/portal/overview");
      setData(json.overview);
    } catch {
      // Si falla el refresco no se pierde nada: el comprobante ya quedó cargado.
    }
  }

  const limit = data.limits.monthLimitG;
  const pct = (v: number) => `${Math.min(100, (v / limit) * 100)}%`;

  return (
    <>
      <header className="member-intro">
        <div className="flex items-center gap-3">
          <div><p className="panel-sub" style={{ margin: 0 }}>{data.club.nombre}</p><h1 style={{ margin: 0 }}>Tu espacio de socio</h1></div>
        </div>
        <nav aria-label="Secciones de tu portal" className="member-shortcuts">
          <a href="#mi-carnet" onClick={() => setShowCard(true)}>Mi carnet</a>
          <a href="#variedades">Variedades</a>
          <a href="#historial">Historial</a>
          <a href="#documentacion">Documentación</a>
        </nav>
      </header>
      {recalled.length ? (
        <section className="note note-bad" role="alert" style={{ marginBottom: 4 }}>
          <CircleAlert aria-hidden />
          <div>
            <b>Un lote que retiraste fue retirado del mercado.</b>
            <div style={{ marginTop: 4 }}>
              {recalled.map((r) => (
                <div key={`${r.code}-${r.occurredAt}`}>
                  {r.strain} · lote {r.code} · {g(r.grams)} el {fmtDate(r.occurredAt)}
                  {r.reason ? ` · motivo: ${r.reason}` : ""}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6 }}>No lo consumas y escribí a la secretaría del club.</div>
          </div>
        </section>
      ) : null}

      {data.member.reprocannDays != null && data.member.reprocannDays <= 30 ? (
        <section className="note note-warn" role="status" style={{ marginBottom: 4 }}>
          <CircleAlert aria-hidden />
          <div>
            <b>
              {data.member.reprocannDays < 0
                ? "Tu REPROCANN está vencido."
                : data.member.reprocannDays === 0
                  ? "Tu REPROCANN vence hoy."
                  : `Tu REPROCANN vence en ${data.member.reprocannDays} días.`}
            </b>{" "}
            {data.member.reprocannDays < 0
              ? "No vas a poder retirar hasta renovarlo. Cuando lo tengas, avisanos y lo cargamos."
              : "Iniciá la renovación ahora para no quedarte sin poder retirar."}
          </div>
        </section>
      ) : null}

      <section className="allowance" aria-label="Tu saldo del mes">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div style={{ fontSize: 14, color: "#a9c0b3" }}>Hola, {data.member.firstName}. Te quedan este mes</div>
            <div className="allowance-big" style={{ marginTop: 8 }}>{String(data.disponibleMes).replace(".", ",")}<small>g</small></div>
          </div>
          <button className="rail-out" onClick={() => setShowCard((s) => !s)} aria-expanded={showCard} aria-controls="mi-carnet" aria-label={showCard ? "Ocultar mi carnet" : "Mostrar mi carnet"} title="Mi carnet" style={{ padding: 8 }}>
            <QrCode size={20} />
          </button>
        </div>
        <div className="gauge-track" style={{ marginTop: 18 }} aria-hidden>
          <span className="gauge-used" style={{ width: pct(data.usage.monthGrams) }} />
          <span className="gauge-now" style={{ left: pct(data.usage.monthGrams), width: pct(data.pendingGrams) }} />
        </div>
        <div className="gauge-row" style={{ marginTop: 8, marginBottom: 0 }}>
          <span>Retiraste <b>{g(data.usage.monthGrams)}</b>{data.pendingGrams ? <>, reservaste <b>{g(data.pendingGrams)}</b></> : null}</span>
          <span>de {g(limit)}</span>
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 14, fontSize: 13, color: "#a9c0b3" }}>
          <span>Legajo {data.member.legajo}</span>
          <span>·</span>
          <span style={{ color: data.member.reprocannOk ? "#a6e8bf" : "#ffb4a6" }}>
            REPROCANN: {documentStatus.label}
          </span>
          {data.limits.isMinor ? <><span>·</span><span>Tope reducido por edad{data.limits.thcMaxPct != null ? `, hasta ${data.limits.thcMaxPct}% THC` : ""}</span></> : null}
        </div>
        {data.cuenta ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 13, color: "#a9c0b3", marginTop: 10 }}>
            <span>Aporte de cultivo de {data.cuenta.periodo}: <b style={{ color: "#fff" }}>{MONEY.format(data.cuenta.aportesDelMes)}</b></span>
            <span>·</span>
            <span>
              Cuenta:{" "}
              <b style={{ color: data.cuenta.saldo > 0.009 ? "#ffb4a6" : data.cuenta.saldo < -0.009 ? "#a6e8bf" : "#fff" }}>
                {data.cuenta.saldo > 0.009
                  ? `adeudás ${MONEY.format(data.cuenta.saldo)}`
                  : data.cuenta.saldo < -0.009
                    ? `a favor ${MONEY.format(Math.abs(data.cuenta.saldo))}`
                    : "al día"}
              </b>
            </span>
          </div>
        ) : null}
          <div id="mi-carnet" hidden={!showCard} className="member-card" style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #23453a" }}>
            <div className="qr-box" style={{ width: 132, height: 132, flex: "none" }} dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="Código QR de tu carnet" />
            <div style={{ fontSize: 14 }}>
              <div style={{ color: "#fff", fontWeight: 650, fontFamily: "var(--font-display)", fontSize: 18 }}>{data.member.lastName}, {data.member.firstName}</div>
              <div style={{ color: "#a9c0b3" }}>Mostralo en el mostrador: abre tu legajo al instante.</div>
            </div>
          </div>
      </section>

      {activos.length === 1 ? (
        <div className="note note-ok">
          {activos[0].deliveryMode === "ENVIO" ? <Truck aria-hidden /> : <CalendarCheck2 aria-hidden />}
          <div>
            <b>
              {activos[0].deliveryMode === "ENVIO"
                ? `Tenés un envío de ${g(activos[0].grams)} en camino a prepararse.`
                : `Tenés un retiro de ${g(activos[0].grams)}${activos[0].pickupLabel ? ` el ${activos[0].pickupLabel.replace(" · ", " a las ")}` : ""}.`}
            </b>{" "}
            {activos[0].status === "CONFIRMADA" ? "El club ya lo confirmó." : "El club lo va a confirmar."}{" "}
            {activos[0].deliveryMode === "ENVIO"
              ? "Lo despacha el club y te avisamos cuando sale."
              : "Traé tu DNI para retirarlo."}
          </div>
        </div>
      ) : activos.length > 1 ? (
        <div className="note note-ok">
          <PackageCheck aria-hidden />
          <div>
            <b>Tenés {activos.length} pedidos activos.</b>{" "}
            {(() => {
              const envios = activos.filter((p) => p.deliveryMode === "ENVIO").length;
              const retiros = activos.length - envios;
              return [
                retiros ? `${retiros} para retirar en el club` : null,
                envios ? `${envios} para despachar a domicilio` : null,
              ]
                .filter(Boolean)
                .join(" y ")
                .concat(". Si vas a retirar, traé tu DNI.");
            })()}{" "}
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              style={{ marginLeft: 4 }}
              onClick={() => {
                setFiltroPedidos("ACTIVOS");
                document.getElementById("mis-pedidos")?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              Ver mis pedidos
            </button>
          </div>
        </div>
      ) : null}

      <section className="panel" id="variedades" aria-labelledby="variedades-title">
        <div className="panel-head"><div>
          <h2 className="panel-title" style={{ fontSize: 19 }} id="variedades-title">Variedades del club</h2>
          <p className="panel-sub">Lo que el club tiene cultivado. No se vende: el aporte de cultivo se prorratea al retirar y lo ves en tu cuenta.</p>
        </div></div>
        <div className="panel-body">
          {variedades.length === 0 ? (
            <div className="note note-mute">
              <Leaf aria-hidden />
              <div>Todavía no hay variedades publicadas. Cuando el club cierre una cosecha, aparecen acá.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
              {variedades.map((v) => (
                <VariedadCard
                  key={v.id}
                  v={v}
                  carrito={
                    open
                      ? {
                          gramos: gramosDe(carrito, v.id),
                          puedeSubir: puedeSubir(v.id),
                          onDelta: (paso) => setCarrito(moverItem(carrito, v.id, paso, data.tope)),
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <p className="panel-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            Para llevarte algo, reservá un retiro arriba: elegís gramos y horario, y el club lo prepara.
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div>
          <h2 className="panel-title" style={{ fontSize: 19 }}>Tu pedido</h2>
          <p className="panel-sub">Armás el combo en las variedades —5 g por vez, hasta tu tope del mes— y acá elegís cómo lo recibís: en el club con turno, o en tu domicilio. El aporte de cultivo se prorratea al entregar: no es una venta.</p>
        </div></div>
        <div className="panel-body">
          {!open ? (
            <div className="note note-warn">
              <CircleAlert aria-hidden />
              <div>
                {!data.member.reprocannOk
                  ? `Tu documentación requiere revisión (${documentStatus.label.toLowerCase()}). Consultá con la secretaría del club.`
                  : data.member.status !== "ACTIVO"
                    ? "Tu ficha no está activa. Hablá con la secretaría del club."
                    : data.topeMotivo === "stock"
                      ? "En este momento no hay stock para reservar. Probá en unos días."
                      : "Ya usaste todo tu saldo disponible. Se renueva el mes que viene."}
              </div>
            </div>
          ) : (
            <form className="stack" style={{ gap: 18 }} onSubmit={reserve} id="confirmar-pedido">
              <div className="cart-summary" aria-live="polite">
                <div className="cart-summary-head">
                  <span className="label" style={{ margin: 0 }}>Tu combo</span>
                  <span className="cart-total tnum">
                    {g(gramsNum)} / {g(data.tope)}
                  </span>
                </div>

                {carrito.length === 0 ? (
                  <p className="hint" style={{ margin: "6px 0 0" }}>
                    Elegí arriba las variedades y los gramos de cada una: el total se arma solo.
                  </p>
                ) : (
                  <button type="button" className="btn btn-quiet btn-block" style={{ marginTop: 8 }} onClick={() => setDrawerAbierto(true)}>
                    Revisar los {carrito.length} renglones del pedido
                  </button>
                )}

                <span className="hint" style={{ marginTop: 8 }}>
                  Hasta {g(data.tope)}{" "}
                  {data.topeMotivo === "dia" ? `por el tope diario de ${g(data.limits.dayLimitG)}` : data.topeMotivo === "mes" ? "de tu saldo del mes" : "según el stock del club"}.
                  {estimated != null ? ` Aporte estimado: ${MONEY.format(estimated)}.` : data.club.aportePorGramo != null ? ` Aporte: ${MONEY.format(data.club.aportePorGramo)} por gramo.` : ""}
                </span>
                {modo === "ENVIO" ? (
                  <div className="cart-lineas">
                    {zonaElegida ? (
                      <div className="cart-linea">
                        <span>Envío a {zonaElegida.zona}</span>
                        <span className="tnum">{MONEY.format(zonaElegida.precioArs)}</span>
                      </div>
                    ) : (
                      <div className="cart-linea">
                        <span>Envío</span>
                        <span>Elegí la zona</span>
                      </div>
                    )}
                    {faltanParaEnvio > 0 ? (
                      <p className="note note-warn" style={{ marginTop: 6 }}>
                        <CircleAlert aria-hidden />
                        <span>
                          El envío sale desde {g(data.club.minimoEnvioG)}: te faltan {g(faltanParaEnvio)}. Sumá otra
                          variedad o retirá en el club.
                        </span>
                      </p>
                    ) : null}
                    {totalACubrir > 0 ? (
                      <div className="cart-linea cart-linea--total">
                        <span>A cubrir al entregar</span>
                        <span className="tnum">{MONEY.format(totalACubrir)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <span className="cell-meta">El saldo del mes se renueva el día 1 y el tope diario a las 00:00. Se fracciona de a {PASO_G} g.</span>
              </div>

              {cobertura ? (
                <div className={`note ${cobertura.estado === "CUBIERTA" ? "note-ok" : cobertura.estado === "SIN_COBERTURA" ? "note-warn" : "note"}`} role="status">
                  <CircleAlert aria-hidden />
                  <div>
                    {cobertura.estado === "CUBIERTA" ? (
                      <>
                        <b>Enviamos a tu zona: {cobertura.zona.zona}.</b> {MONEY.format(cobertura.zona.precioArs)} ·{" "}
                        {cobertura.zona.demora}
                        {cobertura.zona.transportista ? ` · ${cobertura.zona.transportista}` : ""}.{" "}
                        {cobertura.aproximada ? <span className="cell-meta">{cobertura.motivo}. </span> : null}
                        Mínimo {g(data.club.minimoEnvioG)}.{" "}
                        <Link href="/portal/envios" style={{ fontWeight: 650, textDecoration: "underline" }}>
                          Ver todos los envíos
                        </Link>
                      </>
                    ) : cobertura.estado === "SIN_CP" ? (
                      <>
                        <b>Falta tu código postal para saber si llegamos.</b>{" "}
                        <Link href="/portal/datos" style={{ fontWeight: 650, textDecoration: "underline" }}>
                          Completar mis datos
                        </Link>
                      </>
                    ) : cobertura.estado === "SIN_ZONAS" ? (
                      <>
                        <b>Por ahora sólo retiro en el club</b>: todavía no hay zonas de envío cargadas.
                      </>
                    ) : (
                      <>
                        <b>No llegamos con envío a tu código postal ({cobertura.cp}).</b> {cobertura.motivo}. Podés retirar
                        en el club o escribirnos para coordinar.
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              <div>
                <span className="label">¿Cómo lo recibís?</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de entrega">
                  {([
                    { id: "RETIRO" as const, t: "Retiro en el club", d: "Con turno, el día que elijas" },
                    { id: "ENVIO" as const, t: "Envío a domicilio", d: "A tu casa, por transporte" },
                  ]).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      className={modo === op.id ? "btn btn-quiet" : "btn btn-quiet"}
                      aria-pressed={modo === op.id}
                      onClick={() => setModo(op.id)}
                      style={
                        modo === op.id
                          ? { borderColor: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--ink)", textAlign: "left" }
                          : { textAlign: "left", opacity: 0.75 }
                      }
                    >
                      <span style={{ display: "block", fontWeight: 650 }}>{op.t}</span>
                      <span className="cell-meta">{op.d}</span>
                    </button>
                  ))}
                </div>
                {data.club.envios.length === 0 ? (
                  <span className="hint">El club todavía no cargó zonas de envío: por ahora sólo retiro en el club.</span>
                ) : null}
                {modo === "ENVIO" && cobertura?.estado === "CUBIERTA" && zonaElegida && zonaElegida.zona !== cobertura.zona.zona ? (
                  <span className="hint" style={{ display: "block", marginTop: 6, color: "var(--warn-ink, #7a4b00)" }}>
                    Tu código postal ({cobertura.cp}) corresponde a <b>{cobertura.zona.zona}</b> y elegiste{" "}
                    <b>{zonaElegida.zona}</b>. Si no coincide con tu domicilio, revisá la zona o tus datos.
                  </span>
                ) : null}
                {!data.member.postalCode ? (
                  <div className="note note-warn" role="status">
                    <CircleAlert aria-hidden />
                    <div>
                      Para pedir envío falta tu código postal.{" "}
                      <Link href="/portal/datos" style={{ fontWeight: 650, textDecoration: "underline" }}>
                        Completar mis datos
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              {modo === "RETIRO" ? (<>
              <div>
                <span className="label">¿Qué día?</span>
                <div className="days" role="radiogroup" aria-label="Día del retiro">
                  {(days.length ? days : [{ key: initialDay, weekday: 0, estado: "abierto" as EstadoDia }]).map((d) => {
                    const p = dayParts(d.key);
                    const cerrado = (d.estado ?? "abierto") !== "abierto";
                    return (
                      <button
                        key={d.key}
                        type="button"
                        className="day"
                        aria-pressed={d.key === day}
                        aria-disabled={cerrado}
                        title={cerrado ? MOTIVO_DIA[d.estado ?? "abierto"] : undefined}
                        style={cerrado ? { opacity: 0.45 } : undefined}
                        onClick={() => setDay(d.key)}
                      >
                        <small>{p.wd}</small><b className="tnum">{p.d}</b>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label">¿A qué hora?</span>
                {slots.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {closedDay
                      ? "El club cerró ese día. Elegí otra fecha."
                      : MOTIVO_DIA[days.find((d) => d.key === day)?.estado ?? "sin-franja"] || "Ese día el club no atiende."}
                  </p>
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

              </>) : (<>
                <div>
                  <label className="label" htmlFor="p-zona">¿A qué zona?</label>
                  <select id="p-zona" className="input" value={zona} onChange={(e) => setZona(e.target.value)}>
                    {data.club.envios.map((z) => (
                      <option key={z.zona} value={z.zona}>
                        {z.zona} · {MONEY.format(z.precioArs)} · {z.demora}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    El envío lo paga el socio y se cobra aparte del aporte de cultivo.{" "}
                    {zonaElegida ? `Sale por ${zonaElegida.transportista ?? "el transporte del club"}, ${zonaElegida.demora.toLowerCase()}.` : ""}
                  </span>
                </div>

                <div>
                  <label className="label" htmlFor="p-dir">¿A qué dirección lo mandamos?</label>
                  <textarea
                    id="p-dir"
                    className="input"
                    rows={2}
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle y número, localidad, provincia, código postal"
                  />
                  <span className="hint">Tiene que ser una dirección donde haya alguien para recibir. Lo despachamos en un solo envío.</span>
                </div>

                {validGrams && gramsNum > data.club.topeEnvioG + 1e-9 ? (
                  <div className="note note-warn">
                    <CircleAlert aria-hidden />
                    <div>Por envío salen hasta {g(data.club.topeEnvioG)}. Si querés más, dividilo en dos pedidos.</div>
                  </div>
                ) : null}
              </>)}

              {error ? <div className="note note-danger" role="alert">{error}</div> : null}
              <button className="btn btn-lg btn-block" disabled={busy || !puedePedir}>
                {busy
                  ? "Enviando…"
                  : modo === "ENVIO"
                    ? envioValido
                      ? `Pedir envío de ${g(gramsNum)} a ${zona}`
                      : direccion.trim().length < 8
                        ? "Completá la dirección"
                        : "Pedir envío"
                    : validGrams && chosen
                      ? `Reservar ${g(gramsNum)} el ${dayParts(day).long} a las ${chosen.label}`
                      : "Reservar retiro"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="panel" id="mis-pedidos" aria-labelledby="mis-pedidos-title">
        <div className="panel-head"><div>
          <h2 className="panel-title" id="mis-pedidos-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Mis pedidos
            {totales.activos > 0 ? (
              <Chip tone="brand">
                {totales.activos} activo{totales.activos === 1 ? "" : "s"}
              </Chip>
            ) : null}
          </h2>
          <p className="panel-sub">
            Retiros y envíos, cada uno con lo que el club sabe: fecha, modalidad y estado. Al entregar —en el club o por
            envío— vuelve a verificar tu REPROCANN y tus topes.
          </p>
        </div></div>
        {totales.todos === 0 ? (
          <div className="empty">Todavía no hiciste ningún pedido. Elegí tus variedades arriba y armá el primero.</div>
        ) : (
          <>
            <div className="filtros" role="group" aria-label="Filtrar pedidos">
              {(
                [
                  ["TODOS", `Todos (${totales.todos})`],
                  ["ACTIVOS", `Activos (${totales.activos})`],
                  ["CERRADOS", `Cerrados (${totales.cerrados})`],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className="filtro-btn"
                  aria-pressed={filtroPedidos === valor}
                  onClick={() => setFiltroPedidos(valor)}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            {data.pickups.length < totales.todos ? (
              <p className="cell-meta" style={{ margin: "0 0 8px" }}>
                Mostrando los últimos {data.pickups.length} de {totales.todos}. Los contadores son del total real.
              </p>
            ) : null}
            {pickupsVisibles.length === 0 ? (
              <div className="empty">
                {filtroPedidos === "ACTIVOS"
                  ? "No tenés pedidos activos ahora."
                  : filtroPedidos === "CERRADOS"
                    ? "Todavía no tenés pedidos cerrados."
                    : "No hay pedidos para mostrar."}
              </div>
            ) : (
          <ul className="rows">
            {pickupsVisibles.map((p) => {
              const st = estadoPedido(p.status, p.deliveryMode);
              const isOpen = esActivo(p.status);
              return (
                <li key={p.id}>
                  <div className="grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="tnum">{g(p.grams)}</b>
                      <span className={st.tone === "mute" ? "chip" : `chip chip-${st.tone}`}>{st.label}</span>
                      <span className="chip">
                        {p.deliveryMode === "ENVIO" ? "Envío a domicilio" : "Retiro en el club"}
                      </span>
                    </div>
                    <div className="pedido-datos">
                      <span>Pedido el {fmtDay(p.createdAt)}</span>
                      {p.deliveryMode === "ENVIO" ? (
                        <span>
                          {p.deliveryZona ?? "zona a confirmar"}
                          {p.deliveryCostoArs != null ? ` · envío ${MONEY.format(p.deliveryCostoArs)}` : ""}
                        </span>
                      ) : (
                        <span>{p.pickupLabel ? `Turno: ${p.pickupLabel.replace(" · ", " a las ")}` : "Sin turno asignado"}</span>
                      )}
                      {p.aporteEstimado != null ? (
                        <span>
                          {p.status === "RETIRADA" && p.deliveryMode !== "ENVIO" ? "Aporte" : "Aporte estimado"}{" "}
                          {MONEY.format(p.aporteEstimado)}
                        </span>
                      ) : null}
                      {st.nota ? <span className="pedido-nota">{st.nota}</span> : null}
                    </div>
                    {p.cancelReason ? (
                      <div className="pedido-motivo">
                        <b>Motivo de la cancelación</b>
                        <span>{p.cancelReason}</span>
                      </div>
                    ) : null}
                    {/* El aporte se transfiere y el comprobante cierra el pedido: sin eso el club no lo confirma. */}
                    {["SOLICITADA", "CONFIRMADA"].includes(p.status) && p.aporteEstimado != null ? (
                      <ComprobantePago
                        pickupId={p.id}
                        aporteEstimado={p.aporteEstimado}
                        envioArs={p.deliveryCostoArs ?? null}
                        pago={p.pago ?? "PENDIENTE"}
                        pagoMotivo={p.pagoMotivo ?? null}
                        cobro={data.club.cobro ?? { alias: null, cbu: null, titular: null, banco: null, nota: null }}
                        onSubido={() => { void recargar(); }}
                      />
                    ) : null}
                  </div>
                  {isOpen ? <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setCancelId(p.id)}>Cancelar</button> : null}
                </li>
              );
            })}
          </ul>
            )}
          </>
        )}
      </section>


      <section className="panel" id="historial" aria-labelledby="history-title">
        <div className="panel-head"><div>
          <h2 className="panel-title" id="history-title">Lo que retiraste</h2>
          <p className="panel-sub">Tus últimas entregas en el club. Si una figura anulada, el club la corrigió y no cuenta para tu tope.</p>
        </div></div>
        {history.length > 0 ? (
          <div className="panel-body member-history-filter">
            <label className="label" htmlFor="history-filter">Mostrar registros</label>
            <select id="history-filter" className="input" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}>
              <option value="all">Todos</option><option value="valid">Sin anular</option><option value="voided">Anulados</option>
            </select>
            <span className="hint" role="status">{visibleHistory.length} de {history.length} registros recientes</span>
          </div>
        ) : null}
        {history.length === 0 ? (
          <div className="empty">Todavía no retiraste nada.</div>
        ) : visibleHistory.length === 0 ? (
          <div className="empty">No hay registros con este filtro.</div>
        ) : (
          <ul className="rows">
            {visibleHistory.map((h) => (
              <li key={h.id} className={h.voided ? "voided" : undefined}>
                <div className="grow">
                  <div className="cell-main" style={h.voided ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{h.strain}</div>
                  <div className="cell-meta">{fmtDay(h.at)} · lote {h.batch}{h.voided ? " · anulada" : ""}</div>
                </div>
                <b className="tnum">{g(h.grams)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" id="privacidad">
        <div className="panel-head"><div>
          <h2 className="panel-title">Privacidad y permisos</h2>
          <p className="panel-sub">
            Esto es lo que el club tiene registrado que autorizaste, por separado. La carta del club la manejás vos
            desde acá; para el resto, pedilo en la secretaría: queda registrado con fecha, no se borra.
          </p>
        </div></div>
        <div className="panel-body">
          <ul className="stack" style={{ gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
            {consents.map((c) => (
              <li key={c.purpose} style={{ display: "grid", gap: 4 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{c.label}</b>
                  <Chip tone={c.granted ? "ok" : c.revokedAt ? "warn" : "mute"}>
                    {c.granted ? "Autorizado" : c.revokedAt ? "Revocado" : "Sin registrar"}
                  </Chip>
                  {c.granted && c.grantedAt ? <span className="cell-meta">{fmtDate(c.grantedAt)}</span> : null}
                  {c.version ? <span className="cell-meta">texto {c.version}</span> : null}
                </div>
                <span className="cell-meta">
                  {(c.version && consentTexts[c.version]?.[c.purpose]) ?? c.detail}
                </span>
                {c.purpose === "COMUNICACIONES" ? (
                  <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className={carta ? "btn btn-sm btn-quiet" : "btn btn-sm"}
                      disabled={cartaBusy}
                      onClick={async () => {
                        setCartaBusy(true);
                        try {
                          const r = await api("/api/portal/comunicaciones", { method: "POST", body: { quiere: !carta } });
                          setCarta(!carta);
                          toast({ tone: "ok", title: (r as { mensaje?: string })?.mensaje ?? "Listo." });
                        } catch (e) {
                          toast({ tone: "bad", title: "No se pudo cambiar", text: errMsg(e) });
                        } finally {
                          setCartaBusy(false);
                        }
                      }}
                    >
                      {carta ? "No quiero recibir la carta" : "Quiero recibir la carta"}
                    </button>
                    <span className="cell-meta">Es la carta mensual, no los avisos de tu trámite.</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel" id="documentacion">
        <div className="panel-head"><div>
          <h2 className="panel-title">Tu documentación</h2>
          <p className="panel-sub">Si algo no coincide con tus papeles, avisá en la secretaría: el club lo corrige en tu legajo.</p>
        </div></div>
        <div className="panel-body">
          {documentStatus.attention ? (
            <div className="note note-warn" style={{ marginBottom: 16 }}>
              <CircleAlert aria-hidden /><div><b>REPROCANN: {documentStatus.label}.</b> Revisá los datos con la secretaría del club.</div>
            </div>
          ) : null}
          <dl className="dl">
            <dt>Estado de la ficha</dt><dd>{{ ACTIVO: "Activo", PENDIENTE: "Pendiente", SUSPENDIDO: "Suspendido", BAJA: "De baja" }[data.member.status] ?? "Consultar en secretaría"}</dd>
            <dt>Estado REPROCANN</dt><dd>{documentStatus.label}</dd>
            <dt>Legajo</dt><dd className="tnum">{data.member.legajo}</dd>
            <dt>REPROCANN</dt><dd>{data.member.reprocannNumber ?? "Sin número cargado"}</dd>
            <dt>Vence</dt><dd>{fmtDate(data.member.reprocannExpiresAt)}</dd>
            <dt>Consentimiento</dt><dd>{consentDate ? `Firmado el ${fmtDate(consentDate)}` : "Falta firmar en el club"}</dd>
          </dl>
        </div>
      </section>

      <ReasonDialog
        open={cancelId != null}
        onClose={() => setCancelId(null)}
        title="Cancelar la reserva"
        description="Los gramos vuelven a tu saldo del mes y el horario se libera."
        confirmLabel="Cancelar reserva"
        reasonLabel="¿Querés contarle al club por qué? (opcional)"
        reasonRequired={false}
        danger
        busy={busy}
        onConfirm={async (reason) => {
          if (!cancelId) return;
          setBusy(true);
          try {
            const json = await api<{ overview: Overview }>(`/api/portal/pickups/${cancelId}/cancel`, { body: { reason: reason || undefined } });
            setData(json.overview);
            setCancelId(null);
            toast({ tone: "ok", title: "Reserva cancelada" });
          } catch (err) {
            toast({ tone: "bad", title: "No se pudo cancelar", text: errMsg(err) });
          } finally {
            setBusy(false);
          }
        }}
      />

      {/* Barra fija: con el carrito cerrado el socio ve cuánto lleva sin scrollear. */}
      {carrito.length > 0 ? (
        <div className="cartbar" role="status">
          <button type="button" className="cartbar-btn" onClick={() => setDrawerAbierto(true)}>
            <span className="cartbar-total tnum">
              {g(gramsNum)} · {estimated != null ? MONEY.format(estimated) : "—"}
            </span>
            <span className="cartbar-cta">Ver pedido</span>
          </button>
        </div>
      ) : null}

      <CarritoDrawer
        abierto={drawerAbierto}
        items={carrito}
        tope={data.tope}
        aportePorGramo={data.club.aportePorGramo}
        nombre={cepaNombre}
        onCerrar={() => setDrawerAbierto(false)}
        onDelta={(id, paso) => setCarrito(moverItem(carrito, id, paso, data.tope))}
        onQuitar={(id) => setCarrito(carrito.filter((i) => i.strainId !== id))}
        onContinuar={() => {
          setDrawerAbierto(false);
          document.getElementById("confirmar-pedido")?.scrollIntoView({ block: "start", behavior: "smooth" });
        }}
        puedeContinuar={gramsNum > 0}
        nota={
          gramosFaltanEnvio > 0
            ? `El envío sale desde ${g(data.club.minimoEnvioG)}: te faltan ${g(gramosFaltanEnvio)}.`
            : gramsNum >= data.tope
              ? `Llegaste a tu tope de ${g(data.tope)}.`
              : null
        }
      />
    </>
  );
}
