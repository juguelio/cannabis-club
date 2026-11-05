# Informe semestral — declaración jurada (Res. 1780/2025)

La resolución pide un **informe semestral en carácter de declaración jurada** con la **cantidad de plantas totales y
en floración** y la **variedad genética registrada**. Antes de esto, el club lo armaba a mano contando plantas y
revisando planillas: el dato existía en la app, pero no había documento.

## Qué declara la app

Por semestre (`AAAA-S1` = enero-junio, `AAAA-S2` = julio-diciembre):

- **Plantas totales** en cultivo (propagación + vegetativo + floración) y **en floración**.
- **Plantas por sala** y **por variedad**, con su genética.
- **Lotes en cultivo**: código, variedad, sala, etapa, plantas y fecha de plantado.
- **Actividad del semestre**: cosechado (g), dispensado (g), entregas registradas y lotes retirados.
- **Identidad de la asociación**: nombre, CUIT, REPROCANN, Director Médico y Responsable Técnico.

## Qué NO declara (y lo dice en el documento)

- La **referencia de inscripción de cada variedad** no está cargada: se informa el nombre y la genética, no un número
  de registro que la app no tiene.
- **Antecedentes penales** de las autoridades ni otra documentación societaria: no es dato de esta app.
- Nada de salud ni de pacientes: el informe es de cultivo.

Un informe que completa huecos con supuestos es un problema legal, no un detalle de diseño. Por eso el documento
imprime esos faltantes tal cual.

## Cómo se firma

- **Vista previa**: mientras no se firma, los números se recalculan de los libros cada vez que se abre.
- **Firmar** (sólo ADMIN) congela el contenido: guarda el payload, la **huella SHA-256 del JSON canónico** y quién
  firmó. Es append-only.
- **Un período ya firmado no se vuelve a firmar** (`409 ALREADY_SIGNED`): corregirlo es otro informe que declara qué
  reemplaza (`supersedesId`).
- La pantalla muestra si el contenido guardado **sigue coincidiendo** con la huella firmada.
- **Imprimible** en `/informe-semestral/<período>/imprimir`, con block de firmas para Responsable Técnico y autoridad
  de la asociación. Si el período está firmado, imprime el contenido firmado, no el recálculo de hoy.
- **CSV** con `;` y BOM, como el resto de los libros, para adjuntar al expediente.

## Dependencia de datos (importante)

El informe cuenta **`Batch.plantsCount`** de los lotes en etapa PROPAGACION, VEGETATIVO o FLORACION, y agrupa por
**`Batch.room`**. Si esos campos están vacíos, el informe declara **cero plantas** —y la pantalla lo avisa con un
aviso en rojo, en lugar de mostrar un cero silencioso—. Es la primera cosa que hay que cargar para que sirva.

## Pendientes

1. **Número de registro de cada variedad** (campo nuevo en `Strain` cuando la organización lo tenga).
2. **Plantas por lote a lo largo del tiempo**: hoy se informa el número actual del lote; no hay historia de bajas ni
   de sexado, así que "plantas en floración" es la foto del lote, no un movimiento.
3. **Firma digital** del responsable: hoy se imprime y se firma a mano.
4. **Envío al registro**: no hay integración con el sistema del Ministerio; se descarga e imprime.
