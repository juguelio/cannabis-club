"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { grupos, puedeVer, rutaLegajo, secciones, type Seccion } from "@/lib/legajo-secciones";
import type { Role } from "@prisma/client";

export function LegajoNav({ id, role }: { id: string; role: Role }) {
  const actual = useSelectedLayoutSegment() ?? "resumen";
  const router = useRouter();
  return <nav className="legajo-nav" aria-label="Secciones del legajo">
    <label className="legajo-select">Sección del legajo
      <select value={actual} onChange={e => router.push(rutaLegajo(id, e.target.value as Seccion))}>
        {grupos.map(g => <optgroup key={g.nombre} label={g.nombre}>
          {g.items.filter(s => puedeVer(role, s)).map(s => <option key={s} value={s}>{secciones[s]}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="legajo-links">{grupos.map(g => <div key={g.nombre}>
      <p>{g.nombre}</p>
      {g.items.filter(s => puedeVer(role, s)).map(s => <Link key={s} prefetch={false}
        aria-current={actual === s ? "page" : undefined} href={rutaLegajo(id, s)}>{secciones[s]}</Link>)}
    </div>)}</div>
  </nav>;
}
