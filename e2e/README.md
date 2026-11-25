# Tests E2E

Prueban la app entera desde el navegador, contra una base propia que se rehace en cada corrida.
Nunca tocan `cannabis_club_dev` ni la base de producción.

```bash
npx playwright install chromium  # una vez por máquina
npm run build          # el servidor de los tests usa el build de producción
npm run e2e            # corre todo y deja el reporte en e2e/.reporte
npm run e2e:reporte    # abre el último reporte
```

La conexión de `.env` debe apuntar a PostgreSQL en esta máquina. El proceso de pruebas usa
el mismo servidor y una base independiente llamada `cannabis_club_e2e`. La sesión de solicitud
representa la vuelta de Google con una cuenta de prueba y una clave efímera de la corrida.

Para mirar una sola suite o un solo test:

```bash
npx playwright test --project=staff
npx playwright test e2e/portal/02-pedido.spec.ts
npx playwright test -g "comprobante" --headed
```

## Cómo está armado

| pieza | qué hace |
|---|---|
| `scripts/e2e-server.sh` | rehace la base (`e2e/reset-db.ts`) y levanta `next start` en el **3500** |
| `e2e/env.ts` | puerto, credenciales del seed y la URL de la base de test (derivada de `.env`) |
| `e2e/auth.setup.ts` | entra por la pantalla real con admin, operador y socio; guarda la sesión |
| `e2e/onboarding.setup.ts` | deja a María con el legajo verificado, que es el único estado desde el que se puede pedir |
| `e2e/fixtures.ts` | falla si la página tira una excepción de JavaScript; junta los errores de consola |
| `e2e/helpers.ts` | login, datos del seed y un PNG de 1×1 para los comprobantes |

Proyectos: `publico` (sin sesión), `staff` (admin), `portal` (socio), `movil` (socio en Pixel 7),
`api` (HTTP directo, sin navegador).

## Reglas que hacen que esto sirva

- **Un worker, sin paralelo.** El club tiene estado compartido (topes, stock, cupos): en paralelo los
  tests se pisan y el rojo deja de significar algo.
- **La base se rehace antes de que arranque el servidor.** Al revés, tirar la base con el pool de
  Prisma conectado rompe todas las consultas del servidor («terminating connection due to
  administrator command») y fallan tests que no tienen nada que ver.
- **Puerto 3500.** El 3000 es el bridge de WhatsApp y el 3300 el `next dev` de siempre.
- **Se prueba el build de producción**, no `next dev`: lo que se testea es lo que se publica.
- **Nada de `waitForTimeout`** para esperar: se espera por condición (`toHaveText`, `waitForURL`).

## Antes de agregar un test

1. ¿La aserción mira lo que el club ve, o un detalle de implementación? Que mire lo que se ve.
2. Si el test crea datos (un pedido, una entrega), ¿rompe a otro? Nombrá el archivo con número
   (`01-`, `02-`) y dejá el efecto para el final.
3. Si toca un flujo que ya existe en otro test, reusá el helper en vez de repetir el camino.
