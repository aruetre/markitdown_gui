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

// Renderizar lista de formatos
function renderFormats() {
    const formats = Object.values(supportedFormats);
    const uniqueFormats = [...new Set(formats)];
    
    formatsList.innerHTML = uniqueFormats
        .map(format => `<div class="format-badge">${format}</div>`)
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
}

// Manejar archivos seleccionados
function handleFiles(files) {
    selectedFiles = Array.from(files);
    
    if (selectedFiles.length === 0) return;
    
    // Validar extensiones
    selectedFiles = selectedFiles.filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
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
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            const format = supportedFormats[ext] || 'Unknown';
            const size = formatFileSize(file.size);
            
            return `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-icon">${getFileIcon(ext)}</div>
                        <div>
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${format} • ${size}</div>
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

// Convertir archivos
async function convertFiles() {
    if (selectedFiles.length === 0) {
        alert('Selecciona al menos un archivo');
        return;
    }
    
    // Mostrar progreso
    filesSection.style.display = 'none';
    progressSection.style.display = 'block';
    convertBtn.disabled = true;
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al convertir archivos: ' + error.message);
        progressSection.style.display = 'none';
        filesSection.style.display = 'block';
        convertBtn.disabled = false;
    }
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
                return `
                    <div class="result-item">
                        <div class="result-header">
                            <div class="result-info">
                                <div class="result-status">❌</div>
                                <div class="result-details">
                                    <div class="result-filename">${result.filename}</div>
                                    <div class="result-error-message">${result.error}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="result-item">
                    <div class="result-header">
                        <div class="result-info">
                            <div class="result-status">✓</div>
                            <div class="result-details">
                                <div class="result-filename">${result.markdown_filename}</div>
                                <div class="result-format">De: ${result.original_filename} (${result.format})</div>
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

// Descargar archivo
function downloadFile(index) {
    const result = window.conversionResults[index];
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(result.markdown_content));
    element.setAttribute('download', result.markdown_filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Descargar desde modal
downloadBtn.addEventListener('click', () => {
    const result = currentModalData;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(result.markdown_content));
    element.setAttribute('download', result.markdown_filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
});

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

function getFileIcon(ext) {
    const icons = {
        '.pdf': '📄',
        '.docx': '📋',
        '.doc': '📋',
        '.pptx': '🎯',
        '.ppt': '🎯',
        '.xlsx': '📊',
        '.xls': '📊',
        '.csv': '📊',
        '.jpg': '🖼️',
        '.jpeg': '🖼️',
        '.png': '🖼️',
        '.gif': '🖼️',
        '.mp3': '🎵',
        '.wav': '🎵',
        '.txt': '📝',
        '.json': '{}',
        '.xml': '📄',
        '.html': '🌐',
        '.epub': '📚',
        '.zip': '📦'
    };
    return icons[ext] || '📁';
}
