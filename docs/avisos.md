# Avisos a socios — por qué la app no manda WhatsApp

El club necesita avisar: REPROCANN por vencer, reservas sin retirar, cuenta con saldo, consentimiento
pendiente, documento sin verificar. Eso no es marketing: es lo que evita que un socio llegue al mostrador
y se vaya sin poder retirar.

## Lo que hace la app

`/avisos` es una **cola priorizada**: primero lo que bloquea una entrega (REPROCANN vencido), después lo
que hay que regularizar. Para cada aviso:

- **Prepara el mensaje** a partir del motivo (no se redacta cada vez, no se improvisa).
- **Abre WhatsApp** con el texto ya escrito (`wa.me/<celular>?text=…`). El mensaje lo manda una persona,
  desde su propio WhatsApp.
- **Registra el aviso** en `NoticeLog` (append-only): motivo, canal, quién lo hizo y cuándo. El tablero
  muestra el último aviso y permite filtrar por «sin avisar», así nadie recibe el mismo reclamo dos veces.

## Lo que la app no hace (y por qué)

**No envía mensajes sola.** Mandar WhatsApp de forma automática requiere la API de WhatsApp Business:
cuenta verificada del club, número dedicado y plantillas aprobadas por Meta. Eso es una decisión y un
trámite del club, no una línea de código. Mientras no exista:

- nada de "envíos automáticos" en la UI, porque un botón que promete enviar y no envía destruye la confianza;
- el aviso queda registrado igual, así el club puede mostrar que avisó.

Cuando el club tenga la API, el reemplazo es directo: `NoticeLog` ya guarda qué se avisó, por qué canal y
quién; sólo cambia quien hace el envío.

## Criterios de la cola

| Motivo | Cuándo aparece | Severidad |
|---|---|---|
| REPROCANN vencido | estado distinto de vigente, o fecha pasada | urgente |
| REPROCANN por vencer | vence en ≤ 30 días | aviso |
| REPROCANN sin fecha | vigente sin vencimiento cargado | aviso |
| Consentimiento pendiente | falta `DATOS_PERSONALES` vigente | aviso |
| Documento sin verificar | el padrón no tiene la huella | aviso |
| Reserva sin retirar | reserva abierta hace ≥ 3 días | aviso |
| Cuenta con saldo | saldo > 0 | aviso |

Los socios de baja no reciben avisos. Los suspendidos sí: pueden regularizar.

## Dónde se consulta

La cola se trabaja en pantalla, en el mostrador. Lo que sí conviene tener en papel es la lista de REPROCANN
por vencer, que sale del padrón filtrado (`/socios?filtro=reprocann`).

## Pendiente

1. **API de WhatsApp Business** (gate del club: cuenta, número, plantillas).
2. **Avisos automáticos programados** (un cron que llene la cola sin que nadie abra la pantalla): hoy la
   cola se calcula al abrir, que es suficiente para un club de 200 socios.
3. **Registro de respuestas**: hoy se registra el aviso, no la respuesta del socio.
