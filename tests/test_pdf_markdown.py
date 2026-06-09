"""Tests del enrutado de PDF a pymupdf4llm (backend/pdf_markdown.py) y su fallback.

Los .pdf se convierten con pymupdf4llm (Markdown estructurado + cabecera/pie). Si
esa vía falla, no está instalada o no extrae nada, `_extract_markdown` cae a
markitdown. Aquí mockeamos `pdf_markdown.pdf_to_markdown` para verificar el
enrutado y los tres disparadores del fallback de forma determinista, sin depender
de un PDF real ni de la librería.
"""

from fastapi.testclient import TestClient

from backend import pdf_markdown
from backend.main import app

client = TestClient(app)


def _convert(content=b"%PDF-1.4 fake"):
    return client.post(
        "/api/convert-single",
        files={"file": ("doc.pdf", content, "application/pdf")},
    )


def test_pdf_routes_to_pymupdf4llm(monkeypatch):
    """Un .pdf debe convertirse con pymupdf4llm cuando este devuelve contenido."""
    monkeypatch.setattr(pdf_markdown, "pdf_to_markdown", lambda path: "# Título\n\n| a | b |")
    r = _convert()
    assert r.status_code == 200
    body = r.json()
    assert body["markdown_content"] == "# Título\n\n| a | b |"
    assert body["markdown_filename"] == "doc.md"


def test_pdf_falls_back_to_markitdown_on_exception(monkeypatch):
    """Si pymupdf4llm lanza, se usa markitdown sin romper la petición."""

    def boom(path):
        raise RuntimeError("pdf corrupto")

    monkeypatch.setattr(pdf_markdown, "pdf_to_markdown", boom)
    monkeypatch.setattr(
        "backend.main.md.convert",
        lambda path: type("R", (), {"text_content": "MD desde markitdown"})(),
    )
    r = _convert()
    assert r.status_code == 200
    assert r.json()["markdown_content"] == "MD desde markitdown"


def test_pdf_falls_back_to_markitdown_on_empty(monkeypatch):
    """Si pymupdf4llm devuelve vacío/espacios, se usa markitdown."""
    monkeypatch.setattr(pdf_markdown, "pdf_to_markdown", lambda path: "   \n  ")
    monkeypatch.setattr(
        "backend.main.md.convert",
        lambda path: type("R", (), {"text_content": "MD desde markitdown"})(),
    )
    r = _convert()
    assert r.status_code == 200
    assert r.json()["markdown_content"] == "MD desde markitdown"


def test_pdf_falls_back_when_dependency_missing(monkeypatch):
    """Si falta pymupdf4llm (ImportError), se usa markitdown (degradación suave)."""

    def missing(path):
        raise ImportError("falta pymupdf4llm")

    monkeypatch.setattr(pdf_markdown, "pdf_to_markdown", missing)
    monkeypatch.setattr(
        "backend.main.md.convert",
        lambda path: type("R", (), {"text_content": "MD desde markitdown"})(),
    )
    r = _convert()
    assert r.status_code == 200
    assert r.json()["markdown_content"] == "MD desde markitdown"
