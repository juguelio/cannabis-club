# REA · Cómo ordenan y envían los clubes y dispensarios que lo hacen bien

**Encargo:** Iván probó pedir desde el portal y el sistema no le gustó. Su crítica, textual: no tiene
flujo, quiere algo más de carrito, y no hay información de envío estipulada.

**Método REA** (observado / inferido / decisión de producto). Nada de esto se copia: se copia el
*orden de los pasos*, que es lo que hace que un checkout se sienta un checkout.

Fecha: 5-nov-2026.

---

## 1. Observado (con fuente)

### Dris (Nueva York) — el checkout más explícito de los cuatro

Fuente: `drisbrands.com/menu/help/how-to-order`.

Pasos, en sus palabras: *«Build your bag at drisbrands.com/menu, sign in with a one-time code, enter
your address, pick a delivery window and upload your ID once.»*

- **Bag con contador**: «Your bag keeps a running total and **tells you how much more you need if
  you're under our $50 minimum**». El mínimo no se descubre al final: el carrito te dice cuánto falta.
- **Envío $4, gratis desde $100** (después de descuentos, antes de impuestos).
- **Login sin contraseña**: código de un solo uso.
- **Ventana de entrega** elegida por el cliente, no «en 48 h» a secas.
- **Documento se sube una vez** y queda; en la puerta se controla contra lo subido.
- **No se paga online**: se paga en la puerta, efectivo o débito.

### Doobiez (Nueva Jersey) — la página de envíos como contrato

Fuente: `doobiez.com/delivery`.

- **Tres pasos numerados** en la propia página de envíos: agregar al carrito y elegir Delivery →
  ingresar dirección → el equipo contacta para agendar el horario.
- **Mínimo $50, sin costo de envío.**
- **Cobertura por condado**, escrita (Hudson, Sussex, Essex, Morris, Passaic, Bergen) y con una
  salida para el que está afuera: «si no estás en la zona, llamanos».
- Requisito explícito: **dirección residencial privada** en NJ.

### Eaze (California) — elegibilidad antes que catálogo

Fuente: `help.eaze.com` (signup y FAQ de pedidos).

- **Verificación de edad y dirección ANTES del menú**: sin dirección válida no se navega, porque el
  catálogo depende de qué dispensario puede entregar ahí.
- Límite diario explícito en la FAQ (28,5 g de flor / 8 g de concentrado por día).
- **Página propia que explica por qué hay costo de envío** (seguro, soporte, operación) y cuándo es
  gratis por mínimo alcanzado.

### California (regulador) — la entrega deja rastro

Fuente: `cannabis.ca.gov`, record-keeping y track-and-trace para entregas.

Cada viaje tiene un **ledger de inventario**: qué salió, a qué hora salió el vehículo, a qué hora y
en qué condado se entregó, qué se vendió y a qué precio. Vehículo cerrado y conductor empleado del
comercio. La entrega no es sólo un estado en la base: es un registro por pedido.

### Alemania (KCanG) — el contraejemplo que ordena todo

Fuente: resumen de KCanG (CannDelta), contrastado con FAQ de clubs.

- Los clubes de cultivo **no pueden enviar ni entregar** cannabis a sus socios: **el retiro es
  presencial en el club**.
- Límites: **25 g/día y 50 g/mes** (menores de 21: 30 g/mes con menos de 10 % THC).
- Sin consumo en el club ni a 100 m, sin publicidad.

**Lo que esto significa para nosotros:** el envío a domicilio no es «el estándar internacional del
club»; es una facilidad de acceso que Argentina permite y Alemania prohíbe. Los referentes de
*checkout* son los dispensarios médicos de USA; los referentes de *gobierno del club* son los CSC
europeos. Nuestro flujo tiene que parecerse a los primeros y rendir cuentas como los segundos.

---

## 2. Inferido (qué hace que se sienta un carrito)

1. **La elegibilidad va primero.** Dris pide usuario; Eaze pide dirección. Ninguno te deja armar un
   pedido que después no puede entregar. Nosotros hoy dejamos armar el combo y recién al final
   aparece el código postal faltante (o el envío sin zona).
2. **El mínimo y el costo se ven mientras se arma**, no en el último paso. El carrito que avisa
   «te faltan 15 g para el envío» es el mismo dato que evita el pedido rechazado.
3. **La entrega es una elección con nombre y precio**: ventana o día, zona con su demora y su costo.
   «Menos de 48 h» es un cartel, no una opción.
4. **Una sola verificación de identidad, temprana.** En Dris el documento se sube una vez y en la
   puerta sólo se controla. En nuestro caso el equivalente es la validación del legajo (ya existe).
5. **La entrega deja registro propio**, como en California: quién lo llevó, cuándo salió, cuándo
   llegó. Hoy tenemos el pedido y la dispensación, pero el envío no tiene su bitácora.
6. **El pago no sorprende**: Dris cobra en la puerta y lo dice arriba. Nosotros cobramos por
   transferencia con comprobante aprobado; eso tiene que estar dicho en el resumen, no en un correo
   posterior.

---

## 3. Estado real de la app (verificado, no supuesto)

| Pieza | Estado |
|---|---|
| Zonas de envío con precio y demora | **Sí**, en `Club.precios.envios` de producción: CABA $20.000, GBA 1.er cordón $25.000, GBA 2.º cordón $25.000, Interior $25.000 (Andreani). |
| Selector de zona + dirección en el portal | **Sí**, dentro del bloque «¿Cómo lo recibís?». |
| Costo del envío en el resumen | **Sólo al confirmar**: se congela en la reserva y se ve después en «Tus reservas». |
| Mínimo por envío | **No existe**. Hay máximo (`topeEnvioG`, 40 g), que es otra cosa. |
| Fecha o ventana de envío | **No existe**: la demora es texto fijo por zona. |
| Chequeo de cobertura por código postal | **No existe**: la zona se elige a mano, sin validar que el CP corresponda. |
| Página de envíos en el portal | **No existe**. En el sitio público hay sección `#envios` con texto de marca. |
| Registro de entrega del envío | **Parcial**: la reserva guarda zona, costo, demora y transportista; no hay bitácora de salida/entrega. |
| Pago | Transferencia + comprobante aprobado por el club (sin pasarela, por decisión). |

**Diagnóstico:** Iván no llegó a ver la información de envío porque **no está donde se decide**: el
costo aparece recién al confirmar, el mínimo no existe y la demora es un cartel. Y el bloqueo anterior
(el código postal) lo dejó afuera del flujo justo antes de esa pantalla.

---

## 4. Decisión de producto

Seis cambios, en orden de impacto sobre lo que Iván sintió. Ninguno copia precios ni venta: el club
prorratea costos de cultivo y el envío es un costo logístico, no un precio de producto.

**1 · Chequeo de cobertura antes de armar el pedido.** El socio carga su código postal una vez (ya
tiene «Mis datos») y el portal le dice, arriba del catálogo: «Enviamos a tu zona: Interior, $25.000,
5 días hábiles» o «No llegamos con transporte propio: retiro en sede». Sin esto, todo lo demás es
decoración.

**2 · El carrito dice cuánto falta.** Mínimo por envío configurable (propuesta: 1 membresía = 10 g,
que es la unidad de retiro). El resumen muestra «te faltan 5 g para poder enviarlo» en vez de dejar
el botón apagado sin explicación.

**3 · Costo del envío visible en el resumen, siempre.** Zona elegida → línea «Envío a Interior:
$25.000» junto al aporte estimado. Y el total a cubrir, que hoy no se ve junto.

**4 · Ventana en lugar de demora.** Dos o tres fechas de despacho reales (el club despacha martes y
jueves, por ejemplo), no «menos de 48 h». Es lo que hace Dris y es lo que permite al socio elegir.

**5 · Página «Envíos» en el portal**, con lo de Doobiez: zonas, costos, demoras, mínimo, qué pasa si
no hay nadie, qué documento lleva el transportista, y qué **no** se puede mandar.

**6 · Bitácora del envío.** Salida, transportista, número de seguimiento, entrega o rechazo, con
usuario y hora. Como California: el envío no es un estado, es un registro.

**Lo que NO se copia, y por qué:**

- **Pago con tarjeta en el checkout.** Acá el aporte se transfiere y el club aprueba el comprobante.
  La pasarela convertiría el flujo en una venta, que es exactamente lo que la app no es.
- **Precios por producto.** El catálogo no lleva precio; el aporte se prorratea por gramo y se
  congela al reservar.
- **Entrega sin verificación previa.** En Alemania ni siquiera existe el envío; acá existe, pero sólo
  al socio con legajo verificado y REPROCANN vigente.

---

## 5. Plan en tres cortes

> **Corte 1: hecho el 5-nov-2026.** Mínimo de envío **5 g** (decisión del club), cobertura por código
> postal en el portal y en la página «Envíos», costo del envío y total a cubrir en el resumen, y la
> puerta del servidor (`ENVIO_MINIMO`) para que la regla no viva sólo en la pantalla.

**Corte 1 — que se vea (medio día).**
Cobertura por CP en el resumen, costo del envío en el resumen, mínimo por envío con «te faltan N g»,
y página «Envíos» del portal con las cuatro zonas de producción.
*Aceptación:* un socio con CP 8370 ve antes de armar el combo que su zona es Interior, $25.000, 5 días
hábiles; y si arma 5 g ve «te faltan 5 g» en lugar de un botón muerto.

**Corte 2 — que se elija (un día).**
Fechas de despacho reales por zona, elegidas por el socio; la reserva congela la fecha.
*Aceptación:* la reserva guarda la fecha de despacho pedida y el club la ve en su panel.

**Corte 3 — que se pueda auditar (un día).**
Bitácora del envío: salida, transportista, seguimiento, entrega o rechazo.
*Aceptación:* cada envío entregado tiene su registro con hora y responsable, y el libro del semestre
puede nombrarlo.

---

## 6. Riesgos

- **Que el checkout parezca e-commerce.** Toda la estética del carrito invita a leer «compra». El
  texto tiene que seguir diciendo aporte prorrateado, y el botón no puede decir «Comprar».
- **Publicar mínimos que el club no sostiene.** Un mínimo de 10 g tiene que ser decisión del club y
  estar en la configuración, no en el código.
- **Prometer plazos que el transportista no cumple.** La ventana es de *despacho*, no de entrega, y
  así hay que escribirlo.
- **CP y zona desalineados.** Si el socio escribe un CP de otra provincia, la zona tiene que cambiar
  sola o avisar; nunca dejarlo elegir Interior con dirección de CABA sin decirlo.
