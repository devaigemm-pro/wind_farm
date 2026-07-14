# Directorio temporal del workspace

Este directorio se usa para archivos temporales generados durante tareas del agente
(por ejemplo, salidas de compilador, logs de build, resultados de tests capturados).

Al estar dentro del workspace, no dispara los prompts de autorizacion de acceso
externo que ocurririan al escribir en `/tmp/` del sistema.

## Uso recomendado

En lugar de:

```bash
tsc > /tmp/tsc_output.txt
```

Usar:

```bash
tsc > .kiro/tmp/tsc_output.txt
```

## Notas

- Todo el contenido de este directorio esta ignorado por Git (excepto `.gitkeep` y este README).
- Se puede limpiar en cualquier momento sin afectar el proyecto.
