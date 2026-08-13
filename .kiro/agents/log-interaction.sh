#!/bin/bash
# Script: log-interaction.sh
# Propósito: Registra un resumen mínimo de cada interacción del usuario en un log acumulativo.
# Se ejecuta via hook UserPromptSubmit.
# Lee el mensaje del usuario desde stdin (JSON con session context).

LOG_FILE=".kiro/agents/session-logs/current-session.md"

# Crear directorio si no existe
mkdir -p "$(dirname "$LOG_FILE")"

# Leer stdin (JSON del hook)
INPUT=$(cat)

# Extraer timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Si el archivo no existe o es de una sesión anterior, inicializarlo
if [ ! -f "$LOG_FILE" ]; then
  echo "# Sesión Actual - Log de Interacciones" > "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  echo "Inicio: $TIMESTAMP" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
fi

# Registrar la interacción (timestamp)
echo "- [$TIMESTAMP] Interacción del usuario" >> "$LOG_FILE"

exit 0
