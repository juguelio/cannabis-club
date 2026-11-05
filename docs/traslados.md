# Traslados — cuando el paciente no retira en sede

El club entrega a distancia: pacientes de la zona y de localidades vecinas,
y en agosto de 2026 hizo el primer traslado aéreo autorizado de materia vegetal del país. Hasta ahora la app
**no sabía representar eso**: todo el dispensario suponía mostrador.

## Cómo funciona

1. **Se abre el traslado** (`/traslados` → «Nuevo traslado»): cómo viaja (aéreo/terrestre), desde dónde, a dónde,
   quién lo lleva con su documento, fecha prevista y — si corresponde — la constancia del **aviso previo a la
   autoridad** (Res. 1780/2025).
2. **Se cargan los pacientes**: socio, lote y gramos. Cada ítem tiene su **DDJJ**: se marca cuando el paciente firma.
3. **Se despacha**: si falta una sola DDJJ, **no sale** (`422 SHIPMENT_INCOMPLETE`, con el motivo escrito). A partir
   de acá la lista de pacientes queda congelada.
4. **Se entrega**: cada ítem pasa por `dispense()`, es decir por **todos** los controles del dispensario (REPROCANN,
   topes diario y mensual, lote liberado, recall, stock) y deja **asiento en el libro** con su `limitSnapshot`.
5. **Remito** (`/traslados/<id>/remito`): hoja imprimible que viaja con la materia vegetal, con paciente, legajo,
   lote, variedad, gramos, DDJJ y firmas. Sin datos clínicos ni de contacto.

## Decisiones que no son obvias

- **El traslado no mueve stock.** No crea un movimiento propio: entregar es dispensar. Si el traslado descontara
  stock, el libro tendría dos asientos por la misma entrega y el tope del socio se podría esquivar despachando.
- **Se entrega al llegar, no al salir.** La cuota del socio se consume cuando recibe, no cuando el paquete sale.
  Eso deja un estado real: `DESPACHADO` con ítems pendientes, y el panel lo muestra así.
- **La entrega no es atómica a propósito.** Si un paciente no puede recibir (REPROCANN vencido, tope alcanzado,
  lote retirado), los demás se registran igual y el que falló queda informado con su motivo. Un traslado de seis
  pacientes no se cae por uno; lo que no se hace es mentir diciendo que se entregó todo.
- **El estado no se toca a mano.** No hay botón «marcar entregado»: `ENTREGADO` lo escribe el sistema cuando todos
  los ítems tienen dispensa. Si no, queda `DESPACHADO`.
- **Cancelar sólo antes de entregar.** Con entregas registradas hay que anular cada entrega (contra-asiento), porque
  el libro no se borra.

## Episodios de aviso (lo que cambió en el mismo lote)

Un aviso pertenece a un **hecho concreto**: un vencimiento con esa fecha, esa reserva, ese saldo, ese estado. Antes,
avisar una vez silenciaba el motivo para siempre y un problema nuevo quedaba tapado por el aviso viejo.

| Motivo | Episodio |
|---|---|
| REPROCANN vencido / por vencer | la fecha de vencimiento |
| REPROCANN no vigente | el estado (en trámite, rechazado, sin declarar) |
| Reserva sin retirar | el id de la reserva |
| Cuenta con saldo | el monto |
| Consentimiento / documento | el estado |

El registro sigue siendo **declaración del operador**, no prueba de entrega: el texto de la pantalla lo dice
(«Ya lo avisé»). Registrar preparación y respuesta del socio queda pendiente.

## Lo que todavía no hace

1. **Adjuntar la DDJJ escaneada** o la constancia del aviso: hoy se registra la fecha y una nota.
2. **Reservar gramos para el traslado**: si dos traslados salen con el mismo lote y no alcanza, el segundo falla al
   entregar, no al prepararse.
3. **Notificar al paciente** que su envío salió: el texto existe (columna de avisos), pero no hay aviso automático
   por traslado.
4. **Manifiesto por transportista** (varios envíos en un mismo viaje): hoy un traslado = un viaje.
5. **Firma digital del remito**: se imprime y se firma a mano.
