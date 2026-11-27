"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";

import { seccionesLote } from "@/lib/lote-secciones";

export function LoteNav({ id }: { id: string }) {
  const actual = useSelectedLayoutSegment() ?? "resumen";
  const router = useRouter();
  const href = (s: string) => `/stock/${id}${s === "resumen" ? "" : "/" + s}`;
  return <nav className="legajo-nav" aria-label="Secciones del lote">
    <label className="legajo-select">Sección del lote
      <select value={actual} onChange={e => router.push(href(e.target.value))}>
        {Object.entries(seccionesLote).map(([s, label]) => <option key={s} value={s}>{label}</option>)}
      </select>
    </label>
    <div className="legajo-links"><div>{Object.entries(seccionesLote).map(([s, label]) =>
      <Link key={s} href={href(s)} prefetch={false} aria-current={s === actual ? "page" : undefined}>{label}</Link>)}</div></div>
  </nav>;
}
