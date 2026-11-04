"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Stethoscope } from "lucide-react";
import { api, errMsg } from "@/lib/client";
import { useToast } from "./toast";
import type { DeclaracionReprocann } from "@/lib/reprocann-entrada";

/**
 * La primera pregunta del portal: ¿tenés REPROCANN?
 *
 * Se pregunta una vez y se guarda. La respuesta no habilita nada —eso lo hace el club cuando mira los
 * documentos—: sólo decide qué pantalla sigue. Por eso el socio puede cambiarla sin pedir permiso, y
 * por eso el botón de la opción ya elegida sigue disponible: quien dijo «no tengo» hace tres meses y
 * ya lo sacó no tiene que escribirle a nadie para corregirlo.
 */
export function WizardReprocann({ inicial }: { inicial: DeclaracionReprocann }) {
  const router = useRouter();
  const toast = useToast();
  const [actual, setActual] = useState<DeclaracionReprocann>(inicial);
  const [busy, setBusy] = useState<"TIENE" | "NO_TIENE" | null>(null);

  async function elegir(declaracion: "TIENE" | "NO_TIENE") {
    setBusy(declaracion);
    try {
      const r = await api<{ mensaje: string }>("/api/portal/reprocann", { body: { declaracion } });
      setActual(declaracion);
      toast({ tone: "ok", title: r.mensaje });
      // El servidor decide qué pantalla sigue: acá sólo se pide que vuelva a renderizar.
      router.refresh();
    } catch (e) {
      toast({ tone: "bad", title: "No se pudo guardar tu respuesta", text: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="wiz-reprocann" aria-labelledby="wiz-reprocann-titulo">
      <div className="wiz-reprocann-head">
        <span className="wiz-paso" aria-current="step">
          Paso 1 de 2
        </span>
        <h2 id="wiz-reprocann-titulo">
          <Stethoscope aria-hidden size={17} /> ¿Tenés REPROCANN?
        </h2>
        <p>
          Es el permiso del Ministerio de Salud que habilita todo lo demás. Si ya lo tenés, subís tu DNI y tu
          credencial para que el club los revise; si no, te explicamos cómo sacarlo con el consultorio.{" "}
          <a className="wiz-ayuda" href="/reprocann" target="_blank" rel="noopener noreferrer">
            ¿Qué es el REPROCANN?
          </a>
        </p>
      </div>

      <div className="wiz-opciones">
        <button
          type="button"
          className={`wiz-opcion${actual === "TIENE" ? " wiz-opcion--elegida" : ""}`}
          onClick={() => elegir("TIENE")}
          disabled={busy !== null}
          aria-pressed={actual === "TIENE"}
        >
          <span className="wiz-opcion-titulo">
            {busy === "TIENE" ? <Loader2 aria-hidden size={16} className="spin" /> : actual === "TIENE" ? <Check aria-hidden size={16} /> : null}
            Sí, ya lo tengo
          </span>
          <span className="wiz-opcion-detalle">Continuar con la validación de documentos.</span>
        </button>

        <button
          type="button"
          className={`wiz-opcion${actual === "NO_TIENE" ? " wiz-opcion--elegida" : ""}`}
          onClick={() => elegir("NO_TIENE")}
          disabled={busy !== null}
          aria-pressed={actual === "NO_TIENE"}
        >
          <span className="wiz-opcion-titulo">
            {busy === "NO_TIENE" ? <Loader2 aria-hidden size={16} className="spin" /> : actual === "NO_TIENE" ? <Check aria-hidden size={16} /> : null}
            No, todavía no
          </span>
          <span className="wiz-opcion-detalle">Ver cómo sacarlo, paso a paso.</span>
        </button>
      </div>
    </section>
  );
}
