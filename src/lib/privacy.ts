import crypto from "node:crypto";
import { prisma } from "./db";
import { normalizeDoc } from "./doc-format";

export { maskDoc, normalizeDoc } from "./doc-format";

/**
 * Privacidad del padrón (REA 4).
 *
 * El club necesita poder decir "este documento ya está en el padrón" y "es la misma persona",
 * pero no necesita conservar el número. Se guarda una huella HMAC-SHA256 (no reversible sin la
 * clave) y los últimos 4 dígitos para verificación visual en el mostrador.
 *
 * La clave sale de `DOC_HASH_KEY` (o, si falta, de `AUTH_SECRET` con separación de dominio).
 * Rotar la clave invalida la búsqueda por documento: se documenta en `docs/privacidad.md`.
 */

const KEY = () => {
  const key = process.env.DOC_HASH_KEY ?? process.env.AUTH_SECRET;
  if (!key) throw new Error("Falta DOC_HASH_KEY (o AUTH_SECRET) para calcular la huella del documento.");
  return `club-doc:v1:${key}`;
};

/** Huella del documento: permite detectar duplicados sin guardar el número. */
export function docHash(raw: string): string {
  const normalized = normalizeDoc(raw);
  if (!normalized) throw new Error("Documento vacío.");
  return crypto.createHmac("sha256", KEY()).update(normalized).digest("hex");
}

export function docLast4(raw: string): string {
  const normalized = normalizeDoc(raw);
  return normalized.slice(-4);
}

/** Qué se guarda de un documento que se acaba de verificar en el mostrador. */
export function docFingerprint(raw: string) {
  return { docHash: docHash(raw), docLast4: docLast4(raw) };
}

/**
 * Finalidades del consentimiento. Cada una se registra por separado y se puede revocar
 * sin tocar las otras: el socio puede autorizar sus datos para el padrón y negar la imagen.
 */
export const CONSENT_PURPOSES = {
  DATOS_PERSONALES: { label: "Datos personales", detail: "Padrón, legajo, contacto y registro de entregas." },
  SALUD: { label: "Datos de salud", detail: "Indicación médica, consumo y seguimiento del Director Médico." },
  IMAGEN: { label: "Imagen", detail: "Fotos o videos del club y de actividades." },
  COMUNICACIONES: { label: "Comunicaciones", detail: "Avisos por WhatsApp, correo o teléfono." },
} as const;

export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;
export const CONSENT_VERSION = "2026-10";

/**
 * Texto de cada finalidad por versión: guardar sólo "2026-10" no permite contestar «¿qué acepté?».
 * Cada versión se agrega cuando la organización aprueba el texto; el histórico no se edita.
 */
export const CONSENT_TEXTS: Record<string, Record<ConsentPurpose, string>> = {
  "2026-10": {
    DATOS_PERSONALES:
      "Autorizo a la asociación a tratar mis datos personales (nombre, documento verificado, contacto y registro de entregas) para sostener el padrón, el legajo y la trazabilidad que exige la normativa.",
    SALUD:
      "Autorizo el tratamiento de los datos de salud que surjan del acompañamiento profesional (indicación, consumo y seguimiento), con acceso restringido al equipo que corresponda.",
    IMAGEN:
      "Autorizo el uso de mi imagen en fotos y videos institucionales del club. No incluye datos de salud ni de consumo.",
    COMUNICACIONES:
      "Autorizo que el club me contacte por WhatsApp, correo o teléfono para avisos administrativos (vencimientos, reservas, cuenta). No es consentimiento para publicidad de terceros.",
  },
};

export const consentLabel = (purpose: ConsentPurpose) => CONSENT_PURPOSES[purpose].label;

export async function memberConsents(memberId: string) {
  const rows = await prisma.consent.findMany({
    where: { memberId },
    orderBy: { grantedAt: "desc" },
    include: { grantedBy: { select: { name: true } } },
  });
  const purposes = Object.keys(CONSENT_PURPOSES) as ConsentPurpose[];
  return purposes.map((purpose) => {
    const vigente = rows.find((r) => r.purpose === purpose && !r.revokedAt) ?? null;
    return {
      purpose,
      label: CONSENT_PURPOSES[purpose].label,
      detail: CONSENT_PURPOSES[purpose].detail,
      granted: Boolean(vigente),
      grantedAt: vigente?.grantedAt ?? null,
      by: vigente?.grantedBy?.name ?? null,
      version: vigente?.version ?? null,
      revokedAt: rows.find((r) => r.purpose === purpose && r.revokedAt)?.revokedAt ?? null,
    };
  });
}

/** Registra (o vuelve a registrar) el consentimiento de una finalidad. */
export async function grantConsent(input: { memberId: string; purpose: ConsentPurpose; /** `null` cuando lo otorga el socio desde un link propio. */ actorId: string | null; note?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.consent.findFirst({ where: { memberId: input.memberId, purpose: input.purpose, revokedAt: null } });
    if (active) return active;
    // Si ya había un consentimiento revocado de esta misma versión del texto, se reabre en vez de
    // crear otro: el único (socio, finalidad, versión) no admite dos filas, y volver a aceptar es
    // reabrir el registro, no fabricar uno nuevo. La fecha de la baja queda en la auditoría.
    const previo = await tx.consent.findFirst({
      where: { memberId: input.memberId, purpose: input.purpose, version: CONSENT_VERSION, revokedAt: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const row = previo
      ? await tx.consent.update({
          where: { id: previo.id },
          data: { revokedAt: null, grantedAt: new Date(), grantedById: input.actorId, note: input.note?.trim() || previo.note },
        })
      : await tx.consent.create({
          data: {
            memberId: input.memberId,
            purpose: input.purpose,
            version: CONSENT_VERSION,
            grantedById: input.actorId,
            note: input.note?.trim() || null,
          },
        });
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "CONSENT_GRANT", entity: "Member", entityId: input.memberId, payload: { purpose: input.purpose, version: CONSENT_VERSION } },
    });
    return row;
  });
}

/** Revocar no borra: deja la fecha. El consentimiento es un registro, no un checkbox. */
export async function revokeConsent(input: { memberId: string; purpose: ConsentPurpose; actorId: string; note?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.consent.findFirst({ where: { memberId: input.memberId, purpose: input.purpose, revokedAt: null } });
    if (!active) return null;
    const row = await tx.consent.update({ where: { id: active.id }, data: { revokedAt: new Date(), note: input.note?.trim() || active.note } });
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "CONSENT_REVOKE", entity: "Member", entityId: input.memberId, payload: { purpose: input.purpose } },
    });
    return row;
  });
}
