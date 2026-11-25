"use client";

import { useId, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { limitesFechasAlta, motivoFechaBloqueada, type CampoFechaAlta } from "@/lib/access-request";
import { Input } from "./validated-form";

const formato = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" });
const semana = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function FechaAlta({ name, label }: { name: CampoFechaAlta; label: string }) {
  const id = useId();
  const abrir = useRef<HTMLButtonElement>(null);
  const { setValue } = useFormContext();
  const valor: string = useWatch({ name }) || "";
  const [mes, setMes] = useState("");
  const [explicar, setExplicar] = useState("");
  const limites = limitesFechasAlta();
  const nacimiento = name === "birthDate";
  const referencia = nacimiento ? limites.nacimientoMaximo : limites.hoy;
  const inicio = new Date((mes || referencia.slice(0, 7)) + "-01T00:00:00Z");
  const primero = 1 - (inicio.getUTCDay() + 6) % 7;
  const diaDelMes = (dia: number) => {
    const fecha = new Date(inicio);
    fecha.setUTCDate(dia);
    return fecha;
  };
  const motivo = motivoFechaBloqueada(name, explicar, limites);

  function mostrar() {
    setExplicar("");
    setMes((valor || referencia).slice(0, 7));
  }

  function cerrar() {
    setMes("");
    setExplicar("");
    abrir.current?.focus();
  }

  function cambiarMes(delta: number) {
    const siguiente = new Date(inicio);
    siguiente.setUTCMonth(inicio.getUTCMonth() + delta);
    if (siguiente.getUTCFullYear() < 1 || siguiente.getUTCFullYear() > 9999) return;
    setMes(iso(siguiente).slice(0, 7));
    setExplicar("");
  }

  return <div className="fecha-alta" onKeyDown={e => {
    if (mes && e.key === "Escape") { e.preventDefault(); cerrar(); }
  }}>
    <label className="label" htmlFor={id}>{label}</label>
    <div className="fecha-alta-control">
      <Input className="input" type="date" id={id} name={name} required onClick={e => { e.preventDefault(); mostrar(); }}
        min={nacimiento ? undefined : limites.hoy} max={nacimiento ? limites.nacimientoMaximo : undefined} />
      <button ref={abrir} className="btn btn-quiet" type="button" aria-expanded={Boolean(mes)}
        aria-label={`Calendario: ${label}`} onClick={() => {
          if (mes) cerrar();
          else mostrar();
        }}><CalendarDays size={19} aria-hidden /></button>
    </div>
    {mes && <section aria-label={`Elegir fecha: ${label}`} className="fecha-alta-panel">
      <div className="fecha-alta-mes">
        <button type="button" className="btn btn-quiet" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}><ChevronLeft aria-hidden /></button>
        <input type="month" aria-label="Mes visible" value={mes} onChange={e => {
          if (/^\d{4}-\d{2}$/.test(e.target.value)) { setMes(e.target.value); setExplicar(""); }
        }} />
        <button type="button" className="btn btn-quiet" aria-label="Mes siguiente" onClick={() => cambiarMes(1)}><ChevronRight aria-hidden /></button>
      </div>
      <div className="fecha-alta-dias">
        {semana.map(d => <span key={d} aria-hidden>{d}</span>)}
        {Array.from({ length: 42 }, (_, i) => {
          const fecha = diaDelMes(primero + i);
          if (fecha.getUTCMonth() !== inicio.getUTCMonth()) return <span key={i} />;
          const dia = iso(fecha);
          const bloqueada = Boolean(motivoFechaBloqueada(name, dia, limites));
          return <button key={i} type="button" aria-label={formato.format(fecha)}
            aria-pressed={valor === dia} aria-disabled={bloqueada}
            aria-describedby={explicar === dia && bloqueada ? id + "-motivo" : undefined}
            onPointerEnter={() => setExplicar(dia)} onPointerLeave={() => setExplicar("")}
            onFocus={() => setExplicar(dia)} onBlur={() => setExplicar("")}
            onClick={() => {
              if (bloqueada) { setExplicar(dia); return; }
              setValue(name, dia, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
              cerrar();
            }}>{fecha.getUTCDate()}</button>;
        })}
      </div>
      {explicar && motivo && <div id={id + "-motivo"} role="tooltip" className="fecha-alta-motivo">{motivo}</div>}
    </section>}
  </div>;
}
