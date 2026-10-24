# REA — Clubes cannábicos europeos → requisitos para la app

> Fecha: 2026-10-24 · Autor: HAL · Estado: **insumo de diseño**, no asesoría legal.
> Objetivo: extraer del funcionamiento real de los clubes/asociaciones europeas (y del software que usan)
> las reglas que deben quedar **codificadas** en la app, con la misma separación que exige el método:
> `observado` (fuente citada) / `inferido` / `decisión de producto`.

## 0. Targets y por qué

| Target | Qué se inspeccionó | Por qué sirve |
|---|---|---|
| Alemania — Anbauvereinigungen (KCanG) | **Texto legal § 26 KCanG** (documentación y reporte) + guías de asociaciones | Es el único marco europeo que **enumera campo por campo** lo que hay que registrar. Define el estándar de trazabilidad. |
| España — CSC | Código de buenas prácticas **ConFAC** (6 libros obligatorios) | Modelo de "libros" y de **previsión de consumo por socio**; es el pariente cultural/legal más cercano a Argentina. |
| Países Bajos — experimento cadena cerrada | Reglas oficiales (Government.nl) | Track & trace mínimo: recibido, transportista, stock, vendido, con fechas. |
| Suiza — pilotos | BAG (FOPH) + Cannavigia | Prueba de que el estándar del mercado es **seed-to-sale por lote**. |
| Malta — ARUC | No accesible (timeout del sitio) | **Sin verificación directa**: no se usa como fuente. |
| Software comercial | HerbTrack (DE), Cannabivo, WeedPOS | Superficie de features ya validada por clubes reales: qué pantallas necesita un club, no qué se nos ocurre. |

## 1. Lo que la ley obliga a registrar (esto ES el modelo de datos)

### 1.1 Alemania — § 26 KCanG (observado, texto legal)

Campos de documentación continua para trazabilidad (`§26(1)`, 7 bloques):

1. **Origen del material de propagación**: nombre, apellido y dirección de la persona — o nombre y sede de la
   asociación/persona jurídica — que lo entregó.
2. **Existencias**: cantidades de cannabis **en gramos** y **unidades** de material de propagación en el predio.
3. **Cultivado**: gramos.
4. **Destruido**: gramos y unidades de material de propagación destruido.
5. **Entrega a socio**: nombre, apellido y **año de nacimiento** del socio + (a) gramos, (b) **THC promedio**,
   (c) **fecha**.
6. **Material de propagación entregado**: unidades + fecha.
7. **Transporte**: gramos y **variedades**, nombre del socio que transporta/acompaña, fecha, **origen y destino**.

Obligaciones asociadas (`§26(2)–(5)`):

- Conservación **5 años**; entrega **electrónica** a la autoridad cuando la pida.
- **Informe anual anonimizado antes del 31 de enero**: cultivado, entregado, destruido y **stock final**,
  desagregado por **variedad** y por **THC/CBD promedio**.
- **Recall** inmediato si hay riesgo sanitario → hace falta trazabilidad *hacia adelante* (qué socios recibieron qué lote).
- **Notificación de extravío o entrega no autorizada** → libro de incidentes, no un mail suelto.

Límites operativos (observado, guías DE): 25 g/día · 50 g/mes · 18–20 años: 30 g/mes y **≤10 % THC** ·
máx. **500 socios** · una sola asociación por persona · identidad verificada **al alta y en cada entrega**.

### 1.2 España — ConFAC (observado)

Seis libros obligatorios: **actas** de asambleas · **contabilidad** · **membrecía** (datos personales, fecha de
inscripción, alta en cultivo compartido con confirmación de junta, aportes) · **consumo de socios** (folio
numerado: socio, gramos, fecha y **firma**) · **previsión de cultivo** y **resultados del cultivo** (o previsión y
actas de compras mancomunadas). Tope orientativo **3,5 g/día** con **ajuste trimestral** contra la previsión;
primer diagnóstico lúdico/terapéutico al ingresar; aceptación firmada del reglamento interno.

### 1.3 Países Bajos — experimento (observado)

Registro obligatorio: tipo y cantidad recibida, **fecha de recepción**, cultivador que la entregó,
**transportista**, **cantidades en stock**, tipo y cantidad vendida y **fecha de venta**.

### 1.4 Argentina — punto de partida real (observado, prensa/guías 2025-26)

Asociación civil con **libros rubricados** (Actas, Socios, Inventario, Caja); inscripción en REPROCANN como
**ONG vinculada a la salud** vía TAD con CUIT del presidente; **Resolución 1780/2025** exige **Director Médico** y
**Responsable Técnico de cultivo**; los socios se vinculan con un **código de vinculación** y deben tener
indicación médica propia; sin fines de lucro → **cuota social + cuota de cultivo**, prorrateo de costos, nunca
"venta". Contexto: trámites demorados (decenas de miles de personas esperando), o sea el padrón tiene estados
"en trámite" que hay que modelar, no asumir.

## 2. Lo que el software europeo ya resolvió (observado en producto)

| Capacidad | HerbTrack | Cannabivo | WeedPOS | Veredicto |
|---|---|---|---|---|
| Alta de socios, solicitudes, lista de espera | ✅ | ✅ | ✅ | **MVP** |
| Import CSV del padrón existente | ✅ | — | ✅ (migración) | **MVP** (todo club llega con planilla) |
| Credencial/carnet con QR | ✅ | ✅ (+ wallet) | ✅ + NFC | QR en MVP; wallet/NFC después |
| OCR del documento de identidad | — | ✅ verificación | ✅ | Fase 2 |
| Límites diario/mes **chequeados antes de confirmar** | ✅ | ✅ (más estricto <21) | — | **MVP, no negociable** |
| Cosecha en **dos etapas** (peso húmedo → seco acredita stock) | — | ✅ | — | **MVP** (es la única forma de no inventar stock) |
| Lote con cepa, nº plantas, etapa, sala, diario | ✅ | ✅ kanban | — | **MVP** (kanban simple) |
| Inventario con **historial de movimientos** | ✅ | ✅ ledger | ✅ | **MVP** |
| Informe anual exportable (§26) | ✅ CSV | — | reportes | **MVP** (es la razón por la que el club paga) |
| Roles/roster + permisos | — | ✅ | ✅ | **MVP** |
| Cuotas, facturas, KPIs | parcial | ✅ | ✅ | Fase 2 (en AR: cuota social/cultivo) |
| Contratos + firma electrónica | — | ✅ | ✅ digital | Fase 2 |
| Eventos, encuestas, feed | — | ✅ | — | **No** |
| POS / caja mostrador | ✅ till | — | ✅ | **No** (en AR no hay venta) |
| Directorio público de clubes | ✅ 877 clubes | ✅ homepage | — | **No** (problema de exposición) |

Precios observados como referencia de disposición a pagar: HerbTrack **€199/mes planos desde el socio 51**
(gratis hasta 50); Trazagrow (CL/LatAm) **USD 30/mes** por asociación; Cannabivo por tramos de socios.

## 3. Traducción a la app (decisión de producto)

1. **El registro es un ledger append-only, no una tabla editable.** Cada entrega, destrucción, ajuste o
   transporte es un asiento con actor, timestamp y motivo. Corregir = **contra-asiento**, nunca `UPDATE`.
   Es lo que la autoridad espera ("historial verificable") y lo que evita el agujero clásico: editar el pasado.
2. **El stock no es un campo.** Saldo por lote = suma de movimientos. Se puede cachear, pero la verdad es la suma.
3. **La dispensación guarda el snapshot del cálculo de límites** (consumo del día, del mes, tope aplicado, edad).
   Si mañana cambia el criterio, hay que poder defender por qué se entregó.
4. **Lote = unidad de trazabilidad.** Origen del material de propagación, plantas, pesos, THC/CBD, y desde el lote
   se responde "a qué socios fue" (recall §26(4)).
5. **Los límites son configuración del club, no constantes.** El default sale del estándar europeo
   (25 g/día, 50 g/mes, 30 g y ≤10 % para menores de 21), porque en Argentina el tope lo fija la previsión del
   club y la normativa se mueve. Hardcodear es garantizar una migración.
6. **Identidad en dos capas:** DNI (persona) + REPROCANN (número, estado, vencimiento, código de vinculación).
   Un socio con REPROCANN vencido no puede retirar: el chequeo va en la transacción, no en un aviso.
7. **Reportes = libros.** Socios, dispensaciones (con las columnas que pide la ley: nombre, apellido, año de
   nacimiento, gramos, THC promedio, fecha), stock por cepa/lote, destrucciones, transportes e informe anual
   por variedad con THC/CBD promedio. Todos exportables a CSV.
8. **Datos personales de salud**: consentimiento informado con fecha, minimización, retención 5 años, log de
   accesos. Es la parte que ningún competidor muestra y es la primera que pide un abogado.

## 4. Lo que NO copiamos y por qué

- **POS / venta al mostrador**: en Argentina el club prorratea costos; un ticket de venta es prueba en contra.
- **Directorio público / marketplace**: publicidad de una actividad que se mueve por vínculo y no por SEO.
- **Gamificación social** (encuestas, feed, eventos): no aporta a usuarios/stock/registro.
- **NFC/RFID y Apple Wallet**: hardware y ceremonia antes de tener el circuito básico verificado.

## 5. Brechas y unknowns (declarados)

- **Malta**: sitio ARUC inaccesible en dos intentos (timeout). No se usó como fuente ni se infiere su modelo.
- **Nubeana y Grow Club Manager** (competencia AR): páginas renderizadas por JS; sin contenido inspeccionable por
  fetch. Quedan como mercado, no como benchmark técnico. Trazagrow sí expone modelo y precio: **B2B sin cuentas
  de socios** (el equipo administra) — nosotros vamos a permitir portal de socio como fase 2, decisión a validar
  con el club piloto.
- **Normativa AR en movimiento**: la exigencia de Director Médico/Responsable Técnico (Res. 1780/2025) y las
  demoras de trámite cambian el padrón; el sistema modela estados y vencimientos, no los presume.
- **Ningún club real validó todavía** este recorte: el orden de módulos es inferencia desde la ley + producto
  europeo, no desde uso observado en un club argentino.

## 6. Fuentes

- § 26 KCanG — https://www.gesetze-im-internet.de/kcang/__26.html (texto legal, campos de trazabilidad)
- BlattWerk — obligaciones de Anbauvereinigungen (500 socios, 25/50 g, documentación, inspecciones)
  https://blattwerk.dev/en/wissensdatenbank/legal/anbauvereinigungen-kcang
- HerbTrack — software CSC (features, informe §26, precio) https://herbtrack.de/en y /en/csc-software
- Cannabivo — Club Manager (módulos, kanban de lote, límites) https://cannabivo.com/club-manager
- WeedPOS — FAQ (OCR, QR/NFC, tiers, GDPR) https://weedpos.xyz/faq
- ConFAC — Código de buenas prácticas (6 libros, 3,5 g/día, previsión de consumo)
  https://www.confac.org/codigo-de-buenas-practicas
- Government.nl — requisitos de coffeeshops en el experimento (track & trace)
  https://www.government.nl/themes/family-health-and-care/controlled-cannabis-supply-chain-experiment/requirements-for-coffee-shops-in-the-experiment
- BAG/FOPH — pilotos autorizados https://www.bag.admin.ch/en/overview-of-authorised-pilot-trials-with-cannabis
- ANSOL — guía club de cultivo AR 2026 (libros rubricados, Res. 1780/2025, código de vinculación)
  https://ansol.com.ar/conocimiento/guias/club-cultivo-cannabis-argentina/
- Trazagrow — modelo B2B y precio https://trazagrow.com/
