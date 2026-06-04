"""Tests de anonimización de datos sensibles (PII).

Las pruebas de email y DNI/NIE son deterministas. Las de PERSON/teléfono
dependen del modelo spaCy; se marcan como tolerantes.
"""

from fastapi.testclient import TestClient

from backend.anonymizer import _valid_dni_nie, anonymize_text, available_options
from backend.main import app

client = TestClient(app)


# --- Validación de DNI/NIE (determinista) ---


def test_dni_valido():
    assert _valid_dni_nie("12345678Z") is True


def test_dni_letra_incorrecta():
    assert _valid_dni_nie("12345678A") is False


def test_nie_valido():
    assert _valid_dni_nie("X1234567L") is True


def test_dni_formato_invalido():
    assert _valid_dni_nie("1234567Z") is False  # solo 7 dígitos
    assert _valid_dni_nie("ABCDEFGHZ") is False


# --- available_options ---


def test_available_options_shape():
    opts = available_options()
    assert isinstance(opts, list) and opts
    for o in opts:
        assert set(o.keys()) == {"key", "label", "default"}
    keys = {o["key"] for o in opts}
    assert {"dni_nie", "email", "person"} <= keys


def test_location_no_marcada_por_defecto():
    by_key = {o["key"]: o for o in available_options()}
    assert by_key["location"]["default"] is False
    assert by_key["email"]["default"] is True


# --- anonymize_text (email y DNI deterministas) ---


def test_anonymize_email_y_dni():
    txt = "Mi correo es ana@example.com y mi DNI 12345678Z."
    out = anonymize_text(txt, ["email", "dni_nie"])
    assert "[EMAIL]" in out
    assert "[DNI]" in out
    assert "ana@example.com" not in out
    assert "12345678Z" not in out


def test_anonymize_seleccion_solo_email_no_toca_dni():
    txt = "correo ana@example.com y DNI 12345678Z."
    out = anonymize_text(txt, ["email"])
    assert "[EMAIL]" in out
    assert "12345678Z" in out  # el DNI no se pidió, se conserva


def test_anonymize_sin_entidades_devuelve_igual():
    txt = "correo ana@example.com"
    assert anonymize_text(txt, []) == txt


def test_anonymize_numero_no_dni_no_se_trata():
    # 8 dígitos con letra de control inválida no debe tratarse como DNI
    txt = "El pedido 12345678A está listo."
    out = anonymize_text(txt, ["dni_nie"])
    assert "12345678A" in out


def test_anonymize_iban_con_espacios_irregulares():
    # IBAN con dobles espacios y grupos irregulares (como en una nómina real)
    txt = "Número de cuenta:ES27  0049  6794  01  2116034467"
    out = anonymize_text(txt, ["iban"])
    assert "[IBAN]" in out
    assert "2116034467" not in out


def test_anonymize_iban_invalido_no_se_trata():
    txt = "Ref ES0000000000000000000000 fin"  # checksum mod-97 inválido
    out = anonymize_text(txt, ["iban"])
    assert "[IBAN]" not in out


def test_anonymize_nombre_por_etiqueta_en_mayusculas():
    # El NER se salta nombres en MAYÚSCULAS; el reconocedor por etiqueta no.
    txt = "Nombre: RUEDA TREVIÑO, ANTONIO\nOtro campo"
    out = anonymize_text(txt, ["person"])
    assert "[NOMBRE]" in out
    assert "RUEDA TREVIÑO" not in out


# --- API ---


def test_anonymizer_options_endpoint():
    r = client.get("/api/anonymizer-options")
    assert r.status_code == 200
    opts = r.json()["options"]
    assert any(o["key"] == "email" for o in opts)


def test_convert_single_anonymiza_email():
    r = client.post(
        "/api/convert-single",
        files={"file": ("c.txt", b"escribe a ana@example.com", "text/plain")},
        data={"anonymize": "true", "anonymize_entities": "email"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["anonymized"] is True
    assert "[EMAIL]" in body["markdown_content"]
    assert "ana@example.com" not in body["markdown_content"]


def test_convert_single_sin_anonimizar_conserva_contenido():
    r = client.post(
        "/api/convert-single",
        files={"file": ("c.txt", b"escribe a ana@example.com", "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("anonymized") is False
    assert "ana@example.com" in body["markdown_content"]
