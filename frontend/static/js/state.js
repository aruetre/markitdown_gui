// Estado mutable compartido entre módulos.
// Se exporta un único objeto: los módulos mutan sus campos (state.selectedFiles…).
// No se exportan primitivas sueltas porque serían de solo lectura en el importador.
export const state = {
    selectedFiles: [],
    supportedFormats: {},
    currentModalData: null,
    // Resultados de la última conversión, usados por descargas individuales y ZIP.
    conversionResults: [],
};
