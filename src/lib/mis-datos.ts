/**
 * Los datos que el socio puede corregir solo.
 *
 * Hay dos clases de datos en el legajo y no se tocan igual:
 *
 * - **Identidad** (nombre, apellido, DNI, número y vencimiento del REPROCANN): la valida el club
 *   contra el documento y la credencial. Si el socio pudiera editarla, la verificación no
 *   significaría nada.
 * - **Operativos** (domicilio, localidad, provincia, código postal, teléfono): cambian por mudanza o
 *   por un número nuevo, y el envío no sale sin ellos. Hacerlo pasar por la secretaría es lo que
 *   dejó a un socio verificado sin poder pedir: el portal le decía «completalos en Validá tus datos»
 *   y esa pantalla no existía para él, porque ya estaba verificado.
 *
 * Tocar el domicilio no invalida la verificación: el DNI y la credencial siguen siendo los mismos.
 */
import { normalizarCp } from "./verificacion-rules";

export type DatosOperativos = {
  address: string | null;
  locality: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
};

export type CampoDatos = keyof DatosOperativos;

export type ProblemaDato = { campo: CampoDatos; mensaje: string };

const limpio = (v: string | null | undefined) => (v ?? "").trim();

/** Vacío se guarda como `null`: «no lo tengo» y «no lo toqué» no son lo mismo que una cadena vacía. */
const oNulo = (v: string) => (v.length ? v : null);

/**
 * Valida y normaliza. No exige nada: el socio que sólo retira en el club no necesita domicilio para
 * existir. Lo que sí hace es no aceptar un domicilio a medias —la calle sin número, el código postal
 * truncado—, porque eso se descubre cuando el paquete ya salió.
 */
export function normalizarDatosOperativos(
  input: Partial<Record<CampoDatos, string | null>>,
): { ok: true; datos: DatosOperativos } | { ok: false; problemas: ProblemaDato[] } {
  const problemas: ProblemaDato[] = [];

  const address = limpio(input.address);
  if (address.length > 0 && (address.length < 5 || !/\d/.test(address)))
    problemas.push({ campo: "address", mensaje: "Poné la calle y el número (por ejemplo, Los Notros 195)." });

  const locality = limpio(input.locality);
  if (locality.length > 0 && locality.length < 3)
    problemas.push({ campo: "locality", mensaje: "La localidad está incompleta." });

  const province = limpio(input.province);
  if (province.length > 0 && province.length < 3)
    problemas.push({ campo: "province", mensaje: "La provincia está incompleta." });

  const cpCrudo = limpio(input.postalCode);
  const postalCode = cpCrudo.length ? normalizarCp(cpCrudo) : null;
  if (cpCrudo.length && !postalCode)
    problemas.push({ campo: "postalCode", mensaje: "El código postal son 4 números (por ejemplo, 8370)." });

  const phone = limpio(input.phone);
  if (phone.length > 0 && phone.replace(/\D/g, "").length < 6)
    problemas.push({ campo: "phone", mensaje: "El teléfono no parece completo." });

  if (problemas.length) return { ok: false, problemas };

  return {
    ok: true,
    datos: {
      address: oNulo(address),
      locality: oNulo(locality),
      province: oNulo(province),
      postalCode: oNulo(postalCode ?? ""),
      phone: oNulo(phone),
    },
  };
}

/** Sin calle y sin código postal no hay envío: el paquete no se despacha con media dirección. */
export const faltaParaEnvio = (d: Pick<DatosOperativos, "address" | "postalCode">) => !d.address || !d.postalCode;

/** Sólo lo que efectivamente cambió: la auditoría tiene que poder leerse. */
export function cambios<D extends Record<string, unknown>>(antes: D, despues: Partial<D>) {
  const salida: Partial<D> = {};
  for (const [k, v] of Object.entries(despues)) {
    if (antes[k] !== v) salida[k as keyof D] = v as D[keyof D];
  }
  return salida;
}
