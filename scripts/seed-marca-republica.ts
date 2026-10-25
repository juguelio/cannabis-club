/**
 * Carga la marca de República ONG (primer club configurado) sin tocar nada más del club.
 *
 * - No destructivo: solo escribe `marca`, `marcaLogo` y `marcaVersion`; padrón, stock y libros ni se leen.
 * - No pisa: si el club ya tiene marca guardada, no hace nada (salvo `--forzar`).
 * - Muestra a qué base apunta y no escribe sin `--si`: verificá la identidad antes de confirmar.
 * - El logo sale de public/logo-republica.png; si `sharp` está disponible lo achica a 512 px.
 * - Emblema y portada no se cargan acá: se suben desde Configuración › Marca y sitio.
 *
 *   npx tsx scripts/seed-marca-republica.ts          # muestra destino y lo que haría
 *   npx tsx scripts/seed-marca-republica.ts --si     # escribe
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { brandSchema } from "../src/lib/brand";
import { validateBrandImage } from "../src/lib/brand-image";

const prisma = new PrismaClient();
const CLUB_ID = "singleton";
const confirm = process.argv.includes("--si");
const force = process.argv.includes("--forzar");

const marca = brandSchema.parse({
  colores: { primario: "#111111", acento: "#f3c4d3", oscuro: "#111111", claro: "#f2ece2", firma: "#e8412a" },
  fuenteTitulos: "montserrat",
  fuenteTexto: "instrument",
  nombreGotico: true,
  estilo: "afiche",
  logoPlaca: true,
  sigla: "RC",
  lema: "Un club de la salud",
  // Textos tomados de lo que República comunica en su Instagram (25-oct-2026): el club los revisa antes de publicar.
  presentacion:
    "Somos República, una asociación civil de San Telmo inscripta en el REPROCANN. " +
    "Acompañamos a pacientes de todo el país con cultivo solidario, información clara y envíos con trazabilidad.",
  contacto: { whatsapp: "5491156160623", instagram: "republica.ong", email: "", zona: "San Telmo, CABA", horario: "" },
  sitio: {
    publico: false,
    pasos: [
      "Escribinos por WhatsApp: te guiamos con el REPROCANN en la modalidad «Cultiva otro», vinculado al club.",
      "Hacé la consulta médica con el equipo del club (bonificada para quienes se asocian).",
      "Firmás la declaración jurada, la solicitud de ingreso y el consentimiento informado.",
      "Con tu DNI y el alta aprobada, quedás habilitado para retirar o recibir tus envíos.",
    ],
    envios: true,
    enviosTexto: "Enviamos a todo el país: 48 h en Buenos Aires y hasta 5 días hábiles en el interior, con seguimiento, en paquete discreto y sellado.",
  },
});

async function logoDataUrl(): Promise<string> {
  const file = path.join(process.cwd(), "public", "logo-republica.png");
  let bytes: Buffer = await readFile(file);
  try {
    const sharp = (await import("sharp")).default;
    bytes = await sharp(bytes).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    console.warn("sharp no está disponible: se usa el PNG original");
  }
  return validateBrandImage("logo", `data:image/png;base64,${bytes.toString("base64")}`);
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://sin-configurar");
  console.log(`Base destino: ${url.hostname}:${url.port || 5432}${url.pathname}`);

  const club = await prisma.club.findUnique({ where: { id: CLUB_ID }, select: { nombre: true, nombreCorto: true, marca: true, marcaVersion: true } });
  if (!club) throw new Error("No hay club configurado (fila singleton): correr primero la configuración inicial.");
  console.log(`Club: ${club.nombre}${club.nombreCorto ? ` (${club.nombreCorto})` : ""} · marca v${club.marcaVersion} ${club.marca ? "YA CONFIGURADA" : "sin configurar"}`);

  if (club.marca && !force) {
    console.log("El club ya tiene marca: no se toca. Usá --forzar para reemplazarla.");
    return;
  }
  const logo = await logoDataUrl();
  console.log(`Haría: marca República (afiche, gótica, ${Object.values(marca.colores).join(" ")}), logo ${Math.round((logo.length * 3) / 4 / 1024)} KB, sitio sin publicar.`);
  if (!confirm) {
    console.log("Sin --si: no se escribió nada.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.club.update({
      where: { id: CLUB_ID },
      data: { marca: marca as unknown as Prisma.InputJsonValue, marcaLogo: logo, marcaVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { action: "CLUB_BRAND_UPDATE", entity: "Club", entityId: CLUB_ID, payload: { origen: "scripts/seed-marca-republica.ts", despues: marca } as Prisma.InputJsonValue },
    });
  });
  console.log("Listo. Revisá Configuración › Marca y sitio y publicá el sitio cuando el club lo apruebe.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
