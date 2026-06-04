"""Anonimización de datos sensibles (PII) sobre el Markdown convertido.

Usa Microsoft Presidio (analyzer + anonymizer) con spaCy `es_core_news_lg` para
NER de nombres/ubicaciones en texto libre, más reconocedores propios y
deterministas para los datos estructurados típicos de documentos oficiales
españoles (nóminas, formularios):

- DNI/NIE con validación de la letra de control.
- IBAN español tolerante a espacios/agrupamiento irregular, con checksum mod-97.
- Nombre de persona a partir de etiquetas como "Nombre:" / "Apellidos:" /
  "Titular:", que el NER se salta cuando vienen en MAYÚSCULAS.

Los motores de Presidio son caros de construir, así que se inicializan de forma
perezosa (singleton) en la primera llamada a `anonymize_text`: importar este
módulo no carga el modelo.
"""

from __future__ import annotations

import re
from threading import Lock

# Configuración de tipos soportados. Fuente de verdad para el frontend y para el
# mapeo entidad Presidio -> etiqueta de reemplazo.
# key: clave usada por la API/UI; entity: nombre de entidad en Presidio;
# label: texto legible para la UI; tag: con qué se sustituye en el texto;
# default: si la casilla viene marcada por defecto en la UI.
ENTITY_CONFIG = [
    {
        "key": "dni_nie",
        "entity": "ES_DNI_NIE",
        "label": "DNI / NIE",
        "tag": "[DNI]",
        "default": True,
    },
    {
        "key": "email",
        "entity": "EMAIL_ADDRESS",
        "label": "Email",
        "tag": "[EMAIL]",
        "default": True,
    },
    {
        "key": "person",
        "entity": "PERSON",
        "label": "Nombre de persona",
        "tag": "[NOMBRE]",
        "default": True,
    },
    {
        "key": "phone",
        "entity": "PHONE_NUMBER",
        "label": "Teléfono",
        "tag": "[TELEFONO]",
        "default": True,
    },
    {"key": "iban", "entity": "IBAN_CODE", "label": "IBAN", "tag": "[IBAN]", "default": True},
    {
        "key": "credit_card",
        "entity": "CREDIT_CARD",
        "label": "Tarjeta de crédito",
        "tag": "[TARJETA]",
        "default": True,
    },
    # LOCATION es ruidoso sobre tablas con el NER, por eso viene desmarcado.
    {
        "key": "location",
        "entity": "LOCATION",
        "label": "Dirección / ubicación",
        "tag": "[DIRECCION]",
        "default": False,
    },
    {"key": "ip", "entity": "IP_ADDRESS", "label": "Dirección IP", "tag": "[IP]", "default": True},
]

_BY_KEY = {e["key"]: e for e in ENTITY_CONFIG}

_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

# Etiquetas que preceden a un nombre de persona en documentos estructurados.
# Captura el valor de la línea (sin la etiqueta), parándose en salto de línea o
# en una barra de tabla markdown.
_NAME_LABEL_RX = re.compile(
    r"(?im)^[ \t>|]*(?:nombre y apellidos|nombre|apellidos?|titular|"
    r"trabajador(?:/?a)?|empleado(?:/?a)?)\s*:\s*(?P<val>\S[^\n|]*?)\s*$"
)

_engines = None  # (analyzer, anonymizer) una vez inicializados
_engines_lock = Lock()


def available_options() -> list[dict]:
    """Lista de tipos disponibles para el frontend: [{key, label, default}]."""
    return [{"key": e["key"], "label": e["label"], "default": e["default"]} for e in ENTITY_CONFIG]


def _valid_dni_nie(text: str) -> bool:
    """Valida un DNI (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra)
    comprobando la letra de control."""
    t = text.strip().upper()
    if len(t) != 9:
        return False
    body, letter = t[:-1], t[-1]
    if body[0] in ("X", "Y", "Z"):
        num = str("XYZ".index(body[0])) + body[1:]
    else:
        num = body
    if not num.isdigit():
        return False
    return letter == _DNI_LETTERS[int(num) % 23]


def _valid_iban_es(text: str) -> bool:
    """Valida un IBAN español (ES + 22 dígitos) por su checksum mod-97,
    ignorando espacios/separadores."""
    s = re.sub(r"\s+", "", text).upper()
    if not re.fullmatch(r"ES\d{22}", s):
        return False
    rearranged = s[4:] + s[:4]
    digits = "".join(str(int(c, 36)) for c in rearranged)
    return int(digits) % 97 == 1


def _build_dni_nie_recognizer():
    from presidio_analyzer import Pattern, PatternRecognizer

    class DniNieRecognizer(PatternRecognizer):
        """Reconocedor de DNI/NIE español con validación de letra de control."""

        def __init__(self):
            patterns = [Pattern("DNI/NIE", r"\b[XYZ]?[0-9]{7,8}[A-Za-z]\b", 0.3)]
            super().__init__(
                supported_entity="ES_DNI_NIE",
                patterns=patterns,
                supported_language="es",
            )

        def validate_result(self, pattern_text: str):
            return _valid_dni_nie(pattern_text)

    return DniNieRecognizer()


def _build_iban_recognizer():
    from presidio_analyzer import Pattern, PatternRecognizer

    class TolerantIbanRecognizer(PatternRecognizer):
        """IBAN español tolerante a espacios/agrupamiento, validado por mod-97."""

        def __init__(self):
            patterns = [Pattern("ES IBAN", r"\bES\d{2}(?:[ \t]*\d){20}\b", 0.5)]
            super().__init__(
                supported_entity="IBAN_CODE",
                patterns=patterns,
                supported_language="es",
            )

        def validate_result(self, pattern_text: str):
            return _valid_iban_es(pattern_text)

    return TolerantIbanRecognizer()


def _build_labeled_person_recognizer():
    from presidio_analyzer import EntityRecognizer, RecognizerResult

    class LabeledPersonRecognizer(EntityRecognizer):
        """Detecta nombres tras etiquetas ("Nombre:", "Apellidos:", "Titular:"),
        que el NER se salta cuando van en MAYÚSCULAS o como 'APELLIDOS, NOMBRE'."""

        def __init__(self):
            super().__init__(
                supported_entities=["PERSON"],
                supported_language="es",
                name="LabeledPersonRecognizer",
            )

        def load(self) -> None:
            pass

        def analyze(self, text, entities, nlp_artifacts=None):
            results = []
            if "PERSON" not in entities:
                return results
            for m in _NAME_LABEL_RX.finditer(text):
                start, end = m.span("val")
                results.append(
                    RecognizerResult(entity_type="PERSON", start=start, end=end, score=0.95)
                )
            return results

    return LabeledPersonRecognizer()


def _get_engines():
    """Construye (una vez) y devuelve (AnalyzerEngine, AnonymizerEngine)."""
    global _engines
    if _engines is not None:
        return _engines
    with _engines_lock:
        if _engines is not None:
            return _engines

        from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        from presidio_anonymizer import AnonymizerEngine

        provider = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "es", "model_name": "es_core_news_lg"}],
            }
        )
        nlp_engine = provider.create_engine()

        registry = RecognizerRegistry(supported_languages=["es"])
        registry.load_predefined_recognizers(languages=["es"])
        registry.add_recognizer(_build_dni_nie_recognizer())
        registry.add_recognizer(_build_iban_recognizer())
        registry.add_recognizer(_build_labeled_person_recognizer())
        # Mantener el registro y el analyzer consistentes en idioma.
        registry.supported_languages = ["es"]

        analyzer = AnalyzerEngine(
            nlp_engine=nlp_engine,
            registry=registry,
            supported_languages=["es"],
        )
        anonymizer = AnonymizerEngine()
        _engines = (analyzer, anonymizer)
        return _engines


def anonymize_text(text: str, entity_keys: list[str]) -> str:
    """Reemplaza en `text` las entidades pedidas por su etiqueta.

    `entity_keys` son claves de ENTITY_CONFIG; las desconocidas se ignoran.
    Si no hay texto o no hay claves válidas, devuelve el texto sin cambios.
    """
    keys = [k for k in entity_keys if k in _BY_KEY]
    if not text or not keys:
        return text

    from presidio_anonymizer.entities import OperatorConfig

    analyzer, anonymizer = _get_engines()
    entities = [_BY_KEY[k]["entity"] for k in keys]

    results = analyzer.analyze(text=text, language="es", entities=entities)
    operators = {
        _BY_KEY[k]["entity"]: OperatorConfig("replace", {"new_value": _BY_KEY[k]["tag"]})
        for k in keys
    }
    return anonymizer.anonymize(text=text, analyzer_results=results, operators=operators).text
