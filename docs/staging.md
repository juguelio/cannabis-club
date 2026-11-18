# Staging: cómo se prueba antes de producción

Hay dos ambientes vivos del mismo proyecto de Vercel (`patagonia-sounds/cannabis-club`):

| | producción | staging |
|---|---|---|
| rama | `main` | `staging` |
| dominio | `republicacannabis.com.ar` | `staging.republicacannabis.com.ar` |
| datos | base real del club | base de prueba (`huella 2f21e9740a9a`) |
| quién entra | socios y club | sólo el equipo, con el link |

El dominio de staging está **atado a la rama**: cada push a `staging` lo actualiza solo, sin reasignar
alias a mano.

## Flujo de trabajo

1. Se corta una rama desde `staging` (`hal/algo`, `ramita/algo`) y se trabaja ahí.
2. El PR va **contra `staging`**, no contra `main`. Vercel arma un preview por rama, además del
   deployment de staging.
3. Se mira en `staging.republicacannabis.com.ar` con datos de prueba.
4. Recién cuando está aprobado, `staging` → `main`. Ese merge es el que publica en el club.

Regla práctica: **nada llega a `main` sin haber pasado por staging** (salvo un arreglo urgente, y en ese
caso se hace el mismo día el merge de vuelta a `staging` para que no se separen).

## Datos

Staging **no** usa la base de producción: `DATABASE_URL` de Preview apunta a otra base (se comprueba con
`/api/health`, que devuelve `huella`). Si alguna vez staging devuelve `f04e602c11be`, está apuntando a
producción: frenar y arreglar la variable antes de tocar nada.

Las variables de entorno de Preview ya están cargadas en Vercel (DB, `DOC_ENC_KEY`, `AUTH_SECRET`), pero
son **distintas** de las de producción. Un socio dado de alta en staging no existe en el club.

## Migraciones

El build de producción sólo migra con el candado de huella (`f04e602c11be`, ver
`references/migraciones-produccion.md` de la skill). Staging **no migra solo**: si un cambio trae
migración, se aplica a mano contra la base de staging y se verifica el enum/columna antes de mergear.

## Ingreso con Google

El login con Google depende de que el host esté autorizado en Google Cloud. Mientras
`staging.republicacannabis.com.ar` no figure como redirect autorizado, en staging se entra con
email y contraseña; Google sigue funcionando en producción.
