# Videos del club

Pipeline reproducible de los videos de recorrido (captura real, cursor sintético, locución es-AR).

| Video | Guion | Voz | Para quién |
|---|---|---|---|
| `socio.mp4` | `guion-socio.json` | `es-AR-ElenaNeural` | el socio: carnet, reserva, historial |
| `admin.mp4` | `guion-admin.json` | `es-AR-TomasNeural` | quien administra: padrón, altas, dispensario, libros |
| `dispensario.mp4` | `guion-dispensario.json` | `es-AR-TomasNeural` | el mostrador: turnos del día, entrega, comprobante |

## Orden de ejecución (saltearse un paso falla tarde)

```bash
# 0. app con datos de demo corriendo (otra terminal)
#    DATABASE_URL → cannabis_club_demo, APP_BASE_URL → http://127.0.0.1:3321
npm run build && npx next start -p 3321

# 1. locución (edge-tts, una por vez) y duraciones.json
python3 narrar.py                             # o: narrar.py socio
# 2. masterizado de voz (-16 LUFS)
python3 masterizar.py
# 3. placas de portada/cierre y bandas de subtítulo
python3 placas.py
# 4. grabación (screencast + cursor)
node record.mjs socio
node record.mjs admin
node record.mjs dispensario
# 5. montaje y subtítulos
python3 montar.py socio && python3 montar.py admin && python3 montar.py dispensario
```

Los archivos intermedios viven en `.videos-work/` (ignorado por git): `audio/`, `audio-master/`,
`bandas/`, `placas/`, `grab-<cual>/`, `seg-<cual>/`. Los `.mp4` y `.srt` finales se copian a
`.shots/videos/` para entregar.

## Reglas

- **El guion manda.** Cada sección de tipo `nav` necesita: una entrada en el guion, un handler
  `ACC[id]` en `record.mjs` y una banda; las de tipo `placa` usan una placa por nombre.
  Si falta cualquiera de los tres, el montaje falla **después** de haber grabado todo.
- **Ids únicos por texto.** Cambiar la locución de una sección pide un id nuevo: `narrar.py`
  saltea los mp3 que ya existen y reusaría el audio viejo con el texto nuevo.
- **Credenciales** en `claves.json` (demo local). No van al repo con valores reales.
- **Se graba contra un build con los fixes.** Si se grabó antes de un arreglo de UI, el video
  vuelve a mostrar el bug.

## Estado de los datos de demo que usan los videos

- `maria@club.test` (legajo 1) reserva 10 g en el video del socio; `admin` cierra esa entrega.
- `Ana Ruiz` (legajo 3) tiene una reserva para el miércoles que cierra el video del mostrador.
- `dispensador@club.test` es la cuenta DISPENSADOR del video (no existe en producción así).
- `demo-lucia-002` + `token-solicitud.txt` (JWT `scope=solicitud`, 4 h) permiten mostrar `/solicitud`.
