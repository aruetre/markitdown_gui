// Variables globales
let selectedFiles = [];
let supportedFormats = {};
let currentModalData = null;

// Elementos del DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const formatsList = document.getElementById('formatsList');
const progressSection = document.getElementById('progressSection');
const resultsSection = document.getElementById('resultsSection');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const newConversionBtn = document.getElementById('newConversionBtn');
const contentModal = document.getElementById('contentModal');
const downloadBtn = document.getElementById('downloadBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressCurrent = document.getElementById('progressCurrent');
const progressLog = document.getElementById('progressLog');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const toastContainer = document.getElementById('toastContainer');
const resultsList = document.getElementById('resultsList');
const successInfo = document.getElementById('successInfo');
const errorInfo = document.getElementById('errorInfo');
const successCount = document.getElementById('successCount');
const errorCount = document.getElementById('errorCount');

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await loadSupportedFormats();
    setupEventListeners();
});

// Cargar formatos soportados
async function loadSupportedFormats() {
    try {
        const response = await fetch('/api/supported-formats');
        const data = await response.json();
        supportedFormats = data.formats;
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
    for (const [ext, fmt] of Object.entries(supportedFormats)) {
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

// Configurar event listeners
function setupEventListeners() {
    // Upload area
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Botones
    convertBtn.addEventListener('click', convertFiles);
    clearBtn.addEventListener('click', clearFiles);
    newConversionBtn.addEventListener('click', resetUI);
    downloadAllBtn.addEventListener('click', downloadAll);
}

// Manejar archivos seleccionados
function handleFiles(files) {
    selectedFiles = Array.from(files);
    
    if (selectedFiles.length === 0) return;
    
    // Validar extensiones
    selectedFiles = selectedFiles.filter(file => {
        const ext = extOf(file.name);
        if (!supportedFormats[ext]) {
            console.warn(`Formato no soportado: ${file.name}`);
            return false;
        }
        return true;
    });
    
    if (selectedFiles.length === 0) {
        alert('No hay archivos con formatos soportados');
        return;
    }
    
    renderFilesList();
    uploadArea.style.display = 'none';
    filesSection.style.display = 'block';
}

// Renderizar lista de archivos
function renderFilesList() {
    filesList.innerHTML = selectedFiles
        .map((file, index) => {
            const ext = extOf(file.name);
            const format = supportedFormats[ext] || 'Unknown';
            const size = formatFileSize(file.size);
            
            return `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-icon">${getFileIcon(ext)}</div>
                        <div>
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-size">${escapeHtml(format)} • ${size}</div>
                        </div>
                    </div>
                    <button class="remove-btn" onclick="removeFile(${index})">✕</button>
                </div>
            `;
        })
        .join('');
}

// Remover archivo
function removeFile(index) {
    selectedFiles.splice(index, 1);
    
    if (selectedFiles.length === 0) {
        clearFiles();
    } else {
        renderFilesList();
    }
}

// Limpiar archivos
function clearFiles() {
    selectedFiles = [];
    fileInput.value = '';
    filesSection.style.display = 'none';
    uploadArea.style.display = 'block';
}

// Convertir archivos uno a uno, mostrando progreso y tiempo por archivo
async function convertFiles() {
    if (selectedFiles.length === 0) {
        alert('Selecciona al menos un archivo');
        return;
    }

    filesSection.style.display = 'none';
    progressSection.style.display = 'block';
    convertBtn.disabled = true;

    const total = selectedFiles.length;
    const results = [];
    const errors = [];

    progressFill.style.width = '0%';
    progressText.textContent = `0/${total} archivos procesados`;
    progressCurrent.textContent = '';
    progressLog.innerHTML = '';

    for (let i = 0; i < total; i++) {
        const file = selectedFiles[i];
        progressCurrent.textContent = `Procesando ${i + 1}/${total}: ${file.name}`;
        appendLog(`⏳ ${file.name}…`, 'pending');

        const formData = new FormData();
        formData.append('file', file);

        const start = performance.now();
        try {
            const response = await fetch('/api/convert-single', {
                method: 'POST',
                body: formData
            });
            const elapsedMs = performance.now() - start;

            if (response.ok) {
                const result = await response.json();
                result.elapsed_ms = elapsedMs;
                results.push(result);
                replaceLastLog(`✓ ${file.name} — ${formatElapsed(elapsedMs)}`, 'ok');
            } else {
                let detail;
                try {
                    detail = (await response.json()).detail || `HTTP ${response.status}`;
                } catch {
                    detail = `HTTP ${response.status}`;
                }
                errors.push({ filename: file.name, error: detail, elapsed_ms: elapsedMs });
                replaceLastLog(`✗ ${file.name} — ${detail}`, 'err');
            }
        } catch (error) {
            const elapsedMs = performance.now() - start;
            errors.push({ filename: file.name, error: error.message, elapsed_ms: elapsedMs });
            replaceLastLog(`✗ ${file.name} — ${error.message}`, 'err');
        }

        const done = i + 1;
        progressFill.style.width = `${(done / total) * 100}%`;
        progressText.textContent = `${done}/${total} archivos procesados`;
    }

    progressCurrent.textContent = '';
    displayResults({
        results,
        errors,
        total_files: total,
        successful: results.length,
        failed: errors.length
    });
}

// Añadir línea al log de progreso
function appendLog(text, kind) {
    const div = document.createElement('div');
    div.className = `progress-log-item ${kind}`;
    div.textContent = text;
    progressLog.appendChild(div);
    progressLog.scrollTop = progressLog.scrollHeight;
}

// Reemplazar la última línea del log (transición pending → ok/err)
function replaceLastLog(text, kind) {
    const last = progressLog.lastElementChild;
    if (!last) {
        appendLog(text, kind);
        return;
    }
    last.className = `progress-log-item ${kind}`;
    last.textContent = text;
}

// Formatear duración: < 1s en ms, >= 1s en s con un decimal
function formatElapsed(ms) {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

// Escapar caracteres especiales de HTML antes de interpolar en innerHTML.
// Defensa contra XSS por nombres de archivo o mensajes de error con caracteres como < > " ' &
function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Mostrar resultados
function displayResults(data) {
    progressSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // Actualizar información de éxito/error
    if (data.successful > 0) {
        successInfo.style.display = 'block';
        successCount.textContent = data.successful;
    } else {
        successInfo.style.display = 'none';
    }
    
    if (data.failed > 0) {
        errorInfo.style.display = 'block';
        errorCount.textContent = data.failed;
    } else {
        errorInfo.style.display = 'none';
    }
    
    // Renderizar resultados
    const allResults = [];
    
    // Agregar conversiones exitosas
    data.results.forEach(result => {
        allResults.push({
            ...result,
            type: 'success'
        });
    });
    
    // Agregar errores
    data.errors.forEach(error => {
        allResults.push({
            ...error,
            type: 'error'
        });
    });
    
    resultsList.innerHTML = allResults
        .map((result, index) => {
            if (result.type === 'error') {
                const errIcon = getFileIcon(extOf(result.filename));
                return `
                    <div class="result-item">
                        <div class="result-header">
                            <div class="result-info">
                                <div class="result-status">❌</div>
                                <div class="result-details">
                                    <div class="result-filename">${errIcon} ${escapeHtml(result.filename)}</div>
                                    <div class="result-error-message">${escapeHtml(result.error)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const elapsed = result.elapsed_ms != null ? ` • ${formatElapsed(result.elapsed_ms)}` : '';
            const sourceIcon = getFileIcon(result.extension || extOf(result.original_filename));
            return `
                <div class="result-item">
                    <div class="result-header">
                        <div class="result-info">
                            <div class="result-status">✓</div>
                            <div class="result-details">
                                <div class="result-filename">${escapeHtml(result.markdown_filename)}</div>
                                <div class="result-format">De: ${sourceIcon} ${escapeHtml(result.original_filename)} (${escapeHtml(result.format)})${elapsed}</div>
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="result-btn view" onclick="viewContent(${index})">Ver</button>
                            <button class="result-btn download" onclick="downloadFile(${index})">Descargar</button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');
    
    // Guardar datos para descargas
    window.conversionResults = data.results;
    convertBtn.disabled = false;
}

// Ver contenido en modal
function viewContent(index) {
    const result = window.conversionResults[index];
    currentModalData = result;
    
    document.getElementById('modalTitle').textContent = result.markdown_filename;
    document.getElementById('modalPreview').textContent = result.markdown_content;
    
    contentModal.style.display = 'flex';
}

// Cerrar modal
function closeModal() {
    contentModal.style.display = 'none';
}

// Disparar descarga de un resultado y mostrar confirmación
function triggerDownload(result) {
    const element = document.createElement('a');
    element.setAttribute(
        'href',
        'data:text/markdown;charset=utf-8,' + encodeURIComponent(result.markdown_content)
    );
    element.setAttribute('download', result.markdown_filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast(`Descargado: ${result.markdown_filename}`, 'ok');
}

// Descargar archivo individual
function downloadFile(index) {
    triggerDownload(window.conversionResults[index]);
}

// Descargar todos los resultados exitosos como un único ZIP (pedido al backend)
async function downloadAll() {
    const all = window.conversionResults || [];
    if (all.length === 0) {
        showToast('No hay archivos para descargar', 'err');
        return;
    }

    downloadAllBtn.disabled = true;
    const originalLabel = downloadAllBtn.textContent;
    downloadAllBtn.textContent = 'Generando ZIP…';

    try {
        const response = await fetch('/api/zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: all.map((r) => ({
                    filename: r.markdown_filename,
                    content: r.markdown_content,
                })),
            }),
        });

        if (!response.ok) {
            let detail;
            try {
                detail = (await response.json()).detail || `HTTP ${response.status}`;
            } catch {
                detail = `HTTP ${response.status}`;
            }
            showToast(`Error generando ZIP: ${detail}`, 'err');
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const element = document.createElement('a');
        element.setAttribute('href', url);
        element.setAttribute('download', 'conversiones.zip');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);

        showToast(`ZIP descargado (${all.length} archivos)`, 'ok');
    } catch (error) {
        showToast(`Error generando ZIP: ${error.message}`, 'err');
    } finally {
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = originalLabel;
    }
}

// Descargar desde modal
downloadBtn.addEventListener('click', () => {
    triggerDownload(currentModalData);
});

// Mostrar toast efímero (3.5s)
function showToast(message, kind = 'ok') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Cerrar modal al hacer clic fuera
contentModal.addEventListener('click', (e) => {
    if (e.target === contentModal) {
        closeModal();
    }
});

// Nueva conversión
function resetUI() {
    clearFiles();
    resultsSection.style.display = 'none';
    progressSection.style.display = 'none';
    uploadArea.style.display = 'block';
    contentModal.style.display = 'none';
}

// Utilidades
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Badge SVG por extensión: forma de documento con esquina doblada + etiqueta del formato
// en blanco sobre color de familia (PDF rojo, Word azul, Excel verde, PPT naranja, etc.).
const FILE_TYPES = {
    '.pdf':  ['PDF',  '#DC2626'],
    '.docx': ['DOCX', '#2563EB'],
    '.doc':  ['DOC',  '#2563EB'],
    '.pptx': ['PPTX', '#EA580C'],
    '.ppt':  ['PPT',  '#EA580C'],
    '.xlsx': ['XLSX', '#16A34A'],
    '.xls':  ['XLS',  '#16A34A'],
    '.csv':  ['CSV',  '#16A34A'],
    '.jpg':  ['JPG',  '#9333EA'],
    '.jpeg': ['JPEG', '#9333EA'],
    '.png':  ['PNG',  '#9333EA'],
    '.gif':  ['GIF',  '#9333EA'],
    '.bmp':  ['BMP',  '#9333EA'],
    '.webp': ['WEBP', '#9333EA'],
    '.mp3':  ['MP3',  '#DB2777'],
    '.wav':  ['WAV',  '#DB2777'],
    '.m4a':  ['M4A',  '#DB2777'],
    '.txt':  ['TXT',  '#64748B'],
    '.md':   ['MD',   '#475569'],
    '.json': ['JSON', '#D97706'],
    '.xml':  ['XML',  '#7C3AED'],
    '.html': ['HTML', '#0891B2'],
    '.htm':  ['HTM',  '#0891B2'],
    '.epub': ['EPUB', '#0D9488'],
    '.zip':  ['ZIP',  '#525252'],
};

function getFileIcon(ext) {
    const [label, color] = FILE_TYPES[ext] || ['FILE', '#64748B'];
    // Escala el texto según la longitud para que quepa siempre en el badge
    const fontSize = label.length <= 3 ? 7 : label.length === 4 ? 5.4 : 4.5;
    return `<svg class="file-glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6.5 2 H14.5 L19 6.5 V20.5 A1.5 1.5 0 0 1 17.5 22 H6.5 A1.5 1.5 0 0 1 5 20.5 V3.5 A1.5 1.5 0 0 1 6.5 2 Z" fill="${color}"/><path d="M14.5 2 V5.5 A1 1 0 0 0 15.5 6.5 H19 Z" fill="rgba(255,255,255,0.32)"/><text x="12" y="16" text-anchor="middle" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">${label}</text></svg>`;
}

// Extraer extensión normalizada de un nombre de archivo
function extOf(name) {
    if (!name) return '';
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}
