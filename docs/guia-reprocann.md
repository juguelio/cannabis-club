# Guía del REPROCANN en el portal

Reconstruida el **2026-11-04** de la mini página de recepción del consultorio del Dr. Javier Victorica
(link público compartido por el club). Método REA: lo observado, lo inferido y las decisiones.

## Lo observado (fuente)

- Consulta **por videollamada (Google Meet)**, con tres profesionales que hacen la consulta **y la carga
  del trámite**: Javier Victorica y Federico Brodschi con agenda online (Doodle), Paula Barreiro por
  WhatsApp.
- Valor de la consulta en la fuente: **$60.000**. Vinculación de quien ya tiene REPROCANN: **$40.000**.
- Siete preguntas frecuentes; dos de ellas son las importantes: **cuánto tarda** (autocultivo vs. club)
  y **mi trámite está trabado**, con cuatro estados.
- Contacto del consultorio: WhatsApp **+54 9 11 3148-2320**, Instagram **@codigoverde8**.
- Control médico **cada 6 meses** para socios de clubes, según la reglamentación.

## Lo inferido

- Los cuatro estados trabados son el mayor valor operativo: son exactamente los mensajes que hoy
  llegan a la secretaría. El más frecuente, «pendiente de consentimiento del paciente», es gente que
  nunca aceptó los términos en REPROCANN.
- La página de la fuente es de captación del consultorio; en el portal del club cumple otra función:
  que el socio sepa **qué le toca a él y qué le toca al club**.

## Decisiones de producto

- **La página dice lo que el club no puede hacer**: el trámite lo inicia y lo acepta el socio; el club
  vincula y avisa. Eso no es letra chica, es la causa de la mitad de los idas y vueltas.
- **El club no cobra la consulta**: el pago es al consultorio. Queda escrito en la página para que
  nadie lea la guía como una venta del club.
- **Contenido como dato** (`src/lib/guia-reprocann.ts`), no como JSX: cambiar un profesional, un
  estado o un tiempo es tocar un archivo, y los tests cuidan que no falte nada.
- **Diseño con el lenguaje del sitio** (`.sitio`: banda oscura, titular de afiche, tarjetas con trazo
  y sombra dura) pero a la escala del portal, que es una columna de 720 px.

## El valor de la consulta (resuelto el 4-nov-2026)

Rige el del consultorio: **$60.000**. El club lo confirmó y se actualizaron los dos lugares donde el
número se ve:

| Lugar | Antes | Ahora |
|---|---|---|
| Guía del portal (`src/lib/guia-reprocann.ts`) | no publicado | **$60.000** |
| Sitio público (`Club.marca.sitio.pasos`, paso 4) | $50.000 | **$60.000** |

Si el valor cambia otra vez, se tocan esos dos lugares. El test `publica el valor del consultorio`
fija la constante: un cambio de precio obliga a pasar por el test, no a que se escape un número
viejo en producción.

## Otras contradicciones detectadas en la misma pasada (no tocadas)

- `Club.marca.sitio.pasos` manda a **retirar en la sede de San Telmo**: el club **sí** está en San
  Telmo; San Martín de los Andes será una segunda sede. No se tocó.
- `Club.marca.sitio.enviosTexto` dice CABA **$20.000** y GBA **$25.000**; la configuración
  (`Club.precios`) dice CABA **$10.000** y GBA1 **$18.000**.
- El paso 4 de la marca dice que la consulta es **obligatoria (Res. 1780/2025)** y de **vigencia 3
  años**; la guía del consultorio habla de control cada 6 meses. No se contradicen (aprobación vs.
  control), pero conviene que el texto del sitio lo diga con las mismas palabras.
