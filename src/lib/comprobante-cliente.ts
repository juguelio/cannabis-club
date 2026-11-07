/**
 * Lo que se puede validar de un comprobante **antes** de mandarlo.
 *
 * El servidor vuelve a validar (tipo y 6 MB) y esa es la regla que manda; esto evita que el socio
 * espere la subida de un archivo de 30 MB para enterarse de que no entra. Vive aparte del componente
 * para poder probarlo sin navegador.
 *
 * Los iPhone sacan fotos en HEIC, que ningún navegador fuera de Safari sabe leer y el servidor no
 * acepta: se convierte a JPEG en el navegador (Safari sí puede decodificarlo) y, si no se puede, se le
 * dice al socio qué hacer en vez de dejarlo con un «error interno».
 */
export const MAX_BYTES = 6 * 1024 * 1024;
export const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type ArchivoElegido = {
  file: File;
  tipo: string;
  nombre: string;
  /** «1,2 MB», para que el socio vea que eligió el archivo correcto. */
  peso: string;
  /** Data URL para la miniatura; `null` en un PDF. */
  preview: string | null;
};

export type Resultado = { ok: true; archivo: ArchivoElegido } | { ok: false; motivo: string };

const MB = (bytes: number) => `${Math.max(0.1, Math.round((bytes / (1024 * 1024)) * 10) / 10).toString().replace(".", ",")} MB`;

export const esHeic = (tipo: string, nombre: string) =>
  /image\/hei[cf]/i.test(tipo) || /\.(heic|heif)$/i.test(nombre);

/** Regla pura: qué se rechaza y con qué frase. */
export function validarArchivo(nombre: string, tipo: string, bytes: number): { ok: true } | { ok: false; motivo: string } {
  if (bytes === 0) return { ok: false, motivo: "Ese archivo está vacío. Elegí la foto o el PDF del comprobante." };
  if (bytes > MAX_BYTES)
    return {
      ok: false,
      motivo: `El archivo pesa ${MB(bytes)} y el límite es 6 MB. Compartilo más chico (una foto en vez del PDF escaneado) y volvé a intentar.`,
    };
  if (esHeic(tipo, nombre)) return { ok: true };
  const limpio = (tipo || "").toLowerCase().split(";")[0];
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(limpio))
    return {
      ok: false,
      motivo: "Ese formato no sirve: se aceptan fotos (JPG, PNG, WEBP) o PDF.",
    };
  return { ok: true };
}

/** Convierte lo que venga de la cámara a JPEG, que es lo que el servidor acepta. */
async function aJpeg(file: File): Promise<File> {
  const mapa = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = mapa.width;
  canvas.height = mapa.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  ctx.drawImage(mapa, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
  if (!blob) throw new Error("sin blob");
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

export async function validarComprobante(file: File): Promise<Resultado> {
  const previo = validarArchivo(file.name, file.type, file.size);
  if (!previo.ok) return previo;

  let final = file;
  if (esHeic(file.type, file.name)) {
    try {
      final = await aJpeg(file);
    } catch {
      return {
        ok: false,
        motivo:
          "Tu iPhone sacó la foto en HEIC y este navegador no la puede convertir. Probá «Captura o PDF», o en Ajustes → Cámara → Formatos elegí «Más compatible».",
      };
    }
  }

  const tipo = final.type || "application/octet-stream";
  if (tipo.startsWith("image/") && tipo !== "image/heic") {
    const preview = await new Promise<string | null>((res) => {
      const lector = new FileReader();
      lector.onload = () => res(typeof lector.result === "string" ? lector.result : null);
      lector.onerror = () => res(null);
      lector.readAsDataURL(final);
    });
    return { ok: true, archivo: { file: final, tipo, nombre: final.name, peso: MB(final.size), preview } };
  }

  return { ok: true, archivo: { file: final, tipo, nombre: final.name, peso: MB(final.size), preview: null } };
}
