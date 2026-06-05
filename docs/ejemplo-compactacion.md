# Documento de ejemplo para probar la compactación

<!-- Este comentario HTML debería desaparecer al compactar -->

Este párrafo tiene un espacio duro (NBSP) y un​carácter invisible (zero-width)
que el compactador normaliza/elimina.   



## Una tabla con filas vacías

| Concepto | Importe |
| --- | --- |
| Sueldo base | 1000 |
| | |
| Complemento | 200 |
| | |

<!--
comentario
multilínea
también fuera
-->

## Bloque de código (debe quedar intacto)

```python
def suma(a, b):


    return a + b      # sangría y líneas en blanco se conservan
```

Fin del documento.


