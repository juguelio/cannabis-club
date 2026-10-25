"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { maskDoc } from "@/lib/doc-format";
import {
  CalendarClock, ClipboardList, FileSpreadsheet, LayoutDashboard, Leaf, Scale, Search, Settings, Sprout, UserPlus, Users,
} from "lucide-react";
import { Dialog } from "./dialog";
import { REPROCANN_STATUS } from "@/lib/labels";

type Item = { key: string; group: string; label: string; meta?: string; href: string; alt?: string; icon: React.ElementType };

const NAV: Item[] = [
  { key: "n-entrega", group: "Acciones", label: "Registrar una entrega", href: "/dispensario", icon: Scale },
  { key: "n-socio", group: "Acciones", label: "Dar de alta un socio", href: "/socios/nuevo", icon: UserPlus },
  { key: "n-turno", group: "Acciones", label: "Agendar un turno", href: "/turnos", icon: CalendarClock },
  { key: "g-panel", group: "Ir a", label: "Panel del día", href: "/", icon: LayoutDashboard },
  { key: "g-socios", group: "Ir a", label: "Padrón de socios", href: "/socios", icon: Users },
  { key: "g-stock", group: "Ir a", label: "Stock y lotes", href: "/stock", icon: Sprout },
  { key: "g-reportes", group: "Ir a", label: "Libros y reportes", href: "/reportes", icon: FileSpreadsheet },
  { key: "g-config", group: "Ir a", label: "Configuración del club", href: "/configuracion", icon: Settings },
];

const Ctx = createContext<() => void>(() => undefined);
export const useOpenPalette = () => useContext(Ctx);

type Found = {
  members: { id: string; legajo: number; firstName: string; lastName: string; docLast4: string | null; status: string; reprocannStatus: string }[];
  batches: { id: string; code: string; stage: string; strain: { name: string } }[];
};

export function CommandPalette({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const show = useCallback(() => { setQ(""); setFound(null); setActive(0); setOpen(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  useEffect(() => {
    if (!open || q.trim().length < 1) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => { setFound(d); setActive(0); })
        .catch(() => undefined);
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  const items: Item[] = useMemo(() => {
    const nav = NAV.filter((n) => isAdmin || n.href !== "/configuracion");
    const query = q.trim().toLowerCase();
    if (!query) return nav;
    const members: Item[] = (found?.members ?? []).map((m) => ({
      key: `m-${m.id}`,
      group: "Socios",
      label: `${m.lastName}, ${m.firstName}`,
      meta: `Legajo ${m.legajo} · ${maskDoc(m.docLast4)}${m.status !== "ACTIVO" ? ` · ${m.status.toLowerCase()}` : m.reprocannStatus !== "VIGENTE" ? ` · ${REPROCANN_STATUS[m.reprocannStatus]?.label ?? ""}` : ""}`,
      href: `/socios/${m.id}`,
      alt: m.status === "ACTIVO" ? `/dispensario?socio=${m.id}` : undefined,
      icon: Users,
    }));
    const batches: Item[] = (found?.batches ?? []).map((b) => ({
      key: `b-${b.id}`, group: "Lotes", label: b.code, meta: b.strain.name, href: `/stock/${b.id}`, icon: Leaf,
    }));
    return [...members, ...batches, ...nav.filter((n) => n.label.toLowerCase().includes(query))];
  }, [q, found, isAdmin]);

  const go = (item: Item | undefined, alt = false) => {
    if (!item) return;
    setOpen(false);
    router.push(alt && item.alt ? item.alt : item.href);
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} className="palette" labelledBy="palette-label">
        <div className="palette-input">
          <Search aria-hidden />
          <label id="palette-label" htmlFor="palette-q" className="sr-only">Buscar</label>
          <input
            id="palette-q"
            autoFocus
            autoComplete="off"
            placeholder="Legajo, apellido, DNI, REPROCANN o lote"
            value={q}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pi-${items[active].key}` : undefined}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(items[active], e.shiftKey); }
            }}
          />
        </div>
        <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 ? (
            <li className="empty" style={{ padding: 24 }}>
              <ClipboardList aria-hidden />
              {q.trim() ? `Nada coincide con “${q.trim()}”.` : "Escribí para buscar."}
            </li>
          ) : null}
          {items.map((item, i) => {
            const head = i === 0 || items[i - 1].group !== item.group ? item.group : null;
            const Icon = item.icon;
            return (
              <li key={item.key} role="presentation">
                {head ? <div className="palette-group">{head}</div> : null}
                <div
                  id={`pi-${item.key}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  className="palette-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => go(item, e.shiftKey)}
                >
                  <Icon aria-hidden />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 550 }}>{item.label}</div>
                    {item.meta ? <div className="cell-meta truncate">{item.meta}</div> : null}
                  </div>
                  {item.alt && i === active ? <span className="kbd">⇧ ↵ entregar</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="palette-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> moverse</span>
          <span><span className="kbd">↵</span> abrir</span>
          <span className="hide-sm"><span className="kbd">⇧ ↵</span> entregar al socio</span>
          <span style={{ marginLeft: "auto" }}><span className="kbd">esc</span> cerrar</span>
        </div>
      </Dialog>
    </Ctx.Provider>
  );
}
