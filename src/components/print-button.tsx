"use client";

/** Botón de impresión: el remito es una hoja que viaja con la materia vegetal. */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button className="btn btn-sm" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
