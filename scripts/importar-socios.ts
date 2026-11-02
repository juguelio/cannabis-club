/**
 * Carga el padrón que el club mandó por planilla (23 socios, 21–31 oct 2026).
 *
 * De esa planilla hay nombre, email, modalidad de entrega y domicilio. NO hay DNI, fecha de
 * nacimiento, REPROCANN ni fecha de alta real: esos datos los declara el socio al validarse en el
 * portal, y por eso cada legajo entra en `verificationStatus = PENDIENTE` con `birthDate` nulo.
 * Inventar un nacimiento o un REPROCANN para "completar la ficha" sería basura impresa en los libros.
 *
 * Uso:
 *   npx tsx scripts/importar-socios.ts            # muestra qué haría (no escribe)
 *   npx tsx scripts/importar-socios.ts --si       # escribe
 *
 * Idempotente por email: si el socio ya está en el padrón, no lo duplica.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SI = process.argv.includes("--si");

type Modalidad = "RETIRO" | "ENVIO_AMBA" | "ENVIO_NACIONAL";

type Fila = {
  fecha: string;
  nombre: string;
  email: string;
  modalidad: Modalidad;
  domicilio: string;
  /** Nombres compuestos: el split automático manda "Ezequiel Silva" al apellido. */
  partes?: { firstName: string; lastName: string };
};

const FILAS: Fila[] = [
  { fecha: "2026-10-21", nombre: "Fabio Correa", email: "fcg68@hotmail.com", modalidad: "RETIRO", domicilio: "retiro personal" },
  {
    fecha: "2026-10-21",
    nombre: "Imanol Mesa Cariaga",
    email: "ima.mesa.cariaga@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Tromen 120 Casa 9, CP 8370, San Martín de los Andes, Neuquén",
    partes: { firstName: "Imanol", lastName: "Mesa Cariaga" },
  },
  {
    fecha: "2026-10-21",
    nombre: "Alexis Ezequiel Silva",
    email: "alexises1287@gmail.com",
    modalidad: "RETIRO",
    domicilio: "retiro personal",
    partes: { firstName: "Alexis Ezequiel", lastName: "Silva" },
  },
  {
    fecha: "2026-10-21",
    nombre: "Eluney Botana Murphy",
    email: "eluney.murphy@gmail.com",
    modalidad: "RETIRO",
    domicilio: "retiro personal",
    partes: { firstName: "Eluney", lastName: "Botana Murphy" },
  },
  { fecha: "2026-10-21", nombre: "Gastón Noriega", email: "pepokingone@gmail.com", modalidad: "ENVIO_AMBA", domicilio: "Besares 2247, CP 1646, Gran Buenos Aires" },
  {
    fecha: "2026-10-21",
    nombre: "Macs Alfonso Zimmermann",
    email: "macszimmermann@gmail.com",
    modalidad: "RETIRO",
    domicilio: "retiro personal",
    partes: { firstName: "Macs Alfonso", lastName: "Zimmermann" },
  },
  {
    fecha: "2026-10-21",
    nombre: "Victoria Del Sel",
    email: "delsel.victoria@gmail.com",
    modalidad: "RETIRO",
    domicilio: "retiro personal",
    partes: { firstName: "Victoria", lastName: "Del Sel" },
  },
  { fecha: "2026-10-21", nombre: "Sofía Marrón", email: "sofiamarron680@gmail.com", modalidad: "ENVIO_NACIONAL", domicilio: "Retiro en sucursal de correo" },
  {
    fecha: "2026-10-21",
    nombre: "Facundo Colucho",
    email: "facundo.colucho@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Perito Moreno 868 (pinturería), CP 8370, San Martín de los Andes, Neuquén",
  },
  { fecha: "2026-10-21", nombre: "Damaris Salomé", email: "salogonzalez2001@gmail.com", modalidad: "RETIRO", domicilio: "Maipú 631 (declaró domicilio pero retira en sede)" },
  {
    fecha: "2026-10-21",
    nombre: "María Fernanda Albornoz Aroca",
    email: "fernandaalbornozsmandes@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Chacra 4, área mixta, lote 27, familia Albornoz, San Martín de los Andes",
    partes: { firstName: "María Fernanda", lastName: "Albornoz Aroca" },
  },
  { fecha: "2026-10-21", nombre: "Roberto Lachivita", email: "robertolachivita@hotmail.com", modalidad: "ENVIO_AMBA", domicilio: "El Salvador 3870, AMBA" },
  {
    fecha: "2026-10-21",
    nombre: "Luis Matías Iberra",
    email: "matutinodeviaje@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "San Martín 1130, depto 4, CP 6015, Los Toldos, Buenos Aires",
    partes: { firstName: "Luis Matías", lastName: "Iberra" },
  },
  { fecha: "2026-10-21", nombre: "Anabella León", email: "leondiazanabella@gmail.com", modalidad: "RETIRO", domicilio: "retiro personal" },
  {
    fecha: "2026-10-21",
    nombre: "Sergio Tanoni",
    email: "smtanoni@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Ensueños 2, lote 6, depto 2, CP 8370, San Martín de los Andes, Neuquén",
  },
  {
    fecha: "2026-10-21",
    nombre: "Gabriel Alejandro De Benito",
    email: "gadebenito92@gmail.com",
    modalidad: "ENVIO_AMBA",
    domicilio: "Doblas 1428, entre Vernet y Santander, Parque Chacabuco, CABA",
    partes: { firstName: "Gabriel Alejandro", lastName: "De Benito" },
  },
  { fecha: "2026-10-21", nombre: "Francisco Sampietro", email: "frankksam1986@gmail.com", modalidad: "RETIRO", domicilio: "Piedras 605, CABA (retira en sede)" },
  { fecha: "2026-10-21", nombre: "Micaela Barranco", email: "micaela_f_barranco@hotmail.com", modalidad: "RETIRO", domicilio: "retiro personal" },
  { fecha: "2026-10-23", nombre: "Alejandro Cortés", email: "alejandro.cortes@gmail.com", modalidad: "ENVIO_AMBA", domicilio: "Marcelo Torcuato de Alvear 665, Quilmes Oeste" },
  {
    fecha: "2026-10-23",
    nombre: "Federico Stanzione",
    email: "tony.stanzionee@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Manuel Belgrano 164, CP 8370, San Martín de los Andes, Neuquén",
  },
  { fecha: "2026-10-24", nombre: "Federico García", email: "fefugarcia92@gmail.com", modalidad: "RETIRO", domicilio: "retiro personal" },
  {
    fecha: "2026-10-27",
    nombre: "Agustina Genovese",
    email: "agustinagenovese@gmail.com",
    modalidad: "ENVIO_NACIONAL",
    domicilio: "Las Frutillas 195, CP 8370, San Martín de los Andes, Neuquén",
  },
  { fecha: "2026-10-31", nombre: "Gabriela Scheimberg", email: "ga.sch.wosco@gmail.com", modalidad: "ENVIO_NACIONAL", domicilio: "Almirante Brown 385" },
];

const MODALIDAD_TXT: Record<Modalidad, string> = {
  RETIRO: "Retiro por sede social San Telmo",
  ENVIO_AMBA: "Envío local (AMBA)",
  ENVIO_NACIONAL: "Envío nacional (todo el país)",
};

function partir(nombre: string) {
  const t = nombre.trim().split(/\s+/);
  if (t.length === 1) return { firstName: t[0], lastName: "" };
  return { firstName: t.slice(0, -1).join(" "), lastName: t[t.length - 1] };
}

async function main() {
  const club = await prisma.club.findFirst({ select: { nombreCorto: true } });
  const host = (process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@");
  console.log(`Base: ${host}`);
  console.log(`Club: ${club?.nombreCorto ?? "(sin configurar)"}`);
  console.log(`Filas en la planilla: ${FILAS.length}${SI ? "" : "  ·  DRY-RUN (nada se escribe)"}\n`);

  const actuales = await prisma.member.findMany({
    orderBy: { legajo: "asc" },
    select: { legajo: true, firstName: true, lastName: true, email: true, verificationStatus: true },
  });
  console.log(`Padrón actual (${actuales.length}):`);
  for (const m of actuales) console.log(`  · ${m.legajo} ${m.lastName}, ${m.firstName} <${m.email ?? "sin email"}> [${m.verificationStatus}]`);
  console.log("");

  const legajoMax = await prisma.member.aggregate({ _max: { legajo: true } });
  let siguiente = (legajoMax._max.legajo ?? 0) + 1;

  const creados: string[] = [];
  const saltados: string[] = [];

  for (const fila of FILAS) {
    const email = fila.email.trim().toLowerCase();
    const ya = await prisma.member.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { legajo: true, firstName: true, lastName: true },
    });
    if (ya) {
      saltados.push(`${ya.lastName}, ${ya.firstName} (legajo ${ya.legajo}) — ya está con ${email}`);
      continue;
    }

    const { firstName, lastName } = fila.partes ?? partir(fila.nombre);
    const nota = [
      `Padrón cargado desde la planilla del ${fila.fecha.split("-").reverse().join("/")}.`,
      `Modalidad declarada: ${MODALIDAD_TXT[fila.modalidad]}.`,
      fila.domicilio ? `Domicilio declarado: ${fila.domicilio}.` : "",
      "Falta que valide DNI y REPROCANN en el portal.",
    ]
      .filter(Boolean)
      .join(" ");

    const data = {
      legajo: siguiente,
      firstName,
      lastName,
      email,
      address: fila.modalidad === "RETIRO" ? null : fila.domicilio,
      status: "ACTIVO" as const,
      admittedAt: new Date(`${fila.fecha}T00:00:00.000Z`),
      reprocannStatus: "NO_APORTA" as const,
      verificationStatus: "PENDIENTE" as const,
      notes: nota,
    };

    if (SI) await prisma.member.create({ data });
    creados.push(`legajo ${siguiente} · ${lastName}, ${firstName} · ${email} · ${MODALIDAD_TXT[fila.modalidad]}`);
    siguiente += 1;
  }

  console.log(`A crear: ${creados.length}`);
  for (const c of creados) console.log("  +", c);
  if (saltados.length) {
    console.log(`\nYa existentes (no se tocan): ${saltados.length}`);
    for (const s of saltados) console.log("  =", s);
  }
  console.log(
    SI
      ? `\nListo: ${creados.length} legajos cargados, todos en «falta validar».`
      : `\nDry-run: no se escribió nada. Volvé a correrlo con --si para cargarlos.`,
  );
}

main()
  .catch((error) => {
    console.error("Falló la importación:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
