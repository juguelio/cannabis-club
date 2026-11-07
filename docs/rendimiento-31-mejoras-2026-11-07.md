# Rendimiento: las 31 mejoras, una por una contra esta app

Fecha: 07/11/2026. Base: `main` = `7805e71`. Origen: un reel con 31 mejoras de rendimiento (Jugue lo pidió implementado).
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
| `/` panel | 2044 ms · 44 | 1717 ms · 33 | 104 ms |
| `/dispensario` | 1202 ms · 29 | 964 ms · 17 | 86 ms |
| `/socios` | 1244 ms · 20 | 1078 ms · 14 | 80 ms |
| `/stock` | 1020 ms · 16 | 1106 ms · 14 | 74 ms |
| `/aportes` | 954 ms · 17 | 951 ms · 11 | 54 ms |
| `/portal` | 2185 ms · 53 | 1123 ms · 22 | 72 ms |
| `/portal/basket` | 1733 ms · 48 | 782 ms · 17 | 52 ms |
| `/portal/pedido` | 1763 ms · 44 | 843 ms · 19 | 49 ms |
| `/portal/envios` | 1539 ms · 29 | 615 ms · 15 | 67 ms |
| `/portal/datos` | 1606 ms · 24 | 671 ms · 15 | 44 ms |

«Base al lado» = proxy de 1 ms por sentido: lo que se espera con las funciones en `gru1`, al lado de Neon.

### Celular (390 px, CPU 4× más lenta)

| Pantalla | `main` LCP · imágenes | rama LCP · imágenes |
|---|---|---|
| `/portal` | 2000 ms · **7,2 MB** | 1352 ms · 0,8 MB |
| `/portal/pedido` | 1972 ms | 788 ms |
| `/` panel | 3328 ms | 2388 ms |
| `/socios` | 1748 ms | 1324 ms |

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
| 14 | UI optimista | Pendiente con el rediseño del panel de compra (Hermes): basket y cantidades. |
| 15 | Lazy loading de imágenes | **Hecho** en comprobantes, documentos, catálogo del club y sitio. La portada del sitio va con `fetchPriority="high"`. Las tarjetas del portal quedan para el rediseño (Hermes). |
| 16 | Peticiones en paralelo | **Hecho**: el resumen del portal pasó de 4 tandas encadenadas a 1 (comprobantes y cuenta del socio se piden junto con todo lo demás). |
| 17 | Índices | Ya estaban en todo lo que filtra (pedidos por socio y estado, entregas por socio y fecha, comprobantes, turnos, auditoría). |
| 18 | Rastrear peticiones lentas | **Hecho**: toda consulta de más de 300 ms deja en los logs `{"evento":"consulta_lenta","ms":…,"sql":…}`, sin parámetros. `SLOW_QUERY_MS` lo ajusta. |
| 19 | Acercar el servidor a la base | **Hecho en código**: `vercel.json` → `"regions": ["gru1"]`. Es el cambio que más pesa (ver tabla). |
| 20 | Renderizar en el servidor | Ya estaba (componentes de servidor). |
| 21 | Scripts de terceros después | No hay scripts de terceros. |
| 22 | Dividir el JavaScript | Ya lo hace Next por ruta: lo propio de cada pantalla pesa 38–45 KB; el resto es React y Next. |
| 23 | Virtualizar listas largas | No hay listas que lo necesiten (padrón de decenas, no miles). |
| 24 | Pedir sólo las columnas | **Hecho, y era grande**: `include: { strain: true }` traía la foto de cada variedad (hasta 3 MB) en el panel, el dispensario, el stock, la ficha del socio y el cierre. Ahora el cliente de Prisma omite la foto y las imágenes de marca salvo que se pidan explícitamente. |
| 25 | Pool de conexiones | Para Hermes: confirmar que `DATABASE_URL` de producción use el host `-pooler` de Neon con `pgbouncer=true&connection_limit=5`. No se tocó la variable. |
| 26 | Evitar re-renders | Sin problemas medibles; se revisa con el rediseño del portal. |
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
