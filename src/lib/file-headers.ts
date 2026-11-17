/**
 * Cabeceras para servir un archivo guardado: comprobante de pago, documento del legajo, foto.
 *
 * La regla que no es obvia: **un PDF no puede llevar `Content-Security-Policy: sandbox`**. Chromium
 * crea la pestaña bajo las restricciones del sandbox, el visor de PDF interno necesita script y
 * extensiones, y el resultado es `ERR_BLOCKED_BY_CLIENT` (crbug.com/1187122) — lo que el club veía
 * como «no aparece nada» al abrir el comprobante desde Pedidos y desde Aportes. El sandbox se
 * mantiene en las imágenes, y cualquier mime fuera de la lista permitida se sirve como descarga
 * (`octet-stream` + `attachment`) para no perder esa defensa con un archivo que miente el tipo.
 */

export const MIMES_EN_LINEA = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

const EXTENSIONES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Nombre con la extensión del mime real, para que el navegador y el club vean `comprobante.pdf`. */
export function nombreDeArchivo(base: string, mime: string): string {
  const ext = EXTENSIONES[mime];
  return ext ? `${base}.${ext}` : base;
}

export type ArchivoParaServir = {
  mime: string;
  /** Tamaño en bytes del contenido ya descifrado. */
  bytes: number;
  /** Nombre sin comillas ni saltos de línea: va dentro de la cabecera. */
  nombre: string;
};

export function cabecerasDeArchivo({ mime, bytes, nombre }: ArchivoParaServir): Record<string, string> {
  const permitido = (MIMES_EN_LINEA as readonly string[]).includes(mime);
  const tipo = permitido ? mime : "application/octet-stream";
  const limpio = nombre.replace(/["\\\r\n;]/g, "").slice(0, 80) || "archivo";

  const cabeceras: Record<string, string> = {
    "Content-Type": tipo,
    "Content-Length": String(bytes),
    "Content-Disposition": `${permitido ? "inline" : "attachment"}; filename="${limpio}"`,
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };

  // El visor de PDF de Chromium no funciona dentro de un sandbox: ahí la cabecera rompe el archivo.
  if (tipo !== "application/pdf") cabeceras["Content-Security-Policy"] = "default-src 'none'; sandbox";

  return cabeceras;
}
