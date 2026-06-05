// Carga de opciones de anonimización y lectura de la selección del usuario.
import { fetchAnonymizerOptions } from './api.js';
import { escapeHtml } from './utils.js';

// Cargar tipos de datos anonimizables y montar las casillas (según su `default`).
// La caja de opciones se muestra/oculta con el atributo `hidden` al marcar el toggle.
export async function loadAnonymizerOptions() {
    const check = document.getElementById('anonymizeCheck');
    const optionsBox = document.getElementById('anonymizeOptions');
    const typesBox = document.getElementById('anonymizeTypes');

    check.addEventListener('change', () => {
        optionsBox.hidden = !check.checked;
    });

    try {
        const data = await fetchAnonymizerOptions();
        typesBox.innerHTML = (data.options || [])
            .map(opt => `
                <label class="anonymize-type">
                    <input type="checkbox" value="${escapeHtml(opt.key)}" ${opt.default ? 'checked' : ''}>
                    <span>${escapeHtml(opt.label)}</span>
                </label>
            `)
            .join('');
    } catch (error) {
        console.error('Error loading anonymizer options:', error);
        typesBox.innerHTML = '<div class="format-loading">Error al cargar opciones</div>';
    }
}

// Lee el estado de anonimización: { anonymize, entities }
export function getAnonymizeSelection() {
    const check = document.getElementById('anonymizeCheck');
    if (!check || !check.checked) return { anonymize: false, entities: [] };
    const entities = Array.from(
        document.querySelectorAll('#anonymizeTypes input[type="checkbox"]:checked')
    ).map(el => el.value);
    return { anonymize: entities.length > 0, entities };
}
