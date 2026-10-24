/**
 * Turnos: capa de base de datos. La validación vive en `appointments.ts` y se
 * repite dentro de la transacción: lo que muestra la pantalla no autoriza nada.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { conflict, notFound, unprocessable } from "./errors";
import { isClosedDay } from "./closed-days";
import {
  addDaysKey,
  labelOf,
  weekdayOfKey,
  buildSlots,
  daySummary,
  evaluateBooking,
  slotInstant,
  type AppointmentLike,
  type Rule,
  type Slot,
} from "./appointments";

export type AppointmentView = {
  id: string;
  memberId: string;
  legajo: number;
  memberName: string;
  at: string;
  label: string;
  status: string;
  channel: string;
  notes: string | null;
  dispatchId: string | null;
};

const STATUSES = ["PENDIENTE", "CONFIRMADO", "ATENDIDO", "AUSENTE", "CANCELADO"] as const;
export type AppointmentStatus = (typeof STATUSES)[number];

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDIENTE: ["CONFIRMADO", "ATENDIDO", "AUSENTE", "CANCELADO"],
  CONFIRMADO: ["ATENDIDO", "AUSENTE", "CANCELADO"],
  ATENDIDO: [],
  AUSENTE: [],
  CANCELADO: [],
};

export function isStatus(value: string): value is AppointmentStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function toRule(r: {
  weekday: number;
  startMin: number;
  endMin: number;
  slotMin: number;
  capacity: number;
  active: boolean;
}): Rule {
  return { weekday: r.weekday, startMin: r.startMin, endMin: r.endMin, slotMin: r.slotMin, capacity: r.capacity, active: r.active };
}

async function rulesFor(tx: Prisma.TransactionClient | typeof prisma) {
  const rows = await tx.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
  return rows.map(toRule);
}

function dayRange(dayKey: string) {
  return { gte: slotInstant(dayKey, 0), lt: slotInstant(addDaysKey(dayKey, 1), 0) };
}

export type DayBoard = {
  day: string;
  slots: Slot[];
  appointments: AppointmentView[];
  summary: ReturnType<typeof daySummary>;
  openingHours: { weekday: number; label: string }[];
};

export async function dayBoard(dayKey: string, now: Date = new Date()): Promise<DayBoard> {
  const [rules, rows] = await Promise.all([
    rulesFor(prisma),
    prisma.appointment.findMany({
      where: { scheduledAt: dayRange(dayKey) },
      include: { member: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const likes: AppointmentLike[] = rows.map((r) => ({ id: r.id, scheduledAt: r.scheduledAt, status: r.status }));
  const slots = buildSlots(rules, dayKey, likes, now);

  const appointments: AppointmentView[] = rows.map((r) => {
    return {
      id: r.id,
      memberId: r.memberId,
      legajo: r.member.legajo,
      memberName: `${r.member.lastName}, ${r.member.firstName}`,
      at: r.scheduledAt.toISOString(),
      label: labelOf(r.scheduledAt),
      status: r.status,
      channel: r.channel,
      notes: r.notes,
      dispatchId: r.dispensationId,
    };
  });

  const weekdayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const byDay = new Map<number, Rule[]>();
  for (const r of rules) {
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), r]);
  }
  const openingHours = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, rs]) => ({
      weekday,
      label: `${weekdayNames[weekday]} ${rs.map((r) => `${r.startMin / 60}-${Math.floor(r.endMin / 60)}h`).join(" y ")}`,
    }));

  return { day: dayKey, slots, appointments, summary: daySummary(likes, now), openingHours };
}

export async function bookAppointment(input: {
  memberId: string;
  dayKey: string;
  startMin: number;
  channel?: string;
  notes?: string;
  operatorId: string;
}) {
  return prisma.$transaction(
    async (tx) => {
      if (await isClosedDay(tx, input.dayKey))
        throw unprocessable("DAY_CLOSED", "Ese día el dispensario no atiende.");
      const rules = await rulesFor(tx);
      const rows = await tx.appointment.findMany({
        where: { scheduledAt: dayRange(input.dayKey) },
        select: { id: true, memberId: true, scheduledAt: true, status: true },
      });
      const member = await tx.member.findUnique({ where: { id: input.memberId } });
      if (!member) throw notFound("Socio inexistente");

      const decision = evaluateBooking({
        dayKey: input.dayKey,
        startMin: input.startMin,
        rules,
        appointments: rows,
        memberAppointments: rows.filter((r) => r.memberId === input.memberId),
        member: { status: member.status },
      });
      if (!decision.ok) throw unprocessable(decision.code, decision.message);

      return tx.appointment.create({
        data: {
          memberId: input.memberId,
          scheduledAt: decision.at,
          status: "PENDIENTE",
          channel: input.channel ?? "MOSTRADOR",
          notes: input.notes,
          operatorId: input.operatorId,
          createdById: input.operatorId,
          durationMin: rules.find((r) => r.weekday === weekdayOfKey(input.dayKey))?.slotMin ?? 20,
        },
        include: { member: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function changeStatus(input: {
  id: string;
  status: string;
  reason?: string;
  userId: string;
}) {
  if (!isStatus(input.status)) throw unprocessable("INVALID_STATUS", "Estado de turno inválido");
  const current = await prisma.appointment.findUnique({ where: { id: input.id } });
  if (!current) throw notFound("Turno inexistente");

  const from = current.status as AppointmentStatus;
  if (from === input.status) return current;
  if (!ALLOWED[from].includes(input.status)) {
    throw conflict("INVALID_TRANSITION", `No se puede pasar un turno de "${from}" a "${input.status}"`);
  }
  if (input.status === "CANCELADO" && !input.reason?.trim()) {
    throw unprocessable("CANCEL_REASON_REQUIRED", "Para cancelar hace falta el motivo");
  }

  return prisma.appointment.update({
    where: { id: input.id },
    data: {
      status: input.status,
      attendedAt: input.status === "ATENDIDO" ? new Date() : undefined,
      canceledAt: input.status === "CANCELADO" ? new Date() : undefined,
      cancelReason: input.status === "CANCELADO" ? input.reason?.trim() : undefined,
      operatorId: input.userId,
    },
  });
}

/** Vincula la entrega con el turno (lo usa el dispensario al confirmar). */
export async function linkDispensation(appointmentId: string, dispensationId: string) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "ATENDIDO", attendedAt: new Date(), dispensationId },
  });
}
