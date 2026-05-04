import io
import os
import tempfile
import zipfile
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn
from markitdown import MarkItDown

# Límites para mitigar DoS por documentos grandes o lotes masivos
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB por archivo
MAX_FILES_PER_BATCH = 50
MAX_FILENAME_LEN = 255

# Crear aplicación FastAPI
app = FastAPI(title="MarkItDown GUI")

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Plugins desactivados: cargarían cualquier paquete instalado y amplían superficie sin necesidad real aquí
md = MarkItDown(enable_plugins=False)


def _safe_filename(name: str | None) -> str:
    """Sanitizar nombre antes de reflejarlo en respuestas, sugerencia de descarga, o miembro de zip.

    - Quita componentes de ruta (defensa contra path-traversal y zip-slip).
    - Elimina caracteres de control ASCII (rompen el render del frontend y nombres de zip).
    - Trunca a MAX_FILENAME_LEN.
    """
    if not name:
        return "file"
    # Strip path components (unix y windows). basename solo cubre el separador del SO actual.
    name = name.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(c for c in name if ord(c) >= 0x20 and ord(c) != 0x7F)
    cleaned = cleaned[:MAX_FILENAME_LEN]
    return cleaned or "file"


def _check_request_size(request: Request) -> None:
    """Rechaza temprano por Content-Length si excede el presupuesto del lote."""
    cl = request.headers.get("content-length")
    if cl is None:
        return
    try:
        size = int(cl)
    except ValueError:
        return
    if size > MAX_FILE_SIZE * MAX_FILES_PER_BATCH:
        raise HTTPException(status_code=413, detail="Request body too large")


# Extensiones soportadas
SUPPORTED_EXTENSIONS = {
    # Documentos
    ".pdf": "PDF",
    ".docx": "Word",
    ".doc": "Word",
    ".pptx": "PowerPoint",
    ".ppt": "PowerPoint",
    ".xlsx": "Excel",
    ".xls": "Excel",
    ".csv": "CSV",
    # Imágenes
    ".jpg": "Image",
    ".jpeg": "Image",
    ".png": "Image",
    ".gif": "Image",
    ".bmp": "Image",
    ".webp": "Image",
    # Audio
    ".mp3": "Audio",
    ".wav": "Audio",
    ".m4a": "Audio",
    # Texto
    ".txt": "Text",
    ".json": "JSON",
    ".xml": "XML",
    ".html": "HTML",
    ".htm": "HTML",
    ".md": "Markdown",
    ".epub": "EPUB",
    ".zip": "ZIP",
}


@app.get("/")
async def root():
    """Servir la página principal"""
    return FileResponse("frontend/index.html")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Sirve el SVG como favicon también en /favicon.ico para clientes que no leen el <link>."""
    return FileResponse("frontend/static/favicon.svg", media_type="image/svg+xml")


@app.get("/api/supported-formats")
async def get_supported_formats():
    """Obtener lista de formatos soportados"""
    return JSONResponse(
        {"formats": SUPPORTED_EXTENSIONS, "extensions": list(SUPPORTED_EXTENSIONS.keys())}
    )


@app.post("/api/convert")
async def convert_files(request: Request, files: List[UploadFile] = File(...)):
    """
    Convertir múltiples archivos a Markdown.
    Detecta automáticamente la extensión y convierte individualmente.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) > MAX_FILES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files (max {MAX_FILES_PER_BATCH})",
        )

    _check_request_size(request)

    results = []
    errors = []

    for file in files:
        safe_name = _safe_filename(file.filename)
        try:
            file_extension = Path(file.filename or "").suffix.lower()

            if file_extension not in SUPPORTED_EXTENSIONS:
                errors.append(
                    {
                        "filename": safe_name,
                        "error": f"Format not supported. Supported formats: {', '.join(SUPPORTED_EXTENSIONS.keys())}",
                    }
                )
                continue

            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                errors.append(
                    {
                        "filename": safe_name,
                        "error": f"File too large (max {MAX_FILE_SIZE // (1024 * 1024)} MB)",
                    }
                )
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name

            try:
                result = md.convert(tmp_path)
                filename_without_ext = _safe_filename(Path(file.filename or "").stem)

                results.append(
                    {
                        "original_filename": safe_name,
                        "format": SUPPORTED_EXTENSIONS.get(file_extension, "Unknown"),
                        "extension": file_extension,
                        "markdown_content": result.text_content,
                        "markdown_filename": f"{filename_without_ext}.md",
                        "status": "success",
                    }
                )
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        except Exception as e:
            errors.append({"filename": safe_name, "error": str(e)})

    return JSONResponse(
        {
            "results": results,
            "errors": errors,
            "total_files": len(files),
            "successful": len(results),
            "failed": len(errors),
        }
    )


@app.post("/api/convert-single")
async def convert_single_file(request: Request, file: UploadFile = File(...)):
    """Convertir un único archivo a Markdown"""
    _check_request_size(request)

    try:
        file_extension = Path(file.filename or "").suffix.lower()

        if file_extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Format not supported. Supported formats: {', '.join(SUPPORTED_EXTENSIONS.keys())}",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (max {MAX_FILE_SIZE // (1024 * 1024)} MB)",
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            result = md.convert(tmp_path)
            filename_without_ext = _safe_filename(Path(file.filename or "").stem)

            return JSONResponse(
                {
                    "original_filename": _safe_filename(file.filename),
                    "format": SUPPORTED_EXTENSIONS.get(file_extension, "Unknown"),
                    "extension": file_extension,
                    "markdown_content": result.text_content,
                    "markdown_filename": f"{filename_without_ext}.md",
                    "status": "success",
                }
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ZipFileEntry(BaseModel):
    filename: str = Field(..., max_length=MAX_FILENAME_LEN * 2)
    content: str


class ZipRequest(BaseModel):
    files: List[ZipFileEntry]


def _unique_zip_name(name: str, taken: set[str]) -> str:
    """Devuelve un nombre que no colisione con los ya usados, añadiendo sufijo (2), (3), ..."""
    if name not in taken:
        return name
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    i = 2
    while True:
        candidate = f"{stem} ({i}).{ext}" if ext else f"{stem} ({i})"
        if candidate not in taken:
            return candidate
        i += 1


@app.post("/api/zip")
async def create_zip(request: Request, payload: ZipRequest):
    """Empaquetar varios .md generados por el cliente en un único zip."""
    _check_request_size(request)

    if not payload.files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(payload.files) > MAX_FILES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files (max {MAX_FILES_PER_BATCH})",
        )

    buf = io.BytesIO()
    taken: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for entry in payload.files:
            name = _safe_filename(entry.filename)
            if not name.lower().endswith(".md"):
                name = f"{name}.md"
            name = _unique_zip_name(name, taken)
            taken.add(name)
            zf.writestr(name, entry.content)

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="conversiones.zip"'},
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
