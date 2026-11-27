export const archivosLegajo = {
  PERFIL: "Foto de perfil",
  DNI_FRENTE: "DNI (frente)",
  DNI_DORSO: "DNI (dorso)",
  REPROCANN: "Credencial REPROCANN",
} as const;
export type ArchivoLegajo = keyof typeof archivosLegajo;

// El cuerpo completo debe entrar en una función de Vercel (4,5 MB).
export const limiteArchivoLegajo = 4 * 1024 * 1024;
