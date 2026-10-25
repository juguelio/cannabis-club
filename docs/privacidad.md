# Privacidad del padrón — qué se guarda y qué no

Documento operativo del club. Explica el criterio con el que la app trata los datos personales,
qué se puede prometer en una inspección y qué queda pendiente de decisión de la comisión directiva.

## 1. El documento no se archiva

El padrón necesita tres cosas: **detectar duplicados**, **verificar que la persona es quien dice ser**
y **poder decir después que se verificó**. Ninguna de las tres exige conservar el número.

Lo que se guarda:

| Campo | Qué es | Para qué |
|---|---|---|
| `docType` | DNI / LC / LE / PAS | encabezado del libro |
| `docHash` | HMAC-SHA256 del documento normalizado | duplicados y búsqueda exacta |
| `docLast4` | últimos 4 caracteres | verificación visual en el mostrador |
| `docVerifiedAt` | cuándo se verificó | trazabilidad de la verificación |

Lo que **no** existe en la base: la columna con el número. La migración
`…_borra_documento_en_claro` la elimina después de que todas las filas tienen huella.

**Consecuencias que hay que saber:**

- La búsqueda por documento es por **últimos 4** o por **número completo exacto** (se hashea lo tipeado
  y se compara). No se puede buscar "los que empiezan con 30".
- **Si se rota la clave de la huella, se pierde la búsqueda por documento** (no se puede recalcular sin
  el número). La clave es `DOC_HASH_KEY`; si no está definida, se deriva de `AUTH_SECRET`. Rotarla exige
  re-verificar documentos en el mostrador, no hay forma de recuperarlos.
- Perder la clave **no** expone nada: la huella no es reversible.

## 2. Consentimiento por finalidad

Cuatro finalidades, registradas por separado (`Consent`): **datos personales**, **salud**, **imagen** y
**comunicaciones**. Cada una guarda versión del texto, quién la registró y cuándo.

- Registrar es un acto del club con el socio presente (Administración u Operación).
- **Revocar no borra**: deja `revokedAt`. El consentimiento es un registro, no un checkbox.
- La ficha del socio muestra el estado de las cuatro; el padrón y los libros no dependen de ellas
  todavía (ver "pendiente").

## 3. Minimización en los libros

- Los CSV del padrón y de dispensaciones muestran **`DNI ····1234`**, nunca el número completo.
- Las dispensaciones guardan nombre, **año de nacimiento**, gramos, THC y fecha — no la fecha completa
  de nacimiento ni el documento.
- El modo inspección (`/inspeccion`) no muestra documentos.

## 4. Retención

Los libros (entregas, stock, calidad, cierres) se conservan **5 años** desde el cierre del ejercicio.
Los datos de contacto de un socio de baja se conservan mientras la obligación legal lo exija y después
se anonimizan (nombre reducido a iniciales, contacto borrado, legajo y movimientos intactos), porque el
libro tiene que seguir cuadrando sin identificar a la persona.

## 5. Pendiente (decisiones de la comisión, no del sistema)

1. **Texto del consentimiento** para cada finalidad: lo tiene que redactar el club con su asesor legal.
   La app registra la versión, no la inventa.
2. **Efecto de la revocación**: hoy revocar no bloquea la entrega. Definir si negar "datos personales"
   impide operar (criterio sugerido: sí, porque el padrón es la base legal de la entrega).
3. **Anonimización automática de bajas** a los N años: falta el job y la firma de quien lo autoriza.
4. **Datos de salud** (indicación médica, seguimiento del Director Médico): se implementan en el REA 7,
   con acceso restringido y consentimiento `SALUD` como condición.
