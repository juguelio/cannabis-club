import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { anchoPedido, fotoOptimizada } from "../foto-catalogo";
import { rutaSinIds } from "../../components/web-vitals";

describe("fotos del catálogo", () => {
  it("redondea el ancho pedido al permitido más cercano por arriba", () => {
    expect(anchoPedido(null)).toBe(960);
    expect(anchoPedido("300")).toBe(480);
    expect(anchoPedido("480")).toBe(480);
    expect(anchoPedido("700")).toBe(960);
    expect(anchoPedido("5000")).toBe(960);
    expect(anchoPedido("abc")).toBe(960);
  });

  it("achica una foto de cámara y la pasa a WebP", async () => {
    const jpg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 120, b: 60 } } })
      .jpeg({ quality: 92 })
      .toBuffer();
    const out = await fotoOptimizada("test:1", jpg, 480);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(480);
    expect(out.length).toBeLessThan(jpg.length);
  });

  it("no agranda una foto chica", async () => {
    const png = await sharp({ create: { width: 200, height: 150, channels: 3, background: "#123456" } }).png().toBuffer();
    const meta = await sharp(await fotoOptimizada("test:2", png, 960)).metadata();
    expect(meta.width).toBe(200);
  });
});

describe("medición de usuarios reales", () => {
  it("saca los identificadores de la ruta antes de registrarla", () => {
    expect(rutaSinIds("/socios/cmw5jx1u100057d749lgbtxnm")).toBe("/socios/:id");
    expect(rutaSinIds("/portal/pedido/pago/cmw5jx1u100057d749lgbtxnm?x=1")).toBe("/portal/pedido/pago/:id");
    expect(rutaSinIds("/informe-semestral/2026")).toBe("/informe-semestral/:id");
    expect(rutaSinIds("/")).toBe("/");
    expect(rutaSinIds("/portal")).toBe("/portal");
  });
});
