/**
 * Qué puede abrir cada rol en la consola del club.
 *
 * El DISPENSADOR es el mostrador: entrega lo que la comisión aprobó. Ve padrón y stock para poder entregar,
 * pero no toca configuración, no ve documentos del legajo, no aprueba altas, no anula entregas ni abre libros.
 * La regla vive acá y no repartida en cada página, para que no se desincronice.
 */
export type Rol = "ADMIN" | "OPERADOR" | "DISPENSADOR" | "SOCIO";

/**
 * Roles que son «equipo» y por lo tanto se listan y se crean en Configuración › Equipo.
 * Una sola lista: cuando se agregó DISPENSADOR quedó afuera de la consulta de la pantalla y una cuenta
 * creada no aparecía en ningún lado (el cliente la creó y no la encontró). El test de abajo falla si se
 * agrega un rol y no se suma acá.
 */
export const ROLES_EQUIPO: Rol[] = ["ADMIN", "OPERADOR", "DISPENSADOR"];

export const SECCIONES = [
  "panel",
  "dispensario",
  "turnos",
  "calendario",
  "socios",
  "stock",
  "avisos",
  "traslados",
  "aportes",
  "control",
  "reportes",
  "inspeccion",
  "cierre",
  "cierre-mensual",
  "informe-semestral",
  "configuracion",
] as const;

export type Seccion = (typeof SECCIONES)[number];

/** Lo mínimo para entregar: saber a quién y qué hay. */
const MOSTRADOR: Seccion[] = ["panel", "dispensario", "turnos", "calendario", "socios", "stock", "avisos"];
/** Operador: agrega movimientos de stock, traslados y libros, pero no la configuración del club. */
const OPERADOR: Seccion[] = [...MOSTRADOR, "traslados", "aportes", "control", "reportes", "cierre"];
const ADMIN: Seccion[] = [...SECCIONES];

const POR_ROL: Record<Exclude<Rol, "SOCIO">, Seccion[]> = { ADMIN, OPERADOR, DISPENSADOR: MOSTRADOR };

export function esStaff(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "OPERADOR" || role === "DISPENSADOR";
}

/** ¿Este rol puede abrir esta sección de la consola? */
export function permite(role: string | null | undefined, seccion: Seccion): boolean {
  if (!role || !esStaff(role)) return false;
  return POR_ROL[role as Exclude<Rol, "SOCIO">].includes(seccion);
}

/** Secciones que ve en el menú, en el orden en que las declaramos. */
export function seccionesDe(role: string | null | undefined): Seccion[] {
  if (!role || !esStaff(role)) return [];
  const suyas = POR_ROL[role as Exclude<Rol, "SOCIO">];
  return SECCIONES.filter((s) => suyas.includes(s));
}

/** Traduce la ruta a la sección que la protege: `/stock/abc` → `stock`. La raíz es el panel. */
export function seccionDeRuta(pathname: string): Seccion | null {
  const limpio = pathname.split("?")[0];
  if (limpio === "/" || limpio === "") return "panel";
  const primero = limpio.replace(/^\/+/, "").split("/")[0];
  return (SECCIONES as readonly string[]).includes(primero) ? (primero as Seccion) : null;
}

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "Administración",
  OPERADOR: "Operador",
  DISPENSADOR: "Dispensario",
  SOCIO: "Socio",
};
