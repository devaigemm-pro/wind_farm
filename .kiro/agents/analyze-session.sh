#!/bin/bash
# Script: analyze-session.sh
# Propósito: Instrucción concisa y directa para actualizar el perfil al final de la sesión.
# Se ejecuta via hook "Stop" como respaldo del hook agent.

cat << 'EOF'
ACTUALIZA EL PERFIL DE USUARIO AHORA.

Lee .kiro/agents/user-profile.md y actualízalo con lo observado en esta sesión:

1. Incrementa "Sesiones analizadas" en Metadata
2. Actualiza "Última actualización" a la fecha de hoy
3. Agrega entrada al final de "## 8. Historial de Observaciones por Sesión":

### Sesión [N] - [FECHA]
- **Tarea principal**: [qué pidió el usuario]
- **Observaciones nuevas**: [patrones, preferencias, correcciones detectadas]
- **Patrones confirmados**: [patrones que se repitieron vs sesiones anteriores]

4. Si detectaste correcciones del usuario, agrégalas a "## 7. Correcciones al Agente"
5. Si un patrón aparece en 3+ sesiones, sube su confianza a "alta"

Usa str_replace para cambios quirúrgicos. No reescribas todo el archivo.
Si hay un archivo .kiro/agents/session-logs/current-session.md, úsalo como referencia de lo que pasó.
Después de actualizar el perfil, borra current-session.md (se regenera en la próxima sesión).
EOF

# Archivar current-session.md si existe
SESSION_LOG=".kiro/agents/session-logs/current-session.md"
if [ -f "$SESSION_LOG" ]; then
  ARCHIVE_NAME=".kiro/agents/session-logs/session-$(date +%Y%m%d-%H%M%S).md"
  cp "$SESSION_LOG" "$ARCHIVE_NAME"
  rm "$SESSION_LOG"
fi

exit 0
