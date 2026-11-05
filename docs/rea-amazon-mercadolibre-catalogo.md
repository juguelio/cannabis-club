# REA · Amazon y Mercado Libre: cómo se ordena un pedido (y por qué el nuestro no se siente uno)

**Encargo:** «tenemos que cambiar esa página… hace un REA de Amazon, MercadoLibre… no me gusta cómo quedó».

**Método REA.** Lo que sigue distingue **observado** (medido en el navegador o en documentación),
**inferido** (lo que se deduce del patrón) y **decisión de producto** (qué hacemos nosotros).

Fecha: 5-nov-2026.

---

## 0. El problema, medido antes de mirar afuera

`/portal` mide **6165 px de alto a 1440×900: 6,8 pantallas**, con **seis paneles** apilados:

> Variedades del club · Tu pedido · Mis pedidos · Lo que retiraste · Privacidad y permisos · Tu documentación

El carrito y el catálogo comparten página con el carnet, el historial y los consentimientos. El socio
elige una cepa arriba, arma el combo en el medio y confirma abajo, con cuatro paneles de por medio si
se distrae. Eso no es un problema de estilos: es un problema de arquitectura de página.

---

## 1. Observado

### Amazon — carrito real, medido en el navegador (5-nov-2026)

Agregué un producto real a un carrito de Amazon y medí el DOM. No es una descripción de manual:

| Dato | Valor |
|---|---|
| Ancho de la lista de ítems | **1084 px** sobre un viewport de 1440 (75 %) |
| Alto del bloque de lista | 423 px para **un** ítem |
| Estructura | lista a la izquierda, **columna de resumen a la derecha** |
| Cabecera de la lista | `Shopping Cart` · `Deselect all items` · etiqueta `Price` |
| Por ítem | imagen, **título completo sin truncar**, `by <vendedor>`, precio grande, **precio unitario** (`$0.27 / fluid ounce`), rating, selector de cantidad |
| Cantidad | selector + botón **`Update`** explícito (no autoguarda) |
| Acciones secundarias | fila separada debajo: `Delete`, `Save for later`, `Compare with similar items` |
| Subtotal | **dos veces**: `Subtotal (1 item): $39.00` arriba de la lista y repetido en el panel derecho |
| CTA | **uno solo**, primario, en el panel derecho: `Proceed to checkout` |
| Secciones | `Active items` / `Saved for later` / `Buy it again` + recomendaciones |
| Etiquetado | todo con texto; no hay iconos sin palabra |

**Lo que esto dice del patrón:** el carrito es una **pantalla propia** con jerarquía de tres niveles
(cantidad → precio → total), el resumen siempre visible a la derecha, un único botón que avanza, y las
acciones destructivas o diferidas (borrar, guardar para después) **separadas** del CTA para que no se
toquen por error. El precio unitario al lado del total existe porque el socio compara por gramo/unidad,
no por paquete.

### Mercado Libre — no se pudo observar en vivo (y se dice)

Intenté `/cart`, una ficha de producto y el centro de ayuda, en navegador en la nube y en copia del
perfil local: **Mercado Libre devuelve su página anti-bot** («Hubo un error accediendo a esta página»)
en todas las variantes. No voy a describir su UI como si la hubiera visto.

Lo único que puedo sostener como **inferido de su comportamiento público conocido** —y que hay que
confirmar con una captura del usuario antes de tomarlo como fuente—:

- Carrito como **drawer lateral** al agregar, con `Ver carrito` y `Seguir comprando`.
- Checkout en **pasos numerados** (entrega → pago → confirmación) con resumen persistente.
- **Envío gratis por umbral** y su variante «te faltan $X», que es la misma mecánica que ya copiamos
  para el mínimo de gramos.
- **Compra protegida** como bloque de confianza junto al CTA, no enterrado en los términos.

Si querés que ML entre al REA como evidencia dura, necesito que abras una ficha y el carrito y me
pases dos capturas (ficha y carrito). Con eso lo paso de inferido a observado.

---

## 2. Inferido — los cinco principios que hacen que un pedido se sienta un pedido

1. **Una responsabilidad por pantalla.** Catálogo, carrito y confirmación no comparten página.
   Nosotros tenemos los tres en una de 6,8 pantallas.
2. **El resumen nunca se va de la vista.** En Amazon está fijo a la derecha mientras la lista scrollea.
   Nuestro total vive al final de un panel que queda lejos del catálogo.
3. **Una sola acción primaria.** Amazon tiene un botón que avanza; todo lo demás es secundario o está
   en otra fila. Nuestro panel mezcla confirmar, cancelar, comprobante y estado de pago.
4. **El ítem se explica solo.** Título completo, precio unitario y cantidad editable con confirmación
   explícita. Nuestro renglón dice «5 g · Lemon Haze», sin precio por gramo al lado.
5. **Lo que se guarda para después no se mezcla con lo activo.** Amazon separa `Saved for later` de
   `Active items`. Nuestro «Mis pedidos» mezcla activos y cerrados en la misma lista (hoy con filtros,
   que es un parche razonable pero no la estructura).

---

## 3. Decisión de producto

Rediseño en tres piezas. **Ninguna cambia reglas de negocio**: `createPickup`, topes, mínimo de envío,
comprobante y auditoría se reusan tal cual.

### Pieza 1 · Catálogo como grilla, con ficha

`/portal` deja de ser el lugar donde se arma el pedido y pasa a ser **tablero**: carnet, aviso de
pendientes y accesos (Catálogo, Mis pedidos, Envíos, Mis datos). El catálogo se mueve a
`/portal/catalogo` con **grilla de fichas**: foto, nombre, THC, disponibilidad y el precio por gramo
en chico (el aporte estimado, no un precio de venta). Cada ficha tiene su selector de 5 g.

*Aceptación:* entrar al portal y ver el catálogo cuesta un clic, y el tablero no supera 2 pantallas.

### Pieza 2 · Carrito como panel deslizante, con barra fija en celular

Al tocar `+` se abre un **drawer** (derecha en escritorio, hoja inferior en celular) con: renglones
(cantidad editable con `−`/`+`, quitar), **subtotal en gramos y en aporte**, el aviso de mínimo de
envío si corresponde, `Seguir eligiendo` y **`Continuar`**. En celular, además, una **barra fija abajo**
con `N g · $X — Ver pedido` que aparece en cuanto hay algo en el carrito.

*Aceptación:* con el carrito cerrado el socio ve cuánto lleva sin scrollear; abrirlo no lo saca del
catálogo.

### Pieza 3 · Confirmación en tres pasos

`/portal/pedido` con barra de progreso y resumen sticky a la derecha:

1. **Entrega** — Retiro (día y horario) o Envío (zona sugerida por CP, dirección, cobertura, costo).
2. **Aporte** — monto a cubrir (gramos × aporte + envío), alias/CBU, comprobante si ya lo tiene.
3. **Confirmar** — resumen de una pantalla: qué, cuánto, cómo y hasta cuándo.

*Aceptación:* el socio puede volver a un paso sin perder lo cargado; el paso 3 se lee sin scrollear.

### Lo que NO se copia

- **Precios de venta por producto.** El catálogo muestra aporte prorrateado por gramo; nunca un precio
  de venta ni un botón «Comprar».
- **Pago con tarjeta y checkout de un clic.** Acá el aporte se transfiere y el club aprueba el
  comprobante; un checkout de tarjeta convertiría el flujo en una venta.
- **Cuentas, cupones, favoritos y «comprá de nuevo».** No aportan a un club con tope mensual.
- **Urgencia artificial** («solo quedan 2», contadores). El stock y el tope ya son reales; inventar
  escasez en un club de cultivo es faltarle el respeto al socio.

---

## 4. Plan por cortes

| Corte | Qué | Esfuerzo | Riesgo |
|---|---|---|---|
| **1** | Drawer de carrito + barra fija en celular, sobre la página actual | 1 día | Bajo: no se mueve ninguna ruta |
| **2** | `/portal/pedido` en 3 pasos, reusando `createPickup` | 1,5 días | Medio: hay que mover el formulario sin cambiar validaciones |
| **3** | Catálogo a `/portal/catalogo` y tablero de 2 pantallas | 1 día | Bajo, pero toca el atajo «Pedir» de todo el portal |

**Orden recomendado: 1 → 2 → 3.** El corte 1 es el que cambia la sensación («no me gusta cómo quedó»)
y no mueve nada de sitio. El 3 es el más cosmético de los tres y el que más enlaces rompe.

---

## 5. Riesgos

- **Que la estética de carrito tape la naturaleza del club.** Cuanto más se parezca a una tienda, más
  falta hace el texto que dice que es aporte prorrateado y no venta.
- **Dos fuentes de verdad del carrito.** Mientras el drawer y la página compartan estado, tiene que
  haber uno solo (hoy el estado vive en `member-portal.tsx`); si se duplica, aparecen totales distintos.
- **Perder el contexto de tope.** El drawer tiene que decir siempre «X g de Y»; un carrito que no
  muestra el tope invita a pedir lo que no se puede.
