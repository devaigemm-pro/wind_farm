# Perfil de Usuario - Aprendizaje Acumulado

> Este archivo es actualizado automáticamente al final de cada sesión.
> Contiene patrones observados sobre cómo el usuario interactúa con Kiro.
> Se usa como contexto al inicio de cada nueva sesión para representar al usuario.

---

## Metadata

- **Sesiones analizadas**: 52
- **Última actualización**: 2026-08-13
- **Confianza general del perfil**: alta (patrones sólidos confirmados en 7+ sesiones)

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
- **Meta-nivel**: piensa en optimizar la herramienta misma, no solo usarla (confianza: alta — confirmado en 3+ sesiones)

---

## 5. Stack Tecnológico

- **Lenguajes**: TypeScript, JavaScript (confianza: alta)
- **Frameworks**: React, Vite (confianza: alta)
- **UI Library**: Material UI (MUI) — elegido para replicar Skyvisor
- **Herramientas**: Supabase (DB + auth), Vercel (deploy), agent-browser (web automation)
- **Servicios cloud**: Supabase, Vercel
- **Gráficos**: Recharts / SVG custom (por determinar preferencia exacta)
- **Testing**: Vitest (unit/funcional), Playwright (e2e/smoke) (confianza: alta)

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
- **"diagnosticar más profundo"** — cuando un fix no funciona al primer intento, no hacer otro parche superficial. Ir a la raíz real del problema. Si dice "AUN no funciona" en mayúsculas, el approach anterior fue incorrecto.
- **"usar el mismo metodo que X"** — cuando dice que algo en otra parte funciona bien, buscar EXACTAMENTE cómo está implementado y replicar. No inventar un approach diferente. Siempre revisar el patrón existente PRIMERO antes de hacer algo nuevo.
- **"las imagenes no se ven de alta calidad"** — cuando reporta un problema de calidad, la causa probable es que usaste un approach incorrecto. Busca cómo funciona en otra parte del sistema que SÍ funciona bien.
- **"fila" = lo visual, no lo lógico** — cuando habla de "fila de fotos" se refiere a las fotos que se ven en una fila del grid (3 columnas = 3 fotos), NO a agrupaciones lógicas de datos. Interpretar siempre desde lo que el usuario VE en pantalla, no desde la estructura del código.
- **"la inspección asociada" ≠ step 4 del workflow** — cuando dice "redirigir a la inspección asociada" o "la página de la inspección", se refiere a la página de SubassetDetail (`/assets-wind/{windFarmId}/subasset/{turbineId}`) donde se muestra la turbina con su tabla de inspecciones. NO es el step 4 del workflow. La "inspección asociada" es la PÁGINA que muestra la inspección, no un step dentro del workflow.
- **"no pedir permiso para user-profile.md"** — NUNCA pedir confirmación para editar `.kiro/agents/user-profile.md`. Editarlo directamente sin preguntar. Es un archivo propio del sistema de aprendizaje, no código del proyecto.
- **"sobrio" ≠ cambiar identidad cromática** — cuando dice "más sobrio" o "tonos suaves" para colores, significa MANTENER los mismos colores pero desaturarlos/suavizarlos. No cambiar la paleta por completo. "Mate" = misma familia cromática sin brillo.

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

### Sesión 6 - 2026-08-12
- **Tarea principal**: Verificar y mejorar el mecanismo de aprendizaje entre sesiones
- **Observaciones nuevas**:
  - Vuelve a preguntar por el mecanismo de aprendizaje después de 22 días — le importa que funcione de verdad
  - Cuando dice "revisa", quiere que hagas el trabajo completo sin pedir más contexto
  - Cuando dice "mejorar", confía en que sepas qué mejorar — no necesita dar specs
  - Comunicación ultra-breve: una sola palabra como instrucción completa ("revisa", "mejorar")
- **Patrones confirmados**: español, directo, alta autonomía, pensamiento meta-nivel, comunicación mínima, confianza total en decisiones del agente

### Sesión 7 - 2026-08-12
- **Tarea principal**: Importar fotos de inspección Skyvisor (BKfxiIihRgG6cy6vzAij) a la inspección planned de FDM-T03
- **Observaciones nuevas**:
  - Usa modo "compañero" para tareas de datos/operaciones, no solo código
  - Cuando algo toma demasiado tiempo vs otra parte del sistema, lo nota y pregunta por qué — espera consistencia
  - Corrige con frases de 3-4 palabras ("mismo procedimiento que FDM-T02") — confía en que el agente entienda
  - Prefiere el approach más simple/rápido que funcione. No le importa si es "menos elegante" siempre que sea equivalente al patrón que ya funciona
  - Credenciales Skyvisor: risto.martinez@core-tec.cl / Fil@2026
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-breve, "replicar lo que ya funciona" > "innovar"

### Sesión 8 - 2026-08-12
- **Tarea principal**: Fix fast forward mode en workflow step 2 — los botones prev/next deben saltar una fila completa de fotos cuando está activo
- **Observaciones nuevas**:
  - Activa "modo compañero" directamente con la palabra "compañero" al inicio del mensaje
  - Da la URL exacta de la pantalla + describe el comportamiento esperado en una sola frase
  - No necesita que se le pregunte nada — instrucción clara y completa desde el primer mensaje
  - **CORRECCIÓN**: "fila de fotografías" = las 3 fotos que se ven visualmente en una fila del grid del sidebar, NO el grupo blade-face. Cuando dice "fila" se refiere al layout visual (3 columnas = 3 fotos), no a la agrupación lógica de datos.
  - Corrige de forma directa: "el salto debe ser a las siguientes 3 fotos, no la siguiente cara de la pala" — sin drama, sin explicación extra
- **Patrones confirmados**: español, directo, alta autonomía, comunicación mínima, URL exacta como referencia, modo compañero funcional

### Sesión 9 - 2026-08-12
- **Tarea principal**: Agregar controles de ajuste de imagen (Contrast, Brightness, Saturation) en workflow step 2 del visor de inspección
- **Observaciones nuevas**:
  - Proporciona DOM de referencia de Skyvisor como spec visual — no describe con palabras, pasa el HTML directamente
  - Cuando da DOM de referencia, espera que se replique la funcionalidad exacta (3 sliders + reset + panel flotante con close)
  - Modo compañero: da toda la instrucción en un solo mensaje sin esperar preguntas — URL + descripción + DOM de referencia
  - No necesitó correcciones en esta iteración — la implementación se aceptó al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, modo compañero, DOM como spec, URL exacta como referencia

### Sesión 10 - 2026-08-12
- **Tarea principal**: (1) Corregir fast forward mode para saltar de 3 en 3 fotos (no por grupo blade-face). (2) Agregar overlay de vista de pala con selector de caras (SS/PS/LE/TE) al hacer click en ícono de girar imagen
- **Observaciones nuevas**:
  - Corrigió interpretación de "fila de fotos" — se refiere a las 3 fotos visibles en el grid, no a la agrupación lógica. Siempre interpretar desde lo visual.
  - Vuelve a usar DOM de Skyvisor como spec para features nuevos (patrón repetido, confianza alta)
  - No dice "compañero" en el segundo mensaje pero sigue en el mismo flujo/contexto — la sesión es continua
  - Describe la funcionalidad en términos de UX ("ver las fotografías de la pala por cada cara al hacer click en el icono") no en términos técnicos
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec (3+ sesiones = alta confianza), corrección breve sin drama, modo compañero continuo en toda la sesión

### Sesión 11 - 2026-08-12
- **Tarea principal**: Corregir blade face overlay en AnnotateStep — clicks en caras deben navegar a imagen asociada, blade no debe desaparecer al click, y blade debe mostrarse acostado (horizontal)
- **Observaciones nuevas**:
  - Pasa DOM completo del sistema original (Skyvisor) como referencia para correcciones — no solo para features nuevos sino también para bugs
  - Describe 3 problemas en un solo mensaje de forma clara y concisa: (1) referencia a imagen, (2) no desaparecer, (3) acostado
  - No pregunta cómo hacerlo — describe el resultado esperado y confía en la implementación
  - "al hacer click en las caras del blade mostrado debe hacer referencia a la imagen asociado a esa cara" — "referencia a imagen" = navegar/seleccionar la imagen, no solo filtrar
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec (4+ sesiones = confianza muy alta), modo compañero continuo, comunicación mínima, múltiples correcciones en un solo mensaje

### Sesión 12 - 2026-08-12
- **Tarea principal**: Reemplazar el SVG genérico (ellipse) del blade overlay por una imagen de perfil aerodinámico (airfoil) proporcionada por el usuario
- **Observaciones nuevas**:
  - Pasa imágenes directamente como spec visual — no describe con palabras, adjunta la imagen y dice "usa esta imagen"
  - Comunicación ultra-mínima: "usa esta imagen para el blade:" + imagen. Cero explicación adicional.
  - Confianza total en que el agente interprete la imagen y la convierta a SVG/código apropiado
  - Patrón de iteración rápida: sesión anterior creó la funcionalidad, esta sesión refina el visual — mejoras incrementales en sesiones cortas
- **Patrones confirmados**: español, directo, alta autonomía, imagen como spec (nuevo patrón), comunicación ultra-mínima (5+ sesiones = confianza muy alta), iteración incremental rápida

### Sesión 13 - 2026-08-12
- **Tarea principal**: (1) Reemplazar ellipse SVG por airfoil shape proporcionado como imagen. (2) Reparar clicks en LE y TE del blade overlay que no funcionaban.
- **Observaciones nuevas**:
  - Reporta bugs de forma ultra-concisa: "no funcionan al hacer click en LE y TE del blade. reparar" — problema + acción en una sola frase
  - Cuando algo "no funciona", espera que se diagnostique y repare sin preguntar qué significa o pedir más contexto
  - Sesión continuada: esta es la tercera interacción seguida refinando el mismo componente (overlay blade) — iteración incremental rápida confirmada
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración incremental, imagen como spec, reporta bugs sin contexto extra (confía en que el agente diagnostique)

### Sesión 14 - 2026-08-12
- **Tarea principal**: Ampliar ancho del blade SVG en overlay y aplicar estilo del DOM original de Skyvisor (fondo oscuro, blade blanco)
- **Observaciones nuevas**:
  - "según el dom entregado" — se refiere a DOM pasado en sesiones anteriores, espera que el agente recuerde el contexto previo
  - Instrucciones de 1 línea con 2 cambios combinados: ampliar + estilizar — confía en que se resuelvan juntos
  - Cuarta iteración consecutiva sobre el mismo componente (blade overlay) — patrón de refinamiento progresivo muy claro
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración incremental rápida (4+ sobre mismo componente), referencia a contexto previo sin repetirlo

### Sesión 15 - 2026-08-12
- **Tarea principal**: Cambiar fondo y ventana del blade overlay de negro a blanco
- **Observaciones nuevas**:
  - Corrección directa del resultado anterior: "se ven negros, quiero que sean blancos" — sin rodeos, dice exactamente qué está mal y qué quiere
  - El estilo oscuro que se implementó no era lo que esperaba — cuando dice "según el dom entregado" se refiere al layout/estructura, NO necesariamente al color scheme. El color scheme debe ser blanco/claro (consistente con el resto de la app)
  - Quinta iteración sobre el mismo componente en la misma sesión — patrón de refinamiento micro muy fuerte
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración incremental, corrige con claridad absoluta ("quiero X")

### Sesión 16 - 2026-08-12
- **Tarea principal**: (1) Cambiar fondo del blade overlay a blanco. (2) Implementar breadcrumb con links clickables siguiendo patrón Skyvisor (WindFarm > Turbine > Fecha)
- **Observaciones nuevas**:
  - Pasa DOM snippet de Skyvisor como spec para breadcrumbs — mismo patrón de "DOM como spec" pero ahora para elementos de navegación, no solo para overlays
  - "para los links superiores seguir la logica segun el dom del sitio original" + DOM snippet — instrucción completa en una sola frase + código
  - Sigue en flujo continuo de micro-iteraciones sobre la misma pantalla (workflow step 2)
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec (confianza muy alta - usado para navegación, overlays, controles), comunicación ultra-mínima, iteración incremental

### Sesión 17 - 2026-08-12
- **Tarea principal**: Corregir link de turbina en breadcrumb — debe redirigir a la inspección asociada (TurbineDetail con inspectionId), no solo a la turbina genérica
- **Observaciones nuevas**:
  - "la inspección asociada a la turbina" — entiende la relación de datos y describe el destino correcto en términos de modelo de datos, no de ruta URL
  - Describe el bug en contexto: "al estar en 3.ANALYSE y hacer click..." — da el estado exacto para reproducir
  - No pide una URL específica — confía en que el agente sepa cuál es la ruta correcta basándose en el contexto
- **Patrones confirmados**: español, directo, alta autonomía, comunicación mínima, describe bugs con contexto de reproducción, iteración incremental sobre la misma pantalla

### Sesión 18 - 2026-08-12
- **Tarea principal**: Integrar TurbineDetail (ResultsStep) como paso 4 dentro del workflow en lugar de navegar a una página separada
- **Observaciones nuevas**:
  - "no está en el workflow como paso 4, favor hacer los cambios para que sea parte del flujo" — describe el problema arquitectural y el resultado esperado en una sola frase
  - Visión de producto coherente: quiere que los 4 pasos sean una experiencia unificada, sin salir del workflow
  - "favor" — tono educado pero directo, no es una pregunta sino una instrucción clara
- **Patrones confirmados**: español, directo, alta autonomía, comunicación mínima, visión de producto clara (flujo unificado), iteración incremental

### Sesión 19 - 2026-08-12
- **Tarea principal**: Embeber TurbineDetail completo (con todos sus componentes) como paso 4 del workflow, en lugar del ResultsStep parcial que no mostraba todo el contenido
- **Observaciones nuevas**:
  - "buscar una solucion precisa, profesional" — cuando algo no funciona bien, pide calidad de producción. No quiere hacks ni soluciones parciales.
  - "turbinedetail debe estar por completo con todos sus componenetes" — quiere el componente real completo, no una versión reducida
  - Patrón de escalada: si la primera solución no es suficientemente buena, lo dice directamente y espera un approach más robusto
  - Solución adoptada: props opcionales para embeber TurbineDetail sin depender de URL params — enfoque profesional que mantiene reusabilidad
- **Patrones confirmados**: español, directo, alta autonomía, comunicación mínima, exige soluciones profesionales/completas (no hacks), visión de producto integrada

### Sesión 20 - 2026-08-12
- **Tarea principal**: Importar fotos de Skyvisor a inspecciones planned de FDM-T03, FDM-T04 y FDM-T05 con diferentes cantidades por cara
- **Observaciones nuevas**:
  - Pide operaciones en batch sobre múltiples turbinas en un solo mensaje: "1 foto por cara a T04 y 2 por cara a T05"
  - Cuando corrige ("las imagenes no se ven de alta calidad" / "mismo procedimiento que FDM-T02"), la respuesta es ultra-breve y asume que el agente sabe qué hacer
  - "usar mismo metodo" = replicar EXACTAMENTE lo que funciona en otra parte. SIEMPRE revisar la implementación existente ANTES de inventar un approach diferente
  - Corrección clave: NO asumir que "mismo método que T02" significa lo que crees. Leer el código real de T02 primero. En este caso T02 SÍ subía archivos a storage, no solo guardaba URLs.
  - Acepta que operaciones largas (descarga 486 fotos full-size) tomen tiempo — no le molesta la espera, le molesta que no funcione
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, "replicar lo que funciona" (confianza muy alta), batch de operaciones en un mensaje, acepta esperas si el resultado es correcto

### Sesión 21 - 2026-08-12
- **Tarea principal**: Corregir la columna "Photos uploaded" en la tabla de inspecciones de la pantalla de asset detail — no mostraba el conteo real de fotos
- **Observaciones nuevas**:
  - Activa modo compañero con una sola frase: URL + problema + expectativa ("las inspecciones no están mostrando la cantidad de fotos cargadas, esto debe aparecer en la columna photos uploaded")
  - No necesitó dar contexto técnico (tabla, columna DB, service) — confía en que el agente trace el problema desde la UI hasta el backend
  - Sesión resuelta sin correcciones — la implementación se aceptó al primer intento
  - Patrón de reporte de bug simple: "X no está mostrando Y, esto debe aparecer en Z" — estructura clara: ubicación + problema + resultado esperado
- **Patrones confirmados**: español, directo, alta autonomía, modo compañero, comunicación mínima, URL como referencia, describe bugs desde lo visual/UX sin dar detalles técnicos

### Sesión 22 - 2026-08-12
- **Tarea principal**: Corregir defectos no visibles en el gráfico de blades del paso 4 del workflow (TurbineDetail embebido)
- **Observaciones nuevas**:
  - Da URL exacta del problema + descripción precisa: "no se estan mostrando los defectos en el grafico de las blades"
  - No da información técnica sobre el causa — confía en que el agente diagnostique el problema de data flow
  - Problema era race condition en la cadena de datos (turbineId no disponible al primer render → blade positions indefinidas → defectos no mapeados)
  - Solución requerida: derivar turbineId de múltiples fuentes (relación + FK directo) para robustez
- **Patrones confirmados**: español, directo, alta autonomía, URL + descripción del bug, confía en diagnóstico del agente, problemas de data flow son comunes en este proyecto

### Sesión 23 - 2026-08-12
- **Tarea principal**: Los defectos SIGUEN sin mostrarse en el blade diagram (fix anterior no fue suficiente). La causa real: deriveBladeFace retorna '?' para UUIDs y BladesDiagram filtra por 'A'/'B'/'C' — defectos con '?' no matchean.
- **Observaciones nuevas**:
  - "NO SE ESTAN MOSTRANDO LOS DEFECTOS AUN" — mayúsculas = frustración, el fix anterior no resolvió el problema real
  - Adjunta screenshot mostrando que los stats SÍ tienen 1 defecto pero las blades están vacías — prueba visual irrefutable
  - **CORRECCIÓN AL AGENTE**: El primer intento fue insuficiente (derivar turbineId de más fuentes). El problema REAL era que blade='?' no matchea en el filtro del diagrama. Cuando un fix no funciona, DIAGNOSTICAR MÁS PROFUNDO antes de intentar otra vez.
- **Patrones confirmados**: español, directo, alta autonomía, screenshot como prueba, frustración expresada con mayúsculas, espera que el problema se resuelva de verdad (no parches parciales)

### Sesión 22 - 2026-08-12
- **Tarea principal**: (1) Corregir columna "Photos uploaded" mostrando 0 en tabla de inspecciones. (2) Corregir botón PDF report que no funcionaba en asset detail.
- **Observaciones nuevas**:
  - "usar el mismo metodo que usas en [URL]" — patrón repetido de alta confianza. Cuando da dos URLs, la primera es donde está el bug y la segunda es la referencia de cómo debe funcionar. SIEMPRE ir a leer el código de la URL de referencia PRIMERO.
  - Reporta dos bugs en la misma sesión, cada uno en un mensaje separado — no los agrupa, los trata secuencialmente
  - No usa la palabra "compañero" explícitamente pero el contexto es claramente modo compañero (da URL + problema + expectativa)
  - Ambos bugs fueron aceptados al primer intento sin correcciones
- **Patrones confirmados**: español, directo, alta autonomía, "usar el mismo método que X" (confianza muy alta - 4+ sesiones), URL como referencia, comunicación mínima, modo compañero implícito

### Sesión 23 - 2026-08-12
- **Tarea principal**: Cambiar color del badge de estado "Analyze" a rojo en la tabla de inspecciones del asset detail
- **Observaciones nuevas**:
  - "en esa pantalla" — referencia implícita a la pantalla de la que se habla en la sesión. No repite la URL si ya se estableció el contexto.
  - Instrucción de una sola línea para un cambio visual simple: "usar color rojo para el estado Analize" — confía en que el agente sepa dónde y cómo aplicarlo
  - Cambio aceptado sin correcciones al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, cambios visuales simples en una frase, contexto implícito de pantalla ya discutida

### Sesión 24 - 2026-08-12
- **Tarea principal**: Homologar breadcrumbs/toolbar superior en TurbineDetail standalone para que se comporte idéntico al toolbar del InspectionWorkflow en todos los steps
- **Observaciones nuevas**:
  - Pasa DOM de referencia completo para describir el resultado esperado — patrón consolidado
  - "homologues" = hacer que algo se comporte IGUAL que otro lugar. Implica: buscar el patrón que funciona bien y replicarlo
  - Instrucción clara y suficiente en un solo mensaje: "homologues los links superiores" + DOM de referencia = spec completa
  - No necesitó correcciones — aceptado al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec (confianza muy alta), modo compañero, comunicación mínima, "homologar" = replicar patrón existente

### Sesión 25 - 2026-08-12
- **Tarea principal**: (1) Homologar toolbar/breadcrumb de TurbineDetail standalone con el del InspectionWorkflow. (2) Hacer que el click en el nombre de turbina en el breadcrumb redirija a la página de la inspección asociada (SubassetDetail).
- **Observaciones nuevas**:
  - **CORRECCIÓN**: "la inspección asociada" NO es el step 4 del workflow. Es la página SubassetDetail donde se muestra la turbina con su tabla de inspecciones (`/assets-wind/{windFarmId}/subasset/{turbineId}`). El usuario corrigió: "me está redirigiendo al step 4 y espero que me lleve a la página de la inspección asociada".
  - Sesión continuada: primera instrucción fue homologar, segunda fue refinar el destino del link, tercera fue corrección directa sin drama.
  - Patrón de corrección directa: describe lo que pasa vs lo que espera en una sola frase.
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec, modo compañero, iteración incremental rápida, comunicación mínima, corrección directa sin drama

### Sesión 26 - 2026-08-12
- **Tarea principal**: Eliminar la ruta duplicada /assets-wind/:wf/turbine/:t (TurbineDetail standalone) y dejar como único acceso /inspections/:id/workflow?step=4
- **Observaciones nuevas**:
  - "se profesional y no rompas nada que ya funciona" — establece expectativa de calidad y cuidado. No quiere que el refactor rompa funcionalidad existente.
  - Da las dos URLs exactas y dice cuál quiere mantener y cuál eliminar — instrucción completa sin ambigüedad.
  - Tarea de refactoring/limpieza arquitectural: eliminar duplicidad de rutas. Piensa en coherencia del sistema, no solo en features nuevas.
  - No dice "compañero" pero el contexto es modo compañero implícito (da instrucción directa + espera ejecución completa).
- **Patrones confirmados**: español, directo, alta autonomía, comunicación mínima, URL exacta como referencia, exige soluciones profesionales/completas, piensa en coherencia arquitectural

### Sesión 27 - 2026-08-12
- **Tarea principal**: Corregir columna "# Inspections" en tabla subassets del WindFarmDetail — mostraba 0 para todas las turbinas
- **Observaciones nuevas**:
  - Mismo patrón de reporte de sesión 21: URL + problema + columna esperada. Una sola frase.
  - Bug de data path: la query solo buscaba inspecciones via blade_id, pero las inspecciones se asocian directamente via turbine_id. Patrón recurrente de "doble path" en este proyecto.
  - Sesión resuelta sin correcciones — aceptada al primer intento
  - No activó modo compañero explícitamente pero el contexto es modo compañero implícito (URL + bug + expectativa)
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL como referencia, describe bugs desde lo visual sin detalles técnicos, modo compañero implícito

### Sesión 28 - 2026-08-12
- **Tarea principal**: (1) Corregir columna inspecciones en tabla subassets del WindFarmDetail. (2) Corregir columna inspecciones en tabla de wind farms del dashboard /assets-wind.
- **Observaciones nuevas**:
  - Dos bugs del mismo tipo reportados en la misma sesión secuencialmente — ambos eran el mismo root cause (query solo vía blade_id, faltaba turbine_id directo)
  - Patrón de "bug sistémico": cuando encuentra un problema en un lugar, verifica si el mismo problema existe en otros lugares similares. Reportó el segundo bug inmediatamente después del primero.
  - Ambos resueltos sin correcciones al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL como referencia, modo compañero implícito, reporta bugs secuencialmente en la misma sesión

### Sesión 29 - 2026-08-12
- **Tarea principal**: (1) Corregir inspections count en tabla subassets (WindFarmDetail). (2) Corregir inspections count en tabla de wind farms (/assets-wind). (3) Corregir defects table en WindFarmDetail — no mostraba defect size ni encontraba defectos via turbine_id.
- **Observaciones nuevas**:
  - Sesión con 3 bugs reportados secuencialmente, todos del mismo root cause sistémico: queries que solo usaban blade_id path ignorando turbine_id directo
  - Patrón de "bug cascade": encuentra un problema, lo reporta, cuando se corrige, revisa otros lugares similares y reporta los mismos problemas allí
  - Comunicación consistente: URL + "la tabla no muestra X en la columna" — patrón idéntico en los 3 reportes
  - Todos resueltos sin correcciones al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL como referencia, modo compañero implícito, reporta bugs secuencialmente, bug sistémico = verifica en otros lugares

### Sesión 30 - 2026-08-12
- **Tarea principal**: Continuar sesión 29 — defect size y next steps siguen sin data. Problema era que los datos nunca se guardaban al crear defectos (width_cm=0, height_cm=0, next_step=null en DB).
- **Observaciones nuevas**:
  - "sigue sin data" — cuando reporta que un fix anterior no resolvió, espera que se vaya más profundo. En este caso el problema NO era la query sino que los datos literalmente no existían en la DB.
  - Doble fix necesario: (1) actualizar datos existentes en DB, (2) agregar campos al form de creación para que futuros defectos sí capturen esta info.
  - Acepta solución completa (form + data + display) sin pedir desglose — confía en que el agente haga todo lo necesario.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, "sigue sin data" = fix anterior insuficiente (diagnosticar más profundo), reporta bugs secuencialmente

### Sesión 31 - 2026-08-12
- **Tarea principal**: (1) Mostrar Powering Date en tabla subassets (datos no existían en DB). (2) Total Power en detail block debe ser la suma de power_kw de las turbinas (estaba hardcoded en 0). (3) También corregir dashboard /assets-wind para mostrar totalPower y poweringDate.
- **Observaciones nuevas**:
  - "insertar datos si no existen para ser mostrados" — cuando una columna está vacía y no hay datos en DB, quiere que el agente CREE datos razonables además de corregir el código. No solo fix de código, sino también seed de datos.
  - "crear a insertar nueva data si es necesario" — confirma el patrón: espera que el agente sea proactivo con datos de demostración.
  - Instrucción compleja en un solo mensaje: dos problemas distintos (powering date + total power) con la directiva de crear datos. Confía en que se resuelvan todos juntos.
  - Sesión continuada: cuarto bug de la misma pantalla en la misma sesión larga — patrón de "barrido de calidad" (revisa toda una pantalla y reporta problemas uno a uno)
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL como referencia, "insertar datos si no existen" = seed proactivo, barrido de calidad por pantalla

### Sesión 32 - 2026-08-12
- **Tarea principal**: Cambiar paleta de colores de los gráficos del dashboard a tonos más sobrios, serios y modernos
- **Observaciones nuevas**:
  - Pide cambios estéticos con descripción de "feeling" no de valores exactos: "sobrios", "serio y moderno" — confía en el criterio visual del agente
  - Modo compañero: URL + descripción de estilo en una sola frase. No da hex codes, no da referencia visual — confía en la decisión cromática del agente
  - Aceptó el resultado sin correcciones al primer intento — el criterio de "sobrio/serio/moderno" se resolvió con tonos fríos desaturados (navy, slate, teal, blue grey)
  - Primera tarea puramente estética/de design system (no funcional, no de datos) — confirma que también usa el modo compañero para refinamiento visual
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, modo compañero, URL como referencia, confía en decisiones estéticas del agente

### Sesión 33 - 2026-08-12
- **Tarea principal**: (1) Poblar powering_date y power en SubassetDetail (campos hardcoded en 0/null). (2) DocumentDropbox debe funcionar en SubassetDetail — "usar la implementación que hicimos en [URL de WindFarmDetail]".
- **Observaciones nuevas**:
  - "usar la implementacion que hicimos en [URL]" — patrón repetido de alta confianza. Cuando da una URL de referencia, quiere que se replique exactamente la misma funcionalidad. En este caso el DocumentDropbox ya estaba montado correctamente.
  - Sesión simple: el fix era solo actualizar la query del service para leer las columnas que ya existían en la DB. No necesitó seed de datos porque las turbinas ya tenían power_kw y powering_date de la sesión anterior.
  - Barrido de calidad continúa: ahora pasa de WindFarmDetail a SubassetDetail verificando que los mismos campos funcionen en ambas pantallas.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, "usar misma implementación que X" (confianza muy alta), URL como referencia, barrido de calidad por pantalla

### Sesión 33 - 2026-08-12
- **Tarea principal**: Corrección de paleta de colores del dashboard — volver a los colores originales pero en versión mate/suave (desaturados)
- **Observaciones nuevas**:
  - Corrección de la sesión anterior: "usar los colores antiguos pero con tonos mas suaves, estilo mate" — NO quería cambiar la identidad cromática, solo la intensidad/brillo
  - "colores antiguos" = los originales del proyecto (azul oscuro, naranja, amarillo, verde, rojo, gris). "mate" = misma familia pero desaturados, sin brillo
  - Patrón de iteración estética: sesión anterior fue un cambio total de paleta (demasiado agresivo), esta sesión es una corrección para mantener la identidad pero con el acabado deseado
  - **APRENDIZAJE**: Cuando pide "sobrio" no significa cambiar los colores por completo. Significa suavizar los existentes. Mantener la identidad cromática, solo ajustar intensidad/saturación.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración incremental, corrección directa sin drama, confía en el agente pero corrige cuando el resultado no es lo esperado

### Sesión 34 - 2026-08-12
- **Tarea principal**: (1) Cambiar colores del dashboard a sobrios/modernos. (2) Corrección: volver a colores originales en versión mate. (3) Indicar que no se pida permiso para editar user-profile.md.
- **Observaciones nuevas**:
  - Primera iteración de colores fue demasiado agresiva (cambió identidad cromática por completo) → usuario corrigió: "usar los colores antiguos pero con tonos mas suaves, estilo mate"
  - **REGLA**: "sobrio/mate/suave" aplicado a colores = desaturar los existentes, NO cambiar la paleta. Mantener la identidad cromática original.
  - **REGLA**: No pedir permiso para editar user-profile.md. Es archivo del sistema de aprendizaje, se edita directamente.
  - Cuando corrige, da la instrucción completa en una sola frase sin repetir contexto — asume que el agente recuerda qué se hizo antes
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración incremental, corrección directa sin drama, modo compañero implícito

### Sesión 35 - 2026-08-12
- **Tarea principal**: Mejorar performance de carga de fotos de defectos en SubassetDetail — se mostraban muy lento
- **Observaciones nuevas**:
  - "mejorar la performance" — describe el problema desde la experiencia de usuario (lento) sin sugerir solución técnica. Confía en que el agente diagnostique y aplique la optimización correcta.
  - Problema era architectural: las signed URLs de imágenes se generaban sincronamente dentro de la query de defectos, bloqueando toda la tabla. Fix: separar en hook async independiente.
  - Primera tarea de performance/optimization pura (no funcional, no visual, no de datos)
  - Aceptada al primer intento sin correcciones
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL como referencia, confía en diagnóstico técnico del agente, acepta soluciones de primer intento cuando funcionan

### Sesión 36 - 2026-08-12
- **Tarea principal**: Agregar zoom a la imagen principal en workflow step 2 (AnnotateStep)
- **Observaciones nuevas**:
  - Instrucción ultra-mínima: URL + "agregar zoom a la imagen principal" — 8 palabras, sin spec adicional
  - No especifica qué tipo de zoom (wheel, botones, pinch, etc.) — confía en que el agente implemente una solución completa y profesional
  - Tarea de feature nuevo sin referencia DOM ni imagen — solo describe la funcionalidad deseada en una frase
  - Sesión completada sin correcciones al primer intento
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima (8+ palabras como spec completa), URL como referencia, confía en decisiones de implementación del agente, modo compañero implícito

### Sesión 37 - 2026-08-12
- **Tarea principal**: (1) Agregar zoom a la imagen principal en workflow step 2. (2) Arreglar el tag/flag que no funcionaba en la misma pantalla.
- **Observaciones nuevas**:
  - Reporta segundo bug en el mismo contexto/pantalla con "en esa misma pantalla no está funcionando el tag" — referencia implícita a la URL ya discutida (no la repite)
  - "revisar" = diagnosticar + arreglar. No pide que se le explique qué pasa, pide que se resuelva.
  - Dos tareas en la misma sesión sobre la misma pantalla (zoom + tag fix) — patrón de barrido de calidad confirmado una vez más
  - El tag no tenía optimistic update — el usuario percibía "no funciona" porque no había feedback visual inmediato. La solución fue agregar optimistic update + error logging.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL implícita (no repite si ya se estableció), "revisar" = diagnosticar + fix, barrido de calidad por pantalla, modo compañero implícito

### Sesión 38 - 2026-08-12
- **Tarea principal**: (1) Agregar zoom a imagen principal step 2. (2) Fix tag/flag que no funcionaba (optimistic update). (3) Anotaciones en diagonal — el recuadro debe rotarse siguiendo el ángulo del trazo.
- **Observaciones nuevas**:
  - Tres features/fixes en la misma sesión sobre la misma pantalla (step 2 workflow) — barrido de calidad intenso
  - "al hacer un movimiento cruzado el recuadro debe marcar en diagonal" — describe el resultado visual esperado sin dar detalles técnicos (rotate, angle, transform). Confía en que el agente implemente la solución correcta.
  - Pide funcionalidades de herramientas de edición de imágenes (zoom, anotaciones rotadas) — el step 2 se está convirtiendo en un editor de inspección completo tipo Skyvisor
  - Sesión aceptada sin correcciones en las 3 tareas
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, URL implícita (misma pantalla toda la sesión), barrido de calidad por pantalla, confía en implementación del agente, modo compañero implícito

### Sesión 39 - 2026-08-12
- **Tarea principal**: Mejorar precisión del drawing de anotaciones — "el movimiento está muy sensible"
- **Observaciones nuevas**:
  - Corrección inmediata después del feature anterior (diagonal annotations) — patrón de iteración ultra-rápida: implementa feature → prueba → corrige en el siguiente mensaje
  - "mejorar la precisión" = reducir sensibilidad, agregar dead-zone. Describe el problema desde UX ("muy sensible") sin sugerir solución técnica
  - Cuarta tarea consecutiva sobre la misma pantalla (step 2) en la misma sesión — barrido de calidad intenso confirmado
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, iteración inmediata post-feature, describe problemas desde UX no desde código, barrido de calidad por pantalla

### Sesión 40 - 2026-08-12
- **Tarea principal**: Sesión multi-fix sobre step 2 workflow: (1) Zoom imagen principal, (2) Fix tag/flag, (3) Anotaciones diagonales, (4) Mejorar precisión del drawing, (5) Fix botón descargar imagen
- **Observaciones nuevas**:
  - 5 tareas en una sola sesión sobre la misma pantalla — barrido de calidad más largo hasta ahora
  - Reporta cada problema en un mensaje separado de 1 línea conforme va probando — iteración ultra-rápida consecutiva
  - "el botón descargar no está funcionando, debe descargar la imagen principal" — describe exactamente qué debe hacer el botón. Patrón: [cosa rota] + [qué debería hacer]
  - Todos los fixes aceptados al primer intento sin correcciones (excepto precisión que fue corrección del feature diagonal)
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, barrido de calidad por pantalla (5+ fixes/features), iteración consecutiva rápida, describe funcionalidad esperada en una frase, modo compañero implícito

### Sesión 41 - 2026-08-12
- **Tarea principal**: Permitir agregar anotaciones cuando la imagen está con zoom activo (antes solo hacía pan con zoom > 1)
- **Observaciones nuevas**:
  - "cuando hago zoom sobre la imagen debe permitir agregar anotación" — describe el conflicto UX sin sugerir la solución técnica (left click vs right click, etc.)
  - Sexta tarea consecutiva sobre la misma pantalla (step 2 workflow) — sesión de barrido de calidad más larga registrada
  - Confía en que el agente resuelva el conflicto entre pan y anotar de la mejor forma posible
  - Aceptada al primer intento sin correcciones
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, barrido de calidad por pantalla (6+ fixes/features consecutivos), describe problemas desde UX, confía en decisiones de implementación del agente


### Sesión 42 - 2026-08-12
- **Tarea principal**: Cambiar color del sidebar/menú izquierdo — primero a verde mate, luego corrección a grafito mate elegante
- **Observaciones nuevas**:
  - Primera instrucción fue "verde color mate" → se implementó verde. Luego corrigió: "cambiar a color grafico mate elegante" — "grafico" = grafito (gris carbón elegante, no verde)
  - Posible typo/autocorrect: "grafico" probablemente quiso decir "grafito". Interpretado como grafito por contexto (mate + elegante + corrección del verde)
  - Patrón de iteración estética rápida: cambia de opinión sobre el color después de verlo en producción — es visual, necesita verlo para decidir
  - Modo compañero activado con "compañero" al inicio del primer mensaje
  - Instrucción ultra-mínima: toda la spec en una frase de 7 palabras
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, modo compañero, iteración estética rápida (cambia de opinión al ver resultado), corrección directa sin drama

### Sesión 42 - 2026-08-12
- **Tarea principal**: Cambiar sistema de anotación de drag a 2 clicks (marca de puntos) para mayor precisión
- **Observaciones nuevas**:
  - "usar la marca de puntos para abrir recuadro y dar dimensión" — describe el mecanismo UX alternativo que quiere (click-click en vez de drag). Referencia a "marca de puntos" = marcadores visuales en cada click.
  - Séptima tarea consecutiva sobre step 2 — sesión de refinamiento de herramienta de anotación
  - Cuando describe interacción UX, usa terminología visual ("marca de puntos", "recuadro") no técnica ("click handler", "event system")
  - Prioriza precisión sobre velocidad — prefiere 2 clicks exactos a un drag impreciso
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, describe UX con terminología visual, barrido de calidad por pantalla, confía en implementación del agente

### Sesión 43 - 2026-08-12
- **Tarea principal**: Replicar el toolbar de anotaciones del sistema original (Skyvisor) para marcar anotaciones — usuario proporcionó DOM completo como referencia
- **Observaciones nuevas**:
  - Proporciona DOM completo del sistema original como spec para el toolbar de anotaciones — patrón DOM como spec continúa siendo el método principal de comunicación de requerimientos
  - "no es lo que espero" — corrección directa que indica que la implementación anterior no coincidía con la referencia visual del sistema original
  - "te dejo dom del sistema original para que hagas lo mismo" — instrucción explícita de replicar exactamente, no interpretar libremente
  - Sesión truncada por context compaction — no se pudo completar porque se perdió el DOM de referencia
  - Octava+ tarea consecutiva sobre step 2 (toolbar de anotaciones) — el usuario está refinando la experiencia completa de anotación
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec (confianza muy alta — usado consistentemente en 8+ sesiones), "hacer lo mismo" = replicar exactamente, corrección directa sin drama, barrido de calidad por pantalla

### Sesión 44 - 2026-08-12
- **Tarea principal**: Diseñar e implementar pipeline CI/CD completo con tests unitarios, e2e, smoke, seguridad y funcionales. Versionamiento con git tags. Integración GitHub Actions + Vercel.
- **Observaciones nuevas**:
  - Primera vez que pide infraestructura/DevOps completa — no solo código de app sino pipeline de entrega
  - "desarrolles y me preguntes cuando implementarlo definitivamente" — patrón nuevo: quiere ver la propuesta ANTES de aplicar. Para tareas de arquitectura/infraestructura pide validación previa (a diferencia de features UI donde confía 100% en la implementación directa)
  - Aprobó el diseño con un simple "👍" — confirmación ultra-mínima, sin preguntas ni ajustes
  - Pregunta "qué información necesitas para que tú operes directamente en git" — quiere habilitar al agente para operar con más autonomía (push, tags, releases). Piensa en darle al agente capacidad de operación completa, no solo edición de código.
  - No tiene git remote, SSH keys, ni gh CLI configurado — el proyecto era solo local hasta ahora
  - Confirma el patrón meta-nivel: piensa en optimizar la infraestructura del proceso de desarrollo, no solo en features
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima (👍 como aprobación), pensamiento meta-nivel/infraestructura, confía en decisiones del agente para diseño técnico, quiere autonomía máxima del agente

### Sesión 45 - 2026-08-13
- **Tarea principal**: Continuación — configurar git remote, push inicial a GitHub, configurar GitHub Secrets para CI/CD, y hacer que el pipeline pase en verde
- **Observaciones nuevas**:
  - Comparte token de GitHub directamente sin explicaciones — confianza total en el agente para manejar credenciales
  - "configuralo por tu cuenta" — cuando da credenciales/tokens, espera que el agente haga TODO sin preguntar más. No quiere que le expliquen qué hacer manualmente.
  - Aprobó con 👍 nuevamente — patrón de aprobación minimalista confirmado (3+ sesiones, confianza alta)
  - Quiere que el agente tenga capacidad de operación completa: push/pull git, configurar secrets en GitHub via API, resolver problemas de CI sin intervención humana
  - No le preocupa dar tokens/credenciales al agente — confía en que se manejen correctamente
  - Patrón de "hazlo todo tú": cuando la tarea es clara, no quiere intermediarios ni pasos manuales. El agente debe ejecutar end-to-end.
- **Patrones confirmados**: español, directo, alta autonomía TOTAL (incluye operaciones con credenciales), comunicación ultra-mínima (👍), pensamiento meta-nivel, "configuralo por tu cuenta" = ejecutar sin preguntar, confianza en manejo de secrets

### Sesión 45 - 2026-08-12
- **Tarea principal**: (1) Replicar toolbar del workflow según DOM de Skyvisor (3-column grid, breadcrumb, step buttons, search). (2) Corregir que las anotaciones no se veían. (3) Cambiar interacción de anotación para que funcione como Skyvisor: click-drag traza línea → mover mouse expande ancho → click confirma.
- **Observaciones nuevas**:
  - "no funciona, hacer correccion" — reporta bugs de forma ultra-breve. No describe qué no funciona, confía en que el agente diagnostique.
  - "dar solucion profesional" — exige calidad de producción. No quiere parches, quiere soluciones bien implementadas.
  - "estudia bien el dom de skyvisor" + URL + credenciales — cuando algo no funciona como el original, pide que el agente vaya directamente a estudiarlo en producción, no que adivine. Patrón: "ve y mira cómo funciona" > "yo te explico cómo funciona".
  - "primero se debe trazar una linea y luego ampliar" — describe la interacción UX esperada en términos de ACCIÓN del usuario, no de código. Terminología visual/gestual.
  - Sesión larga con múltiples iteraciones de fix (toolbar layout, contentStyle, annotation layer, drawPhase) — paciencia con fixes iterativos siempre que se avance hacia la solución
  - Proporciona credenciales de Skyvisor directamente para que el agente investigue — confianza total en el agente
- **Patrones confirmados**: español, directo, alta autonomía, DOM como spec, URL + credenciales para investigación, comunicación ultra-mínima, describe UX con terminología gestual/visual, exige soluciones profesionales, corrección directa sin drama, barrido de calidad por pantalla (9+ iteraciones sobre step 2)


### Sesión 46 - 2026-08-13
- **Tarea principal**: (continuación) Crear primer release v0.1.0 y verificar que el pipeline release.yml funcione end-to-end (validate → build → deploy producción --prebuilt → GitHub Release → smoke tests)
- **Observaciones nuevas**:
  - "continua" — una sola palabra como instrucción cuando el contexto es claro. No necesita repetir qué hacer, confía en que el agente sabe el siguiente paso lógico.
  - El pipeline release.yml funcionó exitosamente al primer intento: validate, build, deploy --prebuilt, GitHub Release creado automáticamente
  - Smoke tests se dispararon correctamente post-deploy producción
  - E2E tests se skipearon correctamente (solo para previews, no producción) — la lógica de filtrado funciona
  - Primer release oficial del proyecto: v0.1.0
- **Patrones confirmados**: español, directo, alta autonomía TOTAL, comunicación ultra-mínima ("continua" = sigue con el siguiente paso lógico), confía en decisiones del agente, no necesita explicaciones de progreso

### Sesión 47 - 2026-08-12
- **Tarea principal**: Agregar selector de idioma (español/inglés) en el TopBar junto al dark mode, y luego aplicar las traducciones a TODO el sitio (todos los componentes, no solo sidebar/topbar)
- **Observaciones nuevas**:
  - "el idioma debe estar aplicado en todo el sitio, en todos sus componentes" — cuando implementas algo parcial, corrige inmediatamente pidiendo la implementación COMPLETA. No acepta soluciones parciales para features transversales.
  - Instrucción en una sola frase para un feature complejo (i18n site-wide): "agregar opcion de lenguaje en español arriba a la derecha donde se selecciona el dark mode" — confía en que el agente entienda el alcance total.
  - Modo compañero activado con "compañero" al inicio — patrón consistente.
  - No dio spec técnica (no mencionó i18next, react-intl, etc.) — confía en que el agente elija la mejor solución técnica (en este caso, sistema propio ligero con Context + localStorage).
  - Corrección fue directa y sin drama: "el idioma debe estar aplicado en todo el sitio" — no explicó qué faltaba, asumió que el agente entendería que "todo" significa TODO.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, modo compañero, corrección directa sin drama, exige implementación completa (no parcial), confía en decisiones técnicas del agente

### Sesión 48 - 2026-08-13
- **Tarea principal**: Cambiar dark mode para textos verdes y fondos en gris mate elegante — "para que se vea toda la información y nada quede escondido"
- **Observaciones nuevas**:
  - Modo compañero activado con "compañero" al inicio — patrón consistente
  - Describe el cambio estético en una frase con resultado esperado incluido: colores + razón ("para que se vea toda la información")
  - No da hex codes ni valores exactos — confía en la interpretación de "verde" + "gris mate elegante"
  - "nada quede escondido" = prioridad de legibilidad/contraste. El verde no es decorativo, es funcional (alta legibilidad sobre gris oscuro)
  - Sesión ultra-corta: una sola instrucción, cero correcciones, aceptada al primer intento (no respondió nada negativo)
  - Cambio visual para dark mode específicamente, no para light mode — sabe exactamente qué scope quiere modificar
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, modo compañero, confía en decisiones estéticas del agente, describe feeling/resultado no valores exactos

### Sesión 49 - 2026-08-13
- **Tarea principal**: Corrección del dark mode — fondos seguían viéndose azules, los quiere grises puros. Textos verdes.
- **Observaciones nuevas**:
  - "se riguroso con el cambio" — cuando corrige algo que ya se intentó, exige que se haga completo y sin dejar cabos sueltos. "Riguroso" = buscar TODOS los lugares donde pueda haber residuos del problema, no solo el caso obvio.
  - Corrección directa sin drama: "los fondos están azules, los quiero grises" — dice exactamente qué está mal y qué espera. No pregunta por qué, solo pide la corrección.
  - Iteración estética confirmada: primera sesión definió verde+gris, esta sesión corrige que el gris no era suficientemente puro (tenía tono azulado). Necesita verlo en producción para validar.
  - El root cause era `color-scheme: light` que forzaba rendering azulado + fallbacks CSS con tonos slate (#1e293b, #f8fafc). La corrección fue sistémica.
- **Patrones confirmados**: español, directo, alta autonomía, comunicación ultra-mínima, modo compañero, "se riguroso" = búsqueda exhaustiva, iteración estética rápida, corrección directa sin drama
