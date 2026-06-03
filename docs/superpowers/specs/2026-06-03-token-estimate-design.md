# Estimación de tokens por plataforma — Diseño

Fecha: 2026-06-03

## Objetivo

Mostrar, para cada documento convertido a Markdown, una estimación del número
de tokens que ocuparía en las distintas plataformas de IA (ChatGPT, Claude,
Gemini/NotebookLM, Kimi), junto con un indicador de si cabe en la ventana de
contexto típica de cada una.

## Alcance y decisiones

- **100% frontend.** El backend no cambia. El `markdown_content` ya está
  disponible en el cliente dentro de `window.conversionResults`, así que el
  cálculo se hace en `frontend/static/script.js`. Sin nuevas dependencias, sin
  llamadas de red, coherente con el estilo "sin build" del proyecto.
- **Heurística pura.** Estimación por caracteres: `tokens ≈ ceil(len / charsPerToken)`,
  con un `charsPerToken` por plataforma que refleja lo fino que tokeniza cada
  modelo. Todo se etiqueta como "≈ estimado" para no dar falsa precisión.
- **Plataformas:** ChatGPT, Claude, Gemini/NotebookLM (comparten estimación),
  Kimi.
- **Indicador de ventana de contexto:** ✓ si la estimación cabe en la ventana
  típica, ⚠ si la supera. Los límites son constantes editables.
- **Visualización:** badges compactos por plataforma en cada tarjeta de
  resultado + tabla detallada en el modal de vista previa.

## Componentes

### 1. Configuración (script.js)

```js
const TOKEN_PLATFORMS = [
  { key: 'chatgpt', label: 'ChatGPT',            charsPerToken: 4.0, contextWindow: 128000 },
  { key: 'claude',  label: 'Claude',             charsPerToken: 3.6, contextWindow: 200000 },
  { key: 'gemini',  label: 'Gemini / NotebookLM', charsPerToken: 4.0, contextWindow: 1000000 },
  { key: 'kimi',    label: 'Kimi',               charsPerToken: 3.8, contextWindow: 256000 },
];
```

Los valores de `contextWindow` cambian con el tiempo; van con un comentario que
lo advierte para facilitar su mantenimiento.

### 2. Funciones puras

- `estimateTokens(text, charsPerToken)` → `Math.ceil(text.length / charsPerToken)`.
  Devuelve 0 para texto vacío/nulo.
- `formatTokenCount(n)` → número con separador de miles (`es-ES`) para la tabla.
- `abbreviateTokens(n)` → forma compacta (`12.3k`, `1.2M`) para los badges.

### 3. Render en tarjeta de resultado

En `displayResults`, para cada resultado exitoso se añade una fila de badges,
uno por plataforma: `ChatGPT ≈12.3k ✓`. El indicador es ✓ si
`estimado <= contextWindow`, ⚠ si lo supera. Se calcula al renderizar a partir
de `result.markdown_content`.

### 4. Detalle en el modal

En `viewContent`, se rellena una tabla con columnas: Plataforma · Tokens
estimados · Ventana de contexto · ¿Cabe?. Una fila por plataforma.

### 5. Estilos (styles.css)

Clases nuevas para la fila de badges (`.token-badges`, `.token-badge`,
`.token-badge.over`) y para la tabla del modal (`.token-table`), siguiendo la
paleta y tipografía actuales.

## Flujo de datos

`markdown_content` (ya en cliente) → `estimateTokens` por plataforma → badges en
tarjeta + tabla en modal. No hay estado nuevo persistido ni llamadas al backend.

## Manejo de errores / casos límite

- Texto vacío → 0 tokens, indicador ✓.
- Resultados con error (sin `markdown_content`) → no se muestran badges.
- `markdown_content` muy grande → `length` es O(1), sin coste relevante.

## Pruebas

El proyecto no tiene suite de tests de JS. Verificación manual: convertir un
documento conocido y comprobar que los badges aparecen, los números son
coherentes entre tarjeta y modal, y el indicador ⚠ aparece al superar una
ventana (se puede validar bajando temporalmente un `contextWindow`).

## Limitación conocida

La heurística char/token está calibrada para texto latino; para contenido CJK
(chino, japonés, coreano) la estimación puede desviarse más. Aceptable dado el
enfoque sin dependencias; se documenta en un comentario junto a `TOKEN_PLATFORMS`.
