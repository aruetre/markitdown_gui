# Compactación del Markdown (reducción de tokens) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir los tokens del Markdown generado con una limpieza sin pérdida y mostrar el % de compresión junto a la estimación de tokens.

**Architecture:** Módulo puro `backend/compactor.py` (`compact_markdown`) integrado en el pipeline de ambos endpoints (`extraer → anonimizar → compactar`), con una casilla activada por defecto en el frontend y un indicador de ahorro junto a los tokens. Server-side para que preview/descarga/zip/tokens vean el mismo texto.

**Tech Stack:** FastAPI (Python 3.10+, stdlib `re`), vanilla JS (ES modules), CSS, pytest + TestClient. Comandos con `uv`.

**Nota de implementación (desviación menor aprobada en intención):** la regla de líneas en blanco colapsa **cualquier run de 2+ líneas en blanco a 1** (el spec decía "3+"). Es igualmente lossless para el render Markdown y ahorra algo más; misma intención.

**Convención de commits:** mensajes en español, **sin** trailer `Co-Authored-By`.

---

### Task 1: Módulo `backend/compactor.py` (limpieza lossless)

**Files:**
- Create: `backend/compactor.py`
- Test: `tests/test_compactor.py`

- [ ] **Step 1: Escribir los tests de unidad (fallan)**

Create `tests/test_compactor.py`:

```python
from backend.compactor import compact_markdown


def test_colapsa_lineas_en_blanco():
    assert compact_markdown("a\n\n\n\nb") == "a\n\nb"


def test_recorta_blancos_inicio_y_final():
    assert compact_markdown("\n\n  \nhola\n\n  \n") == "hola"


def test_quita_espacios_finales():
    assert compact_markdown("hola   \nmundo\t") == "hola\nmundo"


def test_quita_caracteres_invisibles_y_nbsp():
    assert compact_markdown("a\u200b\ufeffb\u00a0c") == "ab c"


def test_quita_comentarios_html():
    assert compact_markdown("a\n<!-- nota\nmultilinea -->\nb") == "a\n\nb"


def test_dedup_lineas_identicas_consecutivas():
    assert compact_markdown("Pagina 1\nPagina 1\ntexto") == "Pagina 1\ntexto"


def test_dedup_con_blanco_entre_medias():
    assert compact_markdown("Cabecera\n\nCabecera\n\nCuerpo") == "Cabecera\n\nCuerpo"


def test_quita_filas_de_tabla_vacias():
    assert compact_markdown("| a | b |\n| | |\n| c | d |") == "| a | b |\n| c | d |"


def test_no_quita_separador_de_tabla():
    md = "| a | b |\n|---|---|\n| c | d |"
    assert compact_markdown(md) == md


def test_preserva_bloques_de_codigo():
    md = "```\ndef f():\n\n\n    return 1\n```"
    # dentro del fence no se tocan ni sangrías ni líneas en blanco
    assert compact_markdown(md) == md


def test_idempotente():
    md = "a\n\n\n\nb   \n<!-- x -->\n| | |\n"
    once = compact_markdown(md)
    assert compact_markdown(once) == once


def test_vacio():
    assert compact_markdown("") == ""
```

- [ ] **Step 2: Ejecutar para ver que fallan**

Run: `uv run --all-extras pytest tests/test_compactor.py -q`
Expected: FAIL (`ModuleNotFoundError: backend.compactor`).

- [ ] **Step 3: Implementar `backend/compactor.py`**

Create `backend/compactor.py`:

```python
"""Compactación sin pérdida del Markdown para reducir tokens.

Quita "paja" del Markdown (líneas en blanco repetidas, espacios sobrantes,
caracteres invisibles, comentarios HTML, líneas duplicadas consecutivas y filas
de tabla vacías) sin alterar el significado. Los bloques de código cercados
(``` o ~~~) se dejan intactos. La función es determinista e idempotente.
"""

from __future__ import annotations

import re

# Caracteres invisibles a eliminar: zero-width space, BOM, soft hyphen.
_INVISIBLES = dict.fromkeys(map(ord, "\u200b\ufeff\u00ad"), None)
_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
# Fila de tabla totalmente vacía: solo pipes y espacios, con 2+ pipes.
_EMPTY_TABLE_ROW = re.compile(r"^\s*\|(?:\s*\|)+\s*$")


def _is_fence(line: str) -> bool:
    stripped = line.lstrip()
    return stripped.startswith("```") or stripped.startswith("~~~")


def compact_markdown(text: str) -> str:
    """Devuelve el Markdown compactado sin pérdida de información."""
    if not text:
        return text

    # Normalización global previa al recorrido por líneas.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.translate(_INVISIBLES).replace("\u00a0", " ")
    text = _HTML_COMMENT.sub("", text)

    out: list[str] = []
    in_fence = False
    pending_blank = False  # hay una línea en blanco pendiente de emitir

    for raw in text.split("\n"):
        if _is_fence(raw):
            if pending_blank and out:
                out.append("")
            pending_blank = False
            in_fence = not in_fence
            out.append(raw)
            continue

        if in_fence:
            out.append(raw)  # contenido de código: intacto
            continue

        line = raw.rstrip()

        if line == "":
            if out:  # ignora líneas en blanco iniciales
                pending_blank = True
            continue

        if _EMPTY_TABLE_ROW.match(line):
            continue

        # Dedup de líneas idénticas consecutivas (también con blanco entre medias).
        if out and out[-1] == line:
            pending_blank = False
            continue

        if pending_blank:
            out.append("")
            pending_blank = False
        out.append(line)

    # Un pending_blank al final no se emite => recorta blancos finales.
    return "\n".join(out)
```

- [ ] **Step 4: Ejecutar tests hasta verde**

Run: `uv run --all-extras pytest tests/test_compactor.py -q`
Expected: PASS (12 tests).

- [ ] **Step 5: Lint/format**

Run: `uv run ruff check backend/compactor.py tests/test_compactor.py && uv run black backend/compactor.py tests/test_compactor.py`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add backend/compactor.py tests/test_compactor.py
git commit -m "Añade compactor de Markdown sin pérdida"
```

---

### Task 2: Integrar la compactación en los endpoints

**Files:**
- Modify: `backend/main.py` (import; helper `_compact`; `compact: bool = Form(True)` y uso en `/api/convert` y `/api/convert-single`; campo `original_chars` en cada resultado)
- Test: `tests/test_compactor.py` (tests de endpoint)

- [ ] **Step 1: Escribir los tests de endpoint (fallan)**

Append to `tests/test_compactor.py`:

```python
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_convert_single_compacta_por_defecto():
    contenido = b"linea1\n\n\n\nlinea2\n"
    r = client.post(
        "/api/convert-single",
        files={"file": ("doc.txt", contenido, "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    # original_chars refleja el texto antes de compactar; el contenido va compactado.
    assert body["original_chars"] > len(body["markdown_content"])
    assert "\n\n\n" not in body["markdown_content"]


def test_convert_single_sin_compactar_conserva():
    contenido = b"linea1\n\n\n\nlinea2"
    r = client.post(
        "/api/convert-single",
        files={"file": ("doc.txt", contenido, "text/plain")},
        data={"compact": "false"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["original_chars"] == len(body["markdown_content"])
    assert "\n\n\n" in body["markdown_content"]
```

> Nota: markitdown convierte `.txt` devolviendo su texto tal cual, por lo que las líneas en blanco del input llegan al compactor.

- [ ] **Step 2: Ejecutar para ver que fallan**

Run: `uv run --all-extras pytest tests/test_compactor.py -k endpoint or compact -q`
(Si el filtro no casa, ejecuta el fichero completo.)
Run: `uv run --all-extras pytest tests/test_compactor.py::test_convert_single_compacta_por_defecto -q`
Expected: FAIL (`KeyError: 'original_chars'`).

- [ ] **Step 3: Añadir import y helper en `backend/main.py`**

En `backend/main.py`, junto al resto de imports de `backend` (donde está `from backend import ocr`), añade:

```python
from backend import compactor
```

Y junto a `_apply_anonymization`, añade el helper:

```python
def _compact(text: str, enabled: bool) -> str:
    """Compacta el Markdown si se pidió (limpieza sin pérdida)."""
    if not enabled:
        return text
    return compactor.compact_markdown(text)
```

- [ ] **Step 4: Usar `compact` en `/api/convert-single`**

En la firma de `convert_single_file`, añade el parámetro (tras `anonymize_entities`):

```python
    compact: bool = Form(True),
```

Sustituye el bloque que calcula `text_content` y construye la respuesta por:

```python
            try:
                text_content = _apply_anonymization(raw_text, anonymize, entities)
            except (ImportError, OSError) as e:
                raise HTTPException(
                    status_code=503,
                    detail=f"Anonimización no disponible: {e}",
                )

            original_chars = len(text_content)
            text_content = _compact(text_content, compact)

            return JSONResponse(
                {
                    "original_filename": _safe_filename(file.filename),
                    "format": SUPPORTED_EXTENSIONS.get(file_extension, "Unknown"),
                    "extension": file_extension,
                    "markdown_content": text_content,
                    "markdown_filename": f"{filename_without_ext}.md",
                    "anonymized": bool(anonymize and entities),
                    "original_chars": original_chars,
                    "status": "success",
                }
            )
```

- [ ] **Step 5: Usar `compact` en `/api/convert`**

En la firma de `convert_files`, añade el parámetro (tras `anonymize_entities`):

```python
    compact: bool = Form(True),
```

Sustituye el bloque que construye `text_content` y el `results.append(...)` por:

```python
                raw_text = _extract_markdown(tmp_path, file_extension)
                filename_without_ext = _safe_filename(Path(file.filename or "").stem)
                text_content = _apply_anonymization(raw_text, anonymize, entities)
                original_chars = len(text_content)
                text_content = _compact(text_content, compact)

                results.append(
                    {
                        "original_filename": safe_name,
                        "format": SUPPORTED_EXTENSIONS.get(file_extension, "Unknown"),
                        "extension": file_extension,
                        "markdown_content": text_content,
                        "markdown_filename": f"{filename_without_ext}.md",
                        "anonymized": bool(anonymize and entities),
                        "original_chars": original_chars,
                        "status": "success",
                    }
                )
```

- [ ] **Step 6: Ejecutar toda la suite**

Run: `uv run --all-extras pytest -q`
Expected: PASS (todo verde, incluidos los nuevos de endpoint).

- [ ] **Step 7: Lint/format + commit**

```bash
uv run ruff check backend/main.py && uv run black backend/main.py tests/test_compactor.py
git add backend/main.py tests/test_compactor.py
git commit -m "Integra la compactación en los endpoints de conversión"
```

---

### Task 3: Casilla "Compactar" en el frontend y envío del flag

**Files:**
- Modify: `frontend/index.html` (casilla `compactCheck`)
- Modify: `frontend/static/js/conversion.js` (añadir `compact` al FormData)

- [ ] **Step 1: Añadir la casilla en `index.html`**

En la sección `#filesSection`, **justo antes** de `<div class="anonymize-box">`, inserta:

```html
                <label class="compact-toggle">
                    <input type="checkbox" id="compactCheck" checked>
                    <span>🗜️ Compactar Markdown (menos tokens)</span>
                </label>
```

- [ ] **Step 2: Enviar el flag en `conversion.js`**

En `frontend/static/js/conversion.js`, dentro del bucle donde se construye el `formData` de cada archivo (donde ya se añade `anonymize`), añade tras el bloque de anonimización:

```js
        const compact = document.getElementById('compactCheck')?.checked;
        formData.append('compact', compact ? 'true' : 'false');
```

- [ ] **Step 3: Verificación de sintaxis**

Run: `node --check frontend/static/js/conversion.js`
Expected: sin salida (OK).

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/static/js/conversion.js
git commit -m "Añade casilla de compactación y envía el flag al backend"
```

---

### Task 4: Mostrar el % de compresión junto a los tokens

**Files:**
- Modify: `frontend/static/js/tokens.js` (helpers de compresión; `renderTokenBadges` admite prefijo)
- Modify: `frontend/static/js/results.js` (insertar pieza en la fila de tokens y panel en el modal)
- Modify: `frontend/static/css/components/tokens.css` (estilos del pill y panel)

- [ ] **Step 1: Añadir helpers en `tokens.js`**

Al final de `frontend/static/js/tokens.js`, añade:

```js
// Estadísticas de compresión a partir de los caracteres originales y el texto final.
// Devuelve null si no hubo ahorro (o no se compactó).
function compressionStats(originalChars, text) {
    const finalChars = text ? text.length : 0;
    if (!originalChars || originalChars <= finalChars) return null;
    const savedChars = originalChars - finalChars;
    const pct = Math.round((savedChars / originalChars) * 100);
    if (pct <= 0) return null;
    const savedTokens = Math.round(savedChars / 4.0); // charsPerToken representativo
    return { originalChars, finalChars, savedChars, pct, savedTokens };
}

// Pieza compacta "🗜️ −18%" para la fila de tokens de cada resultado (o '' si no aplica).
export function renderCompressionBadge(originalChars, text) {
    const s = compressionStats(originalChars, text);
    if (!s) return '';
    const title =
        `Compactado sin pérdida: ${formatTokenCount(s.originalChars)} → ` +
        `${formatTokenCount(s.finalChars)} caracteres (−${formatTokenCount(s.savedChars)}). ` +
        'Se eliminaron líneas en blanco repetidas, espacios sobrantes, líneas ' +
        'duplicadas y comentarios HTML; el contenido no cambia.';
    return `<span class="token-badge compress" title="${escapeHtml(title)}">🗜️ −${s.pct}%</span>`;
}

// Panel informativo de compresión para el modal (o '' si no aplica).
export function renderCompressionPanel(originalChars, text) {
    const s = compressionStats(originalChars, text);
    if (!s) return '';
    return `
        <div class="compress-panel">
            <div class="compress-row">
                <span>Caracteres</span>
                <strong>${escapeHtml(formatTokenCount(s.originalChars))} → ${escapeHtml(formatTokenCount(s.finalChars))} (−${s.pct}%)</strong>
            </div>
            <div class="compress-row">
                <span>Tokens ahorrados (aprox.)</span>
                <strong>≈ −${escapeHtml(formatTokenCount(s.savedTokens))}</strong>
            </div>
            <p class="compress-note">Compactación sin pérdida: blancos, espacios, duplicados y comentarios HTML.</p>
        </div>
    `;
}
```

- [ ] **Step 2: `renderTokenBadges` admite un prefijo**

En `frontend/static/js/tokens.js`, cambia la firma y el return de `renderTokenBadges`:

De:
```js
export function renderTokenBadges(text) {
```
a:
```js
export function renderTokenBadges(text, prefix = '') {
```

Y su `return`, de:
```js
    return `<div class="token-badges" aria-label="Estimación de tokens por plataforma">${badges}</div>`;
```
a:
```js
    return `<div class="token-badges" aria-label="Estimación de tokens por plataforma">${prefix}${badges}</div>`;
```

- [ ] **Step 3: Usar las piezas en `results.js`**

En `frontend/static/js/results.js`, amplía el import de `tokens.js`:

De:
```js
import { renderTokenBadges, renderTokenTable } from './tokens.js';
```
a:
```js
import {
    renderTokenBadges,
    renderTokenTable,
    renderCompressionBadge,
    renderCompressionPanel,
} from './tokens.js';
```

En `displayResults`, en la rama de éxito, sustituye la línea de los badges:

De:
```js
                                ${renderTokenBadges(result.markdown_content)}
```
a:
```js
                                ${renderTokenBadges(result.markdown_content, renderCompressionBadge(result.original_chars, result.markdown_content))}
```

En `viewContent`, sustituye la línea de `modalTokens`:

De:
```js
    document.getElementById('modalTokens').innerHTML = renderTokenTable(result.markdown_content);
```
a:
```js
    document.getElementById('modalTokens').innerHTML =
        renderCompressionPanel(result.original_chars, result.markdown_content) +
        renderTokenTable(result.markdown_content);
```

- [ ] **Step 4: Estilos en `tokens.css`**

Al final de `frontend/static/css/components/tokens.css`, añade:

```css
/* Pieza de compresión en la fila de tokens */
.token-badge.compress {
    color: var(--color-fg-muted);
    background: color-mix(in srgb, var(--color-fg) 8%, transparent);
    border-color: var(--color-border-strong);
}

/* Panel informativo de compresión en el modal */
.compress-panel {
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--glass-bg-soft);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm), var(--glass-highlight);
}

.compress-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: 0.85rem;
    color: var(--color-fg-muted);
}

.compress-row strong {
    color: var(--color-fg);
    font-variant-numeric: tabular-nums;
}

.compress-note {
    margin-top: var(--space-2);
    font-size: 0.75rem;
    color: var(--color-fg-subtle);
}

/* Estilo de la casilla de compactación (junto a la de anonimizar) */
.compact-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-4);
    font-weight: 600;
    color: var(--color-fg);
    cursor: pointer;
}

.compact-toggle input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
    cursor: pointer;
}
```

- [ ] **Step 5: Verificación de sintaxis y llaves**

Run: `node --check frontend/static/js/tokens.js && node --check frontend/static/js/results.js`
Expected: OK.
Run: `bash -c 'f=frontend/static/css/components/tokens.css; [ "$(grep -o "{" $f|wc -l)" = "$(grep -o "}" $f|wc -l)" ] && echo BALANCEADO'`
Expected: `BALANCEADO`.

- [ ] **Step 6: Commit**

```bash
git add frontend/static/js/tokens.js frontend/static/js/results.js frontend/static/css/components/tokens.css
git commit -m "Muestra el % de compresión junto a los tokens"
```

---

### Task 5: Documentación

**Files:**
- Modify: `README.md` (característica nueva + nota de la casilla)
- Modify: `CLAUDE.md` (módulo compactor + campo original_chars + casilla) — recuerda que CLAUDE.md está gitignored (solo local)

- [ ] **Step 1: README — añadir la característica**

En `README.md`, en la lista de "🎯 Características", añade un bullet tras el de estimación de tokens:

```markdown
- 🗜️ **Compactación del Markdown** - Limpieza sin pérdida (colapsa líneas en blanco, espacios, duplicados y comentarios HTML, respetando bloques de código) que reduce los tokens; activada por defecto y con indicador del % de ahorro junto a la estimación de tokens
```

Y en la sección de `POST /api/convert` y `/api/convert-single`, añade en "**Opcional**" que aceptan `compact` (`true`/`false`, por defecto `true`) y que cada resultado incluye `original_chars`.

- [ ] **Step 2: CLAUDE.md — documentar el módulo**

En `CLAUDE.md`, sección Backend, añade un bullet:

```markdown
- Optional lossless compaction: both convert endpoints accept `compact` (bool, default `true`) as a `Form` field. After extraction and anonymization, the text passes through `_compact` → [backend/compactor.py](backend/compactor.py) (`compact_markdown`), which collapses blank-line runs, trailing whitespace, invisible chars, HTML comments, consecutive duplicate lines and empty table rows — leaving fenced code blocks untouched. Each successful result also returns `original_chars` (length before compaction) so the frontend can show the compression %.
```

Y añade una línea sobre `tests/test_compactor.py` en la sección Tests.

- [ ] **Step 3: Commit (solo README; CLAUDE.md está gitignored)**

```bash
git add README.md
git commit -m "Documenta la compactación del Markdown"
```

---

## Verificación final

- [ ] `uv run --all-extras pytest -q` → todo verde.
- [ ] `uv run ruff check backend/ tests/` → sin errores.
- [ ] Arrancar `./run.sh`, subir un PDF/Office con `compact` marcado y comprobar: el resultado muestra "🗜️ −X%" junto a los tokens y el modal muestra el panel de compresión; desmarcando la casilla, el Markdown sale sin tocar y no aparece el indicador.
