/**
 * Turnos del dispensario: lógica pura (sin Prisma) para poder testearla.
 *
 * El club opera en su propia zona horaria; el schema guarda `scheduledAt` en UTC.
 * Argentina no tiene horario de verano, así que el offset del club es fijo -03:00
 * (el campo `Club.timezone` documenta la zona y se usa para mostrar).
 */

export type Rule = {
  weekday: number; // 0 = domingo … 6 = sábado
  startMin: number; // minutos desde medianoche, hora del club
  endMin: number;
  slotMin: number;
  capacity: number;
  active?: boolean;
};

export type AppointmentLike = {
  id?: string;
  scheduledAt: Date | string;
  status: string;
};

export type Slot = {
  startMin: number;
  label: string;
  at: string; // ISO UTC
  capacity: number;
  taken: number;
  free: number;
  full: boolean;
  past: boolean;
};

export const CLUB_OFFSET = "-03:00";

/** Minutos desde medianoche → "HH:MM". */
export function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutos. Devuelve null si no es una hora válida. */
export function labelToMinutes(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function offsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) throw new Error(`offset inválido: ${offset}`);
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Instante UTC → clave de día en la zona del club ("YYYY-MM-DD"). */
export function dayKeyOf(date: Date | string, offset: string = CLUB_OFFSET): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const shifted = new Date(d.getTime() + offsetMinutes(offset) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Instante → "HH:MM" en la zona del club. */
export function labelOf(date: Date | string, offset: string = CLUB_OFFSET): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const shifted = new Date(d.getTime() + offsetMinutes(offset) * 60_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" + n días (sin cruzar por zonas). */
export function addDaysKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** Día de la semana de una clave de día (0 = domingo). */
export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Instante UTC de un minuto del día en la zona del club. */
export function slotInstant(dayKey: string, startMin: number, offset: string = CLUB_OFFSET): Date {
  const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
  const mm = String(startMin % 60).padStart(2, "0");
  return new Date(`${dayKey}T${hh}:${mm}:00${offset}`);
}

export function isToday(dayKey: string, now: Date = new Date(), offset: string = CLUB_OFFSET): boolean {
  return dayKeyOf(now, offset) === dayKey;
}

/**
 * Arma la grilla de turnos del día a partir de las franjas configuradas.
 * Sólo cuenta como ocupado lo que no está cancelado.
 */
export function buildSlots(
  rules: Rule[],
  dayKey: string,
  appointments: AppointmentLike[],
  now: Date = new Date(),
  offset: string = CLUB_OFFSET,
): Slot[] {
  const weekday = weekdayOfKey(dayKey);
  const usable = rules.filter((r) => r.weekday === weekday && (r.active ?? true) && r.endMin > r.startMin);
  const takenByInstant = new Map<number, number>();

  for (const a of appointments) {
    if (a.status === "CANCELADO") continue;
    const t = (typeof a.scheduledAt === "string" ? new Date(a.scheduledAt) : a.scheduledAt).getTime();
    takenByInstant.set(t, (takenByInstant.get(t) ?? 0) + 1);
  }

  const slots: Slot[] = [];
  for (const rule of usable) {
    const step = rule.slotMin > 0 ? rule.slotMin : 20;
    for (let start = rule.startMin; start + step <= rule.endMin; start += step) {
      const instant = slotInstant(dayKey, start, offset);
      const taken = takenByInstant.get(instant.getTime()) ?? 0;
      const free = Math.max(0, rule.capacity - taken);
      slots.push({
        startMin: start,
        label: minutesToLabel(start),
        at: instant.toISOString(),
        capacity: rule.capacity,
        taken,
        free,
        full: free === 0,
        past: instant.getTime() < now.getTime(),
      });
    }
  }
  return slots.sort((a, b) => a.startMin - b.startMin);
}

/**
 * Próximos días que el club atiende: con franja activa, sin estar cerrado por el club
 * y (si es hoy) con algún horario todavía por delante.
 */
export type EstadoDia = "abierto" | "cerrado" | "sin-franja" | "hoy-sin-horario";
export type DiaCalendario = { key: string; weekday: number; estado: EstadoDia; label: string };

/**
 * Los próximos días **consecutivos**, tengan o no atención. El socio ve la semana completa: un día
 * cerrado o sin franja aparece igual, atenuado y con el motivo, en vez de desaparecer sin explicación
 * (el club cerró un feriado y el lunes se esfumó del selector).
 */
export function calendarDays(
  rules: Rule[],
  closedKeys: Set<string>,
  todayKey: string,
  count = 7,
): DiaCalendario[] {
  const out: DiaCalendario[] = [];
  for (let i = 0; i < count; i += 1) {
    const key = addDaysKey(todayKey, i);
    const weekday = weekdayOfKey(key);
    const tieneFranja = rules.some((r) => r.weekday === weekday && (r.active ?? true));
    let estado: EstadoDia = "abierto";
    if (closedKeys.has(key)) estado = "cerrado";
    else if (!tieneFranja) estado = "sin-franja";
    else if (i === 0 && !buildSlots(rules, key, []).some((s) => !s.past)) estado = "hoy-sin-horario";
    out.push({ key, weekday, estado, label: WEEKDAY_SHORT[weekday] });
  }
  return out;
}

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function nextOpenDays(
  rules: Rule[],
  closedKeys: Set<string>,
  todayKey: string,
  horizon = 10,
  limit = 5,
): { key: string; weekday: number }[] {
  const days: { key: string; weekday: number }[] = [];
  for (let i = 0; i < horizon && days.length < limit; i += 1) {
    const key = addDaysKey(todayKey, i);
    if (closedKeys.has(key)) continue;
    const weekday = weekdayOfKey(key);
    const hasRule = rules.some((r) => r.weekday === weekday && (r.active ?? true));
    // Hoy sólo cuenta si todavía queda algún horario por delante.
    const stillOpen = i > 0 || buildSlots(rules, key, []).some((s) => !s.past);
    if (hasRule && stillOpen) days.push({ key, weekday });
  }
  return days;
}

export type BookingError = {
  ok: false;
  code: "PAST" | "NO_SLOT" | "SLOT_FULL" | "MEMBER_INACTIVE" | "DUPLICATE_DAY";
  message: string;
};

export type BookingOk = { ok: true; at: Date };

/**
 * Valida una reserva. El servidor repite esta validación dentro de la transacción:
 * el chequeo en pantalla es para que el operador vea el motivo, no para autorizar.
 */
export function evaluateBooking(input: {
  dayKey: string;
  startMin: number;
  rules: Rule[];
  /** Todos los turnos del día: se usan para el cupo de cada horario. */
  appointments: AppointmentLike[];
  /** Turnos de este socio: si se omite, se filtran de `appointments` por no poder distinguirlos. */
  memberAppointments?: AppointmentLike[];
  member: { status: string; firstName?: string; lastName?: string };
  now?: Date;
  offset?: string;
}): BookingOk | BookingError {
  const now = input.now ?? new Date();
  const offset = input.offset ?? CLUB_OFFSET;
  const slots = buildSlots(input.rules, input.dayKey, input.appointments, now, offset);
  const slot = slots.find((s) => s.startMin === input.startMin);

  if (!slot) {
    return { ok: false, code: "NO_SLOT", message: "Ese horario no está dentro de las franjas de atención del día." };
  }
  if (slot.past) {
    return { ok: false, code: "PAST", message: "Ese horario ya pasó." };
  }
  if (slot.full) {
    return { ok: false, code: "SLOT_FULL", message: `El turno de ${slot.label} ya está completo (${slot.taken}/${slot.capacity}).` };
  }
  if (input.member.status !== "ACTIVO") {
    return { ok: false, code: "MEMBER_INACTIVE", message: "El socio no está activo: primero hay que completar el alta." };
  }

  const sameDay = (input.memberAppointments ?? input.appointments).filter(
    (a) => a.status !== "CANCELADO" && dayKeyOf(a.scheduledAt, offset) === input.dayKey,
  );
  if (sameDay.length > 0) {
    const hour = minutesToLabel(Math.floor((new Date(sameDay[0].scheduledAt).getTime() + offsetMinutes(offset) * 60_000) / 60_000) % (24 * 60));
    return { ok: false, code: "DUPLICATE_DAY", message: `El socio ya tiene un turno ese día a las ${hour}.` };
  }

  return { ok: true, at: slotInstant(input.dayKey, input.startMin, offset) };
}

/** Resumen del día para los contadores de arriba. */
export function daySummary(appointments: AppointmentLike[], now: Date = new Date()) {
  const live = appointments.filter((a) => a.status !== "CANCELADO");
  return {
    total: live.length,
    pendientes: live.filter((a) => a.status === "PENDIENTE").length,
    confirmados: live.filter((a) => a.status === "CONFIRMADO").length,
    atendidos: live.filter((a) => a.status === "ATENDIDO").length,
    ausentes: live.filter((a) => a.status === "AUSENTE").length,
    porLlegar: live.filter((a) => ["PENDIENTE", "CONFIRMADO"].includes(a.status)).length,
    cancelados: appointments.filter((a) => a.status === "CANCELADO").length,
    ahora: now.getTime(),
  };
}
