import { Leaf } from "lucide-react";
import type { Variedad } from "@/lib/variedad-rules";

/**
 * Tarjeta del catálogo: foto del producto (o recuadro provisorio mientras el club no la subió),
 * nombre, genética y estado de stock. No muestra precios: el aporte se prorratea al retirar.
 * Se usa igual en el sitio público y en el portal del socio.
 */
export function VariedadCard({ v, tone = "light" }: { v: Variedad; tone?: "light" | "site" }) {
  const borde = tone === "site" ? "color-mix(in srgb, currentColor 18%, transparent)" : "var(--line)";
  const suave = tone === "site" ? "color-mix(in srgb, currentColor 7%, transparent)" : "var(--surface, #fff)";

  return (
    <div
      style={{
        border: `1px ${v.disponible ? "solid" : "dashed"} ${borde}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: v.disponible ? 1 : 0.82,
        background: suave,
      }}
    >
      {v.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={v.foto} alt={v.nombre} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            display: "grid",
            placeItems: "center",
            gap: 6,
            background: tone === "site" ? "color-mix(in srgb, currentColor 5%, transparent)" : "var(--mist, #f2f4f2)",
            color: "inherit",
            opacity: 0.7,
          }}
        >
          <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <Leaf aria-hidden style={{ width: 26, height: 26 }} />
            <small style={{ fontSize: 11.5, letterSpacing: ".03em" }}>Foto provisoria</small>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 16.5, lineHeight: 1.2 }}>{v.nombre}</b>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              border: `1px solid ${borde}`,
              opacity: v.disponible ? 1 : 0.75,
            }}
          >
            {v.disponible ? "Con stock" : "Sin stock"}
          </span>
        </div>
        {v.genetica ? (
          <div style={{ fontSize: 13, opacity: 0.72, marginTop: 2 }}>{v.genetica}</div>
        ) : null}
        {v.thc != null || v.cbd != null ? (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.85 }}>
            {v.thc != null ? <span>THC {v.thc}%</span> : null}
            {v.thc != null && v.cbd != null ? <span>·</span> : null}
            {v.cbd != null ? <span>CBD {v.cbd}%</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
