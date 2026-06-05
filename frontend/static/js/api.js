// Todas las llamadas fetch a /api/* viven aquí (misma-origen).

// Extrae el mensaje de error de una respuesta no-ok (campo `detail` o el status)
async function extractDetail(response) {
    try {
        return (await response.json()).detail || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}`;
    }
}

// GET /api/supported-formats → { formats, extensions }
export async function fetchSupportedFormats() {
    const response = await fetch('/api/supported-formats');
    return response.json();
}

// GET /api/anonymizer-options → { options: [{ key, label, default }] }
export async function fetchAnonymizerOptions() {
    const response = await fetch('/api/anonymizer-options');
    return response.json();
}

// POST /api/convert-single con FormData. Devuelve { ok, result?, detail? }.
export async function convertSingle(formData) {
    const response = await fetch('/api/convert-single', {
        method: 'POST',
        body: formData,
    });
    if (response.ok) {
        return { ok: true, result: await response.json() };
    }
    return { ok: false, detail: await extractDetail(response) };
}

// POST /api/zip con la lista de ficheros. Devuelve { ok, blob?, detail? }.
export async function requestZip(files) {
    const response = await fetch('/api/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
    });
    if (response.ok) {
        return { ok: true, blob: await response.blob() };
    }
    return { ok: false, detail: await extractDetail(response) };
}
