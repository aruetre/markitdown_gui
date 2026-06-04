# MarkItDown GUI

Una interfaz gráfica web moderna para convertir múltiples formatos de archivo a Markdown usando [Microsoft MarkItDown](https://github.com/microsoft/markitdown).

## 🎯 Características

- ✅ **Carga de múltiples archivos** - Arrastra y suelta o selecciona archivos
- 🔍 **Detección automática de extensiones** - Identifica el formato automáticamente
- 🚀 **Conversión por lote** - Cada archivo se procesa de forma aislada; un fallo no aborta el resto
- 📋 **Vista previa** - Visualiza el Markdown convertido antes de descargar
- 💾 **Descarga individual o como ZIP** - Guarda cada `.md` por separado o todos en `conversiones.zip`
- 🔢 **Estimación de tokens** - Calcula (heurística, en el navegador) cuántos tokens ocuparía cada documento en ChatGPT, Claude, Gemini/NotebookLM y Kimi, con indicador de si cabe en su ventana de contexto
- 🎨 **Interfaz moderna** - Diseño responsivo, sin build step ni framework de frontend

## 📦 Formatos Soportados

### Documentos
- PDF
- Word (.docx, .doc)
- PowerPoint (.pptx, .ppt)
- Excel (.xlsx, .xls)

### Imágenes
- JPEG, PNG, GIF, WebP, BMP (con OCR opcional)

### Audio
- MP3, WAV, M4A (con transcripción opcional)

### Texto y Datos
- TXT, CSV, JSON, XML
- HTML, EPUB
- ZIP files
- Markdown

## 🚀 Requisitos Previos

- Python 3.10 o superior
- `uv` (gestor de paquetes) - [Instalar uv](https://docs.astral.sh/uv/getting-started/installation/)

## 📥 Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone https://github.com/aruetre/markitdown_gui.git
cd markitdown_gui
```

### 2. Instalar dependencias con `uv`

```bash
# Instalar dependencias principales
uv sync

# O si prefieres instalar en un entorno específico
uv venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
uv sync
```

## 🎮 Uso

### Opción 1: Ejecutar con el script

```bash
# En Windows (PowerShell)
.\run.ps1

# En Linux/Mac
./run.sh
```

### Opción 2: Ejecutar manualmente

```bash
# Activar entorno virtual (si lo creaste)
source .venv/bin/activate  # Linux/Mac
# o
.venv\Scripts\activate      # Windows

# Ejecutar la aplicación
python -m uvicorn backend.main:app --reload
```

### Opción 3: Usar `uv` directamente

```bash
# Ejecutar sin activar el entorno
uv run python -m uvicorn backend.main:app --reload
```

La aplicación estará disponible en: **http://localhost:8000**

## 📁 Estructura del Proyecto

```
markitdown_gui/
├── backend/
│   └── main.py              # Servidor FastAPI (endpoints + saneo + ZIP)
├── frontend/
│   ├── index.html           # Interfaz HTML
│   └── static/
│       ├── styles.css       # Estilos CSS
│       ├── script.js        # Lógica JavaScript
│       └── favicon.svg      # Favicon (servido también en /favicon.ico)
├── tests/
│   └── test_api.py          # Tests del API (pytest + httpx)
├── pyproject.toml           # Configuración de dependencias (uv)
├── uv.lock                  # Lockfile reproducible (uv)
├── run.sh                   # Script para ejecutar (Linux/Mac)
├── run.ps1                  # Script para ejecutar (Windows)
└── README.md                # Este archivo
```

## 🔌 API Endpoints

### GET `/`
Sirve la interfaz web principal

### GET `/api/supported-formats`
Retorna lista de formatos soportados
```json
{
  "formats": {".pdf": "PDF", ".docx": "Word", ...},
  "extensions": [".pdf", ".docx", ...]
}
```

### POST `/api/convert`
Convierte múltiples archivos
- **Parámetro**: `files` (FormData con múltiples archivos)
- **Retorna**: Array de resultados con contenido Markdown

### POST `/api/convert-single`
Convierte un único archivo
- **Parámetro**: `file` (FormData con un archivo)
- **Retorna**: Resultado con contenido Markdown

### POST `/api/zip`
Empaqueta varios .md generados por el cliente en un único `conversiones.zip`.
- **Body** (JSON): `{ "files": [ { "filename": "...", "content": "..." } ] }`
- **Retorna**: `application/zip` con `Content-Disposition: attachment; filename="conversiones.zip"`
- Aplica las mismas mitigaciones que el resto: límite de archivos por lote, saneado de nombres (incluye strip de `/` y `\` para prevenir zip-slip), y dedup automático de nombres en colisión (`doc.md`, `doc (2).md`, …).

## 🔄 Cómo procesa los archivos

El servidor es **stateless**: no hay carpeta de uploads, ni de outputs, ni base de datos. Nada se persiste entre requests.

### Ciclo de vida del archivo de entrada (PDF, DOCX, etc.)

1. El cliente sube el archivo vía `multipart/form-data`.
2. FastAPI lo expone como un `UploadFile` (un `SpooledTemporaryFile` en memoria/disco que limpia Starlette al cerrar la request).
3. El backend lo vuelca a un `tempfile.NamedTemporaryFile(delete=False, suffix=<extensión original>)` — típicamente en `/tmp` (Linux/Mac) o `%TEMP%` (Windows).
4. Preservar la extensión original es **load-bearing**: MarkItDown despacha el conversor por sufijo. Sin la extensión correcta, devolvería contenido vacío o erróneo.
5. `MarkItDown.convert(tmp_path)` lee el temp file en memoria.
6. Un `finally` ejecuta `os.unlink(tmp_path)`. Tras la respuesta no queda rastro del archivo en disco.

### Ciclo de vida del Markdown de salida

1. `result.text_content` se devuelve como **string dentro del JSON de respuesta** — nunca se escribe a disco en el servidor.
2. El campo `markdown_filename` (`<nombre>.md`) es solo una sugerencia de nombre de descarga.
3. El frontend construye un `data:text/markdown;...` URL y dispara la descarga en el navegador. El `.md` solo existe en el cliente, donde lo guarde el usuario. Si no se descarga, se pierde al cerrar la pestaña.

### Manejo de errores por lote (`/api/convert`)

Cada archivo se procesa en su propio `try/except`: un error en uno no aborta el resto. La respuesta siempre es `200 OK` con dos arrays:

```json
{
  "results": [ ... archivos convertidos con éxito ... ],
  "errors":  [ { "filename": "...", "error": "..." } ],
  "total_files": N,
  "successful": M,
  "failed": N - M
}
```

`/api/convert-single`, en cambio, levanta `HTTPException` (400 si la extensión no está soportada, 500 si la conversión falla).

### Caveats

- **Crash entre los pasos 3 y 6** (p. ej. `kill -9` o panic del proceso): el temp file queda huérfano en `/tmp`. Solo el `try/finally` cubre el caso normal, no la muerte abrupta.
- **Memoria**: el límite de 50 MB por archivo y 50 archivos por lote (ver siguiente sección) se aplica en el handler tras leer el body. El archivo se carga entero en memoria/disco antes de validarse — un proxy delante (Nginx, Caddy) sigue siendo recomendable para cortar el upload antes de llegar al worker.
- **CORS**: `allow_origins=["*"]` está pensado para uso local. Restringir antes de cualquier despliegue.

## ⚙️ Configuración Avanzada

### Instalar dependencias opcionales específicas

```bash
# Solo para PDF
uv pip install markitdown[pdf]

# Para múltiples formatos
uv pip install markitdown[pdf,docx,pptx,xlsx]

# Todos los formatos (default en el proyecto)
uv pip install 'markitdown[all]'
```

## 🛡️ Consideraciones de Seguridad

⚠️ **Importante**: MarkItDown realiza operaciones de I/O con los privilegios del proceso actual.
En ambientes no confiables:

- Valida y sanitiza las rutas de archivo
- Limita los esquemas de URI permitidos
- Restringe el acceso a recursos privados/locales
- Usa la función de conversión más específica que necesites

### Mitigaciones implementadas en esta app

- **Límite de tamaño por archivo**: 50 MB. Por encima → `413 Request Entity Too Large`.
- **Límite de archivos por lote**: 50 en `/api/convert`. Por encima → `400`.
- **Saneamiento de nombres reflejados**: los caracteres de control ASCII se eliminan del `filename` antes de devolverlo en la respuesta y de usarlo como sugerencia de descarga.
- **Escapado HTML en el frontend**: cualquier nombre de archivo o mensaje de error se escapa (`& < > " '`) antes de inyectarse en `innerHTML`. Defensa contra XSS reflejado por nombres maliciosos como `<img src=x onerror=...>.txt`.
- **`enable_plugins=False`** en el constructor de `MarkItDown`: no se cargan plugins externos. Reduce superficie de RCE si el entorno se ve comprometido.
- **`tempfile.NamedTemporaryFile`** con nombre aleatorio: el atacante no controla la ruta del archivo en disco. La extensión sí (load-bearing para el dispatcher de MarkItDown), pero está validada contra una whitelist.
- **Borrado del temp file** en `finally`: nada se persiste tras la conversión.

### Riesgos residuales conocidos

- **Sin timeout en `md.convert()`**. Un PDF/Office malformado puede colgar el worker. Mitigación operacional: ejecutar tras un proxy con timeout (Nginx, Caddy) o un supervisor que reinicie workers colgados.
- **XXE / SSRF en formatos XML-like** (`.xml`, `.html`, `.htm`, `.epub`). El comportamiento depende de la lib upstream. Si vas a procesar documentos no confiables, considera deshabilitar esas extensiones eliminándolas de `SUPPORTED_EXTENSIONS`.
- **Zip slip / zip bomb en `.zip`**. Misma consideración que XML.
- **Macros en Office docs**: MarkItDown extrae texto, no ejecuta macros, pero los parsers de Office son superficie de ataque histórica (CVEs). Mantén la dependencia actualizada.
- **CORS abierto** (`allow_origins=["*"]`): solo apto para uso local. Restringir antes de cualquier despliegue público.
- **Sin autenticación**: no la hay. Cualquiera con acceso al puerto puede convertir archivos. Pon delante un reverse-proxy con auth si lo expones.

## 🐛 Solución de Problemas

### Error: "Python 3.10 not found"
```bash
# Especificar versión de Python explícitamente
uv venv --python 3.11
```

### Error: "Module not found: markitdown"
```bash
# Reinstalar dependencias
uv sync --force
```

### La interfaz no carga
- Verifica que el servidor esté ejecutándose en http://localhost:8000
- Abre la consola del navegador (F12) para revisar errores
- Asegúrate de que el puerto 8000 no esté en uso

## 📝 Desarrollo

### Ejecutar tests

```bash
uv sync --all-extras
uv run pytest
```

### Formatear código

```bash
uv run black backend/ frontend/
uv run ruff check backend/ frontend/
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto usa [MarkItDown](https://github.com/microsoft/markitdown) que está bajo licencia MIT.

## 👤 Autor

**Antonio Rueda** — [@aruetre](https://github.com/aruetre) · antonio.rueda@gmail.com

Repositorio: <https://github.com/aruetre/markitdown_gui>

## 🙏 Créditos

- [Microsoft MarkItDown](https://github.com/microsoft/markitdown) - Librería de conversión
- [FastAPI](https://fastapi.tiangolo.com/) - Framework web
- [Uvicorn](https://www.uvicorn.org/) - Servidor ASGI

## 📧 Soporte

Si encuentras problemas:

1. Revisa el [README de MarkItDown](https://github.com/microsoft/markitdown)
2. Consulta los [Problemas conocidos](https://github.com/microsoft/markitdown/issues)
3. Abre un issue en este repositorio

---

**Hecho con ❤️ usando MarkItDown y FastAPI**
