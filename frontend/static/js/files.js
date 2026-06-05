// Selección / drag-drop de archivos, lista, "añadir más", quitar y limpiar.
import { state } from './state.js';
import { escapeHtml, extOf, formatFileSize, getFileIcon } from './utils.js';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');

// Manejar archivos seleccionados (acumula sobre los ya añadidos)
function handleFiles(files) {
    // Validar extensiones de lo recién soltado/seleccionado
    const incoming = Array.from(files).filter(file => {
        const ext = extOf(file.name);
        if (!state.supportedFormats[ext]) {
            console.warn(`Formato no soportado: ${file.name}`);
            return false;
        }
        return true;
    });

    // Permite volver a elegir el mismo archivo en una selección posterior
    fileInput.value = '';

    if (incoming.length === 0) {
        if (state.selectedFiles.length === 0) {
            alert('No hay archivos con formatos soportados');
        }
        return;
    }

    // Añadir solo los que no estén ya en la lista (mismo nombre y tamaño)
    const seen = new Set(state.selectedFiles.map(f => `${f.name}|${f.size}`));
    for (const file of incoming) {
        const key = `${file.name}|${file.size}`;
        if (!seen.has(key)) {
            seen.add(key);
            state.selectedFiles.push(file);
        }
    }

    renderFilesList();
    uploadArea.hidden = true;
    filesSection.hidden = false;
}

// Renderizar lista de archivos
function renderFilesList() {
    filesList.innerHTML = state.selectedFiles
        .map((file, index) => {
            const ext = extOf(file.name);
            const format = state.supportedFormats[ext] || 'Unknown';
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
                    <button class="remove-btn" type="button" data-action="remove" data-index="${index}" aria-label="Quitar ${escapeHtml(file.name)}">✕</button>
                </div>
            `;
        })
        .join('');
}

// Remover archivo por índice
function removeFile(index) {
    state.selectedFiles.splice(index, 1);

    if (state.selectedFiles.length === 0) {
        clearFiles();
    } else {
        renderFilesList();
    }
}

// Limpiar archivos
export function clearFiles() {
    state.selectedFiles = [];
    fileInput.value = '';
    filesSection.hidden = true;
    uploadArea.hidden = false;
}

// Cablear los listeners del área de subida y de la lista de archivos.
export function setupFiles() {
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

    // Delegación: botón "quitar" de cada archivo
    filesList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove"]');
        if (!btn) return;
        removeFile(Number(btn.dataset.index));
    });

    // "Añadir más archivos" reutiliza el input de fichero
    document.getElementById('addMoreBtn').addEventListener('click', () => fileInput.click());
    document.getElementById('clearBtn').addEventListener('click', clearFiles);
}
