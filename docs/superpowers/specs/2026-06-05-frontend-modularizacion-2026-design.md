# Diseño: modularización del frontend, estándares 2026 y contraste

**Fecha:** 2026-06-05
**Estado:** aprobado (pendiente de plan de implementación)

## Objetivo

Mejorar la claridad del código frontend troceando los actuales monolitos
(`script.js` 693 líneas, `styles.css` 1257 líneas) en módulos con una sola
responsabilidad, aplicar estándares web actuales (2026) sin introducir build
step, y mejorar el contraste de los elementos de la UI hasta nivel WCAG AA
("Cómodo").

No hay cambios de backend ni de comportamiento funcional: es un refactor de
estructura + un ajuste de paleta.

## Decisiones tomadas

- **Sin build step.** Se usan ES modules nativos (`<script type="module">`,
  `import`/`export`) y CSS dividido en parciales con `@layer`. Cero dependencias
  nuevas, coherente con la arquitectura descrita en CLAUDE.md.
- **Modernización pragmática** (no "profunda"): se moderniza lo que aporta
  claridad/accesibilidad sin arriesgar regresiones.
- **Contraste nivel Cómodo (WCAG AA).**

## Arquitectura de ficheros

### Puntos de entrada estables

`frontend/static/script.js` y `frontend/static/styles.css` **se conservan como
ficheros índice**. Motivo: `tests/test_api.py` (líneas 19–20) comprueba que
`/static/styles.css` y `/static/script.js` devuelven 200, y mantener esas URLs
estables evita romper tests y enlaces. `StaticFiles` sirve los subdirectorios
`/static/js/` y `/static/css/` automáticamente, sin tocar el montaje.

### JavaScript — `frontend/static/js/` (ES modules)

Un módulo = una responsabilidad describible en una frase, legible y testeable de
forma aislada.

| Módulo | Responsabilidad |
|--------|-----------------|
| `main.js` | Bootstrap: `DOMContentLoaded`, carga inicial y cableado de listeners |
| `state.js` | Estado mutable compartido, exportado como **un único objeto** `state` |
| `api.js` | Todas las llamadas `fetch` a `/api/*` (formats, anonymizer-options, convert-single, zip) |
| `utils.js` | Funciones puras: `escapeHtml`, `extOf`, `formatFileSize`, `formatElapsed`, iconos |
| `tokens.js` | Estimación de tokens: plataformas, logos, `renderTokenBadges`, `renderTokenTable` |
| `anonymize.js` | Carga de opciones y lectura de selección de anonimización |
| `files.js` | Selección/drag-drop, lista, "añadir más", quitar, limpiar |
| `conversion.js` | Bucle de conversión y log de progreso |
| `results.js` | Render de resultados, modal `<dialog>` y descargas (individual + ZIP) |
| `toast.js` | Notificaciones efímeras |

`frontend/static/script.js` queda reducido a un único `import './js/main.js';`.

**Estado compartido:** `state.js` exporta `export const state = { selectedFiles: [],
supportedFormats: {}, currentModalData: null }`. Los módulos mutan
`state.selectedFiles` (no se exportan primitivas sueltas, que serían de solo
lectura en el importador).

**Modal:** la lógica del modal vive dentro de `results.js` (el modal solo
previsualiza un resultado: están acoplados por naturaleza).

### CSS — `frontend/static/css/` con `styles.css` como índice

`styles.css` declara el orden de capas e importa los parciales:

```css
@layer reset, theme, base, layout, components, utilities;

@import url("css/theme.css")  layer(theme);    /* variables :root + dark mode */
@import url("css/base.css")   layer(base);     /* reset, tipografía, body */
@import url("css/layout.css") layer(layout);   /* container, header */

@import url("css/components/admonition.css") layer(components);
@import url("css/components/upload.css")     layer(components);
@import url("css/components/formats.css")    layer(components);
@import url("css/components/files.css")      layer(components);
@import url("css/components/anonymize.css")  layer(components);
@import url("css/components/progress.css")   layer(components);
@import url("css/components/results.css")    layer(components);
@import url("css/components/tokens.css")     layer(components);
@import url("css/components/modal.css")      layer(components);
@import url("css/components/toast.css")      layer(components);
@import url("css/components/buttons.css")    layer(components);

@import url("css/utilities.css") layer(utilities);  /* .hidden y helpers */
```

Las media queries responsive de cada componente viven en su propio parcial (no
en un fichero `responsive.css` global).

**Tradeoff asumido:** `@import` nativo encadena descargas (sin bundler). En una
app local same-origin es irrelevante.

### HTML

`index.html` sigue siendo un único fichero (es la vista). Cambios:

- `<script src="static/script.js">` → `<script type="module" src="static/script.js">`.
- Se eliminan los `onclick` inline (`closeModal()`, etc.).
- Se eliminan los `style="display:none"` inline → atributo `hidden` / clase `.hidden`.
- El modal de vista previa pasa a `<dialog>` nativo.

## Estándares 2026 aplicados (pragmático)

- **ES modules nativos.**
- **Sin handlers inline:** delegación de eventos con `addEventListener` y
  atributos `data-index` / `data-action`. Elimina la necesidad de funciones
  globales (`removeFile`, `viewContent`, `downloadFile`, `closeModal`).
- **Sin estilos inline de visibilidad:** atributo `hidden` + utilidad `.hidden`,
  conmutados por JS.
- **`<dialog>` nativo** para el modal: `showModal()`/`close()`, cierre con `Esc`
  y clic en backdrop, gestión de foco por el navegador.
- **`@layer`** para una cascada explícita.
- **`color-mix()`** para derivar colores de badge (texto incluido).
- **`:focus-visible`** reforzado (anillo más visible).

**Fuera de alcance a propósito** (evitar regresiones): no se migra el theming a
`light-dark()`, ni se introducen container queries ni View Transitions. El
mecanismo de dark mode actual (`@media (prefers-color-scheme)` + `[data-theme]`)
se conserva, solo se reubica a `theme.css`.

## Contraste (nivel Cómodo / WCAG AA)

### Modo claro

| Token | Ahora | Nuevo | Efecto |
|-------|-------|-------|--------|
| `--color-fg-muted` | `#475569` | `#334155` | texto secundario ~10:1 |
| `--color-fg-subtle` | `#64748B` | `#475569` | de ~4.5:1 (justo) a ~7:1 |
| `--color-border` | `#E2E8F0` | `#CBD5E1` | bordes de tarjetas visibles |
| `--color-border-strong` | `#CBD5E1` | `#94A3B8` | separadores ~2.8:1 |

### Modo oscuro

| Token | Ahora | Nuevo |
|-------|-------|-------|
| `--color-border` | `#1E293B` | `#334155` |
| `--color-border-strong` | `#334155` | `#475569` |

`--color-fg-subtle` en oscuro (`#94A3B8`, ~6:1) se conserva.

### Badges de tokens

El texto del badge se oscurece/aclara respecto al color de marca para contrastar
con su fondo suave:

- Claro: `color = color-mix(in srgb, var(--token-color), #000 22%)`.
- Oscuro: `color = color-mix(in srgb, var(--token-color), #fff 18%)`.
- Borde: mezcla del color de marca 40% → 55%.

La jerarquía visual y los colores de marca de logos se mantienen; solo cambia la
legibilidad del texto.

## Compatibilidad y verificación

- **URLs estables** → `test_api.py` sigue verde sin cambios. (Opcional: añadir
  una aserción de que `/static/js/main.js` devuelve 200 para cubrir el montaje de
  subdirectorios.)
- **Sin cambios de backend** ni de comportamiento.
- **Verificación:**
  - `node --check` en cada módulo JS.
  - `uv run --all-extras pytest` → 33 tests verdes.
  - Prueba manual con `./run.sh` y recarga forzada (`Ctrl+Shift+R`): subir varios
    archivos, "añadir más", convertir, anonimizar, ver modal, descargar, ZIP, y
    revisar contraste en claro y oscuro.
- **CLAUDE.md:** actualizar la sección *Frontend* para describir la nueva
  estructura de `js/` y `css/`.

## Fuera de alcance

- Migración a `light-dark()`, container queries, View Transitions.
- Bundler / build step.
- Cualquier cambio funcional o de backend.
- Tests unitarios de JavaScript (no existen hoy; el proyecto verifica vía la API).
