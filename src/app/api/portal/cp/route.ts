import { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";

/**
 * Código postal → localidad y provincia.
 *
 * El socio no debería tener que escribir «San Martín de los Andes, Neuquén» a mano después de poner
 * 8370: en Argentina el CP ya dice la ciudad. Se resuelve en el servidor —el navegador del socio no
 * necesita salir a un tercero— y se devuelven **varias localidades** cuando el CP cubre más de una,
 * porque inventar la primera sería adivinar.
 *
 * CABA se resuelve por rango (1000–1499): el servicio de CP no la tiene desagregada por 4 dígitos.
 */
export const dynamic = "force-dynamic";

const titulo = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase())
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "La");

export async function GET(req: NextRequest) {
  try {
    await requireMember();
    const crudo = req.nextUrl.searchParams.get("cp") ?? "";
    const m = crudo.replace(/\D/g, "").match(/\d{4}/);
    if (!m) return json({ estado: "SIN_CP" as const, localidades: [], provincia: null });

    const cp = m[0];
    const n = Number(cp);

    if (n >= 1000 && n <= 1499) {
      return json({
        estado: "OK" as const,
        cp,
        provincia: "Ciudad Autónoma de Buenos Aires",
        localidades: ["Ciudad Autónoma de Buenos Aires"],
        fuente: "rango",
      });
    }

    const r = await fetch(`https://api.zippopotam.us/ar/${cp}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });

    if (r.ok) {
      const datos = (await r.json()) as {
        places?: { "place name": string; state: string }[];
      };
      const lugares = datos.places ?? [];
      const localidades = [...new Set(lugares.map((p) => titulo(p["place name"])))].slice(0, 8);
      const provincia = lugares[0] ? titulo(lugares[0].state) : null;
      if (localidades.length) return json({ estado: "OK" as const, cp, provincia, localidades, fuente: "cp" });
    }

    // No se pudo resolver: se dice, no se inventa. El socio completa a mano.
    return json({ estado: "NO_RESUELTO" as const, cp, provincia: null, localidades: [] });
  } catch (error) {
    return fail(error);
  }
}
