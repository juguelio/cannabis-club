"use client";

import { ValidatedForm, Input, type ReportFields } from "./validated-form";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "./toast";
import type { DatosOperativos } from "@/lib/mis-datos";

/**
 * «Mis datos»: domicilio, código postal y teléfono.
 *
 * Existe porque el socio verificado no tenía dónde completarlos. El portal le avisaba que para pedir
 * un envío le faltaba el código postal y lo mandaba a «Validá tus datos» — una pantalla que sólo
 * existe mientras no está verificado. Quedaba encerrado: verificado para pedir, incompleto para
 * recibir, sin puerta.
 *
 * La identidad no se toca acá y se dice arriba, sin letra chica: el DNI y el REPROCANN los valida el
 * club contra los documentos.
 */
export function MisDatos({ inicial, volverHref }: { inicial: DatosOperativos; volverHref: string }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    address: inicial.address ?? "",
    locality: inicial.locality ?? "",
    province: inicial.province ?? "",
    postalCode: inicial.postalCode ?? "",
    phone: inicial.phone ?? "",
  });
  const [guardado, setGuardado] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const [falta, setFalta] = useState<{ campo?: string; mensaje: string } | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const sucio = (Object.keys(f) as (keyof typeof f)[]).some((k) => f[k].trim() !== (guardado[k] ?? ""));

  async function guardar(e: React.FormEvent, reportFields: ReportFields) {
    e.preventDefault();
    setBusy(true);
    setFalta(null);
    try {
      const r = await api<{ datos: DatosOperativos; faltaParaEnvio: boolean; mensaje: string }>("/api/portal/datos", {
        method: "PATCH",
        body: f,
      });
      setGuardado(r.datos);
      setF({
        address: r.datos.address ?? "",
        locality: r.datos.locality ?? "",
        province: r.datos.province ?? "",
        postalCode: r.datos.postalCode ?? "",
        phone: r.datos.phone ?? "",
      });
      toast({ tone: "ok", title: r.mensaje });
      router.refresh();
    } catch (err) {
      if (reportFields(err)) return;
      const detalle = errMsg(err);
      setFalta({ mensaje: detalle });
      toast({ tone: "bad", title: "No se pudieron guardar tus datos", text: detalle });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ValidatedForm className="mis-datos" onSubmit={guardar}>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Dónde te llega y cómo te llamamos</h2>
            <p className="panel-sub">
              Es lo que usa el club para despachar un envío y para avisarte de un turno. Podés cambiarlo cuando te mudás,
              sin pedir permiso.
            </p>
          </div>
        </div>
        <div className="panel-body stack" style={{ gap: 16 }}>
          <div>
            <label className="label" htmlFor="md-dir">Calle y número</label>
            <Input id="md-dir" className="input" name="address" value={f.address} onChange={set("address")} autoComplete="street-address" placeholder="Los Notros 195" />
          </div>

          <div className="mis-datos-grid">
            <div>
              <label className="label" htmlFor="md-loc">Localidad</label>
              <Input id="md-loc" className="input" name="locality" value={f.locality} onChange={set("locality")} autoComplete="address-level2" placeholder="San Martín de los Andes" />
            </div>
            <div>
              <label className="label" htmlFor="md-prov">Provincia</label>
              <Input id="md-prov" className="input" name="province" value={f.province} onChange={set("province")} autoComplete="address-level1" placeholder="Neuquén" />
            </div>
            <div>
              <label className="label" htmlFor="md-cp">Código postal</label>
              <Input id="md-cp" className="input tnum" name="postalCode" value={f.postalCode} onChange={set("postalCode")} inputMode="numeric" autoComplete="postal-code" placeholder="8370" aria-describedby="md-cp-hint" />
              <span className="hint" id="md-cp-hint">Cuatro números. Sin esto no podemos despachar un envío.</span>
            </div>
            <div>
              <label className="label" htmlFor="md-tel">Teléfono</label>
              <Input id="md-tel" className="input" name="phone" value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="2944 15 8559" />
            </div>
          </div>

          {falta ? (
            <p className="note note-danger" role="alert">
              {falta.mensaje}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" type="submit" disabled={busy || !sucio}>
              {busy ? <Loader2 aria-hidden size={16} className="spin" /> : <Check aria-hidden size={16} />}
              {sucio ? "Guardar mis datos" : "Todo guardado"}
            </button>
            <Link className="btn btn-quiet" href={volverHref}>
              Volver al portal
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-body">
          <p className="cell-meta" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Lock aria-hidden size={15} style={{ flex: "none", marginTop: 2 }} />
            <span>
              Tu nombre, tu DNI y tu REPROCANN no se editan acá: el club los valida contra el documento y la credencial.
              Si hay un error en esos datos, escribinos y lo corregimos en el legajo.
            </span>
          </p>
        </div>
      </section>
    </ValidatedForm>
  );
}
