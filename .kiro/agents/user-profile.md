# Perfil de Usuario - Aprendizaje Acumulado

> Este archivo es actualizado automáticamente al final de cada sesión.
> Contiene patrones observados sobre cómo el usuario interactúa con Kiro.
> Se usa como contexto al inicio de cada nueva sesión para representar al usuario.

---

## Metadata

- **Sesiones analizadas**: 5 (1 original + 4 sesiones únicas detectadas en logs)
- **Última actualización**: 2026-07-21
- **Confianza general del perfil**: media (datos sólidos de estilo y stack, pocas correcciones registradas)

---

## 1. Idioma y Comunicación

- **Idioma principal**: español (confianza: alta)
- **Idioma secundario**: inglés técnico (usa términos en inglés sin traducir: hooks, steering, deploy, etc.)
- **Estilo**: breve y directo — frases cortas, sin formalidades (confianza: alta)
- **Tono esperado**: casual-técnico, sin relleno (confianza: alta)
- **Escritura**: minúsculas, sin puntuación estricta, a veces sin tildes (confianza: alta)

---

## 2. Nivel Técnico

- **Nivel observado**: alto (confianza: alta)
- **Áreas de expertise**: arquitectura de sistemas, diseño de agentes/automatización, frontend React
- **Áreas donde pide más ayuda**: no detectado — generalmente sabe lo que quiere y confía en la implementación del agente
- **Comprensión conceptual**: entiende hooks, steering, MCP, agents, triggers sin explicación

---

## 3. Preferencias de Formato

- **Formato preferido de respuestas**: mixto — tablas para resúmenes, texto corrido para explicaciones breves
- **Longitud preferida**: corto-medio. No quiere respuestas largas a preguntas simples
- **Usa/prefiere code blocks**: sí, para código. No para texto regular
- **Prefiere explicaciones antes o después del código**: antes si es conceptual, directo al código si es implementación

---

## 4. Patrones de Trabajo

- **Tipo de tareas frecuentes**: creación de sistemas/agentes, investigación web, especificaciones de producto, replicación de funcionalidades
- **Cómo describe las tareas**: a nivel conceptual, 1-2 frases. No da especificaciones técnicas — confía en que el agente decida
- **Prefiere paso a paso o todo de una vez**: todo de una vez, pero pide funcionalidad incremental (base → mejoras)
- **Nivel de autonomía que otorga al agente**: muy alto (confianza: alta)
- **Iteración**: pide funcionalidad base, la valida, luego pide mejoras en la siguiente interacción
- **Meta-nivel**: piensa en optimizar la herramienta misma, no solo usarla

---

## 5. Stack Tecnológico

- **Lenguajes**: TypeScript, JavaScript (confianza: alta)
- **Frameworks**: React, Vite (confianza: alta)
- **UI Library**: Material UI (MUI) — elegido para replicar Skyvisor
- **Herramientas**: Supabase (DB + auth), Vercel (deploy), agent-browser (web automation)
- **Servicios cloud**: Supabase, Vercel
- **Gráficos**: Recharts / SVG custom (por determinar preferencia exacta)
- **Testing**: (por determinar)

---

## 6. Decisiones y Preferencias Arquitectónicas

- Crea agentes personalizados como sub-agentes especializados (web-researcher)
- Usa steering files como documentación viva que influye en el comportamiento del agente
- Documenta especificaciones a nivel de design system con colores, tipografía, layout exacto
- Replica funcionalidad de otros productos (Skyvisor) con specs detalladas como guía
- Prefiere TypeScript interfaces para modelar datos
- Organización: archivos agrupados por función en `.kiro/agents/`, no dispersos

---

## 7. Correcciones al Agente

- "sigue observando" — no quiere la entrevista cuando no la pidió (preferencia: no forzar modos, activar solo cuando se pida explícitamente)
- Pide funcionalidad de delegación — quiere que el agente pueda actuar SIN su supervisión directa
- **"te equivocas mucho"** — cuando dice la URL exacta a donde debe ir, USARLA tal cual. No inventar lógica nueva. Si da un ejemplo concreto, replicar ese patrón exacto.
- **"es un cambio simple"** — no sobrecomplicar. Si el usuario dice que es simple, probablemente lo es. Hacer el cambio directo sin refactorizar ni agregar abstracción.
- **"se riguroso"** — verificar el resultado ANTES de reportar éxito. No asumir que funciona. Probar con el caso exacto que el usuario describe.

---

## 8. Historial de Observaciones por Sesión

### Sesión 1 - 2026-07-21 (madrugada)
- **Tarea principal**: Crear sistema de agente representante (hooks + steering + perfil)
- **Observaciones nuevas**: español como idioma, estilo directo, alta autonomía, pensamiento meta-nivel
- **Patrones confirmados**: n/a (primera sesión)

### Sesiones 2-4 - 2026-07-21 (madrugada-mañana)
- **Tarea principal**: Investigación de Skyvisor (web-researcher agent), documentación de specs
- **Observaciones nuevas**: 
  - Crea agentes especializados para tareas específicas
  - Documenta a nivel extremadamente detallado (design system, modelo de datos, componentes)
  - Usa agent-browser para scraping de apps autenticadas
  - El proyecto wind_farm es un clon/réplica de Skyvisor
  - Trabaja con credenciales reales (risto.martinez@core-tec.cl)
  - Las specs incluyen TypeScript interfaces, API endpoints inferidos, componentes reutilizables
- **Patrones confirmados**: alta autonomía, español, estilo directo, pensamiento sistémico

### Sesión 5 - 2026-07-21 (esta sesión)
- **Tarea principal**: Verificar aprendizaje del agente, pedir modo delegación, solicitar mejora del mecanismo
- **Observaciones nuevas**:
  - Quiere que el agente funcione como proxy/representante que pueda dar instrucciones por él
  - Cuando pregunta "qué haz aprendido" espera honestidad sobre limitaciones
  - Pide "ambas" cuando se le dan opciones — no le gusta elegir si puede tener todo
  - Valora transparencia sobre qué funciona y qué no
- **Patrones confirmados**: español, directo, alta autonomía, pensamiento meta-nivel, iteración incremental
