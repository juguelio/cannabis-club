"use client";

import { ValidatedForm, Input, Select, type FormSubmission, type ReportFields } from "./validated-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";
import { aportePorGramoDe, gramosPorEnvio, type Precios } from "@/lib/precios";
import { cotizacionLegible, FUENTES, type FuenteCotizacion } from "@/lib/cotizacion";

const MONEY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * Economía del club: membresías, envíos y productos. Se guarda una vez y queda como parte del
 * template: cada club carga sus valores sin que nadie toque la base.
 */
export function PreciosForm({ initial }: { initial: Precios }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Precios>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const porGramo = aportePorGramoDe(p);
  const porEnvio = gramosPorEnvio(p);
  const [trayendo, setTrayendo] = useState(false);

  async function traerCotizacion() {
    setTrayendo(true);
    setError(null);
    try {
      const r = await api<{ cotizacion: Precios["cotizacion"] }>("/api/club/cotizacion", { method: "POST", body: { fuente: p.cotizacion.fuente } });
      set("cotizacion", r.cotizacion);
      toast({ tone: "ok", title: "Cotización actualizada", text: cotizacionLegible(r.cotizacion) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos traer la cotización.");
    } finally {
      setTrayendo(false);
    }
  }

  const set = <K extends keyof Precios>(k: K, v: Precios[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function guardar(_: FormSubmission, reportFields: ReportFields) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/club/precios", { method: "PATCH", body: p });
      toast({ tone: "ok", title: "Precios guardados", text: "La cuenta corriente ya usa el aporte por gramo nuevo." });
      router.refresh();
    } catch (err) {
      if (!reportFields(err)) setError(err instanceof Error ? err.message : "No pudimos guardar los precios.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="stack" onSubmit={guardar}>
      {error && <p className="note note-danger">{error}</p>}

      <Panel title="Membresía" subtitle="La membresía es la unidad de retiro: su aporte se divide por los gramos que trae.">
        <div className="seg" style={{ marginBottom: 14, display: "inline-flex" }}>
          {(["ARS", "USD"] as const).map((m) => (
            <button key={m} type="button" aria-current={p.moneda === m ? "true" : undefined} onClick={() => set("moneda", m)}>
              {m === "ARS" ? "En pesos" : "En dólares"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <label className="label">
            Gramos por membresía
            <Input
              className="input"
              type="number"
              min={1}
              max={40}
              step="0.5"
              name="membresiaGramos" value={p.membresiaGramos}
              onChange={(e) => set("membresiaGramos", Number(e.target.value))}
            />
            <small className="muted" style={{ fontSize: 11.5 }}>Retiro mínimo mensual</small>
          </label>
          {p.moneda === "ARS" ? (
            <label className="label">
              Aporte por membresía ($)
              <Input
                className="input"
                type="number"
                min={0}
                step="1000"
                name="aporteMembresiaArs" value={p.aporteMembresiaArs}
                onChange={(e) => set("aporteMembresiaArs", Number(e.target.value))}
              />
              <small className="muted" style={{ fontSize: 11.5 }}>Prorrateo de costos, no precio de venta</small>
            </label>
          ) : (
            <label className="label">
              Aporte por membresía (USD)
              <Input
                className="input"
                type="number"
                min={0}
                step="1"
                name="aporteMembresiaUsd" value={p.aporteMembresiaUsd}
                onChange={(e) => set("aporteMembresiaUsd", Number(e.target.value))}
              />
              <small className="muted" style={{ fontSize: 11.5 }}>Se cobra en pesos con la cotización del día</small>
            </label>
          )}
          <label className="label">
            Máximo de membresías por envío
            <Input
              className="input"
              type="number"
              min={1}
              max={10}
              name="maxMembresiasPorEnvio" value={p.maxMembresiasPorEnvio}
              onChange={(e) => set("maxMembresiasPorEnvio", Number(e.target.value))}
            />
            <small className="muted" style={{ fontSize: 11.5 }}>Tope por envío o retiro</small>
          </label>
        </div>
        {p.moneda === "USD" && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 10, display: "grid",
                        gridTemplateColumns: "auto auto auto", gap: 10, alignItems: "end", justifyItems: "start" }}>
            <label className="label" style={{ minWidth: 170 }}>
              Cotización
              <Select className="input" name="cotizacion.fuente" value={p.cotizacion.fuente} onChange={(e) => set("cotizacion", { ...p.cotizacion, fuente: e.target.value as FuenteCotizacion })}>
                {FUENTES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
            </label>
            {p.cotizacion.fuente === "manual" ? (
              <label className="label" style={{ minWidth: 130 }}>
                Pesos por dólar
                <Input className="input" type="number" min={0} step="0.01" name="cotizacion.valor" value={p.cotizacion.valor}
                       onChange={(e) => set("cotizacion", { ...p.cotizacion, valor: Number(e.target.value), actualizadaAt: new Date().toISOString() })} />
              </label>
            ) : (
              <button type="button" className="btn btn-quiet" onClick={traerCotizacion} disabled={trayendo}>
                {trayendo ? "Trayendo…" : "Traer cotización de hoy"}
              </button>
            )}
            <small className="muted" style={{ fontSize: 11.5 }}>{cotizacionLegible(p.cotizacion)}</small>
          </div>
        )}

        <p className="note" style={{ marginTop: 4 }}>
          {porGramo != null
            ? `Queda en ${MONEY.format(porGramo)} por gramo y ${MONEY.format(porGramo * porEnvio)} por envío de ${porEnvio} g. Es lo que la cuenta corriente carga en cada entrega.`
            : "Sin aporte cargado, la entrega no genera cargo en la cuenta del socio."}
        </p>
      </Panel>

      <Panel title="Envíos" subtitle="Zonas, costo y demora. El retiro en sede se coordina y no se cobra.">
        <div className="stack" style={{ gap: 10 }}>
          {p.envios.map((env, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr 1fr .8fr auto", gap: 10, alignItems: "end" }}>
              <label className="label">
                Zona
                <Input
                  className="input"
                  name={`envios.${i}.zona`} value={env.zona}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, zona: e.target.value } : x)))}
                  placeholder="CABA"
                />
              </label>
              <label className="label">
                Costo ($)
                <Input
                  className="input"
                  type="number"
                  min={0}
                  step="500"
                  name={`envios.${i}.precioArs`} value={env.precioArs}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, precioArs: Number(e.target.value) } : x)))}
                />
              </label>
              <label className="label">
                Demora
                <Input
                  className="input"
                  name={`envios.${i}.demora`} value={env.demora}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, demora: e.target.value } : x)))}
                  placeholder="Menos de 48 h"
                />
              </label>
              <label className="label">
                Transportista
                <Input
                  className="input"
                  name={`envios.${i}.transportista`} value={env.transportista ?? ""}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, transportista: e.target.value } : x)))}
                  placeholder="Andreani"
                />
              </label>
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Quitar ${env.zona || "zona"}`}
                onClick={() => set("envios", p.envios.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => set("envios", [...p.envios, { zona: "", precioArs: 0, demora: "", transportista: "" }])}
            >
              <Plus aria-hidden style={{ width: 16, height: 16 }} />Agregar zona
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Productos" subtitle="Extractos y otras preparaciones, con su aporte. Las flores se cargan en Catálogo.">
        <div className="stack" style={{ gap: 10 }}>
          {p.productos.map((prod, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr .8fr auto", gap: 10, alignItems: "end" }}>
              <label className="label">
                Nombre
                <Input
                  className="input"
                  name={`productos.${i}.nombre`} value={prod.nombre}
                  onChange={(e) => set("productos", p.productos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  placeholder="Live Rosin 90u"
                />
              </label>
              <label className="label">
                Aporte ($)
                <Input
                  className="input"
                  type="number"
                  min={0}
                  step="1000"
                  name={`productos.${i}.precioArs`} value={prod.precioArs}
                  onChange={(e) => set("productos", p.productos.map((x, j) => (j === i ? { ...x, precioArs: Number(e.target.value) } : x)))}
                />
              </label>
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Quitar ${prod.nombre || "producto"}`}
                onClick={() => set("productos", p.productos.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => set("productos", [...p.productos, { nombre: "", precioArs: 0, detalle: "", activo: true }])}
            >
              <Plus aria-hidden style={{ width: 16, height: 16 }} />Agregar producto
            </button>
          </div>
        </div>
      </Panel>

      <div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar precios y aportes"}
        </button>
      </div>
    </ValidatedForm>
  );
}
