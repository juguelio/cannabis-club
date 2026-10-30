# República Cannabis — qué necesitamos del club

Documento para el cliente. Estado al 30-oct-2026.

## Ya está cargado y andando

- **El sitio** con sus textos: cultivo asociativo, «no se vende», membresía de 10 g, hasta 4 por envío (40 g),
  consulta médica $50.000 con 3 años de vigencia, retiro sin costo en la sede de San Telmo, y los cuatro valores de
  envío (CABA $10.000 · GBA 1º $18.000 · 2º $25.000 · interior $25.000, con Andreani y sus plazos).
- **Precios y aportes configurables**: en *Configuración › Precios y aportes* el club carga gramos por membresía,
  aporte por membresía, máximo por envío, zonas de envío y productos. No hace falta que nadie toque el sistema.
- **Cargado con su lista**: membresía 10 g a $130.000 → **$13.000 por gramo**, y eso es lo que la cuenta corriente
  carga en cada entrega (verificado: una entrega de 10 g genera un cargo de $130.000).
- Live Rosin 90u ($110.000) y PEN de live rosin 90u 24K ($120.000) cargados en la lista de productos.

## Necesitamos que el club decida

### 1. Tope mensual de retiro
El texto que se publica dice **«no hay límite mensual de provisión»**, pero el sistema hoy corta a **50 g por mes**
(y 25 g por día). Con eso, un socio que retira 40 g no puede hacer el segundo envío del mes: el mostrador lo frena.

¿Cuál es la regla que sostienen?
- (a) Sin tope mensual: se retira lo que el tratamiento indique, con el máximo de 40 g por envío.
- (b) Tope = lo que autorice el REPROCANN de cada paciente.
- (c) Se mantiene un tope fijo (50 g u otro número).

Es importante que quede escrito: el tope es lo que el sistema usa para **frenar una entrega** y lo que queda
registrado si un inspector revisa los libros.

### 2. Extractos (Live Rosin y PEN)
Hoy el registro trabaja en **gramos**. Para que un extracto quede asentado necesitamos el equivalente:
**¿1 PEN = cuántos gramos? ¿1 g de live rosin = cuántos gramos de flores?** Sin ese número el libro no puede
descontar stock de extractos.

### 3. ¿Los precios van en el sitio público?
Recomendación: **no**. Publicar una lista de precios en una web abierta contradice el marco de «no se vende, se
prorratean costos». Los aportes sí se ven en el **portal del socio** cuando consulta su cuenta.
Si prefieren publicarlos igual, se hace: es una decisión de ellos.

### 4. Actividades
Mencionan acceso a actividades en **CABA, La Plata y San Martín de los Andes**. ¿Las publicamos en el sitio?
Falta qué actividad, en qué lugar y con qué frecuencia.

### 5. Consulta médica
El sitio la describe como paso obligatorio de $50.000, pero **la app no agenda ni cobra la consulta**: hoy se
resuelve por fuera, directamente con el médico. ¿La quieren dentro del sistema (turno + pago) o queda así?

### 6. Datos legales (10 campos, hay 1 completo)
CUIL/CUIT real de la asociación, número de REPROCANN de la ONG, personería jurídica (número y fecha), director
médico y matrícula, responsable técnico y título, REPS y domicilio legal.
**Mientras sigan los datos de ejemplo, se imprimen en los libros y en el informe semestral.** El sistema ya los
marca como faltantes, pero los marca a nosotros, no a un inspector.

### 7. Cuentas y casillas
- Email real del **administrador** y del **dispensador** (hoy son de prueba y no deben quedar en producción).
- Qué proveedor de correo para `@republicacannabis.com.ar`: **Zoho** (gratis la primera casilla) o **Google
  Workspace** (~USD 7 por casilla). Lo paga el club.
- Falta que deleguen los dominios en nic.ar a los nameservers de Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).

### 8. Fotos
Las fotos de las variedades las sube el club. Si quieren, usamos las del Drive para la portada del sitio (hoy no
hay foto de portada y se ve la placa del logo).

### 9. Cuota social
Quedó en **$0**, porque en su esquema la membresía de 10 g ya es la cuota mínima de retiro. Si además cobran una
cuota social mensual aparte, decinos el monto y se carga.

---

## Lo que falta de nuestro lado (no depende del club)

- Verificar la delegación de dominios y dejarlos andando con `www` y redirección.
- Agregar el redirect nuevo en Google Cloud para que el login con Google siga funcionando en el dominio propio.
- Resend: sin clave no sale ningún email de la app (altas, avisos).
- Respaldo automático y tarea de retención programada.
