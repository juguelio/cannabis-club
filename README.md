# Club de cultivo — template de gestión (socios · stock · registro)

App de gestión para una **asociación civil de cultivo (club cannábico) argentina inscripta en REPROCANN**,
pensada como **template white-label**: se despliega una instancia por club y la identidad (nombre, colores,
tipografía, logo, textos, dominio) es configuración, no código.

Primer foco: **padrón de socios, control de stock y registro trazable de entregas**.
No es un POS: el club no vende, prorratea costos entre socios (cuota social + cuota de cultivo).

**Alta de un club nuevo → [`TEMPLATE.md`](TEMPLATE.md)** (checklist de variable de entorno, marca, datos legales
y verificación). La base visual es neutra a propósito: grises, un verde de acción, azul para foco, tipografía del
sistema y radios chicos; el club la reemplaza desde Configuración › Marca sin tocar CSS.

## Principios que manda el diseño

Salen del REA de clubes europeos → [`docs/REA-clubes-europeos.md`](docs/REA-clubes-europeos.md).

1. **El registro es un ledger append-only.** `StockMovement` no se edita ni se borra; corregir es un
   contra-asiento (`reversalOfId`). Toda acción queda en `AuditLog`.
2. **El stock es la suma de movimientos**, no un campo editable. Saldo por lote = Σ con signo por tipo.
3. **La entrega congela el cálculo de límites** (`Dispensation.limitSnapshot`): día, mes, edad, THC y uso previo.
4. **Lote = unidad de trazabilidad**: origen del material de propagación → plantas/sala → peso húmedo y seco →
   entrega a socio → recall (a quién fue cada lote).
5. **Los topes son configuración del club** (`Club`), con default europeo (25 g/día · 50 g/mes ·
   menores de 21: 30 g/mes y ≤10 % THC). La normativa argentina se mueve: no hardcodear.
6. **Identidad en dos capas**: DNI + REPROCANN (número, estado, vencimiento). Sin REPROCANN vigente el
   dispensario rechaza la entrega dentro de la misma transacción.

## Módulos

| Módulo | Qué hace |
|---|---|
| Socios | Alta con legajo automático, DNI, REPROCANN (estado/vencimiento), tipo de consumo, previsión, consentimiento, estados (pendiente/activo/suspendido/baja). |
| Stock | Cepas, lotes con origen del material y etapa, **cosecha en dos etapas** (húmedo → seco acredita stock), ajustes, destrucciones y transferencias con motivo. |
| Dispensario | Entrega con validación atómica (Serializable) de estado, REPROCANN, edad, tope diario/mensual, THC para menores y stock del lote. Anulación sólo por contra-asiento (ADMIN). |
| Reportes | CSV con `;` y BOM: padrón, libro de dispensaciones (con año de nacimiento, gramos, THC y firma), stock por lote, destrucciones e informe anual por variedad. |

## Puesta en marcha

```bash
npm install
bash scripts/dev-db.sh start      # Postgres local en 127.0.0.1:55433 (datos en ~/Dev/.cannabis-club-pgdata)
npx prisma migrate deploy
npm run db:seed
npm run dev                       # http://localhost:3300
```

Usuarios del seed (sólo demo): `admin@club.test / Admin1234!` y `operador@club.test / Operador1234!`.

Variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL` (ver `.env.example`). El resto —nombre y logo de los
correos, Resend, claves de documentos y cron— está comentado con lo que hace cada una.

## Verificación

```bash
npm test          # reglas de entrega y saldo (vitest)
npx tsc --noEmit  # tipos
npm run build     # build de producción
```

## Estructura

```
prisma/schema.prisma      modelo derivado del REA
prisma/seed.ts            club demo, usuarios, cepas, lotes, socios
src/lib/limits.ts         reglas puras de entrega + signo de movimientos
src/lib/dispensary.ts     transacción de entrega, saldo y anulación
src/lib/reports.ts        libros exportables
src/app/api/*             auth, socios, lotes, movimientos, dispensaciones, reportes, config
src/app/*                 panel, socios, stock, dispensario, reportes
scripts/dev-db.sh         cluster Postgres local descartable
```

Smoke de punta a punta contra la base local: `bash scripts/smoke-api.sh` (con la app corriendo y el seed recién aplicado).

La documentación de operación está en [`docs/`](docs): reglas de dominio (`REA-*`), correo, avisos, turnos,
traslados, privacidad, roles y la guía del REPROCANN para el portal.

## Límites conocidos

- No hay módulo de cuotas/aportes ni e-sign. El portal del socio, el carnet QR y la importación del padrón ya existen.
- El sistema **no reemplaza asesoría legal**: el club debe aportar nombre, CUIT, Director Médico y
  Responsable Técnico (Res. 1780/2025) y confirmar sus topes por escrito.
- Datos de salud: consentimiento, minimización y retención 5 años son requisito, no feature.
