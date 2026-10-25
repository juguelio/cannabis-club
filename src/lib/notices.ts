/**
 * Avisos a socios (REA 5).
 *
 * La app **no manda** WhatsApp: no hay API de WhatsApp Business en el club. Lo que hace es
 * preparar el mensaje, abrir el chat con el texto escrito y dejar registro de quién avisó,
 * cuándo y por qué canal. Eso evita dos cosas: avisar dos veces lo mismo y decir "no sabíamos".
 *
 * El cálculo de motivos es puro (`memberNotices`) y se testea; la lectura de la base está abajo.
 */
import { prisma } from "./db";
import { daysToExpiry, fmtGrams } from "./labels";
import { normalizeDoc } from "./doc-format";

export const NOTICE_KINDS = {
  REPROCANN_VENCIDO: {
    label: "REPROCANN vencido",
    severity: "danger",
    why: "No puede retirar hasta renovarlo.",
    template: (name: string) =>
      `Hola ${name}, tu REPROCANN figura vencido en el padrón del club. Para poder retirar necesitamos el trámite actualizado. Cuando lo tengas, avisanos y lo cargamos.`,
  },
  REPROCANN_POR_VENCER: {
    label: "REPROCANN por vencer",
    severity: "warn",
    why: "Renová antes de la fecha o el mostrador lo va a rechazar.",
    template: (name: string, detail?: string) =>
      `Hola ${name}, tu REPROCANN vence ${detail ?? "pronto"}. Si no lo renovás, no vas a poder retirar. Te conviene iniciar el trámite ahora.`,
  },
  REPROCANN_NO_VIGENTE: {
    label: "REPROCANN no vigente",
    severity: "warn",
    why: "Mientras el trámite no esté vigente, el mostrador no puede entregar.",
    template: (name: string, detail?: string) =>
      `Hola ${name}, en el padrón del club tu REPROCANN figura ${detail ?? "no vigente"}: todavía no está vigente. Necesitamos que termines o corrijas el trámite y nos avises para actualizarlo.`,
  },
  REPROCANN_SIN_FECHA: {
    label: "REPROCANN sin fecha",
    severity: "warn",
    why: "Figura vigente pero sin vencimiento cargado: falta el dato.",
    template: (name: string) =>
      `Hola ${name}, necesitamos la fecha de vencimiento de tu REPROCANN para completar el legajo. ¿Nos la pasás?`,
  },
  CONSENTIMIENTO_FALTANTE: {
    label: "Consentimiento pendiente",
    severity: "warn",
    why: "Sin consentimiento registrado no se puede sostener el tratamiento de sus datos.",
    template: (name: string) =>
      `Hola ${name}, nos falta registrar tu consentimiento de datos en el club. Son dos minutos cuando vengas a retirar.`,
  },
  RESERVA_SIN_RETIRAR: {
    label: "Reserva sin retirar",
    severity: "warn",
    why: "Ocupa stock y el turno de otro socio.",
    template: (name: string, detail?: string) =>
      `Hola ${name}, tenés una reserva de ${detail ?? "gramos"} esperando retiro en el club. Si no vas a poder venir, avisanos para liberarla.`,
  },
  CUENTA_CON_SALDO: {
    label: "Cuenta con saldo",
    severity: "warn",
    why: "Los aportes sostienen el cultivo: conviene regularizar.",
    template: (name: string, detail?: string) =>
      `Hola ${name}, tu cuenta del club tiene un saldo pendiente de ${detail ?? "aportes"}. Cuando puedas pasá por la secretaría.`,
  },
  DOCUMENTO_SIN_VERIFICAR: {
    label: "Documento sin verificar",
    severity: "warn",
    why: "El padrón no tiene la huella del documento: falta la verificación presencial.",
    template: (name: string) =>
      `Hola ${name}, falta verificar tu documento en el club para completar el padrón. Traelo la próxima vez que vengas.`,
  },
} as const;

export type NoticeKind = keyof typeof NOTICE_KINDS;
export type NoticeChannel = "WHATSAPP" | "LLAMADO" | "PRESENCIAL" | "EMAIL";

const SEVERITY_ORDER = { danger: 0, warn: 1, mute: 2 } as const;

export type MemberNotice = {
  kind: NoticeKind;
  /** Identifica el hecho concreto: dos vencimientos distintos son dos episodios, no uno. */
  episode: string;
  label: string;
  severity: "danger" | "warn" | "mute";
  detail: string;
  why: string;
  dueInDays: number | null;
  message: string;
};

export type NoticeInput = {
  firstName: string;
  reprocannStatus: string;
  reprocannExpiresAt: Date | string | null;
  docHash: string | null;
  consents: string[];
  balanceArs: number;
  openPickups: { id: string; grams: number; days: number }[];
  status: string;
};

/** Reglas puras: qué avisarle a este socio, con qué urgencia y con qué texto. */
export function memberNotices(m: NoticeInput, opts: { porVencerDias?: number } = {}): MemberNotice[] {
  const porVencer = opts.porVencerDias ?? 30;
  const out: MemberNotice[] = [];
  const add = (kind: NoticeKind, detail: string, dueInDays: number | null = null, episode = "estado") => {
    const meta = NOTICE_KINDS[kind];
    out.push({
      kind,
      episode,
      label: meta.label,
      severity: meta.severity,
      detail,
      why: meta.why,
      dueInDays,
      message: (meta.template as (n: string, d?: string) => string)(m.firstName, detail),
    });
  };

  if (m.status === "ACTIVO" || m.status === "SUSPENDIDO") {
    const days = daysToExpiry(m.reprocannExpiresAt);
    const noVigente = m.reprocannStatus === "NO_APORTA" ? "sin declarar" : m.reprocannStatus.toLowerCase().replace("_", " ");
    // El episodio del REPROCANN es el vencimiento: renovar abre uno nuevo y no queda tapado por el aviso anterior.
    const expiry = m.reprocannExpiresAt ? new Date(m.reprocannExpiresAt).toISOString().slice(0, 10) : "sin-fecha";
    if (m.reprocannStatus === "VENCIDO") {
      // Vencido es un hecho del registro, no una inferencia: se dice tal cual.
      add("REPROCANN_VENCIDO", days !== null && days < 0 ? `Venció hace ${Math.abs(days)} días` : "Figura vencido en el registro", days, `vencido:${expiry}`);
    } else if (m.reprocannStatus !== "VIGENTE") {
      // En trámite, rechazado o sin declarar NO es "vencido": se nombra lo que el padrón sabe.
      add("REPROCANN_NO_VIGENTE", `Estado: ${noVigente}`, null, `estado:${m.reprocannStatus}`);
    } else if (days !== null && days < 0) {
      add("REPROCANN_VENCIDO", `Venció hace ${Math.abs(days)} días`, days, `vencido:${expiry}`);
    } else if (days !== null && days <= porVencer) {
      add("REPROCANN_POR_VENCER", days === 0 ? "Vence hoy" : `Vence en ${days} días`, days, `vence:${expiry}`);
    } else if (days === null) {
      add("REPROCANN_SIN_FECHA", "Sin fecha de vencimiento cargada");
    }

    if (!m.consents.includes("DATOS_PERSONALES")) add("CONSENTIMIENTO_FALTANTE", "Falta el consentimiento de datos personales");
    if (!m.docHash) add("DOCUMENTO_SIN_VERIFICAR", "Sin huella del documento en el padrón");

    for (const p of m.openPickups.filter((p) => p.days >= 3)) {
      // Cada reserva es su propio episodio: avisar por una no silencia la próxima.
      add("RESERVA_SIN_RETIRAR", `${fmtGrams(p.grams)} hace ${p.days} días`, -p.days, `reserva:${p.id}`);
    }

    if (m.balanceArs > 0) add("CUENTA_CON_SALDO", `$${m.balanceArs.toLocaleString("es-AR")} pendientes`, null, `saldo:${m.balanceArs}`);
  }

  return out.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const da = a.dueInDays ?? Number.MAX_SAFE_INTEGER;
    const db = b.dueInDays ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

/** Teléfono en formato wa.me: sólo dígitos, con 54 9 para celulares argentinos. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("54")) {
    // ya viene con país; si le falta el 9 de celular, se lo agrega
    if (!digits.startsWith("549")) digits = `549${digits.slice(2).replace(/^0/, "")}`;
  } else {
    digits = `549${digits.replace(/^0/, "")}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type BoardRow = {
  memberId: string;
  legajo: number;
  name: string;
  phone: string | null;
  notices: (MemberNotice & { lastSentAt: string | null; lastChannel: string | null })[];
};

/** Tablero de avisos: todos los socios con algo pendiente, con su último aviso registrado. */
export async function noticeBoard() {
  const [members, logs, club] = await Promise.all([
    prisma.member.findMany({
      where: { status: { in: ["ACTIVO", "SUSPENDIDO"] } },
      select: {
        id: true, legajo: true, firstName: true, lastName: true, phone: true, status: true,
        reprocannStatus: true, reprocannExpiresAt: true, docHash: true,
        consents: { where: { revokedAt: null }, select: { purpose: true } },
        account: { select: { kind: true, amountArs: true } },
        pickups: { where: { status: { in: ["SOLICITADA", "CONFIRMADA"] } }, select: { id: true, grams: true, createdAt: true } },
      },
      orderBy: { legajo: "asc" },
    }),
    prisma.noticeLog.findMany({ orderBy: { sentAt: "desc" }, select: { memberId: true, kind: true, episode: true, sentAt: true, channel: true } }),
    prisma.club.findFirst({ select: { timezone: true } }),
  ]);
  void club;

  const lastByKey = new Map<string, { sentAt: Date; channel: string }>();
  for (const l of logs) {
    // La clave incluye el episodio: un hecho nuevo del mismo motivo vuelve a estar "sin avisar".
    const key = `${l.memberId}:${l.kind}:${l.episode ?? ""}`;
    if (!lastByKey.has(key)) lastByKey.set(key, { sentAt: l.sentAt, channel: l.channel });
  }

  const rows: BoardRow[] = [];
  for (const m of members) {
    const balanceArs = Math.round(
      m.account.reduce((acc, e) => acc + (e.kind === "CARGO" ? Number(e.amountArs) : -Number(e.amountArs)), 0),
    );
    const notices = memberNotices({
      firstName: m.firstName,
      reprocannStatus: m.reprocannStatus,
      reprocannExpiresAt: m.reprocannExpiresAt,
      docHash: m.docHash,
      consents: m.consents.map((c) => c.purpose),
      balanceArs,
      openPickups: m.pickups.map((p) => ({
      id: p.id,
      grams: Number(p.grams),
      days: Math.floor((Date.now() - p.createdAt.getTime()) / 86_400_000),
      })),
      status: m.status,
    }).map((n) => {
      const last = lastByKey.get(`${m.id}:${n.kind}:${n.episode}`) ?? lastByKey.get(`${m.id}:${n.kind}:`);
      return { ...n, lastSentAt: last ? last.sentAt.toISOString() : null, lastChannel: last?.channel ?? null };
    });
    if (notices.length === 0) continue;
    rows.push({ memberId: m.id, legajo: m.legajo, name: `${m.lastName}, ${m.firstName}`, phone: m.phone, notices });
  }

  const total = rows.reduce((acc, r) => acc + r.notices.length, 0);
  const urgent = rows.reduce((acc, r) => acc + r.notices.filter((n) => n.severity === "danger").length, 0);
  const sinAvisar = rows.reduce((acc, r) => acc + r.notices.filter((n) => !n.lastSentAt).length, 0);
  return { rows, total, urgent, sinAvisar };
}

export async function logNotice(input: {
  memberId: string;
  kind: NoticeKind;
  channel: NoticeChannel;
  actorId: string;
  /** Episodio que se está avisando: sin esto, un hecho nuevo queda tapado por el aviso viejo. */
  episode?: string | null;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.noticeLog.create({
      data: {
        memberId: input.memberId,
        kind: input.kind,
        channel: input.channel,
        episode: input.episode?.trim() || null,
        byId: input.actorId,
        note: input.note?.trim() || null,
      },
    });
    await tx.auditLog.create({
      data: { actorId: input.actorId, action: "NOTICE_SENT", entity: "Member", entityId: input.memberId, payload: { kind: input.kind, channel: input.channel, episode: row.episode } },
    });
    return row;
  });
}

export const isNoticeKind = (value: string): value is NoticeKind => value in NOTICE_KINDS;
export const isNoticeChannel = (value: string): value is NoticeChannel =>
  ["WHATSAPP", "LLAMADO", "PRESENCIAL", "EMAIL"].includes(value);

export { normalizeDoc };
