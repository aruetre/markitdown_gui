# Diseño: compactación del Markdown para reducir tokens

**Fecha:** 2026-06-05
**Estado:** aprobado (pendiente de plan de implementación)

## Objetivo

Reducir el número de tokens del Markdown generado mediante una **limpieza sin
pérdida** (lossless) del contenido, e **informar al usuario** del ahorro junto a
la estimación de tokens ya existente.

No se usa resumen por LLM ni ninguna técnica con pérdida: el significado del
documento no cambia, no se añaden dependencias ni se envía nada a terceros
(coherente con el enfoque local/privado de la app).

## Decisiones tomadas

- **Compresión sin pérdida** (no resumen LLM ni reducción agresiva).
- **Casilla activada por defecto** en la UI; se puede desmarcar.
- **% de compresión mostrado junto al consumo de tokens**, más un panel
  informativo en el modal.
- Implementación **server-side**, en el mismo pipeline que la anonimización, para
  que vista previa, descarga, ZIP y contador de tokens vean el mismo texto.

## Arquitectura

### Módulo nuevo: `backend/compactor.py`

Aislado, mismo patrón que `anonymizer.py`/`ocr.py`. Función pura, sin
dependencias, determinista e **idempotente**:

```python
def compact_markdown(text: str) -> str: ...
```

No necesita import perezoso (no tiene dependencias pesadas), pero se mantiene en
su propio módulo por claridad y para poder testearlo aislado.

### Integración en `backend/main.py`

- Ambos endpoints (`/api/convert`, `/api/convert-single`) aceptan un `Form`
  nuevo: `compact: bool = Form(True)` (activado por defecto).
- Helper `_compact(text, enabled)` que devuelve el texto compactado si procede.
- **Orden del pipeline por archivo:** `extraer (markitdown/OCR) → anonimizar →
  compactar`. Se compacta en último lugar para que el texto devuelto siempre
  salga limpio, sea cual sea el resultado de la anonimización.
- La respuesta de cada resultado incluye un campo nuevo **`original_chars`** (la
  longitud del texto *antes* de compactar). `markdown_content` ya va compactado.
  El % de ahorro lo calcula el cliente: `1 − len(markdown_content)/original_chars`.
  Cuando `compact` está desactivado, `original_chars == len(markdown_content)`
  (ahorro 0, no se muestra nada).

## Reglas de limpieza (lossless)

`compact_markdown` aplica, en orden, conservando el significado y **respetando
los bloques de código cercados (``` ``` ```)**, que se dejan intactos:

1. Normaliza saltos de línea (`\r\n`, `\r` → `\n`).
2. Quita el espacio en blanco al final de cada línea (fuera de bloques de código).
3. Elimina caracteres invisibles (zero-width `U+200B`, BOM `U+FEFF`, soft hyphen
   `U+00AD`) y convierte `NBSP` (`U+00A0`) en espacio normal.
4. **Colapsa 3 o más líneas en blanco consecutivas a una sola** (el mayor ahorro
   en salidas de PDF/Office).
5. Recorta las líneas en blanco al principio y al final del documento.
6. Elimina comentarios HTML `<!-- … -->`.
7. Elimina **líneas no vacías idénticas consecutivas** (cabeceras/pies de página
   repetidos de PDF).
8. Elimina **filas de tabla completamente vacías** (p. ej. `| | | |`).

Nota asumida: el paso 2 elimina el patrón Markdown de "dos espacios al final =
salto de línea forzado". Es muy raro en la salida de markitdown; se acepta el
trade-off a cambio de la simplicidad y el ahorro.

**Detección de bloques de código:** se recorre el texto por líneas llevando un
estado de "dentro de fence" que conmuta con líneas que empiezan por ``` ``` ``` o
`~~~`. Las líneas dentro de un fence se copian sin tocar.

## UX e información de compresión (frontend)

- **Casilla** "🗜️ Compactar Markdown (menos tokens)" en la sección de archivos,
  junto a la de anonimizar, **marcada por defecto**. Su estado viaja en el
  `FormData` de cada archivo como `compact`.
- **% junto al consumo de tokens:** en la fila de badges de tokens de cada
  resultado se añade una pieza **"🗜️ −18%"** (clase reutilizando el estilo de la
  etiqueta existente). Lleva un **tooltip**: *"Compactado sin pérdida: 1.480 →
  1.214 caracteres (−266). Se eliminaron líneas en blanco repetidas, espacios
  sobrantes, líneas duplicadas y comentarios HTML; el contenido no cambia."*
- **Panel informativo en el modal**, encima de la tabla de tokens por plataforma:
  - **Caracteres:** `1.480 → 1.214 (−18%)`
  - **Tokens ahorrados (aprox.):** `≈ −70`, calculado como
    `(original_chars − compactado) / charsPerToken` usando un valor
    representativo (`4.0`, el mismo orden que las plataformas latinas de la
    estimación existente). Es un único número orientativo, no por plataforma.
  - Línea breve: *"Compactación sin pérdida: blancos, espacios, duplicados y
    comentarios HTML."*
- Toda esta información **solo se muestra** si la compactación estuvo activa y el
  ahorro es > 0.

### Dónde vive en el frontend

- `index.html`: la casilla nueva en la sección de archivos.
- Un punto que lea la casilla al construir el `FormData` (junto a donde hoy se
  añade `anonymize`), en `conversion.js` o un pequeño helper análogo a
  `getAnonymizeSelection`.
- `tokens.js`: una función para renderizar la pieza de % y el panel del modal a
  partir de `original_chars` y el texto final.
- `results.js`: insertar la pieza de % en la fila de tokens del resultado y el
  panel en el modal (`viewContent`).

## Tests

- **`tests/test_compactor.py`** (unidad de `compact_markdown`):
  - Colapsa 3+ líneas en blanco a una.
  - Quita espacios finales y caracteres invisibles.
  - Elimina comentarios HTML.
  - Elimina líneas duplicadas consecutivas y filas de tabla vacías.
  - **Preserva intactos los bloques de código** (sangría y líneas en blanco
    dentro de ``` ``` ```).
  - **Idempotente:** `compact(compact(x)) == compact(x)`.
- **Endpoint** (en `test_api.py` o `test_compactor.py`): `compact=true` reduce y
  el resultado incluye `original_chars`; `compact=false` devuelve el texto sin
  tocar con `original_chars == len(contenido)`.

## Fuera de alcance

- Resumen o paráfrasis por LLM y cualquier técnica con pérdida.
- Colapsar espacios internos de línea, eliminar tablas/enlaces/formato, quitar
  stopwords.
- Compresión binaria (gzip) del contenido: aquí "compresión" significa reducir
  tokens del texto, no comprimir bytes.
