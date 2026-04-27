import os
import tempfile
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from markitdown import MarkItDown

# Crear aplicación FastAPI
app = FastAPI(title="MarkItDown GUI")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Inicializar MarkItDown
md = MarkItDown(enable_plugins=True)

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


@app.get("/api/supported-formats")
async def get_supported_formats():
    """Obtener lista de formatos soportados"""
    return JSONResponse(
        {"formats": SUPPORTED_EXTENSIONS, "extensions": list(SUPPORTED_EXTENSIONS.keys())}
    )


@app.post("/api/convert")
async def convert_files(files: List[UploadFile] = File(...)):
    """
    Convertir múltiples archivos a Markdown.
    Detecta automáticamente la extensión y convierte individualmente.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    errors = []

    for file in files:
        try:
            # Obtener extensión
            file_extension = Path(file.filename).suffix.lower()

            # Validar que la extensión sea soportada
            if file_extension not in SUPPORTED_EXTENSIONS:
                errors.append(
                    {
                        "filename": file.filename,
                        "error": f"Format not supported. Supported formats: {', '.join(SUPPORTED_EXTENSIONS.keys())}",
                    }
                )
                continue

            # Crear archivo temporal
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_path = tmp_file.name

            try:
                # Convertir usando MarkItDown
                result = md.convert(tmp_path)

                # Obtener nombre del archivo sin extensión
                filename_without_ext = Path(file.filename).stem

                results.append(
                    {
                        "original_filename": file.filename,
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
            errors.append({"filename": file.filename, "error": str(e)})

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
async def convert_single_file(file: UploadFile = File(...)):
    """Convertir un único archivo a Markdown"""
    try:
        # Obtener extensión
        file_extension = Path(file.filename).suffix.lower()

        # Validar que la extensión sea soportada
        if file_extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Format not supported. Supported formats: {', '.join(SUPPORTED_EXTENSIONS.keys())}",
            )

        # Crear archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            # Convertir usando MarkItDown
            result = md.convert(tmp_path)

            # Obtener nombre del archivo sin extensión
            filename_without_ext = Path(file.filename).stem

            return JSONResponse(
                {
                    "original_filename": file.filename,
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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
