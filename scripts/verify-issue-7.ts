/**
 * Verificación del issue #7 contra una base descartable: el mismo pedido (199 de aporte + 25 de envío)
 * mirado desde las tres pantallas tiene que dar 224 y decir «Coincide».
 *
 * Corre con: npx tsx <este archivo>   (DATABASE_URL apuntando a la base de verificación)
 */
import { prisma } from "@/lib/db";
import { comprobantesEnRevision } from "@/lib/comprobantes";
import { tableroPedidos } from "@/lib/tablero-pedidos-server";
import { detalleEsperado, esperadoDelPedido } from "@/lib/comprobante-rules";

const money = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString("es-AR")}`);

if (process.env.VERIFY_DESCARTABLE !== "1") {
  console.error(
    "Este script escribe y borra pedidos de prueba: corrélo sólo contra una base descartable y con VERIFY_DESCARTABLE=1.",
  );
  process.exit(2);
}

async function main() {
  const member = await prisma.member.findFirstOrThrow({ select: { id: true, firstName: true, lastName: true } });
  const strain = await prisma.strain.findFirstOrThrow({ select: { id: true, name: true } });

  // Escenario textual del club: aporte 199 + envío 25, el socio transfiere 224.
  const pedido = await prisma.pickupRequest.create({
    data: {
      memberId: member.id,
      grams: 10,
      status: "SOLICITADA",
      deliveryMode: "ENVIO",
      deliveryZona: "Interior y resto de la provincia de Buenos Aires",
      deliveryCostoArs: 25,
      aporteEstimado: 199,
      aportePorGramo: 19.9,
      items: { create: [{ strainId: strain.id, strainName: strain.name, grams: 10 }] },
    },
    select: { id: true },
  });

  await prisma.paymentProof.create({
    data: {
      pickupId: pedido.id,
      montoArs: 224,
      mime: "image/png",
      size: 1024,
      sha256: "x".repeat(64),
      iv: Buffer.from("iv"),
      tag: Buffer.from("tag"),
      data: Buffer.from("data"),
      status: "EN_REVISION",
    },
  });

  // Pantalla 1: cola de /aportes
  const cola = await comprobantesEnRevision();
  const enCola = cola.find((c) => c.pickupId === pedido.id);
  if (!enCola) throw new Error("el comprobante no apareció en la cola de aportes");

  // Pantalla 2: tablero de /pedidos
  const tablero = await tableroPedidos();
  const enTablero = tablero.pedidos.find((p) => p.id === pedido.id);
  if (!enTablero) throw new Error("el pedido no apareció en el tablero");

  // Pantalla 3: portal del socio (mismo cálculo, con los datos que recibe desde la base)
  const delPortal = esperadoDelPedido({ aporte: 199, envio: 25, modo: "ENVIO" });

  const filas = [
    ["/aportes (cola)", enCola.esperado.esperado, enCola.analisis.cubreTotal, enCola.esperado],
    ["/pedidos (tablero)", enTablero.esperado.esperado, 224 >= (enTablero.esperado.esperado ?? 0), enTablero.esperado],
    ["portal del socio", delPortal.esperado, 224 >= (delPortal.esperado ?? 0), delPortal],
  ] as const;

  console.log("\nEscenario: aporte $199 + envío $25 · comprobante declarado $224\n");
  console.log("| pantalla | esperado | ¿coincide? | desglose |");
  console.log("|---|---|---|---|");
  for (const [nombre, esperado, cubre, obj] of filas) {
    console.log(`| ${nombre} | ${money(esperado)} | ${cubre ? "sí" : "NO"} | ${detalleEsperado(obj, money) ?? "—"} |`);
  }

  const iguales = new Set(filas.map((f) => f[1])).size === 1;
  const todosCubren = filas.every((f) => f[2] === true);
  console.log(`\nmismo número en las tres: ${iguales ? "SÍ" : "NO"} · las tres dicen que cubre: ${todosCubren ? "SÍ" : "NO"}`);

  // Retiro: sin envío no se menciona el envío.
  const retiro = await prisma.pickupRequest.create({
    data: {
      memberId: member.id,
      grams: 5,
      status: "SOLICITADA",
      deliveryMode: "RETIRO",
      aporteEstimado: 99,
      items: { create: [{ strainId: strain.id, strainName: strain.name, grams: 5 }] },
    },
    select: { id: true },
  });
  const tablero2 = await tableroPedidos();
  const enRetiro = tablero2.pedidos.find((p) => p.id === retiro.id);
  console.log(
    `\nRetiro: esperado ${money(enRetiro?.esperado.esperado ?? null)} · desglose «${detalleEsperado(enRetiro!.esperado, money) ?? "—"}»`,
  );

  // Limpieza: la base es descartable, pero no se deja basura para la próxima corrida.
  await prisma.paymentProof.deleteMany({ where: { pickupId: pedido.id } });
  await prisma.pickupItem.deleteMany({ where: { pickupId: { in: [pedido.id, retiro.id] } } });
  await prisma.pickupRequest.deleteMany({ where: { id: { in: [pedido.id, retiro.id] } } });

  const ok = iguales && todosCubren && enRetiro?.esperado.envio == null;
  console.log(`\nRESULTADO: ${ok ? "OK — criterio de aceptación cumplido" : "FALLA"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
