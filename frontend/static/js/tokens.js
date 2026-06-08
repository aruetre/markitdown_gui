// Estimación heurística de tokens por plataforma (cliente, sin dependencias).
import { escapeHtml } from './utils.js';

// tokens ≈ ceil(longitud_en_caracteres / charsPerToken). charsPerToken refleja
// lo "fino" que tokeniza cada modelo (valores aproximados, orientados a texto
// latino: para contenido CJK la estimación puede desviarse más).
// contextWindow es el tamaño típico de ventana de contexto; CAMBIA con el tiempo,
// actualízalo cuando los proveedores publiquen nuevos modelos.
// color: color de marca aproximado de cada plataforma, usado para teñir su badge.
const TOKEN_PLATFORMS = [
    { key: 'chatgpt', label: 'ChatGPT',             charsPerToken: 4.0, contextWindow: 128000,  color: '#10A37F' },
    { key: 'claude',  label: 'Claude',              charsPerToken: 3.6, contextWindow: 200000,  color: '#D97757' },
    { key: 'gemini',  label: 'Gemini / NotebookLM', charsPerToken: 4.0, contextWindow: 1000000, color: '#4285F4' },
    { key: 'kimi',    label: 'Kimi',                charsPerToken: 3.8, contextWindow: 256000,  color: '#7C3AED' },
];

// Logo SVG inline por plataforma. Usa currentColor para heredar el color del badge.
const PLATFORM_LOGOS = {
    // OpenAI / ChatGPT (nudo entrelazado)
    chatgpt: '<path fill="currentColor" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v3l-2.597 1.5-2.607-1.5z"/>',
    // Anthropic / Claude (ráfaga radial)
    claude: '<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="4.2" y1="7.5" x2="19.8" y2="16.5"/><line x1="4.2" y1="16.5" x2="19.8" y2="7.5"/></g>',
    // Google Gemini (destello de 4 puntas)
    gemini: '<path fill="currentColor" d="M12 0c0 6.627-5.373 12-12 12 6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z"/>',
    // Kimi / Moonshot (luna creciente)
    kimi: '<path fill="currentColor" d="M15 2a10 10 0 1 0 7 17 8 8 0 0 1-7-17z"/>',
};

// Devuelve el <svg> del logo de una plataforma (o cadena vacía si no hay)
function platformLogo(key) {
    const inner = PLATFORM_LOGOS[key];
    if (!inner) return '';
    return `<svg class="token-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

// Estimar tokens de un texto para un charsPerToken dado
function estimateTokens(text, charsPerToken) {
    if (!text) return 0;
    return Math.ceil(text.length / charsPerToken);
}

// Número con separador de miles (es-ES): 12345 → "12.345"
function formatTokenCount(n) {
    return n.toLocaleString('es-ES');
}

// Forma compacta para badges: 12345 → "12,3k", 1200000 → "1,2M"
function abbreviateTokens(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
    return (n / 1000000).toFixed(1).replace('.', ',') + 'M';
}

// Forma compacta y redondeada para ventanas de contexto: 128000 → "128k", 1000000 → "1M"
function abbreviateWindow(n) {
    if (n >= 1000000) return (n / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
}

// Fila de badges (uno por plataforma) con estimación e indicador de ajuste
export function renderTokenBadges(text, prefix = '') {
    const badges = TOKEN_PLATFORMS.map((p) => {
        const tokens = estimateTokens(text, p.charsPerToken);
        const fits = tokens <= p.contextWindow;
        const cls = fits ? 'token-badge' : 'token-badge over';
        const mark = fits ? '✓' : '⚠';
        return `<span class="${cls}" style="--token-color: ${p.color}" title="${escapeHtml(p.label)}: ≈${escapeHtml(formatTokenCount(tokens))} tokens">${platformLogo(p.key)}${escapeHtml(p.label)} ≈${escapeHtml(abbreviateTokens(tokens))} ${mark}</span>`;
    }).join('');
    return `<div class="token-badges" aria-label="Estimación de tokens por plataforma">${prefix}${badges}</div>`;
}

// Carril compacto de estimación de tokens para el modal: una tarjeta por
// plataforma con barra de ocupación de su ventana de contexto.
export function renderTokenRail(text) {
    const cards = TOKEN_PLATFORMS.map((p) => {
        const tokens = estimateTokens(text, p.charsPerToken);
        const ratio = p.contextWindow ? tokens / p.contextWindow : 0;
        const fits = tokens <= p.contextWindow;
        // Relleno visible: mínimo 2% cuando hay tokens, tope 100%.
        const fill = Math.min(100, Math.max(tokens > 0 ? 2 : 0, ratio * 100));
        // % de la ventana solo si es ≥ 0,1%; si no, ni se muestra (cabe de sobra).
        const pctLabel =
            ratio >= 0.001
                ? (ratio * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + '% de '
                : '';
        return `
            <div class="trail-card ${fits ? '' : 'over'}" style="--token-color: ${p.color}">
                <div class="trail-top">
                    <span class="trail-name">${platformLogo(p.key)}${escapeHtml(p.label)}</span>
                    <span class="trail-tok" title="≈ ${escapeHtml(formatTokenCount(tokens))} tokens">≈ ${escapeHtml(abbreviateTokens(tokens))}</span>
                </div>
                <div class="trail-bar"><span style="width: ${fill}%"></span></div>
                <div class="trail-meta">
                    <span>${pctLabel}${escapeHtml(abbreviateWindow(p.contextWindow))}</span>
                    <span class="trail-fit ${fits ? 'ok' : 'over'}">${fits ? '✓ Cabe' : '⚠ Supera'}</span>
                </div>
            </div>
        `;
    }).join('');
    return `
        <div class="rail-section">
            <h4 class="rail-title">Estimación de tokens</h4>
            <div class="trail" aria-label="Estimación de tokens por plataforma">${cards}</div>
            <p class="trail-note">Aproximada (heurística por caracteres). Las ventanas son típicas y varían por modelo.</p>
        </div>
    `;
}

// Estadísticas de compresión a partir de los caracteres originales y el texto final.
// Devuelve null si no hubo ahorro (o no se compactó).
function compressionStats(originalChars, text) {
    const finalChars = text ? text.length : 0;
    if (!originalChars || originalChars <= finalChars) return null;
    const savedChars = originalChars - finalChars;
    const pct = Math.round((savedChars / originalChars) * 100);
    if (pct <= 0) return null;
    const savedTokens = Math.round(savedChars / 4.0); // charsPerToken representativo
    return { originalChars, finalChars, savedChars, pct, savedTokens };
}

// Pieza de la fila de tokens. Solo se muestra si se compactó (`compacted`):
// "🗜️ −18%" si hubo ahorro, o "🗜️ sin reducción" si el texto ya estaba compacto.
export function renderCompressionBadge(compacted, originalChars, text) {
    if (!compacted) return '';
    const s = compressionStats(originalChars, text);
    if (s) {
        const title =
            `Compactado sin pérdida: ${formatTokenCount(s.originalChars)} → ` +
            `${formatTokenCount(s.finalChars)} caracteres (−${formatTokenCount(s.savedChars)}). ` +
            'Se eliminaron líneas en blanco repetidas, espacios sobrantes y ' +
            'comentarios HTML; el contenido no cambia.';
        return `<span class="token-badge compress" title="${escapeHtml(title)}">🗜️ −${s.pct}%</span>`;
    }
    const noChange =
        'Compactación aplicada, pero el texto ya estaba compacto: no había ' +
        'líneas en blanco de más, espacios sobrantes ni comentarios HTML que quitar ' +
        '(habitual en texto de OCR; el mayor ahorro suele venir de PDF/Office).';
    return `<span class="token-badge compress" title="${escapeHtml(noChange)}">🗜️ sin reducción</span>`;
}

// Panel informativo de compresión para el modal. Solo si se compactó (`compacted`).
export function renderCompressionPanel(compacted, originalChars, text) {
    if (!compacted) return '';
    const s = compressionStats(originalChars, text);
    if (!s) {
        return `
        <div class="rail-section compress-panel">
            <h4 class="rail-title">🗜️ Compactación</h4>
            <p class="compress-note">El texto ya estaba compacto: no había nada que reducir (0%).</p>
        </div>
    `;
    }
    return `
        <div class="rail-section compress-panel">
            <div class="compress-headline">
                <span class="compress-pct">−${s.pct}%</span>
                <span class="rail-title" style="margin:0">🗜️ Compactado</span>
            </div>
            <div class="compress-row">
                <span>Caracteres</span>
                <strong>${escapeHtml(formatTokenCount(s.originalChars))} → ${escapeHtml(formatTokenCount(s.finalChars))}</strong>
            </div>
            <div class="compress-row">
                <span>Tokens ahorrados</span>
                <strong>≈ −${escapeHtml(formatTokenCount(s.savedTokens))}</strong>
            </div>
            <p class="compress-note">Sin pérdida: blancos, espacios y comentarios HTML.</p>
        </div>
    `;
}
