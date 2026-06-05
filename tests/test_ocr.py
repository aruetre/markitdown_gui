"""Tests del OCR de imágenes (backend/ocr.py) y su integración en los endpoints.

El OCR real depende del binario `tesseract` del sistema, que puede no estar
instalado en CI. Por eso el grueso de los tests mockea `ocr.ocr_image` para
verificar el enrutado y el manejo de errores de forma determinista; el test que
ejecuta Tesseract de verdad se salta si el binario no está disponible.
"""

import shutil

import pytest
from fastapi.testclient import TestClient

from backend import ocr
from backend.main import app

client = TestClient(app)


def test_is_image():
    assert ocr.is_image(".png")
    assert ocr.is_image(".JPG")  # insensible a mayúsculas
    assert ocr.is_image(".jpeg")
    assert not ocr.is_image(".pdf")
    assert not ocr.is_image(".txt")


def test_convert_single_image_routes_to_ocr(monkeypatch):
    """Una imagen debe pasar por OCR y devolver su texto."""
    monkeypatch.setattr(ocr, "ocr_image", lambda path, lang=ocr.DEFAULT_LANG: "TEXTO OCR")

    r = client.post(
        "/api/convert-single",
        files={"file": ("captura.png", b"bytes-de-imagen-fake", "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["markdown_content"] == "TEXTO OCR"
    assert body["markdown_filename"] == "captura.md"
    assert body["format"] == "Image"


def test_convert_single_image_ocr_unavailable_returns_503(monkeypatch):
    """Si Tesseract no está disponible, single devuelve 503 (no 500 opaco)."""

    def boom(path, lang=ocr.DEFAULT_LANG):
        raise OSError("Tesseract no está instalado")

    monkeypatch.setattr(ocr, "ocr_image", boom)

    r = client.post(
        "/api/convert-single",
        files={"file": ("captura.png", b"fake", "image/png")},
    )
    assert r.status_code == 503
    assert "OCR" in r.json()["detail"]


def test_convert_multi_image_ocr_error_lands_in_errors(monkeypatch):
    """En multi, el fallo de OCR de un archivo va a errors sin abortar el resto."""

    def boom(path, lang=ocr.DEFAULT_LANG):
        raise OSError("Tesseract no está instalado")

    monkeypatch.setattr(ocr, "ocr_image", boom)

    r = client.post(
        "/api/convert",
        files=[
            ("files", ("a.png", b"fake", "image/png")),
            ("files", ("b.txt", b"hola mundo", "text/plain")),
        ],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["successful"] == 1  # el .txt
    assert body["failed"] == 1  # la imagen
    assert any(e["filename"] == "a.png" for e in body["errors"])


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract no instalado")
def test_ocr_image_real_reads_text(tmp_path):
    """Con Tesseract instalado, OCR lee el texto de una imagen generada."""
    from PIL import Image, ImageDraw

    img_path = tmp_path / "texto.png"
    img = Image.new("RGB", (320, 80), (255, 255, 255))
    ImageDraw.Draw(img).text((10, 25), "HOLA MUNDO 123", fill=(0, 0, 0))
    img.save(img_path)

    text = ocr.ocr_image(str(img_path), lang="eng")
    assert "HOLA" in text.upper()
