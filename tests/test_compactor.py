from fastapi.testclient import TestClient

import backend.main as main_module
from backend.compactor import compact_markdown
from backend.main import app

client = TestClient(app)


def test_colapsa_lineas_en_blanco():
    assert compact_markdown("a\n\n\n\nb") == "a\n\nb"


def test_recorta_blancos_inicio_y_final():
    assert compact_markdown("\n\n  \nhola\n\n  \n") == "hola"


def test_quita_espacios_finales():
    assert compact_markdown("hola   \nmundo\t") == "hola\nmundo"


def test_quita_caracteres_invisibles_y_nbsp():
    assert compact_markdown("a​﻿b c") == "ab c"


def test_quita_comentarios_html():
    assert compact_markdown("a\n<!-- nota\nmultilinea -->\nb") == "a\n\nb"


def test_conserva_lineas_duplicadas_consecutivas():
    # Lossless: dos líneas idénticas pueden ser datos legítimos; no se deduplican.
    assert compact_markdown("Pagina 1\nPagina 1\ntexto") == "Pagina 1\nPagina 1\ntexto"


def test_conserva_filas_de_tabla_duplicadas():
    md = "| Pago | 100 |\n| Pago | 100 |"
    assert compact_markdown(md) == md


def test_quita_filas_de_tabla_vacias():
    assert compact_markdown("| a | b |\n| | |\n| c | d |") == "| a | b |\n| c | d |"


def test_no_quita_separador_de_tabla():
    md = "| a | b |\n|---|---|\n| c | d |"
    assert compact_markdown(md) == md


def test_preserva_bloques_de_codigo():
    md = "```\ndef f():\n\n\n    return 1\n```"
    assert compact_markdown(md) == md


def test_idempotente():
    md = "a\n\n\n\nb   \n<!-- x -->\n| | |\n"
    once = compact_markdown(md)
    assert compact_markdown(once) == once


def test_vacio():
    assert compact_markdown("") == ""


# Texto "abultado" controlado. Se inyecta vía _extract_markdown para probar el
# cableado de la compactación sin depender de cómo normaliza markitdown un .txt
# (markitdown ya colapsa por su cuenta, lo que haría los asserts no deterministas).
_BLOATED = "linea1\n\n\n\n\nlinea2   \n"


def test_convert_single_compacta_por_defecto(monkeypatch):
    monkeypatch.setattr(main_module, "_extract_markdown", lambda path, ext: _BLOATED)
    r = client.post(
        "/api/convert-single",
        files={"file": ("doc.txt", b"x", "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    # original_chars = longitud antes de compactar; el contenido va compactado.
    assert body["original_chars"] == len(_BLOATED)
    assert len(body["markdown_content"]) < body["original_chars"]
    assert "\n\n\n" not in body["markdown_content"]


def test_convert_single_sin_compactar_conserva(monkeypatch):
    monkeypatch.setattr(main_module, "_extract_markdown", lambda path, ext: _BLOATED)
    r = client.post(
        "/api/convert-single",
        files={"file": ("doc.txt", b"x", "text/plain")},
        data={"compact": "false"},
    )
    assert r.status_code == 200
    body = r.json()
    # Sin compactar: el texto se devuelve tal cual y original_chars coincide.
    assert body["markdown_content"] == _BLOATED
    assert body["original_chars"] == len(_BLOATED)


def test_convert_multi_compacta_por_defecto(monkeypatch):
    monkeypatch.setattr(main_module, "_extract_markdown", lambda path, ext: _BLOATED)
    r = client.post(
        "/api/convert",
        files=[("files", ("doc.txt", b"x", "text/plain"))],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["successful"] == 1
    result = body["results"][0]
    assert result["original_chars"] == len(_BLOATED)
    assert len(result["markdown_content"]) < result["original_chars"]
    assert "\n\n\n" not in result["markdown_content"]
