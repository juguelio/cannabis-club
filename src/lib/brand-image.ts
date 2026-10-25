import { unprocessable } from "./errors";
import { IMAGE_KINDS, IMAGE_MIME, type ImageKind } from "./brand";

/**
 * Imágenes de marca: llegan como data URL (el editor ya las achica en el navegador) y se guardan así.
 * Acá se valida que sean de verdad lo que dicen ser: tipo permitido, firma binaria coherente y tamaño.
 * SVG queda afuera a propósito: servido desde nuestro dominio puede ejecutar código.
 */

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type DecodedImage = { mime: (typeof IMAGE_MIME)[number]; bytes: Buffer };

function sniff(bytes: Buffer): DecodedImage["mime"] | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function decodeDataUrl(value: string): DecodedImage | null {
  const m = DATA_URL.exec(value);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  const real = sniff(bytes);
  if (!real || real !== m[1]) return null;
  return { mime: real, bytes };
}

/** Valida una imagen entrante; devuelve el data URL tal cual o lanza un 422 legible. */
export function validateBrandImage(kind: ImageKind, value: string): string {
  const spec = IMAGE_KINDS[kind];
  const decoded = decodeDataUrl(value);
  if (!decoded) throw unprocessable("INVALID_IMAGE", `${spec.label}: tiene que ser PNG, JPG o WebP.`);
  if (decoded.bytes.length > spec.maxBytes) {
    throw unprocessable("IMAGE_TOO_LARGE", `${spec.label}: pesa ${Math.round(decoded.bytes.length / 1024)} KB, el máximo es ${Math.round(spec.maxBytes / 1024)} KB.`);
  }
  return value;
}
