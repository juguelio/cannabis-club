/**
 * El envío de la carta del club.
 *
 * Tres cosas que este archivo garantiza y conviene no romper:
 * 1. **No sale a quien no corresponde** — legajo activo, con email y con COMUNICACIONES vigente.
 * 2. **No se manda dos veces la misma edición al mismo socio** — se reclama el envío en `NoticeLog`
 *    antes de mandar, con el mismo índice único parcial que usa el aviso de vencimiento. Si la
 *    corrida se corta a mitad, la siguiente sigue donde quedó y no repite.
 * 3. **La prueba no toca a nadie** — va a la casilla del club, con un link de baja firmado para un
 *    id que no existe: el link se ve, y si alguien lo toca no da de baja a ningún socio real.
 */
import { prisma } from "@/lib/db";
import { urlBaja } from "./baja";
import { cabecerasBaja, plantillaCarta, textoCarta, type BloqueCarta } from "./carta-template";
import { mailerConfigured, enviarEmail } from "./mailer";
import { repartirCarta, type CandidatoCarta, type ContenidoCarta } from "./cartas-rules";

/** Cuántos correos por corrida: la función de Vercel tiene techo de tiempo y Resend cobra por ráfaga. */
const MAX_POR_CORRIDA = 40;
const CONCURRENCIA = 4;

const base = () => (process.env.APP_BASE_URL ?? "https://republicacannabis.com.ar").replace(/\/+$/, "");

export type ResumenEnvio = {
  edicion: string;
  modo: "prueba" | "real";
  alcanzables: number;
  enviados: number;
  yaEstaban: number;
  errores: number;
  quedan: number;
  mailer: boolean;
  detalle: { legajo: number; nombre: string; estado: string; motivo?: string }[];
};

/** Los socios con su consentimiento de COMUNICACIONES, para decidir a quién le llega. */
export async function candidatosDeCarta(): Promise<CandidatoCarta[]> {
  const socios = await prisma.member.findMany({
    select: {
      id: true,
      legajo: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      consents: { where: { purpose: "COMUNICACIONES" }, select: { revokedAt: true } },
    },
    orderBy: { legajo: "asc" },
  });
  return socios.map((s) => ({
    id: s.id,
    legajo: s.legajo,
    nombre: `${s.firstName} ${s.lastName}`.trim(),
    email: s.email,
    status: s.status,
    comunicaciones: s.consents.some((c) => !c.revokedAt),
  }));
}

/** Cuántos socios entran hoy en la carta y por qué quedan afuera los demás (para la consola). */
export async function alcanzablesPara(): Promise<{ total: number; excluidos: number; motivos: Record<string, number> }> {
  const reparto = repartirCarta(await candidatosDeCarta());
  return {
    total: reparto.alcanzables.length,
    excluidos: reparto.excluidos.length,
    motivos: reparto.excluidos.reduce<Record<string, number>>((acc, e) => {
      acc[e.motivo] = (acc[e.motivo] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

async function contenidoDe(id: string): Promise<{ contenido: ContenidoCarta; titulo: string } | null> {
  const e = await prisma.edicionCarta.findUnique({ where: { id } });
  if (!e) return null;
  return {
    titulo: e.titulo,
    contenido: {
      edicion: e.edicion,
      titulo: e.titulo,
      copete: e.copete,
      apertura: (e.apertura as string[]) ?? [],
      bloques: (e.bloques as BloqueCarta[]) ?? [],
      cta: (e.cta as { texto: string; url: string } | null) ?? undefined,
    },
  };
}

/** La línea de baja no se edita desde la consola: es la que corresponde siempre. */
const LINEA_BAJA = "Recibís esta carta porque sos socio del club. Si no querés recibir más novedades, darte de baja con el link de abajo te saca de la carta; los avisos de tu trámite te siguen llegando.";

/** Arma el correo de un socio. `bajaUrl` se omite cuando el correo es de prueba a la casilla del club. */
function correoDe(contenido: ContenidoCarta, bajaUrl?: string) {
  const carta = { ...contenido, baja: LINEA_BAJA, bajaUrl };
  return {
    asunto: contenido.titulo,
    html: plantillaCarta(carta),
    text: textoCarta(carta),
    headers: bajaUrl ? cabecerasBaja(bajaUrl) : undefined,
  };
}

/**
 * Manda la edición. `modo: "prueba"` va sólo a la casilla del club y no registra nada;
 * `modo: "real"` recorre el padrón consentido con el candado por socio.
 */
export async function enviarCarta(input: { id: string; modo: "prueba" | "real"; actorId: string | null }): Promise<ResumenEnvio> {
  const cargado = await contenidoDe(input.id);
  if (!cargado) throw new Error("La edición no existe.");
  const { contenido } = cargado;
  const configurado = mailerConfigured();
  const resumen: ResumenEnvio = {
    edicion: contenido.edicion,
    modo: input.modo,
    alcanzables: 0,
    enviados: 0,
    yaEstaban: 0,
    errores: 0,
    quedan: 0,
    mailer: configurado,
    detalle: [],
  };
  if (!configurado) return resumen;

  if (input.modo === "prueba") {
    const destino = process.env.CLUB_MAIL_PRUEBA ?? process.env.CLUB_MAIL_REPLY_TO;
    if (!destino) {
      resumen.errores = 1;
      resumen.detalle.push({ legajo: 0, nombre: "-", estado: "error", motivo: "el club no tiene casilla de prueba configurada" });
      return resumen;
    }
    // Token firmado para un id inexistente: el link se ve igual y no da de baja a nadie real.
    const bajaFalsa = urlBaja("prueba-de-envio", base()) ?? undefined;
    const correo = correoDe(contenido, bajaFalsa);
    const envio = await enviarEmail({ to: destino, subject: `[Prueba] ${correo.asunto}`, text: correo.text, html: correo.html, headers: correo.headers });
    if (envio.enviado) resumen.enviados = 1;
    else {
      resumen.errores = 1;
      resumen.detalle.push({ legajo: 0, nombre: destino, estado: "error", motivo: envio.detalle ?? envio.motivo });
    }
    return resumen;
  }

  const reparto = repartirCarta(await candidatosDeCarta());
  resumen.alcanzables = reparto.alcanzables.length;
  for (const e of reparto.excluidos) resumen.detalle.push({ legajo: e.legajo, nombre: e.nombre, estado: "excluido", motivo: e.motivo });

  const episode = `carta:${input.id}`;
  const pendientes = reparto.alcanzables.slice(0, MAX_POR_CORRIDA);

  for (let i = 0; i < pendientes.length; i += CONCURRENCIA) {
    const tanda = pendientes.slice(i, i + CONCURRENCIA);
    const resultados = await Promise.all(
      tanda.map(async (socio) => {
        // Reclamo atómico: el índice único por (socio, motivo, episodio) es el candado.
        let reclamo: { id: string };
        try {
          reclamo = await prisma.noticeLog.create({
            data: {
              memberId: socio.id,
              kind: "CARTA_CLUB",
              channel: "EMAIL",
              byId: input.actorId,
              automatic: true,
              episode,
              note: `Carta: ${contenido.edicion}`,
            },
            select: { id: true },
          });
        } catch (error) {
          if ((error as { code?: string }).code === "P2002") return { socio, estado: "ya_estaba" as const };
          throw error;
        }
        const correo = correoDe(contenido, urlBaja(socio.id, base()) ?? undefined);
        const envio = await enviarEmail({ to: socio.email!, subject: correo.asunto, text: correo.text, html: correo.html, headers: correo.headers });
        if (!envio.enviado) {
          // No salió: se suelta el reclamo para que el próximo intento lo tome.
          await prisma.noticeLog.delete({ where: { id: reclamo.id } }).catch(() => undefined);
          return { socio, estado: "error" as const, motivo: envio.detalle ?? envio.motivo };
        }
        return { socio, estado: "enviado" as const };
      })
    );
    for (const r of resultados) {
      if (r.estado === "enviado") resumen.enviados += 1;
      else if (r.estado === "ya_estaba") resumen.yaEstaban += 1;
      else resumen.errores += 1;
      resumen.detalle.push({ legajo: r.socio.legajo, nombre: r.socio.nombre, estado: r.estado, motivo: "motivo" in r ? r.motivo : undefined });
    }
  }

  // Cuántos quedaron sin mandar: se cuenta contra el padrón alcanzable, no contra la tanda.
  const yaReclamados = await prisma.noticeLog.count({ where: { kind: "CARTA_CLUB", episode } });
  resumen.quedan = Math.max(0, resumen.alcanzables - yaReclamados);

  const estado = resumen.quedan === 0 ? "ENVIADA" : "ENVIANDO";
  await prisma.edicionCarta.update({
    where: { id: input.id },
    data: {
      estado,
      alcanzados: resumen.alcanzables,
      enviados: yaReclamados,
      errores: { increment: resumen.errores },
      ...(estado === "ENVIADA" ? { enviadaEn: new Date() } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "CARTA_ENVIADA",
      entity: "EdicionCarta",
      entityId: input.id,
      payload: { edicion: contenido.edicion, enviados: resumen.enviados, errores: resumen.errores, alcanzables: resumen.alcanzables },
    },
  });
  return resumen;
}

/** Lo que corre el cron: las aprobadas cuya hora llegó. Toma pocas por corrida y no se traba con una. */
export async function procesarCartasProgramadas(): Promise<{ procesadas: ResumenEnvio[]; pendientes: number }> {
  const ahora = new Date();
  const listas = await prisma.edicionCarta.findMany({
    where: {
      estado: { in: ["APROBADA", "ENVIANDO"] },
      OR: [{ programadaPara: null }, { programadaPara: { lte: ahora } }],
    },
    orderBy: [{ programadaPara: "asc" }, { createdAt: "asc" }],
    take: 3,
    select: { id: true },
  });
  const procesadas: ResumenEnvio[] = [];
  for (const e of listas) procesadas.push(await enviarCarta({ id: e.id, modo: "real", actorId: null }));
  const pendientes = await prisma.edicionCarta.count({ where: { estado: { in: ["APROBADA", "ENVIANDO"] } } });
  return { procesadas, pendientes };
}
