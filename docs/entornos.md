# Entornos: producción, preview y local

## Regla

**Un preview nunca escribe en la base de producción.** Hasta el 26-oct-2026 los dos entornos compartían `neondb`:
un deploy de prueba podía crear socios, dispensar o cerrar un mes sobre los datos reales del club.

## Cómo quedó

| Entorno | Base | Dónde |
|---|---|---|
| Producción | `neondb` | Neon `aws-sa-east-1`, host `ep-polished-mouse-b6pgnalj` |
| Preview | `cannabis_club_preview` | **misma instancia** de Neon, base aparte |
| Local | `cannabis_club_demo` | Postgres de desarrollo en `127.0.0.1:55433` |

- Las variables `DATABASE_URL` y `DIRECT_URL` de **Preview** en Vercel apuntan a `cannabis_club_preview`.
- `cannabis_club_preview` se creó con `create database`, se migró con `prisma migrate deploy` y se sembró con
  `npm run db:seed` (13 socios y 3 lotes de demostración). Se puede vaciar y volver a sembrar sin tocar producción.
- `DOC_ENC_KEY` también está en Preview: sin ella el alta con documentación no cifra.

## El candado

`src/lib/db-fingerprint.ts` calcula una **huella** de la base (sha256 del host + nombre, 12 caracteres). No expone la
cadena de conexión y no se puede revertir a la URL.

- `PROD_DB_FINGERPRINT` debe estar configurada también en Preview y Development; contiene la huella de producción. El valor histórico documentado es `f04e602c11be`: revalidarlo con el entorno real.
- `src/proxy.ts` corta con **409 `ENTORNO_COMPARTIDO`** las solicitudes a rutas de la app en `preview` o `development` cuya huella coincida con producción, incluidos GET/HEAD. GET también puede escribir: por ejemplo, el callback de Google crea cuentas.
- Sin huella configurada, esos entornos responden **503 `ENTORNO_SIN_VERIFICAR`**. `/api/health` queda disponible para diagnosticar el aislamiento; los assets excluidos del matcher no pasan por este control.
- Se reconocen los hosts directo y pooler de un mismo endpoint Neon sin cambiar las huellas históricas.

Es una barrera de solicitudes web, no un permiso de base de datos: los scripts, migraciones, tareas y conexiones directas necesitan separación de credenciales. No protege por sí sola un desarrollo local sin `VERCEL_ENV`. No sustituye probar respaldo y restauración.

## Cómo se comprueba

```
curl https://cannabis-club-mauve.vercel.app/api/health
→ {"ok":true,"entorno":"production","huella":"f04e602c11be",...}

curl https://<deploy-preview>.vercel.app/api/health
→ {"ok":true,"entorno":"preview","huella":"2f21e9740a9a",...}
```

Huellas iguales = mismo servidor y misma base: hay que separarlas.
