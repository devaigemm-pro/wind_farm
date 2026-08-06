#!/bin/bash
# Script: analyze-session.sh
# Propósito: Al finalizar la sesión, instruye al agente para:
#   1. Revisar visualmente los cambios desplegados a producción (si hubo deploy)
#   2. Actualizar el perfil de usuario con observaciones de la sesión
# Se ejecuta via hook "Stop"

cat << 'EOF'
INSTRUCCIÓN OBLIGATORIA DE FIN DE SESIÓN — EJECUTA LOS DOS BLOQUES:

═══════════════════════════════════════════════════════════
BLOQUE 1: REVISIÓN DE FRONTEND POST-DEPLOY
═══════════════════════════════════════════════════════════

Si durante esta sesión se hizo un deploy a Vercel (producción o preview), DEBES actuar como REVISOR FINAL DE FRONTEND antes de cerrar:

1. **Obtén la URL de producción** (de los logs del deploy o del proyecto Vercel)

2. **Navega a la URL con agent-browser**:
   - Activa la skill agent-browser
   - Abre la URL desplegada
   - Navega a las rutas afectadas por los cambios que se hicieron en esta sesión
   - Toma screenshots de las vistas modificadas

3. **Compara contra lo solicitado**:
   - ¿Los cambios que el usuario pidió se ven reflejados en producción?
   - ¿La UI se ve correcta (no broken, no errores visuales)?
   - ¿Los datos se cargan bien?
   - Usa las specs de .kiro/agents/web-researcher/ como referencia del diseño esperado

4. **Da tu veredicto**:
   - ✅ APROBADO: "Deploy verificado. Los cambios se ven correctamente en producción. [descripción]"
   - ⚠️ OBSERVACIÓN: "Deploy exitoso pero noté [detalle]. No es bloqueante pero revisar."
   - ❌ PROBLEMA: "Los cambios NO se reflejan correctamente en producción. Esperaba [X] pero veo [Y]. Requiere corrección."

5. **Si hay problema**: NO cierres la sesión — itera corrigiendo hasta que el deploy esté correcto.

Si NO hubo deploy en esta sesión, salta al Bloque 2.

═══════════════════════════════════════════════════════════
BLOQUE 2: APRENDIZAJE Y ACTUALIZACIÓN DEL PERFIL
═══════════════════════════════════════════════════════════

OBLIGATORIO — actualiza el perfil de usuario:

1. Lee .kiro/agents/user-profile.md
2. Analiza esta sesión:
   - ¿En qué idioma se comunicó el usuario?
   - ¿Fue breve o detallado?
   - ¿Qué tipo de tarea pidió?
   - ¿Cómo la describió (conceptual vs técnico)?
   - ¿Corrigió algo? ¿Qué indica esa corrección?
   - ¿Qué herramientas/tecnologías usó?
   - ¿Cuánta autonomía te dio?
   - ¿Cómo iteró hasta llegar al resultado? (mapea "cuando dijo X, quería Y")
3. Usa str_replace para actualizar el perfil AGREGANDO:
   - Nueva entrada en "## 8. Historial de Observaciones por Sesión"
   - Patrones nuevos en las secciones correspondientes
   - Incrementar contador de sesiones en Metadata
   - Actualizar fecha de última actualización
4. Si un patrón se observa en 3+ sesiones, marca su confianza como "alta"

IMPORTANTE: Usa str_replace para cambios quirúrgicos. No reescribas todo el archivo.
EOF

exit 0
