# Deploy

## Estado

- Proyecto Vercel: **`patagonia-sounds/cannabis-club`** (misma cuenta que `el-rey-jesus-audio`).
- Link local: `.vercel/project.json` (no se commitea).
- **Bloqueado en la base**: la org Supabase *Patagonia Sounds* ya tiene 2 proyectos free (Oficio y
  descanso-profundo) y el plan gratuito permite 2. Crear `cannabis-club` requiere liberar un slot,
  usar otra org/proveedor, o pagar. No se creó nada por decisión propia.

## Cuando haya DATABASE_URL

```bash
DATABASE_URL="postgresql://usuario:clave@host:5432/postgres?sslmode=require" bash scripts/deploy.sh
```

El script hace, en orden: `prisma migrate deploy` → seed (club demo + admin) → variables en Vercel
(`DATABASE_URL`, `AUTH_SECRET` si falta, `APP_BASE_URL`) → `vercel deploy --prod`.

## Antes de mostrarlo a un club

1. Cambiar la contraseña del usuario admin del seed (`admin@club.test / Admin1234!` es sólo demo).
2. Cargar los datos reales del club (CUIT, director médico, responsable técnico) y confirmar topes por escrito.
3. Revisar retención y consentimiento: son datos de salud.
4. Alternativa a Supabase: Neon free (10 proyectos) — mismo `DATABASE_URL`, sin cambios de código.
