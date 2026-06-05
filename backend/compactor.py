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
    """Devuelve el Markdown compactado: elimina ruido sin alterar el contenido."""
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
