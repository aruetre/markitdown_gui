#!/bin/bash
# Script de ejecución para Linux/Mac
# Uso: ./run.sh

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          MarkItDown GUI - Iniciando servidor...               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar si uv está instalado
if ! command -v uv &> /dev/null; then
    echo "❌ Error: 'uv' no está instalado"
    echo ""
    echo "Para instalar uv, visita: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

echo "✓ Gestor de paquetes 'uv' detectado"
echo ""

# Verificar si Python está disponible
if ! uv python find &> /dev/null; then
    echo "⚠️  No se encontró Python. Instalando..."
    uv python install
fi

echo "✓ Python configurado correctamente"
echo ""

# Sincronizar dependencias
echo "📦 Sincronizando dependencias..."
uv sync
if [ $? -ne 0 ]; then
    echo "❌ Error al sincronizar dependencias"
    exit 1
fi

echo "✓ Dependencias sincronizadas"
echo ""

# Mostrar información de inicio
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Iniciando servidor FastAPI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Servidor en: http://localhost:8000"
echo "📚 Documentación API: http://localhost:8000/docs"
echo ""
echo "💡 Presiona Ctrl+C para detener el servidor"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ejecutar el servidor
uv run python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
