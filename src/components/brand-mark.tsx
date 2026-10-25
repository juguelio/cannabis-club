/* eslint-disable @next/next/no-img-element -- imágenes de marca servidas por /api/marca, ya dimensionadas y cacheadas */

export type BrandMarkInfo = { logo: string | null; sigla: string; placa: boolean };

/** Logo del club (sobre placa clara si la marca lo pide) o, sin logo, el monograma con la sigla. */
export function BrandMark({ info, size = "md" }: { info: BrandMarkInfo; size?: "md" | "lg" }) {
  if (info.logo) {
    const cls = ["brand-plate", size === "lg" ? "brand-plate--lg" : "", info.placa ? "" : "brand-plate--bare"].filter(Boolean).join(" ");
    return (
      <span className={cls} aria-hidden>
        <img src={info.logo} alt="" />
      </span>
    );
  }
  return (
    <span className={size === "lg" ? "monogram monogram--lg" : "monogram"} aria-hidden>
      {info.sigla}
    </span>
  );
}
