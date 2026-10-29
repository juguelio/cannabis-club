# Plan para pasar de demo a producción (República Cannabis)

Escrito el 29-oct-2026 después del audio de Joaquín, los mensajes del cliente y la carpeta de Drive.

## Lo que se decidió

- **La demo no se destruye: se separa.** El club puede empezar a cargar datos reales sin perder la instancia que sirve
  para mostrar el producto a otros clubes («el dispensario de Pepito» es el mismo sistema con otra marca).
- **El sitio es un mockup de trabajo**, no una pieza cerrada: el cliente todavía tiene que decir qué quiere y cómo paga.

## Paso 1 — Producción limpia, demo intacta

Hoy producción usa `neondb`, que tiene los datos de demostración (13 socios, lotes, entregas). El cliente ya avisó que va
a cargar stock y los primeros usuarios reales: si eso entra en `neondb`, la demo se contamina y el legajo 1 es de prueba.

1. Crear `republica_prod` en la misma instancia de Neon.
2. `prisma migrate deploy` (sin `db:seed`).
3. Crear el ADMIN real con `scripts/rotate-user.ts` (email del club, clave temporal que se cambia al entrar).
4. Cargar `DATABASE_URL`/`DIRECT_URL` de producción apuntando a la base nueva y redeployar.
5. `neondb` queda como **base de demostración** (para `/sitio` y para la próxima reunión).
6. Verificar con `/api/health`: la huella de producción tiene que ser la nueva, y las altas de prueba no deben aparecer.

**Gate**: quién es el primer ADMIN (email) y confirmación de que los datos actuales de producción son descartables.

## Paso 2 — Rol DISPENSADOR

El cliente pidió «un usuario admin y otro DISPENSADOR que sólo finalice los pedidos en ENTREGADO/ENVIADO, sin poder
editar nada más».

- Rol nuevo `DISPENSADOR`: registra entregas (dispensa) y cierra traslados; lee el padrón para identificar; **no** edita
  socios, lotes, stock, configuración, ni anula asientos.
- **No hay botón «marcar entregado»**: en esta app el estado del traslado lo escribe el sistema cuando el ítem tiene su
  dispensa. Un DISPENSADOR que sólo cambia estados dejaría el libro mintiendo; el rol habilita **la entrega**, que es lo
  que mueve el registro.
- Alcance técnico: enum `Role` + `src/proxy.ts` + guardas de las rutas de dispensario/traslados + navegación + tests.

## Paso 3 — Dominio

`republicacannabis.com.ar` (y `.org.ar`) ya están disponibles para delegar.

1. Agregar el dominio en Vercel y obtener el destino.
2. Definir la delegación: NS a Vercel, o registros A/CNAME en el panel del registrador.
3. Cambiar `APP_BASE_URL` a `https://republicacannabis.com.ar`.
4. Agregar el redirect URI nuevo en Google Cloud (`/api/auth/google/callback`) y dejar el viejo mientras se prueba.
5. Verificar: `/sitio`, `/login` con Google y `/api/health` sobre el dominio nuevo.

**Gate**: acceso al panel del dominio (o que el club cargue los registros).

## Paso 4 — Los textos del Drive al sitio

La carpeta trae `TEXTOS SUPERIORES` con el copy que el cliente quiere:

- Titular: «Acceso al cannabis medicinal, seguro y de calidad».
- **Menos texto**, mensajes concretos; revisar que no se superpongan en web y móvil.
- Botón **«Crear cuenta»**; «Reservar consulta» tiene que estar en el **paso 1** del recorrido.
- Reemplazar el mensaje corto por **«Todo con REPROCANN»**.
- Bloque «Lo importante»: es cultivo asociativo, no se vende nada, las membresías cuantifican retiros.
- Requisitos de ingreso (usuario PACIENTE en REPROCANN, «¿Quién cultiva?» = Otro, formulario + DNI + credencial,
  consulta médica virtual, vinculación con el profesional y con la ONG) y «Antes de empezar» (una sola ONG, baja en
  cualquier momento, sin autocultivo, transporte 40 g de flores y 6 frascos de 30 ml).

## Paso 5 — Hueco de producto que abre ese documento

El texto pone **la consulta médica virtual como primer paso obligatorio** (Res. 1780/2025, director médico). Hoy la app
no tiene consulta ni agenda médica: el alta arranca en el formulario.

Decisión pendiente: ¿la consulta se agenda dentro de la app (turno + estado) o se resuelve con un link externo y la app
sólo registra que se hizo?

## Paso 6 — «Box» del administrador general

En el audio: un panel donde el administrador general carga todo sin que lo hagamos a mano.

- Datos legales del club: los campos existen (CUIT, director médico, responsable técnico) y se editan en
  Configuración › Club y reglas.
- **Variedades: hoy no hay pantalla** (`POST /api/strains` existe, ninguna UI lo usa). Sin eso el club no puede cargar su
  catálogo real ni subir fotos.
- Fotos de producto: la carpeta del Drive tiene cultivo, sala y prensa, pero **no fotos de flores o extractos** para el
  catálogo.

## Qué datos pedirles

Ver `docs/datos-del-club.md`: identidad legal, reglas de entrega, catálogo, envíos y textos legales, con quién carga cada
cosa (ellos en Configuración, o nosotros por única vez).
