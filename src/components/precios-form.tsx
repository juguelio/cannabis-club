"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/client";
import { aportePorGramoDe, gramosPorEnvio, type Precios } from "@/lib/precios";

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

  const set = <K extends keyof Precios>(k: K, v: Precios[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/club/precios", { method: "PATCH", body: p });
      toast({ tone: "ok", title: "Precios guardados", text: "La cuenta corriente ya usa el aporte por gramo nuevo." });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los precios.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={guardar}>
      {error && <p className="note note-danger">{error}</p>}

      <Panel title="Membresía" subtitle="La membresía es la unidad de retiro: su aporte se divide por los gramos que trae.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <label className="label">
            Gramos por membresía
            <input
              className="input"
              type="number"
              min={1}
              max={40}
              step="0.5"
              value={p.membresiaGramos}
              onChange={(e) => set("membresiaGramos", Number(e.target.value))}
            />
            <small className="muted" style={{ fontSize: 11.5 }}>Retiro mínimo mensual</small>
          </label>
          <label className="label">
            Aporte por membresía ($)
            <input
              className="input"
              type="number"
              min={0}
              step="1000"
              value={p.aporteMembresiaArs}
              onChange={(e) => set("aporteMembresiaArs", Number(e.target.value))}
            />
            <small className="muted" style={{ fontSize: 11.5 }}>Prorrateo de costos, no precio de venta</small>
          </label>
          <label className="label">
            Máximo de membresías por envío
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={p.maxMembresiasPorEnvio}
              onChange={(e) => set("maxMembresiasPorEnvio", Number(e.target.value))}
            />
            <small className="muted" style={{ fontSize: 11.5 }}>Tope por envío o retiro</small>
          </label>
        </div>
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
                <input
                  className="input"
                  value={env.zona}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, zona: e.target.value } : x)))}
                  placeholder="CABA"
                />
              </label>
              <label className="label">
                Costo ($)
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="500"
                  value={env.precioArs}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, precioArs: Number(e.target.value) } : x)))}
                />
              </label>
              <label className="label">
                Demora
                <input
                  className="input"
                  value={env.demora}
                  onChange={(e) => set("envios", p.envios.map((x, j) => (j === i ? { ...x, demora: e.target.value } : x)))}
                  placeholder="Menos de 48 h"
                />
              </label>
              <label className="label">
                Transportista
                <input
                  className="input"
                  value={env.transportista ?? ""}
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
                <input
                  className="input"
                  value={prod.nombre}
                  onChange={(e) => set("productos", p.productos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  placeholder="Live Rosin 90u"
                />
              </label>
              <label className="label">
                Aporte ($)
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1000"
                  value={prod.precioArs}
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
    </form>
  );
}
