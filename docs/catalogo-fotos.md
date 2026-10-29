# Catálogo con fotos del producto

El club carga sus variedades y **su propia foto** desde Configuración › Catálogo. La misma foto se ve en el sitio público
(`/sitio#variedades`) y en el portal del socio.

## Cómo se usa

1. Configuración › **Catálogo** → «Agregar variedad» (nombre, genética, THC, CBD).
2. En la tarjeta de la variedad: **Subir foto** (JPG, PNG o WEBP, hasta 3 MB).
3. **Cambiar foto** reemplaza la anterior; **Quitar** vuelve al recuadro «Foto provisoria».
4. **Apagar** deja de mostrarla en el catálogo sin borrar el historial de lotes. **Publicar** la vuelve a mostrar.

## Reglas

- **Sin foto no hay hueco**: el catálogo muestra un recuadro con una hoja y la leyenda «Foto provisoria», para que el
  club pueda publicar el nombre y los cannabinoides antes de tener la foto (lo que pidió el cliente: «voy a poner algo
  provisorio y después le hago la foto a las plantas»).
- La foto **no se publica con datos personales**: es sólo la imagen del producto.
- La imagen vive en la base (`Strain.fotoData`) y se sirve por `GET /api/variedades/<id>/foto?v=<versión>`. Cada cambio
  sube `fotoVersion`, así que la caché se invalida sola y la respuesta vieja no queda pegada.
- `POST`/`DELETE /api/strains/<id>/foto` pide sesión de equipo (ADMIN u OPERADOR) y queda en auditoría
  (`STRAIN_PHOTO` / `STRAIN_PHOTO_DELETE`). El `GET` es público (sin datos personales) y está en `PUBLIC` del proxy.
- **No se borra una variedad**: se apaga. Borrarla dejaría lotes históricos sin su cepa.
