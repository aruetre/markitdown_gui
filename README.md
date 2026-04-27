# MarkItDown GUI

Una interfaz gráfica web moderna para convertir múltiples formatos de archivo a Markdown usando [Microsoft MarkItDown](https://github.com/microsoft/markitdown).

## 🎯 Características

- ✅ **Carga de múltiples archivos** - Arrastra y suelta o selecciona archivos
- 🔍 **Detección automática de extensiones** - Identifica el formato automáticamente
- 🚀 **Conversión individual** - Procesa cada archivo de forma separada
- 📋 **Vista previa** - Visualiza el contenido Markdown en tiempo real
- 💾 **Descarga individual** - Guarda cada archivo convertido por separado
- 🎨 **Interfaz moderna** - Diseño responsivo y amigable

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
- CSV, JSON, XML
- HTML, EPUB
- ZIP files
- Markdown

## 🚀 Requisitos Previos

- Python 3.10 o superior
- `uv` (gestor de paquetes) - [Instalar uv](https://docs.astral.sh/uv/getting-started/installation/)

## 📥 Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone <repository-url>
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
│   └── main.py              # Servidor FastAPI
├── frontend/
│   ├── index.html           # Interfaz HTML
│   └── static/
│       ├── styles.css       # Estilos CSS
│       └── script.js        # Lógica JavaScript
├── pyproject.toml           # Configuración de dependencias (uv)
├── run.sh                   # Script para ejecutar (Linux/Mac)
├── run.ps1                  # Script para ejecutar (Windows)
└── README.md               # Este archivo
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
