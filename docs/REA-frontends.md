# REA — frontends de gestión de clubes cannábicos

> Fecha: 2026-10-24 · Autor: HAL · Insumo de diseño para la UI de `cannabis-club`.
> Método: navegador real, extracción del DOM (nav, headings, columnas de tabla, paleta computada).
> **Límite honesto:** ningún producto deja ver su app por dentro sin cuenta. HerbTrack es el único con una
> réplica interactiva de la app en su página comercial (datos ficticios). Cannabivo bloquea con verificación
> anti-bot; Nubeana y Grow Club Manager sólo muestran landing. Las capturas que intenté de Grow Club Manager y
> WeedPOS devolvieron landing/estado vacío: **no hay evidencia visual de sus apps**, así que no se copian.

## 1. Qué se observó (evidencia)

### HerbTrack — réplica de la app en `herbtrack.de/en/csc-software#software-demo`
- **Paleta computada:** fondo `rgb(251,250,246)` (#FBFAF6, blanco cálido), texto `rgb(15,23,42)` (#0F172A),
  acento `rgb(9,64,31)` (#09401F, verde profundo). Tipografía **Poppins**.
- **Cockpit = 4 tarjetas que además son filtros:** `Members 16 / 500`, `Available places 484`, `Paused 1`,
  `Open applications 3`. Debajo, segmentos `All 16 / Active 15 / Paused 1 / Contribution outstanding 3`
  que abren la lista ya filtrada ("Select a segment to open the filtered list").
- **Dos vistas del mismo dato:** pestañas `Cockpit` y `List`.
- **Columnas de la lista de socios:** `Member / record` (nombre + código `HT-XXXXXX`), `Membership`
  (`Active` / `Paused`), `Identity verification` (`Already verified`), `Contribution`
  (`No outstanding contribution` / `Contribution outstanding`).
- **Vocabulario de estado en frases, no enums:** "Already verified", "Contribution outstanding". El estado se
  lee como una conclusión, no como un campo de base de datos.
- Su propia página enumera las verificaciones que un comprador exige ver en un demo: chequeo de cantidades
  al entregar (25 g/día, 50 g/mes, más estricto para menores de 21), control de edad e identidad en **cada**
  entrega, informe anual desde los mismos datos, trazabilidad lote → stock → entrega, y permisos de acceso.

### WeedPOS — `weedpos.xyz`
- **Paleta:** fondo `rgb(17,26,20)` (#111A14), acento `rgba(34,197,94,...)` (#22C55E), texto casi blanco
  `rgb(240,253,244)`. Tipografía **Inter**.
- **Módulos declarados:** Membership Management, Point of Donation (no "sale"), Inventory Control,
  Smart Check-in, Analytics & Reports, Automated Communications, Live Digital Menu, Online Member Registration.
- Detalle de mercado: su propia landing se compara con **Doob** y **Gestión Verde** (productos en español).

### Grow Club Manager — `growclubmanager.com` (competencia argentina)
- **Paleta:** texto `rgb(17,19,24)`, fondo blanco. Tipografía **Poppins**.
- **Módulos:** Dashboard · Socios · Dispensario · Turnos · Caja · Inventario · Productos y categorías ·
  Membresías y cuotas · Noticias · Avisos al celular · Staff y permisos.
- CTA de entrada: "Ingreso Miembros". Es el competidor más parecido a nuestro alcance.

### Nubeana (AR)
- Sólo landing; secciones "Para el equipo" / "Para los socios", prueba de 3 meses. Sin app visible.

## 2. Patrones que sí vale copiar

| Patrón | Fuente | Por qué |
|---|---|---|
| **KPI que filtra** (tarjeta = link al listado ya filtrado) | HerbTrack | Evita el dashboard decorativo: cada número lleva a la acción. |
| **Estado en frase** ("REPROCANN vencido", "Sin consentimiento") | HerbTrack | El operador lee el problema, no traduce un enum. |
| **Superficie cálida + verde profundo** (#FBFAF6 / #09401F) | HerbTrack | Se lee bien en mostrador con luz mala; no compite con el dato. |
| **Densidad de tabla con celda de dos líneas** (nombre + legajo/código) | HerbTrack | El legajo es la llave que usa el club en el mostrador. |
| **Dos vistas del mismo dato** (panel / lista) | HerbTrack | Permite operar rápido y auditar después. |
| **Nomenclatura "donación/aporte", no "venta"** | WeedPOS ("Point of Donation") | Coincide con el encuadre argentino sin fines de lucro. |
| **Navegación por módulos cortos y en español** | Grow Club Manager | "Socios / Dispensario / Inventario" es el vocabulario del club real. |

## 3. Lo que NO copiamos

- **Dark mode de WeedPOS** como tema único: en un mostrador con luz brillante, el texto claro sobre negro
  pierde contraste. Nuestro tema base es claro; el verde va en acentos.
- **"Punto de donación"?** Se copia la idea (no es venta), pero el módulo se llama **Dispensario** y la
  contabilidad de aportes queda fuera del MVP.
- **Turnos, caja, noticias, avisos push, votación, feed, contratos, e-sign, wallet pass, NFC**: features de
  producto maduro que no sostienen el primer foco (usuarios, stock, registro).
- **Directorios/marketplace público de clubes**: exposición que el club no quiere.

## 4. Decisiones de UI para nuestra app

1. **Shell de dos columnas:** sidebar fija con 5 secciones (Panel, Socios, Stock, Dispensario, Reportes) +
   bloque del club arriba y usuario abajo; en mobile, barra inferior con las mismas 5.
2. **Tipografía del sistema** con `font-variant-numeric: tabular-nums` en gramos y fechas; sin webfonts
   (la app tiene que abrir rápido en el mostrador).
3. **Tokens:** `--surface #FBFAF6`, `--ink #0F172A`, `--brand #09401F`, `--brand-soft #E7F0E9`,
   `--line #E3E2D9`, `--warn #B45309`, `--danger #B91C1C`, `--ok #15803D`.
4. **Chips semánticos:** verde tenue = habilitado, ámbar = atención, rojo = bloqueado, gris = sin dato.
   Nunca un enum crudo en pantalla.
5. **Dispensario en dos paneles:** a la izquierda socio + lote + gramos; a la derecha el **medidor de límites**
   (día/mes/edad/REPROCANN) que se actualiza al elegir socio, con el botón de entrega deshabilitado y el
   motivo visible antes de apretar. El error nunca aparece *después* de entregar.
6. **Stock como pipeline de etapas** (propagación → vegetativo → floración → cosecha → curado → disponible)
   y cosecha en dos pasos explícitos (húmedo y seco).
7. **Reportes con propósito**: cada libro dice para qué sirve y qué contiene, no sólo "descargar".
8. **Estados vacíos con la próxima acción** ("No hay lotes disponibles. Cargá la cosecha seca de un lote").

## 5. Brechas declaradas

- No se pudo ver la UI interna de Cannabivo, WeedPOS, Nubeana ni Grow Club Manager.
- No hay evidencia de cómo resuelven mobile: sólo se observó layout de escritorio.
- Los patrones son inferencia desde el DOM y las listas de módulos, no desde uso real de un club.
