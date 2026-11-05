# La migración del domicilio quedó fuera de orden (y rompe un deploy desde cero)

Estado: **diagnóstico verificado el 05-nov-2026**. No se tocó ninguna base de producción.

## Qué pasa

Hay dos migraciones que se contradicen en el orden:

| Carpeta | Qué hace | Commit |
|---|---|---|
| `20261102140000_revalidacion_dni_reprocann` | **crea** `MemberVerification` y `VerificationDocument` | `d6d2e40` (primero) |
| `20261102010000_domicilio_en_la_validacion` | **altera** `MemberVerification` (agrega domicilio) | `bfc0dd0` (después) |

Prisma aplica por nombre de carpeta, y `02010000` ordena **antes** que `140000`. Resultado:

- En la base de producción el orden real fue el de los commits (revalidación → domicilio): está bien.
- En una base **nueva**, `domicilio_en_la_validacion` corre primero y falla con
  `ERROR: relation "MemberVerification" does not exist`. `prisma migrate deploy` corta ahí y el
  deploy queda a medias: por eso el seed después se cae con `Club.cobro` inexistente.

Verificado en limpio: 34 migraciones, 5 pendientes, la primera que corre es la del domicilio.

## Por qué importa

Hoy no se nota porque producción ya migró. Se nota el día que haya que:

- levantar el entorno de un club nuevo desde cero,
- crear una base de preview/staging,
- recuperar producción desde backup vacío.

Ese día el alta falla y parece un bug de la app, no del historial.

## Arreglo (en este orden, siempre)

El nombre de la carpeta y el registro en `_prisma_migrations` tienen que cambiar **juntos**. Si se
renombra sólo el archivo, el próximo `migrate deploy` ve una migración "nueva" y trata de agregar
columnas que ya existen: deploy roto y a mano.

### 1. Base que ya aplicó la migración (producción)

Renombrar el registro primero, con la base apuntada y un respaldo del registro:

```bash
# respaldo de la fila
psql "$DATABASE_URL" -c "SELECT * FROM _prisma_migrations WHERE migration_name LIKE '%domicilio%'" \
  | tee ~/.config/respaldo-migracion-domicilio.txt

# renombrar el registro (bookkeeping: la migración ya está aplicada)
psql "$DATABASE_URL" -c "UPDATE _prisma_migrations
  SET migration_name = '20261102170000_domicilio_en_la_validacion'
  WHERE migration_name = '20261102010000_domicilio_en_la_validacion';"
```

### 2. Repo

```bash
git mv prisma/migrations/20261102010000_domicilio_en_la_validacion \
       prisma/migrations/20261102170000_domicilio_en_la_validacion
git commit -m "Migración del domicilio: el orden de carpetas ahora coincide con el orden real"
```

### 3. Verificación

```bash
npx prisma migrate status   # tiene que decir "Database schema is up to date"
```

Y en una base nueva (local descartable): `migrate deploy` completo + `npm run db:seed`.

## Estado actual

- **Template** (`juguelio/cannabis-club-template`): ya corregido. La carpeta se llama
  `20261102170000_domicilio_en_la_validacion` y una instalación limpia aplica 34/34 y siembra.
- **Este repo**: pendiente. El arreglo es el de arriba y toca la base de producción en un solo
  `UPDATE` de bookkeeping: necesita aprobación explícita antes de correrse.
- `scripts/fix-migracion-domicilio.sh` hace los pasos 1 y 2 juntos, con dry-run por defecto y
  `--si` para ejecutar. No se corrió contra ninguna base.
