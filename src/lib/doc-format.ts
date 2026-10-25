/** Formato del documento sin dependencias: lo usan también los componentes cliente. */

/** Deja sólo dígitos y letras, en mayúsculas: "30.111.222" y "30111222" son el mismo documento. */
export function normalizeDoc(raw: string): string {
  return raw.replace(/[.\s-]/g, "").toUpperCase();
}

/** Lo que se muestra en pantalla: "DNI ····1234". Nunca el número completo. */
export function maskDoc(last4: string | null | undefined): string {
  return last4 ? `DNI ····${last4}` : "DNI sin registrar";
}
