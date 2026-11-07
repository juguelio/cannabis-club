"use client";

import Link from "next/link";
import { CircleAlert, QrCode } from "lucide-react";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const g = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} g`;

export type FranjaDatos = {
  firstName: string;
  disponibleMes: number;
  limit: number;
  retiradoMes: number;
  enBasket: number;
  reprocannLabel: string;
  reprocannOk: boolean;
  reprocannDays: number | null;
  /** Zona que le toca por su código postal, con costo y demora. */
  cobertura:
    | { estado: "CUBIERTA"; zona: { zona: string; precioArs: number; demora: string }; aproximada: boolean; motivo: string }
    | { estado: "SIN_CP" }
    | { estado: "SIN_ZONAS" }
    | { estado: "SIN_COBERTURA"; cp: string; motivo: string };
  localidad: string | null;
  minimoEnvioG: number;
  /** Primer horario con lugar en el club, ya formateado («sáb 07 · 10:00»). */
  proximoTurno: string | null;
};

/**
 * La franja de situación: tres cosas, una línea cada una.
 *
 * Reemplaza el cintillo con saludo, los cuatro atajos y el panel verde del saldo, que empujaban el
 * catálogo más de una pantalla abajo. Lo que el socio necesita saber antes de elegir es sólo esto:
 * cuánto le queda, cuánto le sale que se lo manden y cuándo puede ir a buscarlo.
 */
export function FranjaSituacion({
  datos,
  showCard,
  onToggleCard,
  qr,
}: {
  datos: FranjaDatos;
  showCard: boolean;
  onToggleCard: () => void;
  qr: string;
}) {
  const pct = (v: number) => `${Math.min(100, (v / Math.max(1, datos.limit)) * 100)}%`;
  const c = datos.cobertura;

  return (
    <section className="franja" aria-label="Tu situación">
      <div className="franja-col">
        <div className="franja-rotulo">
          <span>Te quedan este mes</span>
          <button
            type="button"
            className="franja-carnet"
            onClick={onToggleCard}
            aria-expanded={showCard}
            aria-controls="mi-carnet"
            title="Mi carnet"
          >
            <QrCode aria-hidden size={16} /> Mi carnet
          </button>
        </div>
        <b className="franja-num tnum">
          {String(datos.disponibleMes).replace(".", ",")}
          <small>g</small>
        </b>
        <div className="gauge-track" aria-hidden>
          <span className="gauge-used" style={{ width: pct(datos.retiradoMes) }} />
          <span className="gauge-now" style={{ left: pct(datos.retiradoMes), width: pct(datos.enBasket) }} />
        </div>
        <span className="franja-pie">
          de {g(datos.limit)}
          {datos.retiradoMes ? ` · retiraste ${g(datos.retiradoMes)}` : ""}
          {datos.enBasket ? ` · ${g(datos.enBasket)} en tu basket` : ""}
        </span>
        <Link
          href="/portal/reprocann"
          className={`franja-chip${datos.reprocannOk ? " franja-chip--ok" : " franja-chip--bad"}`}
          title="Cómo obtenerlo, renovarlo y por qué a veces no avanza"
        >
          {datos.reprocannOk ? null : <CircleAlert aria-hidden size={12} />}
          REPROCANN · {datos.reprocannLabel}
        </Link>
      </div>

      <div className="franja-col">
        <div className="franja-rotulo">
          <span>{c.estado === "CUBIERTA" ? `Te llega a ${datos.localidad ?? c.zona.zona}` : "Envío a domicilio"}</span>
        </div>
        {c.estado === "CUBIERTA" ? (
          <>
            <b className="franja-fuerte">
              {c.zona.zona} · {MONEY.format(c.zona.precioArs)}
            </b>
            <span className="franja-pie">
              {c.zona.demora}. Desde {g(datos.minimoEnvioG)} por envío.
            </span>
            {c.aproximada ? <span className="franja-pie">{c.motivo}</span> : null}
          </>
        ) : c.estado === "SIN_CP" ? (
          <>
            <b className="franja-fuerte">Falta tu código postal</b>
            <span className="franja-pie">Con el CP sabemos la zona y el costo.</span>
          </>
        ) : c.estado === "SIN_COBERTURA" ? (
          <>
            <b className="franja-fuerte">No llegamos a {c.cp}</b>
            <span className="franja-pie">{c.motivo}</span>
          </>
        ) : (
          <>
            <b className="franja-fuerte">Sin zonas cargadas</b>
            <span className="franja-pie">El club entrega en la sede.</span>
          </>
        )}
        <Link href="/portal/envios" className="franja-link">
          Ver zonas y demoras
        </Link>
      </div>

      <div className="franja-col">
        <div className="franja-rotulo"><span>O retirás sin costo</span></div>
        {datos.proximoTurno ? (
          <>
            <b className="franja-fuerte">Próximo turno: {datos.proximoTurno}</b>
            <span className="franja-pie">En el club, con tu DNI.</span>
          </>
        ) : (
          <>
            <b className="franja-fuerte">Sin turnos publicados</b>
            <span className="franja-pie">Los horarios los carga el club.</span>
          </>
        )}
        <Link href="/portal/pedido" className="franja-link">
          Elegir día y horario
        </Link>
      </div>

      <div id="mi-carnet" hidden={!showCard} className="member-card franja-carnet-box">
        <div className="qr-box" style={{ width: 120, height: 120, flex: "none" }} dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="Código QR de tu carnet" />
        <div style={{ fontSize: 13.5 }}>
          <div style={{ color: "#fff", fontWeight: 650, fontFamily: "var(--font-display)", fontSize: 16 }}>
            {datos.firstName}
          </div>
          <div style={{ color: "var(--muted)" }}>Mostralo en el mostrador: abre tu legajo al instante.</div>
        </div>
      </div>
    </section>
  );
}
