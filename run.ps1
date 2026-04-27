# Script de ejecución para Windows PowerShell
# Uso: .\run.ps1

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          MarkItDown GUI - Iniciando servidor...               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar si uv está instalado
$uvPath = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uvPath) {
    Write-Host "❌ Error: 'uv' no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para instalar uv, visita: https://docs.astral.sh/uv/getting-started/installation/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Gestor de paquetes 'uv' detectado" -ForegroundColor Green
Write-Host ""

# Verificar si Python está disponible
$pythonPath = uv python find 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No se encontró Python. Instalando..." -ForegroundColor Yellow
    uv python install
}

Write-Host "✓ Python configurado correctamente" -ForegroundColor Green
Write-Host ""

# Sincronizar dependencias
Write-Host "📦 Sincronizando dependencias..." -ForegroundColor Cyan
uv sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al sincronizar dependencias" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencias sincronizadas" -ForegroundColor Green
Write-Host ""

# Mostrar información de inicio
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🚀 Iniciando servidor FastAPI..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Servidor en: " -ForegroundColor Green -NoNewline
Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "📚 Documentación API: " -ForegroundColor Green -NoNewline
Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Ejecutar el servidor
uv run python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
