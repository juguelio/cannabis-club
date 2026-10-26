// Sin `server-only`: es criptografía pura y los tests la importan directo.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Archivos del legajo cifrados en reposo (AES-256-GCM).
 * La base guarda ciphertext + iv + tag; la clave vive en el entorno (nunca en el repo),
 * igual que DOC_HASH_KEY. Si la clave cambia, los archivos viejos dejan de abrirse: no se rota
 * sin un plan de re-cifrado.
 */

export const MAX_DOC_BYTES = 6 * 1024 * 1024;
export const DOC_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type DocTipo = "DNI_FRENTE" | "DNI_DORSO" | "REPROCANN";
export const DOC_TIPOS: DocTipo[] = ["DNI_FRENTE", "DNI_DORSO", "REPROCANN"];
export const DOC_TIPO_LABEL: Record<DocTipo, string> = {
  DNI_FRENTE: "DNI (frente)",
  DNI_DORSO: "DNI (dorso)",
  REPROCANN: "Credencial REPROCANN",
};

const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.DOC_ENC_KEY;
  if (!raw) throw new Error("DOC_ENC_KEY no está configurada");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DOC_ENC_KEY debe ser de 32 bytes en base64");
  return buf;
}

export const docsKeyConfigured = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

export function encryptDoc(plain: Buffer) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { data, iv, tag: cipher.getAuthTag() };
}

export function decryptDoc(input: { data: Buffer | Uint8Array; iv: Buffer | Uint8Array; tag: Buffer | Uint8Array }) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(input.iv));
  decipher.setAuthTag(Buffer.from(input.tag));
  return Buffer.concat([decipher.update(Buffer.from(input.data)), decipher.final()]);
}

export function encryptText(plain: string) {
  const { data, iv, tag } = encryptDoc(Buffer.from(plain, "utf8"));
  return Buffer.concat([iv, tag, data]);
}

export function decryptText(packed: Buffer | Uint8Array) {
  const buf = Buffer.from(packed);
  return decryptDoc({ iv: buf.subarray(0, IV_BYTES), tag: buf.subarray(IV_BYTES, IV_BYTES + 16), data: buf.subarray(IV_BYTES + 16) }).toString("utf8");
}

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/** Extensión razonable para guardar con el mime correcto al servir. */
export function docExtension(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "pdf";
}
