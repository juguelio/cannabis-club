import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";

/**
 * Cuentas que quedaron pendientes de aprobación (hoy: las que se crean solas al
 * entrar con Google). Se sugiere el legajo cuyo email coincide, para que aprobar
 * sea un clic y no una búsqueda a mano.
 */
export const GET = route(async () => {
  await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({
    // Quien ya presentó su solicitud se revisa en «Solicitudes de alta», no acá.
    where: { active: false, accessRequest: { is: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, googleSub: true, createdAt: true, memberId: true },
  });
  const emails = users.map((u) => u.email);
  const socios = emails.length
    ? await prisma.member.findMany({
        where: { email: { in: emails }, user: null },
        select: { id: true, legajo: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const porEmail = new Map(socios.map((s) => [String(s.email).toLowerCase(), s]));
  return {
    users: users.map((u) => ({ ...u, sugerido: porEmail.get(u.email) ?? null })),
  };
});
