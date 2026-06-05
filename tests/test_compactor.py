from backend.compactor import compact_markdown


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
    assert compact_markdown(md) == md


def test_idempotente():
    md = "a\n\n\n\nb   \n<!-- x -->\n| | |\n"
    once = compact_markdown(md)
    assert compact_markdown(once) == once


def test_vacio():
    assert compact_markdown("") == ""
