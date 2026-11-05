import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { plantillaCarta, type BloqueCarta } from "@/lib/carta-template";
import { contenidoCarta } from "@/lib/cartas-schema";
import { siteUrl } from "@/lib/site";

/**
 * La vista previa del editor: devuelve el HTML de la plantilla real, no una maqueta.
 *
 * Lo que se ve acá es lo que sale. Se firma con un token de baja de mentira para que el pie se vea
 * completo sin dar de baja a nadie.
 */
export const POST = route(async (req) => {
  await requireUser(["ADMIN", "OPERADOR"]);
  const input = await body(req, contenidoCarta);
  const html = plantillaCarta({
    edicion: input.edicion,
    titulo: input.titulo,
    copete: input.copete,
    apertura: input.apertura,
    bloques: input.bloques as BloqueCarta[],
    cta: input.cta,
    // Un token con forma válida y firma falsa: el link se dibuja, la URL no funciona.
    baja: "Recibís esta carta porque sos socio del club. Podés darte de baja cuando quieras.",
    bajaUrl: `${siteUrl()}/api/baja?t=v1.cdVlLnZpc3RhLXByZXZpYQ.zZ9-vista-previa`,
  });
  return { html };
});
