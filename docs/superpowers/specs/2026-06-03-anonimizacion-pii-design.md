# Anonimización de datos sensibles (PII) — Diseño

Fecha: 2026-06-03

## Objetivo

Permitir, de forma opcional, eliminar datos personales (DNI/NIE, emails,
nombres, teléfonos, IBAN, tarjetas, direcciones, IPs) del Markdown resultante
antes de devolverlo al cliente, sustituyéndolos por una etiqueta genérica según
su tipo (`[DNI]`, `[NOMBRE]`, `[EMAIL]`…).

## Decisiones

- **Motor:** Microsoft Presidio (`presidio-analyzer` + `presidio-anonymizer`)
  con spaCy `es_core_news_sm` para NER de nombres. Modelo *small* por tamaño;
  cambiar a `_md` es una sola constante si la precisión de nombres es baja.
- **Modo de reemplazo:** etiqueta por tipo (preserva legibilidad).
- **Activación:** checkbox global "Anonimizar datos sensibles" que, al marcarse,
  despliega casillas por tipo (todas marcadas por defecto).
- **Punto de aplicación:** sobre `result.text_content` en el servidor, tras la
  conversión y antes de devolver. Único punto de salida → vista previa,
  descarga, ZIP y conteo de tokens usan ya el texto anonimizado.
- **Aislamiento:** lógica en módulo nuevo `backend/anonymizer.py`; `main.py`
  solo lo invoca.
- **Inicialización perezosa:** los motores de Presidio (y el modelo spaCy) se
  construyen en la primera petición que pida anonimizar, no al arrancar ni en
  tests que no lo usan. Singleton en el módulo, como el `MarkItDown md`.

## Tipos detectables

| Clave        | Entidad Presidio                         | Etiqueta      |
|--------------|------------------------------------------|---------------|
| `dni_nie`    | reconocedor propio (validación de letra) | `[DNI]`       |
| `email`      | `EMAIL_ADDRESS`                          | `[EMAIL]`     |
| `person`     | `PERSON`                                 | `[NOMBRE]`    |
| `phone`      | `PHONE_NUMBER`                           | `[TELEFONO]`  |
| `iban`       | `IBAN_CODE`                              | `[IBAN]`      |
| `credit_card`| `CREDIT_CARD`                            | `[TARJETA]`   |
| `location`   | `LOCATION`                               | `[DIRECCION]` |
| `ip`         | `IP_ADDRESS`                             | `[IP]`        |

El reconocedor de DNI/NIE valida el dígito de control con el alfabeto
`TRWAGMYFPDXBNJZSQVHLCKE` (para NIE se sustituye la letra inicial X/Y/Z por
0/1/2 antes de calcular), evitando falsos positivos con números de 8 cifras
arbitrarios.

## Componentes

### backend/anonymizer.py

- `ENTITY_CONFIG`: lista ordenada de `{key, presidio_entity, label, tag}` —
  fuente de verdad de los tipos soportados y sus etiquetas legibles.
- Reconocedor propio `DniNieRecognizer(PatternRecognizer)` con
  `validate_result` que comprueba la letra de control.
- `_get_engines()`: construye y cachea `AnalyzerEngine` (NlpEngine spaCy `es`,
  con el reconocedor de DNI/NIE registrado) y `AnonymizerEngine`. Perezoso.
- `anonymize_text(text: str, entity_keys: list[str]) -> str`: analiza el texto
  para las entidades pedidas y reemplaza cada una por su etiqueta usando un
  operador `replace` por entidad. Si `entity_keys` está vacío, devuelve el texto
  sin cambios.
- `available_options() -> list[dict]`: expone `{key, label}` por tipo para el
  frontend.

### backend/main.py

- Endpoints `/api/convert` y `/api/convert-single`: nuevos campos de FormData
  opcionales `anonymize: bool = Form(False)` y
  `anonymize_entities: str = Form("")` (claves separadas por coma). Tras
  `md.convert`, si `anonymize` y hay entidades, aplicar `anonymize_text`.
- `/api/convert` (best-effort): un fallo de anonimización en un archivo entra en
  `errors` para ese archivo, el resto continúa.
- `/api/convert-single`: si Presidio/modelo no está disponible →
  `HTTPException 503` con mensaje claro.
- Nuevo `GET /api/anonymizer-options` → `{ "options": available_options() }`.

### frontend

- `index.html`: en la sección de archivos, checkbox "Anonimizar datos
  sensibles" + contenedor `#anonymizeOptions` (oculto hasta marcar) para las
  casillas por tipo.
- `script.js`: al cargar, `fetch('/api/anonymizer-options')` y render de las
  casillas (todas marcadas). Toggle del checkbox muestra/oculta el grupo.
  `convertFiles` añade `anonymize` y `anonymize_entities` al FormData de cada
  archivo. En cada resultado anonimizado, badge "Anonimizado".
- `styles.css`: estilos para el bloque de opciones y el badge "Anonimizado".

## Dependencias (pyproject.toml)

Añadir `presidio-analyzer`, `presidio-anonymizer`, `spacy` y el modelo
`es_core_news_sm` (vía wheel del release de spaCy para resolución reproducible
con `uv`).

## Manejo de errores

- Import/carga de modelo falla y se pidió anonimizar:
  - single → 503 "Anonimización no disponible".
  - multi → error por archivo en `errors`.
- `anonymize=false` o sin tipos → comportamiento actual intacto (no se importa
  ni carga Presidio).
- Primera petición con anonimización: lenta por la carga del modelo; siguientes
  rápidas (singleton).

## Pruebas

- `anonymize_text` deterministas: email y DNI/NIE (caso con letra válida se
  reemplaza; número de 8 cifras con letra inválida NO se trata como DNI).
- Selección de entidades: pedir solo `email` no toca un DNI presente.
- `PERSON`/`phone`: test más tolerante (depende del modelo); se omite si el
  modelo no está instalado.
- API: `/api/convert-single` con `anonymize=true` devuelve etiquetas; campos
  ausentes mantienen el comportamiento actual; `/api/anonymizer-options`
  devuelve la forma esperada.
- Actualizar la sección de tests y dependencias en `CLAUDE.md`.

## Fuera de alcance (YAGNI)

- Idiomas distintos de español (el NER se configura para `es`).
- Pseudónimos consistentes o cifrado reversible.
- Persistencia o auditoría de lo anonimizado.
