"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysKey, gridDays, mesLargo, SEMANA_LARGA } from "@/lib/appointments";

type Turno = { id: string; hora: string; socio: string; legajo: number; estado: string; gramos: number | null };
type Dia = {
  key: string;
  estado: "abierto" | "cerrado" | "sin-franja";
  franjas: string[];
  total: number;
  porLlegar: number;
  gramos: number;
  turnos: Turno[];
};
type Cerrado = { id: string; date: string; reason: string | null };

const ESTADO_TURNO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  ATENDIDO: "Atendido",
  AUSENTE: "No vino",
  CANCELADO: "Cancelado",
};

const mesCorto = (key: string) =>
  new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

const fechaLarga = (key: string) =>
  new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

export function CalendarioClub({
  inicial,
  desde,
  hasta,
  hoy,
  cerrados,
}: {
  inicial: Dia[];
  desde: string;
  hasta: string;
  hoy: string;
  cerrados: Cerrado[];
}) {
  const router = useRouter();
  const [vista, setVista] = useState<"semana" | "mes">("semana");
  const [ancla, setAncla] = useState(hoy);
  const [seleccion, setSeleccion] = useState(hoy);
  const [dias, setDias] = useState<Dia[]>(inicial);
  const [rango, setRango] = useState({ desde, hasta });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cerradosLocal, setCerradosLocal] = useState<Cerrado[]>(cerrados);

  /**
   * Pide un rango y reemplaza la grilla. Todo el manejo de estado vive acá y **después del primer await**:
   * así el efecto que la dispara no setea estado en su cuerpo (y no hay renders en cascada).
   */
  const pedir = useCallback(async (d: string, h: string) => {
    try {
      const res = await fetch(`/api/calendario?desde=${d}&hasta=${h}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No pudimos cargar el calendario.");
      setDias(data.dias as Dia[]);
      setRango({ desde: data.desde, hasta: data.hasta });
      setError(null);
    } catch (err) {
      // Se oculta el período anterior: mostrar días viejos con la fecha nueva es peor que no mostrar nada.
      setDias([]);
      setError(err instanceof Error ? err.message : "No pudimos cargar el calendario.");
    }
  }, []);

  useEffect(() => {
    const keys = gridDays(ancla, vista);
    if (keys[0] === rango.desde && keys[keys.length - 1] === rango.hasta) return;
    let vivo = true;
    fetch(`/api/calendario?desde=${keys[0]}&hasta=${keys[keys.length - 1]}`)
      .then(async (res) => ({ res, data: await res.json() }))
      .then(({ res, data }) => {
        if (!vivo) return;
        if (!res.ok) throw new Error(data.message ?? "No pudimos cargar el calendario.");
        setDias(data.dias as Dia[]);
        setRango({ desde: data.desde, hasta: data.hasta });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!vivo) return;
        // Se oculta el período anterior: días viejos con la fecha nueva es peor que no mostrar nada.
        setDias([]);
        setError(err instanceof Error ? err.message : "No pudimos cargar el calendario.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [ancla, vista, rango.desde, rango.hasta]);

  const porClave = useMemo(() => new Map(dias.map((d) => [d.key, d])), [dias]);
  const dia = porClave.get(seleccion);
  const cerradoDelDia = cerradosLocal.find((c) => c.date === seleccion);

  function mover(paso: number) {
    const siguiente = addDaysKey(seleccion, paso);
    setSeleccion(siguiente);
    setAncla(siguiente);
  }

  function nav(dir: -1 | 1) {
    if (vista === "semana") {
      const destino = addDaysKey(ancla, dir * 7);
      setAncla(destino);
      setSeleccion(destino);
      return;
    }
    const [y, m] = ancla.split("-").map(Number);
    const fecha = new Date(Date.UTC(y, m - 1 + dir, 1));
    const destino = fecha.toISOString().slice(0, 10);
    setAncla(destino);
    setSeleccion(destino);
  }

  function irHoy() {
    setAncla(hoy);
    setSeleccion(hoy);
  }

  async function cerrarDia() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/closed-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: seleccion, reason: "Cerrado desde el calendario" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No pudimos cerrar el día.");
      setCerradosLocal((c) => [...c, { id: data.day?.id ?? data.id, date: seleccion, reason: "Cerrado desde el calendario" }]);
      const k = gridDays(ancla, vista);
      await pedir(k[0], k[k.length - 1]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cerrar el día.");
    } finally {
      setCargando(false);
    }
  }

  async function reabrirDia(id: string) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/closed-days/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No pudimos reabrir el día.");
      }
      setCerradosLocal((c) => c.filter((x) => x.id !== id));
      const k = gridDays(ancla, vista);
      await pedir(k[0], k[k.length - 1]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos reabrir el día.");
    } finally {
      setCargando(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const pasos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in pasos) {
      e.preventDefault();
      mover(pasos[e.key]);
    }
    if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      irHoy();
    }
  }

  const titulo = vista === "semana" ? `Semana del ${fechaLarga(rango.desde ?? ancla)}` : mesLargo(ancla);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="cal-bar">
        <div className="cal-nav">
          <button className="btn btn-quiet btn-sm" onClick={() => nav(-1)} aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"}>‹</button>
          <button className="btn btn-quiet btn-sm" onClick={irHoy}>Hoy</button>
          <button className="btn btn-quiet btn-sm" onClick={() => nav(1)} aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"}>›</button>
        </div>
        <div className="cal-titulo">{titulo}</div>
        <div className="seg" role="tablist" aria-label="Vista del calendario">
          {(["semana", "mes"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} aria-current={vista === v ? "true" : undefined} onClick={() => setVista(v)}>
              {v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="note note-danger" role="alert">
          <div>{error} <button className="btn btn-sm btn-quiet" onClick={() => { const k = gridDays(ancla, vista); void pedir(k[0], k[k.length - 1]); }}>Reintentar</button></div>
        </div>
      ) : null}

      <div className={`cal-grid cal-${vista}`} role="grid" aria-label="Calendario del dispensario" onKeyDown={onKeyDown} tabIndex={0}>
        {SEMANA_LARGA.map((d) => (
          <div key={d} className="cal-head" role="columnheader">{d}</div>
        ))}
        {(dias.length ? dias : gridDays(ancla, vista).map((k) => ({ key: k, estado: "sin-franja" as const, franjas: [], total: 0, porLlegar: 0, gramos: 0, turnos: [] }))).map((d) => {
          const esHoy = d.key === hoy;
          return (
            <button
              key={d.key}
              type="button"
              role="gridcell"
              className="cal-day"
              data-estado={d.estado}
              aria-selected={d.key === seleccion}
              aria-label={`${fechaLarga(d.key)}: ${d.total} turnos${d.estado !== "abierto" ? `, ${d.estado === "cerrado" ? "cerrado" : "sin atención"}` : ""}`}
              onClick={() => setSeleccion(d.key)}
              onDoubleClick={() => router.push(`/turnos?date=${d.key}`)}
            >
              <span className="cal-num">
                {Number(d.key.slice(8, 10))}
                {/* Cuando la semana cruza de mes, el "1" solo es ambiguo: se aclara al lado. */}
                {d.key.slice(5, 7) !== ancla.slice(5, 7) ? <span className="cal-mes">{mesCorto(d.key)}</span> : null}
                {esHoy ? <em>hoy</em> : null}
              </span>
              {d.estado === "cerrado" ? <span className="cal-tag cal-tag-cerrado">Cerrado</span> : null}
              {d.estado === "sin-franja" ? <span className="cal-tag cal-tag-sin">No atiende</span> : null}
              {d.total > 0 ? (
                <span className="cal-data">
                  <b>{d.total}</b> {d.total === 1 ? "turno" : "turnos"}
                  {d.gramos > 0 ? <span className="cal-g"> · {d.gramos} g</span> : null}
                </span>
              ) : d.estado === "abierto" ? (
                <span className="cal-vacio">libre</span>
              ) : null}
              {d.porLlegar > 0 ? <span className="cal-pend">{d.porLlegar} por llegar</span> : null}
            </button>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" style={{ fontSize: 18, textTransform: "capitalize" }}>{fechaLarga(seleccion)}</h2>
            <p className="panel-sub">
              {dia?.franjas.length ? `Atiende ${dia.franjas.join(" y ")}` : "Sin franja de atención"}
              {cerradoDelDia ? ` · Cerrado${cerradoDelDia.reason ? ` (${cerradoDelDia.reason})` : ""}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cerradoDelDia ? (
              <button className="btn btn-secondary btn-sm" disabled={cargando} onClick={() => reabrirDia(cerradoDelDia.id)}>Reabrir el día</button>
            ) : (
              <button className="btn btn-quiet btn-sm" disabled={cargando} onClick={cerrarDia}>Cerrar el día</button>
            )}
            <button className="btn btn-sm" onClick={() => router.push(`/turnos?date=${seleccion}`)}>Abrir en Turnos</button>
          </div>
        </div>
        <div className="panel-body">
          {dia && dia.turnos.length > 0 ? (
            <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Hora</th><th>Socio</th><th>Legajo</th><th>Retiro</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {dia.turnos.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum">{t.hora}</td>
                    <td>{t.socio}</td>
                    <td className="tnum cell-meta col-opcional">{t.legajo}</td>
                    <td className="tnum cell-meta">{t.gramos != null ? `${t.gramos} g` : "—"}</td>
                    <td><span className="chip">{ESTADO_TURNO[t.estado] ?? t.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="cell-meta" style={{ margin: 0 }}>
              {dia?.estado === "cerrado" ? "Ese día el club no atiende." : dia?.estado === "sin-franja" ? "Ese día no hay franja de atención." : "No hay turnos reservados ese día."}
            </p>
          )}
        </div>
      </section>

      <p className="cell-meta" style={{ margin: 0 }}>
        {cargando ? "Actualizando…" : "Flechas para moverse, T para volver a hoy, doble clic para abrir el día en Turnos."}
      </p>
    </div>
  );
}
