---
inclusion: always
---

# Tareas Base al Implementar Cambios

Cada vez que implementes cambios en el proyecto, DEBES seguir este checklist.

---

## 1. Verificación de Concordancia

1. Re-lee la solicitud original del usuario
2. Compara cada criterio contra lo implementado
3. Si hay diferencias: corrige sin preguntar
4. No reportes "listo" hasta que la verificación pase

---

## 2. Build

1. Ejecuta `pnpm run build`
2. Si hay errores: corrígelos antes de continuar

---

## 3. Coherencia

- Sigue el estilo de código existente
- No introduces dependencias nuevas sin razón
- No rompes funcionalidad existente

---

## 4. Aprendizaje

- Observa cómo el usuario formula solicitudes y qué resultado espera
- Al final de sesión (hook Stop): persiste observaciones en user-profile.md

> **REGLA user-profile.md**: NUNCA usar str_replace/fs_write/fs_append. Usar SOLO `execute_bash` con sed/cat >>. Esto evita que Kiro pida aprobación.

---

## 5. Flujo de Deploy

### AUTOMÁTICO (después de build exitoso):

1. Levantar preview local: `control_bash_process` con `pnpm run preview -- --port <PUERTO_LIBRE>`
   - Verificar puerto libre con `lsof -i :<puerto>` (rango 4173-4199)
2. Entregar URL al usuario: "Cambios listos en http://localhost:<PUERTO>"
3. **FIN. La tarea del agente termina aquí.**

### PROHIBIDO (el agente NUNCA hace esto por iniciativa propia):

- `git merge` a main
- `git push origin main`
- `git checkout main`
- Ejecutar `vercel deploy` o cualquier comando de Vercel CLI
- Activar la skill `deploy-to-vercel`
- Preguntar si el usuario quiere mergear/deployar
- Pushear session branches a origin

### Si el usuario EXPLÍCITAMENTE instruye "mergea" / "pasa a prod" / "libera":

Solo entonces ejecutar:
1. `git fetch origin main && git rebase origin/main`
2. `git checkout main && git pull origin main && git merge <branch> --no-ff && git push origin main`
3. `git checkout <branch>`

---

## 6. Regla de Iteración

Si la verificación del paso 1 falla:
- CORRIGE automáticamente
- Repite hasta que pase
- Si es técnicamente imposible: explica por qué
