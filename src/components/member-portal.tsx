"use client";


import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck2, CircleAlert, Leaf, PackageCheck, QrCode, Truck } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { memberDocumentStatus } from "@/lib/member-document-status";
import { Chip } from "./ui";
import type { Variedad } from "@/lib/variedad-rules";
import { aEnviar, disponibleCarrito, gramosDe, moverItem, PASO_G, totalCarrito } from "@/lib/carrito";
import { faltaParaMinimo, type Cobertura } from "@/lib/envios";
import { esActivo, esperaComprobante, estadoPedido } from "@/lib/pedidos-estado";
import { VariedadCard } from "@/components/variedad-card";
import { CarritoDrawer } from "@/components/carrito-drawer";
import { useCarrito } from "@/lib/carrito-cliente";
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
    province: string | null;
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
  const { items: carrito, setItems: setCarrito } = useCarrito(data.tope);
  const router = useRouter();
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
  // La dirección se arma por partes: el CP resuelve localidad y provincia, y el socio sólo escribe
  // calle y número. Es lo que evita el «Calle 123, San Martín» sin provincia ni CP.
  const [calle, setCalle] = useState<string>(data.member.address ?? "");
  const [cpEnvio, setCpEnvio] = useState<string>(data.member.postalCode ?? "");
  const [localidad, setLocalidad] = useState<string>(data.member.locality ?? "");
  const [provincia, setProvincia] = useState<string>(data.member.province ?? "");
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [cpEstado, setCpEstado] = useState<"idle" | "buscando" | "ok" | "no-resuelto">("idle");
  // Evita repetir la consulta del mismo código en cada tecla.
  const ultimoCp = useRef<string>("");
  const direccion = [calle.trim(), localidad.trim(), provincia.trim(), cpEnvio.trim()].filter(Boolean).join(", ");
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

  /** Pregunta al club/CP qué localidad corresponde; no inventa nada si no lo puede resolver. */
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
      <section className="panel" id="tu-pedido" aria-labelledby="tu-pedido-title">
        <div className="panel-body">
          <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <b id="tu-pedido-title" style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>Tu pedido</b>
              <div className="cell-meta">
                {carrito.length
                  ? `${carrito.length} ${carrito.length === 1 ? "variedad" : "variedades"} · ${g(gramsNum)} de ${g(data.tope)}${estimated != null ? ` · ${MONEY.format(estimated)}` : ""}`
                  : "Vacío: sumá 5 g desde las variedades."}
              </div>
            </div>
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <Link href="/portal/basket" className="btn btn-quiet">Ver basket</Link>
              <Link href="/portal/pedido" className="btn" aria-disabled={carrito.length === 0}>
                Hacer el pedido
              </Link>
            </div>
          </div>
          {!open ? (
            <div className="note note-warn" style={{ marginTop: 10 }}>
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
          ) : null}
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
                      {esperaComprobante(p.status, p.pago) ? (
                        <span className="chip chip-warn">Falta el comprobante</span>
                      ) : null}
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


      <details className="panel plegable">
        <summary>Lo que retiraste</summary>
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
      </details>

            <details className="panel plegable">
        <summary>Privacidad y documentación</summary>
        <div className="panel-body" style={{ display: "grid", gap: 8 }}>
          <p className="hint" style={{ margin: 0 }}>
            Tus permisos por finalidad, el texto que aceptaste y el estado de tu documentación están en
            «Mis datos», en una pantalla propia.
          </p>
          <div>
            <Link href="/portal/datos" className="btn btn-sm">Ver privacidad y documentación</Link>
          </div>
        </div>
      </details>

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
          router.push("/portal/basket");
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
