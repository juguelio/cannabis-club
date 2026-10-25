"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { maskDoc } from "@/lib/doc-format";

export type PickerMember = { id: string; legajo: number; name: string; docLast4?: string | null; hint?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Buscador de socios para el mostrador: legajo, apellido o DNI; flechas y Enter. */
export function MemberPicker({
  members,
  value,
  onChange,
  label = "Socio",
  autoFocus,
  placeholder = "Legajo, apellido o DNI",
}: {
  members: PickerMember[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const selected = members.find((m) => m.id === value);

  const results = useMemo(() => {
    const query = fold(q.trim());
    if (!query) return members.slice(0, 8);
    const digits = query.replace(/[.\s-]/g, "");
    const words = query.split(/\s+/);
    const scored = members
      .map((m) => {
        const name = fold(m.name);
        let score = 0;
        if (/^\d+$/.test(digits) && String(m.legajo) === digits) score = 100;
        else if (/^\d+$/.test(digits) && m.docLast4?.includes(digits)) score = 60;
        else if (words.every((w) => name.includes(w))) score = name.startsWith(words[0]) ? 50 : 30;
        return { m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name));
    return scored.slice(0, 8).map((x) => x.m);
  }, [q, members]);

  const pick = (m: PickerMember | undefined) => {
    if (!m) return;
    onChange(m.id);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="combo">
      <label className="label" htmlFor={id}>{label}</label>
      {selected && !open ? (
        <button
          type="button"
          className="input flex items-center gap-2"
          style={{ textAlign: "left", cursor: "text" }}
          onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}
          aria-label={`Cambiar socio. Elegido: ${selected.name}`}
        >
          <span className="tnum muted" style={{ fontWeight: 600 }}>{selected.legajo}</span>
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>{selected.name}</span>
          <X aria-hidden style={{ width: 16, height: 16, color: "var(--muted)" }} />
        </button>
      ) : (
        <div style={{ position: "relative" }}>
          <Search aria-hidden style={{ position: "absolute", left: 11, top: 12, width: 17, height: 17, color: "var(--muted)" }} />
          <input
            ref={input}
            id={id}
            className="input"
            style={{ paddingLeft: 36 }}
            autoFocus={autoFocus}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={open && results[active] ? `${id}-${results[active].id}` : undefined}
            placeholder={placeholder}
            value={q}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
              if (e.key === "Escape") { setOpen(false); }
            }}
          />
          {open ? (
            <ul className="combo-list" id={`${id}-list`} role="listbox">
              {results.length === 0 ? <li className="cell-meta" style={{ padding: "10px 12px" }}>Ningún socio activo coincide.</li> : null}
              {results.map((m, i) => (
                <li
                  key={m.id}
                  id={`${id}-${m.id}`}
                  role="option"
                  aria-selected={i === active}
                  className="palette-item"
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="tnum muted" style={{ width: 34, fontWeight: 600 }}>{m.legajo}</span>
                  <span className="grow truncate" style={{ fontWeight: 550 }}>{m.name}</span>
                  {m.hint ? <span className="cell-meta">{m.hint}</span> : m.docLast4 ? <span className="cell-meta tnum">{maskDoc(m.docLast4)}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
