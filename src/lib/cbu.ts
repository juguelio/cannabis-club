/** Un CBU de 22 dígitos se lee en dos bloques: 8 de banco/sucursal y 14 de cuenta. */
export function formatearCbu(cbu: string | null | undefined): string {
  const limpio = (cbu ?? "").replace(/\D/g, "");
  if (limpio.length !== 22) return cbu ?? "";
  return `${limpio.slice(0, 8)} ${limpio.slice(8)}`;
}
