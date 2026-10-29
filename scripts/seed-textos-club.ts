/**
 * Carga en la marca del club los textos que el cliente entregó (Word «TEXTOS SUPERIORES» + mensajes de membresías,
 * consulta médica y envíos). Escribe en `Club.marca` y guarda un respaldo del JSON anterior antes de tocar nada.
 *
 *   npx tsx scripts/seed-textos-club.ts          # muestra qué cambiaría
 *   npx tsx scripts/seed-textos-club.ts --si     # aplica
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";

const prisma = new PrismaClient();
const si = process.argv.includes("--si");

const LEMA = "Acceso al cannabis medicinal, seguro y de calidad";

const PRESENTACION = [
  "Acceso al cannabis medicinal, seguro y de calidad.",
  "República Cannabis es una institución que acompaña a pacientes del REPROCANN del Ministerio de Salud que necesiten llevar adelante sus tratamientos con productos de calidad. Brindamos flores y extractos medicinales para su uso terapéutico dentro del marco de la Ley 27.350, exclusivamente con la vinculación dentro de la plataforma oficial.",
  "El trámite es sencillo: coordinás una consulta médica virtual, completás el formulario de ingreso para crear tu legajo, firmás la declaración jurada para la vinculación efectiva y accedés a un catálogo con flores indoor y extractos de primera calidad, con seguimiento médico.",
  "Todo con REPROCANN: somos una institución inscripta en el Registro del Programa Cannabis del Ministerio de Salud de la Nación. Nuestra tarea es asistir a usuarios del REPROCANN mediante la vinculación dentro de la plataforma. Todas las personas con documentación nacional pueden tramitar su autorización y solicitar la vinculación con nuestra Asociación Civil.",
  "Esto es un cultivo asociativo y no se vende nada: las personas vinculadas se organizan solidariamente para cubrir los costos de producción y acceder a su tratamiento medicinal según indicación médica, documentación y registro efectivo. Las membresías cuantifican los retiros de cada paciente y se adaptan a cada tratamiento: una membresía equivale a 10 g de flores secas (o su equivalente en extractos), se pueden solicitar hasta 4 por envío o retiro (40 g) y no hay límite mensual de provisión.",
].join("\n\n");

const PASOS = [
  "Creá tu usuario PACIENTE en la web oficial del REPROCANN. Podés ingresar con tu usuario de Mi Argentina o crearlo con tu correo electrónico y tu DNI.",
  "En «¿Quién cultiva?» elegí la opción «Otro»: es la que te permite vincularte con cultivadores solidarios y con las ONG inscriptas.",
  "Completá el formulario de ingreso del club. Te vamos a pedir copia de tu DNI y de tu credencial del REPROCANN para armar el legajo.",
  "Coordiná la consulta médica virtual: es obligatoria (Res. 1780/2025), tiene un costo de $50.000, vigencia de 3 años y se abona directamente a nuestro médico designado.",
  "Vinculate con nuestro profesional de la salud y con la asociación dentro de la plataforma. Con las dos vinculaciones confirmadas, el Ministerio de Salud te otorga la autorización por 3 años.",
  "Listo: ya podés retirar en la sede de San Telmo, sin costo, o recibir tus envíos en todo el país.",
];

const ENVIOS =
  "Retiro en la sede de San Telmo sin costo, coordinando horario. Envíos a todo el país: CABA $10.000 y Gran Buenos Aires $18.000 (1° cordón) o $25.000 (2° cordón), en menos de 48 h. Interior del país y resto de la Provincia de Buenos Aires: $25.000 por Andreani, con código de seguimiento y entrega en 3 días hábiles desde el despacho.";

async function main() {
  const club = await prisma.club.findFirst({ select: { id: true, marca: true } });
  if (!club) throw new Error("no hay club");
  const marca = (club.marca ?? {}) as Record<string, unknown>;
  const sitio = { ...((marca.sitio ?? {}) as Record<string, unknown>) };

  const nueva = {
    ...marca,
    lema: LEMA,
    presentacion: PRESENTACION,
    sitio: { ...sitio, pasos: PASOS, enviosTexto: ENVIOS, envios: true },
  };

  const antes = JSON.stringify(marca, null, 2);
  const despues = JSON.stringify(nueva, null, 2);

  console.log("lema:", JSON.stringify(marca.lema), "→", JSON.stringify(LEMA));
  console.log("presentacion:", String(marca.presentacion ?? "").length, "→", PRESENTACION.length, "caracteres en 5 párrafos");
  console.log("pasos:", ((sitio.pasos as string[]) ?? []).length, "→", PASOS.length);
  console.log("enviosTexto cambiado:", String(sitio.enviosTexto ?? "") !== ENVIOS);

  if (!si) {
    console.log("\nNada cambió. Volvé a correr con --si para aplicar.");
    return;
  }

  const respaldo = `${homedir()}/.config/cannabis-club-marca-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(respaldo, antes, { mode: 0o600 });
  console.log("respaldo:", respaldo);

  await prisma.club.update({ where: { id: club.id }, data: { marca: nueva as never, marcaVersion: { increment: 1 } } });
  console.log("textos aplicados. diferencia:", despues.length - antes.length, "caracteres");
}

main().finally(() => prisma.$disconnect());
