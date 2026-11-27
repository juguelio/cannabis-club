"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archivosLegajo, limiteArchivoLegajo, type ArchivoLegajo } from "@/lib/archivo-legajo";

const suscribir = () => () => {};
const enNavegador = () => true;
const enServidor = () => false;

export function ArchivoLegajoInput({ memberId, tipo, cargado }: { memberId: string; tipo: ArchivoLegajo; cargado: boolean }) {
  return <ArchivoInput id={`archivo-${tipo}`} url={`/api/members/${memberId}/archivos/${tipo}`}
    label={`${cargado ? "Reemplazar" : "Cargar"} ${archivosLegajo[tipo]}`} permitePdf={tipo !== "PERFIL"} />;
}

export function ArchivoInput({ id, url, label, permitePdf = false }: {
  id: string; url: string; label: string; permitePdf?: boolean;
}) {
  const listo = useSyncExternalStore(suscribir, enNavegador, enServidor);
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [actualizando, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  async function subir(file: File) {
    setError("");
    setMensaje("");
    if (file.size > limiteArchivoLegajo) {
      setError("El archivo supera los 4 MB. Elegí una versión más chica.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "No se pudo guardar el archivo. Volvé a intentarlo.");
      }
      setMensaje("Archivo guardado.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof TypeError ? "Se interrumpió la conexión. Volvé a elegir el archivo." :
        err instanceof Error ? err.message : "No se pudo guardar el archivo.");
    } finally {
      setEnviando(false);
    }
  }

  return <div className="stack" style={{ gap: 4 }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="file" accept={!permitePdf ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
      disabled={!listo || enviando || actualizando} aria-invalid={!!error} aria-describedby={id + "-estado"}
      onChange={e => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file) void subir(file);
      }} />
    <div id={id + "-estado"} aria-live="polite" className={error ? "note note-bad" : "cell-meta"}>
      {error || (enviando ? "Guardando…" : mensaje)}
    </div>
  </div>;
}
