import type { Role } from "@prisma/client";

export const secciones = {
  resumen: "Resumen", datos: "Datos del socio", documentacion: "Documentación", consentimientos: "Consentimientos",
  pedidos: "Pedidos", envios: "Envíos", turnos: "Turnos", entregas: "Entregas",
  cuenta: "Cuenta corriente", cambios: "Cambios del legajo", avisos: "Avisos",
} as const;

export type Seccion = keyof typeof secciones;
export const grupos: { nombre: string; items: Seccion[] }[] = [
  { nombre: "Legajo", items: ["resumen", "datos", "documentacion", "consentimientos"] },
  { nombre: "Operación", items: ["pedidos", "envios", "turnos", "entregas"] },
  { nombre: "Administración", items: ["cuenta", "cambios", "avisos"] },
];

export function puedeVer(role: Role, seccion: Seccion) {
  if (role === "ADMIN") return true;
  if (role === "SOCIO") return false;
  if (seccion === "cuenta") return role === "OPERADOR";
  return ["resumen", "datos", "consentimientos", "entregas", "cambios"].includes(seccion);
}

export function rutaLegajo(id: string, seccion: Seccion, pagina = 1) {
  return `/socios/${id}${seccion === "resumen" ? "" : "/" + seccion}${pagina > 1 ? "?pagina=" + pagina : ""}`;
}

export function paginaLegajo(valor?: string) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n <= 100000000 ? n : 1;
}
