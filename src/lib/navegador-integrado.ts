/**
 * Navegadores integrados (WebViews) y el ingreso con Google.
 *
 * Google dejó de permitir OAuth desde WebViews embebidos el 30-sep-2021 (`403 disallowed_useragent`): quien
 * toca «Continuar con Google» desde el navegador interno de Instagram, Facebook o TikTok ve «Acceso bloqueado»
 * y no hay nada que el club pueda configurar para evitarlo — la política es del lado de Google.
 *
 * La app no puede arreglar el bloqueo, pero sí evitar que el socio se lo coma sin entender: si detectamos el
 * WebView, se le pide abrir el link en Chrome o Safari antes de mandarlo a Google.
 *
 * Regla pura, para poder probarla sin navegador.
 */

/** Marca de WebView en el User-Agent, con el nombre de la app para poder nombrarla en el aviso. */
const MARCAS: { patron: RegExp; app: string }[] = [
  { patron: /Instagram/i, app: "Instagram" },
  { patron: /FBAN|FBAV|FB_IAB/i, app: "Facebook" },
  { patron: /Messenger/i, app: "Messenger" },
  { patron: /musical_ly|BytedanceWebview|TikTok/i, app: "TikTok" },
  { patron: /Line\//i, app: "LINE" },
  { patron: /LinkedInApp/i, app: "LinkedIn" },
  { patron: /Snapchat/i, app: "Snapchat" },
  { patron: /Twitter/i, app: "X" },
  { patron: /GSA\//i, app: "la app de Google" },
  { patron: /; wv\)/i, app: "el navegador de otra app" },
];

/**
 * ¿Está el usuario en un navegador integrado? Devuelve la app cuando la reconoce.
 *
 * `; wv)` es el marcador genérico de Android WebView: va último porque las apps de arriba también lo traen y
 * conviene nombrarlas por su nombre.
 */
export function navegadorIntegrado(userAgent: string): { integrado: boolean; app: string | null } {
  const ua = userAgent ?? "";
  for (const { patron, app } of MARCAS) if (patron.test(ua)) return { integrado: true, app };
  return { integrado: false, app: null };
}

/**
 * Cómo salir del WebView, según el sistema.
 *
 * En Android hay una salida real (`intent://` abre Chrome). En iOS no existe: sólo se puede copiar el link y
 * pedirle que lo pegue en Safari, así que el aviso tiene que decirlo con esas palabras.
 */
export function comoSalir(esIOS: boolean, url: string): { texto: string; intent: string | null } {
  if (esIOS)
    return {
      texto: "Tocá el botón de compartir (□↑) y elegí «Abrir en Safari». Si no aparece, copiá el enlace y pegalo en Safari.",
      intent: null,
    };
  const limpia = url.replace(/^https?:\/\//, "");
  return {
    texto: "Abrí el menú ⋯ de arriba y elegí «Abrir en el navegador» (o «Abrir en Chrome»).",
    intent: `intent://${limpia}#Intent;scheme=https;package=com.android.chrome;end`,
  };
}
