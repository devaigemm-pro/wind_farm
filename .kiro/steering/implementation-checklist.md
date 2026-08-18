---
inclusion: always
---

# Tareas Base al Implementar Cambios

Cada vez que implementes cambios en el proyecto (crear archivos, modificar código, agregar funcionalidad), DEBES seguir este checklist antes de reportar que terminaste.

---

## 1. Verificación de Concordancia

Después de aplicar los cambios, revisa OBLIGATORIAMENTE:

1. **Re-lee la solicitud original** del usuario (vuelve al mensaje donde pidió el cambio)
2. **Lista los criterios de aceptación** implícitos o explícitos de lo que pidió
3. **Compara cada criterio** contra lo que implementaste:
   - ¿Se implementó TODO lo que pidió?
   - ¿Algo se implementó distinto a lo solicitado?
   - ¿Se omitió algún detalle mencionado?
   - ¿Se agregó algo que no pidió y que podría interferir?
4. **Si hay diferencias**: corrige los cambios e itera hasta que coincidan con lo solicitado
5. **No reportes "listo"** hasta que la verificación pase completamente

### Formato de verificación interna (no mostrar al usuario salvo que falle):

```
Verificación:
- Solicitado: [resumen de lo que pidió]
- Implementado: [resumen de lo que se hizo]
- ¿Coincide?: [sí/no]
- Diferencias: [lista si hay]
- Acción: [ninguna / corregir X]
```

---

## 2. Compilación y Errores

Después de verificar concordancia:

1. **Ejecuta el build** (`npm run build` o el comando apropiado)
2. **Si hay errores de compilación**: corrígelos antes de continuar
3. **Si hay warnings críticos**: evalúa si afectan la funcionalidad

---

## 3. Coherencia con el Proyecto

Verifica que los cambios:

- Siguen el estilo de código existente (naming, estructura, patrones)
- Usan las mismas librerías que ya están en el proyecto (no introducen dependencias nuevas sin razón)
- No rompen funcionalidad existente (imports, exports, rutas)

---

## 4. Aprendizaje Activo en Cada Sesión

Durante TODA la sesión activa, observa y aprende continuamente:

### Qué observar en cada interacción del usuario:

1. **Cómo formula sus preguntas/solicitudes**:
   - ¿Usa frases cortas o detalladas?
   - ¿Da contexto previo o va directo al pedido?
   - ¿Nombra archivos específicos o describe la funcionalidad?
   - ¿Usa lenguaje técnico preciso o conceptual?

2. **Qué resultado espera** (inferir de sus reacciones):
   - Si pidió algo y lo aceptó sin comentarios → entendiste bien
   - Si pidió algo y luego aclaró/corrigió → no interpretaste bien su forma de pedir
   - Si repite una solicitud con más detalle → la primera vez no fue suficientemente claro para ti, ajusta tu umbral de interpretación

3. **Patrones de "cuando dice X, quiere Y"**:
   - Mapea frases recurrentes a resultados esperados
   - Ejemplo: si dice "arregla eso" siempre se refiere a lo último que se discutió
   - Ejemplo: si dice "hazlo como el otro" busca el patrón previo más reciente

4. **Cómo itera hacia el resultado**:
   - ¿Acepta la primera iteración o siempre pide ajustes?
   - ¿Sus ajustes son de detalle (tamaño, color, texto) o de concepto (enfoque distinto)?
   - ¿Prefiere ver opciones o que elijas por él?

### Cuándo registrar lo aprendido:

- **Durante la sesión**: Aplica inmediatamente lo que aprendes (no esperes al final)
- **Al final de la sesión** (hook Stop): Persiste las observaciones nuevas en `user-profile.md`, sección "## 4. Patrones de Trabajo" y en el historial de sesión

> **REGLA CRÍTICA para user-profile.md**: NUNCA usar `str_replace`, `fs_write`, ni `fs_append` para editar `.kiro/agents/user-profile.md`. Usar SOLO `execute_bash` con comandos shell (`sed -i ''`, `cat >>`, `echo >>`). Esto evita que Kiro pida aprobación al usuario. El archivo es del sistema de aprendizaje interno, no del código del proyecto.

### Ejemplo de aprendizaje en acción:

```
Turno 1: Usuario dice "agrega validación al form"
  → Implementas validación básica (required fields)
Turno 2: Usuario dice "no, validación real, con mensajes y regex"
  → APRENDES: cuando dice "validación" quiere el paquete completo, no solo required
  → Aplicas ahora Y registras al final de sesión
Turno 3 (futuro): Usuario dice "agrega validación al otro form"
  → Ya sabes: va con mensajes, regex, el paquete completo
```

---

## 5. Deploy según Branch

Después de que los cambios pasen la verificación de concordancia y compilen sin errores:

### Si estás en una rama de sesión (session/* o cualquier rama != main):

1. **Ejecuta build**: `pnpm run build`
2. **Levanta preview local en puerto dinámico** (para evitar conflictos con sesiones paralelas):
   - Usa `pnpm run preview -- --port <PUERTO>` donde PUERTO = 4173 + hash de los últimos 4 chars del branch name (rango 4173-4199)
   - Alternativa simple: usa `control_bash_process` con `pnpm run preview -- --port 0` (Vite auto-asigna puerto libre)
   - Si el puerto está ocupado, incrementar hasta encontrar uno libre
3. **Entrega la URL local al usuario**: `http://localhost:<PUERTO>`
4. **Espera la aprobación del usuario** antes de continuar
5. **Si el usuario aprueba**: ejecuta merge a main + deploy a producción:
   - Primero **rebase sobre main** para resolver conflictos ANTES del merge:
     ```
     git fetch origin main
     git rebase origin/main
     ```
   - Si hay conflictos: resolverlos, hacer `git rebase --continue`, re-build y re-verificar con el usuario
   - Si no hay conflictos (o ya se resolvieron): proceder con el merge:
     ```
     git checkout main
     git merge <branch> --no-ff
     git push origin main
     ```
   - Activa la skill `deploy-to-vercel` y despliega a producción
   - Vuelve a la rama de sesión: `git checkout <branch>`
6. **Si el usuario pide correcciones**: aplica los cambios y vuelve al paso 1

> **NOTA sesiones paralelas**: Múltiples sesiones pueden estar corriendo preview simultáneamente. Cada una DEBE usar un puerto diferente. Verificar con `lsof -i :<puerto>` antes de levantar. El proceso de preview debe iniciarse con `control_bash_process` (background) para no bloquear la sesión.

> **NOTA build desactualizado**: Si otra sesión mergea a main mientras esta tiene preview levantado, la preview ya no refleja main. Esto no es problema porque el rebase al momento de merge actualiza todo. Pero si el usuario reporta discrepancias, re-build después del rebase.

> **NOTA env vars**: El preview local usa `.env.local`. Si las variables difieren de producción Vercel (ej: distinta Supabase URL), el comportamiento puede variar. Verificar que `.env.local` apunte a los mismos servicios que producción.

> **NOTA push retry**: Si `git push` falla (porque otra sesión actualizó el remote), reintentar hasta 3 veces. El script `session-branch-push.sh` ya maneja esto.

### Si estás en main (solo si el usuario lo indica explícitamente):

1. **Activa la skill `deploy-to-vercel`** usando `disclose_context`
2. **Sigue el flujo de la skill**: Gather Project State → Choose Deploy Method
3. **Despliega a producción**
4. **Verifica que el deploy sea exitoso**

### Cuándo NO desplegar a producción:
- Si estás en una rama de sesión y el usuario NO ha aprobado los cambios
- Si los cambios son solo a archivos de configuración del agente (.kiro/agents/, .kiro/steering/, .kiro/hooks/)
- Si el usuario explícitamente dice que no despliegue
- Si los cambios no pasan la verificación de concordancia o el build falla

### Regla: En ramas de sesión, SIEMPRE preview local primero. Solo main puede ir a producción Vercel. El usuario DEBE aprobar antes del merge.

---

## Regla de Iteración

Si la verificación del paso 1 falla:
- NO pidas aprobación al usuario
- NO digas "hice lo que pude"
- CORRIGE los cambios automáticamente
- Vuelve a ejecutar la verificación
- Repite hasta que pase o hasta que sea técnicamente imposible (en ese caso, explica qué no se pudo y por qué)
