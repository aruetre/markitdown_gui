"""Conversión de PDF a Markdown con pymupdf4llm.

markitdown extrae los PDF con pdfminer/pdfplumber: para documentos que son
mayormente texto cae a `pdfminer.high_level.extract_text`, que vuelca texto
plano lineal SIN estructura (ni títulos, ni tablas). La alternativa de pasar
PDF→Word→MD sí maqueta, pero la cabecera/pie del Word viven en
`word/header*.xml`/`footer*.xml` y `mammoth` (el motor del conversor DOCX de
markitdown) los ignora por diseño, así que se pierden.

pymupdf4llm analiza el layout y produce Markdown estructurado (títulos `#`,
tablas con `|`) CONSERVANDO el texto de cabecera y pie, que son texto de página
como cualquier otro. Por eso enrutamos los PDF aquí, con fallback a markitdown
si la dependencia falta o la conversión falla (ver `_extract_markdown`).

Import perezoso: una dependencia ausente no debe romper el arranque de la app,
igual que en `ocr.py`/`anonymizer.py`. PyMuPDF/MuPDF es AGPL (markitdown es MIT);
asumido al elegir esta vía.
"""

from __future__ import annotations

# pymupdf4llm/MuPDF emiten mensajes de diagnóstico ("Using Tesseract for OCR…")
# por un canal propio de MuPDF (no por stdout/stderr de Python), que ensucian los
# logs del servidor. Los silenciamos una sola vez con set_messages; es un ajuste
# global, así que lo guardamos con este flag para no reabrir el sumidero en cada
# conversión.
_messages_silenced = False


def _silence_mupdf_messages(pymupdf) -> None:
    """Redirige los mensajes de MuPDF a /dev/null (una sola vez)."""
    global _messages_silenced
    if _messages_silenced:
        return
    import os

    try:
        pymupdf.set_messages(path=os.devnull)
    except Exception:  # pragma: no cover - API best-effort, no crítico
        pass
    _messages_silenced = True


def pdf_to_markdown(path: str) -> str:
    """Convierte un PDF a Markdown estructurado y lo devuelve como texto.

    Lanza ImportError si pymupdf4llm no está instalado. Cualquier otro fallo de
    conversión se propaga para que el llamante decida el fallback.
    """
    try:
        import pymupdf
        import pymupdf4llm
    except ImportError as e:  # pragma: no cover - depende del entorno
        raise ImportError(
            "Conversión de PDF no disponible: falta pymupdf4llm. Ejecuta 'uv sync'."
        ) from e

    _silence_mupdf_messages(pymupdf)

    return pymupdf4llm.to_markdown(path, show_progress=False).strip()
