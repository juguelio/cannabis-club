import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/http";
import { grantConsent, memberConsents, revokeConsent } from "@/lib/privacy";

/**
 * La carta del club, pedida y retirada por el propio socio.
 *
 * Es la única finalidad que el socio maneja solo, sin pasar por la secretaría: recibir novedades es
 * una decisión suya y tiene que poder cambiarla cuando quiera. El registro queda igual que si lo
 * cargara el club —con fecha, versión del texto y quién lo hizo— porque la ley pide el rastro, no
 * la firma de un mostrador.
 */
const Body = z.object({ quiere: z.boolean() });

export const POST = route(async (req) => {
  const socio = await requireMember();
  const { quiere } = await body(req, Body);

  if (quiere) {
    await grantConsent({ memberId: socio.memberId, purpose: "COMUNICACIONES", actorId: socio.id, note: "Pedido desde el portal" });
  } else {
    await revokeConsent({ memberId: socio.memberId, purpose: "COMUNICACIONES", actorId: socio.id, note: "Baja desde el portal" });
  }
  await audit({
    actorId: socio.id,
    action: quiere ? "CONSENT_GRANT" : "CONSENT_REVOKE",
    entity: "Member",
    entityId: socio.memberId,
    ip: clientIp(req),
    payload: { purpose: "COMUNICACIONES", origen: "portal_del_socio" },
  });

  const consents = await memberConsents(socio.memberId);
  return {
    consents: consents.map((c) => ({ purpose: c.purpose, granted: c.granted, grantedAt: c.grantedAt?.toISOString() ?? null })),
    mensaje: quiere
      ? "Listo: vas a recibir la carta del club. Podés darte de baja cuando quieras."
      : "Listo: no vas a recibir más cartas. Los avisos de tu trámite te siguen llegando.",
  };
});
