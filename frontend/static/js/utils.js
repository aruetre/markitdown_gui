// Funciones puras de presentación y formato (sin estado ni DOM compartido).

// Escapar caracteres especiales de HTML antes de interpolar en innerHTML.
// Defensa contra XSS por nombres de archivo o mensajes de error con caracteres como < > " ' &
export function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Extraer extensión normalizada de un nombre de archivo
export function extOf(name) {
    if (!name) return '';
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

// Tamaño legible de un archivo en bytes
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Formatear duración: < 1s en ms, >= 1s en s con un decimal
export function formatElapsed(ms) {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
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

export function getFileIcon(ext) {
    const [label, color] = FILE_TYPES[ext] || ['FILE', '#64748B'];
    // Escala el texto según la longitud para que quepa siempre en el badge
    const fontSize = label.length <= 3 ? 7 : label.length === 4 ? 5.4 : 4.5;
    return `<svg class="file-glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6.5 2 H14.5 L19 6.5 V20.5 A1.5 1.5 0 0 1 17.5 22 H6.5 A1.5 1.5 0 0 1 5 20.5 V3.5 A1.5 1.5 0 0 1 6.5 2 Z" fill="${color}"/><path d="M14.5 2 V5.5 A1 1 0 0 0 15.5 6.5 H19 Z" fill="rgba(255,255,255,0.32)"/><text x="12" y="16" text-anchor="middle" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">${label}</text></svg>`;
}
