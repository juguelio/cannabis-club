# Requerimientos del club — versión escrita

**Origen:** audios y mensajes del grupo «Web republica» entre el 2 y el 17 de noviembre de 2026.
**Para qué:** tener por escrito lo que se pidió, qué está hecho y qué falta decidir, sin depender de volver a escuchar los audios.
**Última actualización:** 17/11/2026 21:10.

Leyenda de estado:

- ✅ **Hecho y en producción** — ya se puede usar.
- 🔧 **Listo, esperando aprobación** — código escrito y verificado, falta el ok para publicar.
- ❓ **Necesita decisión del club** — no se puede avanzar sin una respuesta.
- 📋 **Propuesto** — lo pedimos nosotros a partir del uso real.
- 🕓 **En curso**.

---

## 1. Reservas y dispensario

**R1. La reserva del portal tiene que mostrar qué variedades y cuántos gramos la componen.**
*«Quiero que aparezca una columna que diga gramos 5 g y al lado la genética, para saberlo desde este lugar que es desde donde se le va a imputar.»* (17/11 16:14)
✅ **Hecho.** En Dispensario › Reservas del portal se lee `15 g` y debajo `5 g CBD Therapy · 5 g Lemon Haze · 5 g Northern Lights`. Al atender la reserva, el aviso dice lo mismo. (issues #2 / PR #5)

**R2. Que quien dispensa no tenga que ir a Pedidos ni imputar de memoria.**
*«Yo no quiero que el que va a dispensar tenga que estar tocando cada vez… que tenga una lista y que aparezca.»* (17/11 16:14)
🕓 **En curso (#11).** Hoy ve el desglose, pero sigue eligiendo lote y cantidad a mano entre todas las genéticas. Lo que falta: una fila por variedad, con los lotes filtrados a esa genética y la cantidad ya puesta, y que la reserva se cierre recién cuando la suma la cubre.

**R3. La entrega tiene que coincidir con lo reservado.**
*«Acá se selecciona el stock y la cantidad que selecciona esa persona y debería coincidir.»* (17/11 16:14)
🕓 **En curso (#11).** Si se entrega el total pero de otra variedad, hoy el sistema no lo advierte.

---

## 2. Aportes y comprobantes

**R4. El «esperado» del comprobante tiene que incluir el envío, y ser el mismo número en todas las pantallas.**
*«Dice que declaró 199 y se esperaba 124… lo esperado son los 224 de la transferencia completa, de los cuales 199 corresponden a cultivo.»* (17/11 16:26)
✅ **Hecho.** Un solo cálculo (`aporte + envío`) para Pedidos, Aportes y el portal. El comprobante que cubre el total se lee «Coincide con lo esperado», con el desglose «aporte $199 + envío $25». El monto sugerido en el portal ahora es el total a transferir. (issue #7 / PR #10)

**R5. El comprobante en PDF no se podía abrir.**
*«Cuando voy a ver el PDF, el comprobante, no aparece nada; me salta eso, tanto desde pedidos como desde aportes.»* (17/11 16:26)
✅ **Hecho.** Chrome bloqueaba el visor por una cabecera de seguridad de la propia app. Corregido para comprobantes y documentos del legajo. **Falta que el club lo confirme abriendo uno** (issue #6 / PR #9).

---

## 3. Envíos

**R6. El CP 8370 (San Martín de los Andes) cae en la zona «Interior y resto de la provincia de Buenos Aires».**
(5/11 y 16/11, pedido de prueba de concepto a Neuquén)
❓ **Necesita un dato:** ¿a Neuquén sale lo mismo que al interior de Buenos Aires ($25.000 / 5 días)? Si es igual, es un cambio de nombre de la zona (2 minutos, sin código). Si es distinto, hay que cargar zonas por rango de CP. (issue #1)

**R7. Poder elegir «envío a sucursal».**
*«Que haya otro botón que diga entregamos en su sucursal y que me aparezca la dirección… después nosotros buscamos cuál es su sucursal de Andreani más cercana.»* (17/11 16:18)
❓ **Necesita decisión de alcance:** (a) un tercer modo de entrega que muestre la leyenda y guarde la dirección de la persona, o (b) además, que el sistema resuelva qué sucursal le toca por CP. La (a) es una tarde; la (b) necesita la lista de sucursales o la API de Andreani. (issue #4)

**R8. Reporte de gasto de envíos por destino.**
*«Abajo envíos, y a todo el que puso envíos le suman los 25, para tener una lógica de envíos: a San Martín de los Andes se gastó tanto y se hicieron tantos envíos, a Los Toldos, a Bahía Blanca… Entonces yo digo: socios, ¿quieren esto o ponemos una sede?»* (17/11 16:26 y 16:27)
✅ **Hecho.** En Aportes, debajo de la cola de comprobantes: una fila por destino con envíos, gramos, envío, aporte y total, y el total del período. Tres períodos: este mes, últimos 3 meses, este año. Agrupa por la localidad del socio y sólo cuenta lo despachado. (issue #8 / PR #16)
❓ **Falta decidir** si el envío entra en la caja y si «destino» es la localidad o algo más fino; el reporte muestra envío y aporte separados para que no haya que rehacerlo.

---

## 4. Topes y familia

**R9. Sacar el tope diario y dejar sólo el tope por solicitud.**
*«No hay un límite diario: saquemos ese límite diario y pongamos un límite por solicitud.» … «La persona sí puede dispensarse dos de cuarenta, y si lo puede hacer con dos envíos, que no sea un impedimento.»* (17/11 16:16 a 16:21)
❓ **Necesita el ok de Joaquín** (es una guarda de cumplimiento). El caso real: parejas donde cada uno tiene su REPROCANN mandan dos solicitudes el mismo día; el club despacha una el viernes y otra el lunes, y el tope diario frena la segunda. (issue #3)

**R10. Que una persona pueda hacer un pedido para un familiar (otro REPROCANN).**
*«Serían usuarios distintos, sí o sí, para dos reprocanns… o le asociamos la familia: este otro usuario es mi familia, puede hacer pedidos por él.»* (17/11 16:18)
❓ **Necesita decisión:** ¿cuentas separadas que comparten domicilio (simple de explicar y de auditar), o una cuenta «familia» que administra varios REPROCANN? (issue #3)

**R11. Que al pasar de 40 g el pedido se divida automáticamente en un envío nuevo.**
*«¿Podría simplemente que se le divida en envíos? Que cuando va seleccionando y pasa los 40 le suma otro envío.»* (17/11 16:21)
📋 **Propuesto**, depende de R9/R10. (issue #3)

---

## 5. Lo que falta del lado del club

- ~~Las capturas de «botoncitos que no andan»~~ — **llegaron**: son las 9 fotos y el video del 17/11. De ahí salió un bug real (R12) y la confirmación del envío a Neuquén (R6).
- **Los textos para acompañar** algunas pantallas (*«algunos textos para acompañar algunas cosas»*, 16/11): siguen sin llegar.
- **Padrón a migrar:** ~70 usuarios al 2/11, *«casi 100 en total»* al 17/11. Si se migran, necesitamos el listado en planilla (nombre, DNI, REPROCANN, vencimiento, contacto).
- **Confirmación del PDF:** abrir un comprobante desde Pedidos o Aportes y avisar si se ve (R5).

---

## 6. Errores corregidos que no eran pedidos

**R12. La dirección de entrega repetía localidad y provincia.**
*«Antonio “Niño” Ragussi 279, San Martín de los Andes, Neuquén, San Martín de los Andes, Neuquén, 8370»* (foto del 17/11 16:15)
✅ **Corregido.** El domicilio del padrón ya trae la localidad y la provincia adentro, y la pantalla las volvía a agregar. Ahora se compone sin repetir, también en la lista de socios y en la dirección que va al despacho. (issue #15 / PR #17)

---

## 7. Decisiones que necesitamos para seguir

| # | Pregunta | Issue |
|---|---|---|
| 1 | ¿A Neuquén el envío sale $25.000 / 5 días como al interior de Buenos Aires? | #1 |
| 2 | ¿El envío a sucursal es sólo una leyenda con la dirección del socio, o además hay que resolver la sucursal por CP? | #4 |
| 3 | ¿El costo de envío entra en la caja? ¿Qué destino y qué período muestra el reporte? | #8 |
| 4 | ¿Se saca el tope diario (queda sólo por solicitud)? ¿Cuentas separadas o cuenta familia? | #3 |

Con esas cuatro respuestas se cierra todo lo pedido hasta hoy, salvo R2/R3, que ya están en curso.
