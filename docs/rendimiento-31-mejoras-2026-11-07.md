# Rendimiento: las 31 mejoras, una por una contra esta app

Fecha: 07/11/2026. Base: `main` = `ef4f7fa` (ya con el catálogo, el basket y el checkout nuevos). Origen: un reel con 31 mejoras de rendimiento (Jugue lo pidió implementado).
Rama: `perf/31-mejoras`.

## Lo que se midió en producción antes de tocar nada

- `x-vercel-id: iad1::iad1::…` en todas las respuestas: **las funciones corren en Washington (iad1)** y la base Neon
  está en **São Paulo (`aws-sa-east-1`)**. Cada consulta cruza el continente.
- `/api/health` hace un solo `SELECT 1` y reporta **561 ms** (cinco lecturas seguidas: 561, 675, 562, 561, 561).
  Eso es abrir conexión + consulta a ~115 ms de ida y vuelta.
- TTFB de `/login` desde la costa este de EE. UU.: ~980 ms.

## Cómo se midió en local

Producción local (`next build && next start`) con la base detrás de un proxy que agrega **57 ms por sentido**
(115 ms de ida y vuelta, lo mismo que iad1 ↔ São Paulo). Postgres con `log_statement=all` para contar consultas.
Fotos de cámara (~1,8 MB) cargadas en las 4 variedades, como tiene producción. Mismos datos para `main` y la rama.

### Servidor (ms hasta la respuesta completa · consultas por pantalla)

| Pantalla | `main` | rama, base lejos | rama, base al lado (gru1) |
|---|---|---|---|
| `/` panel | 1950 ms · 44 | 1479 ms · 33 | 102 ms |
| `/dispensario` | 1203 ms · 25 | 900 ms · 16 | 57 ms |
| `/socios` | 1214 ms · 20 | 1264 ms · 14 | 92 ms |
| `/stock` | 1314 ms · 16 | 1017 ms · 14 | 93 ms |
| `/aportes` | 781 ms · 16 | 947 ms · 11 | 49 ms |
| `/portal` | 2012 ms · 54 | 918 ms · 23 | 69 ms |
| `/portal/basket` | 1887 ms · 49 | 670 ms · 17 | 50 ms |
| `/portal/pedido` | 1712 ms · 45 | 796 ms · 21 | 50 ms |
| `/portal/envios` | 1553 ms · 29 | 611 ms · 15 | 49 ms |
| `/portal/datos` | 1613 ms · 24 | 614 ms · 15 | 54 ms |

Promedio de dos pedidos en caliente. `/socios` y `/aportes` con la base lejos quedan igual dentro del ruido de la
medición (bajan las consultas, no el tiempo: sus consultas ya iban en paralelo). «Base al lado» = proxy de 1 ms por sentido: lo que se espera con las funciones en `gru1`, al lado de Neon.

### Celular (390 px, CPU 4× más lenta)

| Pantalla | `main` LCP · imágenes | rama LCP · imágenes |
|---|---|---|
| `/portal` | 2020 ms · **3,6 MB** | 1256 ms · 0,4 MB |
| `/portal/pedido` | 1788 ms | 796 ms |
| `/` panel | 3140 ms | 2556 ms |
| `/socios` | 1440 ms | 1368 ms |

Las fotos de prueba son ruido (comprimen mal): con fotos reales el WebP pesa todavía menos.

## Las 31, una por una

| # | Mejora | Estado en esta app |
|---|---|---|
| 1 | Skeletons de carga | **Hecho**: `portal/loading.tsx` (la consola ya tenía el suyo). |
| 2 | Imágenes en WebP/AVIF | **Hecho**: `/api/variedades/:id/foto` sirve WebP achicado (960 px, `?w=480` para tarjetas). `?original=1` da el archivo subido. |
| 3 | Evitar llamadas duplicadas | **Hecho**: la sesión, el club, el resumen del socio, el catálogo y la verificación se leen una vez por request (`cache` de React). Antes la sesión se leía 3 veces y el resumen del portal 2. |
| 4 | Debounce en búsqueda | Ya estaba: la paleta (⌘K) espera 120 ms y cancela la anterior; el buscador de socios filtra en memoria. |
| 5 | Paginar la API | Ya estaba en las listas largas (socios, pedidos del portal: últimos 12 con total real). |
| 6 | Estáticos desde CDN | Vercel ya sirve `_next/static` por CDN. **Hecho**: fotos e imágenes de marca con `s-maxage` para que la CDN las guarde. |
| 7 | Tareas lentas a una cola | Ya estaba: cartas y avisos van por cron. No hay otra tarea lenta en pantalla. |
| 8 | Consultas N+1 | Sin N+1 en bucles. Las cadenas de `include` (entrega → socio → lote → variedad) son 3–4 viajes: con la base al lado cuestan ~1 ms cada uno. `relationJoins` de Prisma lo resolvería en una consulta, pero está en preview: no se activa en una app con libro legal. |
| 9 | Compresión Brotli/Gzip | Vercel ya comprime. |
| 10 | Caché (Redis) | No hace falta: con la base al lado las pantallas tardan 40–100 ms en el servidor. Agregar Redis sería un proveedor más con datos de salud. |
| 11 | Quitar dependencias sin usar | Revisadas: todas se usan. Se agrega `sharp` (ya venía con Next) para las fotos. |
| 12 | Timeout a APIs externas | **Hecho**: Resend (10 s) y Google (8 s). Cotización y CP ya lo tenían. |
| 13 | Streaming | Las pantallas ya se envían en streaming; con `loading.tsx` el socio ve el esqueleto al instante. |
| 14 | UI optimista | El basket nuevo ya cambia al instante en el navegador (vive en el cliente). El resto de las acciones esperan al servidor a propósito: son registros legales. |
| 15 | Lazy loading de imágenes | **Hecho** en las tarjetas del catálogo, comprobantes, documentos, catálogo del club y sitio. La portada del sitio va con `fetchPriority="high"`. |
| 16 | Peticiones en paralelo | **Hecho**: el resumen del portal pasó de 4 tandas encadenadas a 1 (comprobantes y cuenta del socio se piden junto con todo lo demás), y el catálogo de 2 a 1. |
| 17 | Índices | Ya estaban en todo lo que filtra (pedidos por socio y estado, entregas por socio y fecha, comprobantes, turnos, auditoría). |
| 18 | Rastrear peticiones lentas | **Hecho**: toda consulta de más de 300 ms deja en los logs `{"evento":"consulta_lenta","ms":…,"sql":…}`, sin parámetros. `SLOW_QUERY_MS` lo ajusta. |
| 19 | Acercar el servidor a la base | **Hecho en código**: `vercel.json` → `"regions": ["gru1"]`. Es el cambio que más pesa (ver tabla). |
| 20 | Renderizar en el servidor | Ya estaba (componentes de servidor). |
| 21 | Scripts de terceros después | No hay scripts de terceros. |
| 22 | Dividir el JavaScript | Ya lo hace Next por ruta: lo propio de cada pantalla pesa 38–45 KB; el resto es React y Next. |
| 23 | Virtualizar listas largas | No hay listas que lo necesiten (padrón de decenas, no miles). |
| 24 | Pedir sólo las columnas | **Hecho, y era grande**: `include: { strain: true }` traía la foto de cada variedad (hasta 3 MB) en el panel, el dispensario, el stock, la ficha del socio y el cierre. Ahora el cliente de Prisma omite la foto y las imágenes de marca salvo que se pidan explícitamente. |
| 25 | Pool de conexiones | Para Hermes: confirmar que `DATABASE_URL` de producción use el host `-pooler` de Neon con `pgbouncer=true&connection_limit=5`. No se tocó la variable. |
| 26 | Evitar re-renders | No se midió con el perfilador de React. No hay síntomas: el JS propio de cada pantalla es chico y las interacciones no esperan al servidor salvo al guardar. |
| 27 | Cachear los estáticos | Ya estaba (`immutable` con versión en la URL); ahora también en la CDN. |
| 28 | Repartir el tráfico | Vercel escala solo. |
| 29 | Fuentes propias y pocos grosores | Ya estaban alojadas en la app (`@fontsource`, variables, un archivo por familia y alfabeto). |
| 30 | Medir usuarios reales | **Hecho**: Web Vitals (LCP, INP, CLS, FCP, TTFB) de cada pantalla van a `/api/vitals` y quedan en los logs como `{"evento":"web_vital",…}`, con la ruta sin identificadores. Sin terceros, sin cookies, sin base. |
| 31 | Probar en celulares | Hecho para esta medición (390 px, CPU 4×). Se repite después del deploy. |

## Otros cambios

- El vencimiento de reservas viejas (7 días) se hacía en **cada** pantalla del portal y del dispensario, con una
  escritura en transacción antes de mostrar nada. Ahora corre como mucho cada 5 minutos por instancia, y el cron
  diario de retención lo fuerza.
- `getClub()` usaba `upsert` (transacción de varios viajes) para leer: ahora lee y crea sólo si falta.
