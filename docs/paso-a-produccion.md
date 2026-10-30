# Pasar de demo a producción

Estado al 29-oct-2026. Producción (`cannabis-club-mauve.vercel.app`, Neon `neondb`) está **vacía de datos** y con la
**configuración todavía de demo**. Nada de esto se puede inventar: son datos del club o cuentas del club.

## 1 · Bloqueantes legales (sin esto no se puede entregar nada)

Hoy producción tiene `CUIT 30-00000000-0`, `REPROCANN-DEMO-0001`, `VINC-DEMO-2026`, «Dra. Demo (mat. 0000)». Eso se imprime
en etiquetas, libros y en el informe semestral que va al Ministerio.

| Dato | Dónde se carga | Para qué |
|---|---|---|
| Razón social exacta y CUIT | Configuración › Datos legales | Libros y comprobantes |
| Personería jurídica (número y fecha) | Datos legales | Informe semestral |
| REPS | Datos legales | Inspección |
| Domicilio legal | Datos legales | Informe semestral |
| Inscripción del club en el REPROCANN (número y código de vinculación) | Club y reglas + Datos legales | Autorización de cultivo |
| Director médico: nombre y matrícula | Datos legales | Res. 1780/2025 |
| Responsable técnico: nombre y título | Datos legales | Res. 1780/2025 |
| Aporte por gramo y cuota social | Club y reglas | Prorrateo de costos (hoy $1.200/g y $8.000/mes, de demo) |
| Topes diario/mensual, edad mínima y límite de menores | Club y reglas | Validación de cada entrega |
| Email institucional y emblema | Marca y sitio | Pie de página y credenciales |

## 2 · Cuentas y accesos

- **Email real del administrador** (hoy `admin@club.test`, que es de prueba) y del dispensador. Se crean en
  Configuración › Equipo; la cuenta de prueba se apaga después.
- **Dominio propio**: el proyecto no tiene ningún dominio apuntado, así que el sitio vive en `cannabis-club-mauve.vercel.app`.
  Hace falta el dominio y acceso al DNS. Al conectarlo hay que sumar el nuevo `redirect_uri` en Google Cloud
  (`https://<dominio>/api/auth/google/callback`) y actualizar `APP_BASE_URL`.
- **Google login**: hoy funciona con el dominio de Vercel (verificado: Google acepta el client y el redirect).

## 3 · Servicios que faltan

| Falta | Consecuencia | Qué necesito |
|---|---|---|
| `RESEND_API_KEY` + `CLUB_MAIL_FROM` | El alta, el rechazo y los avisos no mandan email (la app funciona igual, avisa «sin configurar») | Cuenta de Resend verificada y el remitente (ej. `hola@dominio`) |
| Cron de retención | Los documentos de solicitudes rechazadas no se purgan a los 30 días como promete la política | Crear `vercel.json` + `CRON_SECRET` |
| Respaldo automático | Hoy hay respaldo manual; Neon tiene PITR en planes pagos | Plan de Neon o un export diario |

## 4 · Configuración de operación

- **Horarios de retiro**: hay 6 reglas y 1 día cerrado cargados; confirmar que sean los reales.
- **Variedades con foto**, primer lote y primera entrega de prueba antes de abrir.
- **Sitio público**: ya está publicado con los textos del cliente y el espacio del catálogo reservado.

## 5 · Decisiones que no bloquean el día 1

- **Pago online** del aporte/cuota (Mercado Pago): hoy la cuenta corriente se registra a mano.
- **Consulta médica de $50.000**: figura como paso en el sitio, no como flujo con turno y pago en la app.
- **Envíos**: la app registra envíos; falta la integración con Andreani (etiqueta y seguimiento).
- **Demo para mostrar**: los previews están protegidos (307 al SSO); publicarla es decisión del club.

## 6 · Prueba de aceptación antes de dar la llave

Con los datos reales cargados, un recorrido completo y después se borra: alta de un socio de prueba con documentos,
aprobación, carga de un lote y liberación, entrega en el dispensario (tope y REPROCANN validados), anulación por ADMIN,
cierre mensual firmado, informe semestral en PDF, y retiro con el rol DISPENSADOR.
