# Guion DPEC 2026 · 45 min

**Charla**: Mantenimiento y reparación de aspas mediante acceso por cuerdas
**Fecha**: miércoles 25 de noviembre de 2026, 3:45 a 4:30 p.m.
**Expositor**: Risto Martínez Ramírez, CORE-TEC SPA
**Público**: dueños de parques eólicos de Centroamérica (decisores, no técnicos de campo)

## Cronograma

| Min | Bloque | Slides | Qué decir |
|---|---|---|---|
| 0-3 | Apertura | 1 | Quién es CORE-TEC, qué hace en cuerdas, qué verán hoy. |
| 3-8 | Problema | 2 | Carpetas de fotos, criterios distintos, reparaciones sin evidencia. Pedir que levanten la mano quién recibe informes en PDF sin datos comparables. |
| 8-12 | Plataforma | 3 | Los cuatro pasos y las cuatro campañas. |
| 12-16 | Panel, parque y turbina | 4, 5, 6 | Del panel a la turbina: historial y buzón de documentos. |
| 16-28 | **Demo en vivo** | 7, 8 | Ver guion de demo abajo. |
| 28-35 | Reparación | 9 | Las 11 etapas. Mostrar fotos reales de un trabajo propio. |
| 35-39 | Polipastos, limpieza, dron | 10, 11 | Mismo registro para todos los servicios. |
| 39-41 | Beneficios | 12 | Trazabilidad, comparabilidad, evidencia, rapidez. |
| 41-45 | Cierre y preguntas | 13 | Ofrecer demo con sus datos. |

## Guion de demo (12 min)

Ambiente: preview local con datos de prueba (`npx vite build --mode development`). Usuario `dev@local.test`. Para la charla real, preferible un parque de producción con fotos reales. Las miniaturas de las fotos no cargan en el ambiente local porque el Storage local está vacío.

1. **Panel** (`/dashboard`): pipeline, dispersión de defectos, filtros por parque y severidad. 1 min.
2. **Parques eólicos** (`/assets-wind`): tabla con potencia, inspecciones y fechas. Abrir un parque. 1 min.
3. **Parque**: mostrar las cuatro pestañas de campañas y la pestaña Defectos. 1 min.
4. **Turbina**: abrir WindFarm Test > FDM-T02. Tabla de inspecciones, fotos subidas, % visto, defectos y buzón de documentos. 1 min.
5. **Paso 2 Anotar**: abrir la inspección. Mostrar selector de pala y cara, zoom, brillo y contraste, modo avance rápido, marcar un defecto. 3 min.
6. **Paso 3 Analizar**: arrastrar una anotación al editor, asignar tipo, categoría, distancia a raíz, causa y siguiente paso. 2 min.
7. **Paso 4 Resultados**: posición de defectos en la pala, gráficos, tabla resumen. Pulsar Exportar y Compartir. 2 min.
8. **Certificación de polipastos** (`/hoist-certification/<id>`): pasos, selección de fotos, Generar informe. 1 min.

## Riesgos a cubrir antes del evento

- Internet del hotel: tener la demo en un parque local con datos precargados y capturas de respaldo en `img/`.
- Fotos: usar un parque con fotos reales para la demo. Con datos locales las miniaturas aparecen rotas.
- Reparación: el ambiente local no tiene campañas de reparación con defectos vinculados. Para el slide 9 agregar capturas de una reparación real de producción.
- Datos de clientes: no mostrar nombres de parques ni turbinas de clientes sin su autorización.
- Dron: el slide 11 lo presenta como en desarrollo. Confirmar el estado antes de presentarlo.

## Preguntas probables

| Pregunta | Respuesta base |
|---|---|
| ¿Quién es el dueño de los datos? | El cliente. Los datos viven en su cuenta y se exportan en PDF y XLSX. |
| ¿Sirve para otros proveedores de inspección? | Las fotos se pueden subir desde cualquier fuente. Confirmar política comercial antes. |
| ¿Cómo se clasifican los defectos? | Tipo y categoría de 1 a 5 con distancia a raíz y cara de la pala. |
| ¿Funciona sin internet en torre? | La captura es móvil. Confirmar el comportamiento sin conexión de la app antes de afirmarlo. |
| ¿Qué cuesta? | Definir respuesta comercial antes del evento. |
