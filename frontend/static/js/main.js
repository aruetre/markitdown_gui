// Bootstrap: carga inicial de datos y cableado de listeners.
import { state } from './state.js';
import { fetchSupportedFormats } from './api.js';
import { escapeHtml, getFileIcon } from './utils.js';
import { loadAnonymizerOptions } from './anonymize.js';
import { setupFiles, clearFiles } from './files.js';
import { setupConversion } from './conversion.js';
import { setupResults, closeModal } from './results.js';

const formatsList = document.getElementById('formatsList');
const uploadArea = document.getElementById('uploadArea');
const resultsSection = document.getElementById('resultsSection');
const progressSection = document.getElementById('progressSection');

// Cargar formatos soportados
async function loadSupportedFormats() {
    try {
        const data = await fetchSupportedFormats();
        state.supportedFormats = data.formats;
        renderFormats();
    } catch (error) {
        console.error('Error loading formats:', error);
        formatsList.innerHTML = '<div class="format-loading">Error al cargar formatos</div>';
    }
}

// Renderizar lista de formatos. Cada formato puede mapear a varias extensiones
// (ej. Word → .docx y .doc); usamos el icono de la primera extensión asociada.
function renderFormats() {
    const formatToIcon = {};
    for (const [ext, fmt] of Object.entries(state.supportedFormats)) {
        if (!formatToIcon[fmt]) {
            formatToIcon[fmt] = getFileIcon(ext);
        }
    }

    formatsList.innerHTML = Object.keys(formatToIcon)
        .map(format => `
            <div class="format-badge">
                <span class="format-badge-icon">${formatToIcon[format]}</span>
                <span>${escapeHtml(format)}</span>
            </div>
        `)
        .join('');
}

// Nueva conversión: vuelve al estado inicial
function resetUI() {
    clearFiles();
    resultsSection.hidden = true;
    progressSection.hidden = true;
    uploadArea.hidden = false;
    closeModal();
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await loadSupportedFormats();
    await loadAnonymizerOptions();

    setupFiles();
    setupConversion();
    setupResults();
    document.getElementById('newConversionBtn').addEventListener('click', resetUI);
});
