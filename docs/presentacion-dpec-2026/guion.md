# Guion DPEC 2026 · 45 min

**Charla**: Mantenimiento y reparación de aspas mediante acceso por cuerdas
**Fecha**: miércoles 25 de noviembre de 2026, 3:45 a 4:30 p.m.
**Expositor**: Risto Martínez Ramírez, CORE-TEC SPA
**Público**: dueños de parques eólicos de Centroamérica (decisores, no técnicos de campo)
**Ejemplos usados**: PTO Talinay Oriente (inspección, reparación, cotización) y Fila de Mogote (limpieza y certificación de polipastos). Son datos de demostración.

## Cronograma

| Min | Bloque | Slides | Qué decir |
|---|---|---|---|
| 0-3 | Apertura | 1 | Quién es CORE-TEC, qué hace en cuerdas, qué verán hoy. |
| 3-6 | Problema | 2 | Carpetas de fotos, criterios distintos, cotizaciones sin vínculo con el defecto. |
| 6-9 | Plataforma | 3 | Cuatro fases más cuatro servicios. |
| 9-23 | **Las 4 fases de la inspección** | 5, 6, 7, 8 | Ver detalle abajo. Es el bloque central. |
| 23-31 | **Flujo de cotización** | 9, 10, 11 | Del defecto al costo. Ver detalle abajo. |
| 31-39 | Reparación, limpieza, certificación | 12, 13, 14 | 2 a 3 min por servicio. |
| 39-41 | Captura en campo y beneficios | 15, 16 | App móvil y dron. |
| 41-45 | Cierre y preguntas | 17 | Ofrecer demo con sus datos. |

## Fases de la inspección (14 min)

Inspección de PTO Talinay Oriente, WTG23, 20/8/2026: 85 fotos, 82 defectos, 25 de categoría 5.

1. **Fase 1, Inspeccionar** (3 min): qué se voló y qué se subió. Fotos subidas y pendientes, estado RTK, mapa, documentos.
2. **Fase 2, Anotar** (4 min): pala y cara, marcas sobre la foto, modo de avance rápido, comparación con la inspección anterior. Si es demo en vivo, marcar un defecto.
3. **Fase 3, Analizar** (4 min): arrastrar la anotación al editor. Tipo, categoría de 1 a 5, distancia a raíz, causa raíz y siguiente paso. Numeración A1, A2, B1.
4. **Fase 4, Resultados** (3 min): posición en la pala, desglose por pala, categoría y tipo. Exportar y compartir.

Mensaje de la sección: el defecto queda con tipo, categoría y posición. Eso alimenta la cotización.

## Flujo de cotización (8 min)

1. **Lista**: cotizaciones por aerogenerador y parque, con defectos, estado y total.
2. **Detalle**: cada defecto con horas hombre, número de técnicos, tarifa por hora y materiales. Ejemplo: WTG23 de Talinay, total 10.350.000 CLP, dos defectos tipo CRACK categoría 4.
3. **Trazabilidad de costos**: costo por parque y por aerogenerador, órdenes de trabajo y reparaciones en el tiempo.

Mensaje: el dueño ve cuánto cuesta cada defecto y qué se hizo con él.

## Reparación, limpieza y certificación (8 min)

- **Reparación** (Talinay, WTG23, defecto A1 SHELL DELAMINATION): 11 etapas con fotos elegidas para el informe. 88 fotos, 34 seleccionadas.
- **Limpieza** (Fila de Mogote, WTG02): zonas palas, nacelle, hub y torre. Nacelle con 24 fotos, 15 seleccionadas.
- **Certificación de polipastos** (Los Cururos, A34): seis pasos, ítems de foto, verificación y medición.

## Pendientes antes del evento

- **Fotos**: en el ambiente local no hay imágenes en Storage, así que las miniaturas salen rotas en los slides 6 (Anotar), 12, 13 y 14. Reemplazar esas capturas por otras de producción con fotos reales. Las rutas están en `img/`: `t2-annotate.png`, `r1b-talinay-etapas.png`, `c2-nacelle.png`, `h2-criticas.png`. Los demás slides no dependen de fotos.
- **Valores de cotización**: son de demostración. Confirmar que no corresponden a una oferta real de un cliente.
- **Nombres de parques**: Talinay y Fila de Mogote aparecen con su nombre. Confirmar que puedes mostrarlos en un evento público.
- **Dron**: el slide 15 lo presenta como en desarrollo. Confirmar el estado.
- **Respuestas comerciales**: precio, uso por otros proveedores y funcionamiento sin internet en torre.
- **Internet del hotel**: dejar la demo en un preview local y el PDF como respaldo.

## Preguntas probables

| Pregunta | Respuesta base |
|---|---|
| ¿Quién es el dueño de los datos? | El cliente. Los datos viven en su cuenta y se exportan en PDF y XLSX. |
| ¿Sirve para otros proveedores de inspección? | Las fotos se pueden subir desde cualquier fuente. Confirmar política comercial antes. |
| ¿Cómo se clasifican los defectos? | Tipo y categoría de 1 a 5, con distancia a raíz y cara de la pala. |
| ¿La cotización sale sola? | No. Se arma por defecto con horas hombre, técnicos, tarifa y materiales. |
| ¿Funciona sin internet en torre? | La captura es móvil. Confirmar el comportamiento sin conexión antes de afirmarlo. |

## Sección nueva: inspección interna de palas (slides 16 y 17, 3 a 4 min)

Proyecto en desarrollo. Un carrito automatizado con telemetría se posiciona dentro de la pala, recorre cada zona y captura imágenes.

- Slide 16: esquema ilustrativo del carrito dentro de la pala y qué hace.
- Slide 17: flujo propuesto, del carrito a la plataforma. Lo de integrarse al mismo flujo de inspección es la meta, no algo ya construido.
- Decir claramente que está en desarrollo. No hay fotos ni especificaciones en el deck.
- Por definir: especificaciones del carrito, tipo de pala donde se probó, resultados. Si tienes fotos o video del prototipo, agregarlos al slide 16.
- Los números de slide de la tabla de cronograma anterior se corren en +2 desde el slide 16 (beneficios pasa al 18 y cierre al 19). Recortar 3 min del bloque de reparación, limpieza y certificación para acomodar la sección.

## Actualización: capturas de producción (24-nov)

- Las 4 fases de la inspección (slides 5 a 8) ya usan capturas de producción de PTO Talinay Oriente, WTG23, inspección del 20/8/2026.
- En la fase 2 se ven las fotos reales, pero las 3 miniaturas de la cara LE de la pala A salen rotas también en producción.
- La fase 3 no cambia: la anotación A25 no muestra imagen en producción.
- Siguen en datos locales: cotización (slides 9 a 11), reparación, limpieza y certificación (slides 12 a 14). Pendiente cambiarlas si se quieren con fotos reales.

## Actualización final: todo con capturas de producción

- Todas las capturas del deck son de producción (usuario gmunoz, solo lectura): fases 1 a 4, cotización (lista, detalle WTG23 con 10.350.000 CLP, trazabilidad), reparación (WTG23, defecto A1), limpieza (WTG02, 24 fotos, 15 seleccionadas), certificación (A34 Los Cururos, Inspección visual y mecánica) y parque Fila de Mogote.
- Certificación: las fotos de producción en Preparativos incluyen una foto de un teclado de laptop (subida por "Tecnico", parece de prueba). Considerar reemplazar esa captura o elegir otro paso con fotos reales.
- Fase 2: 3 miniaturas de la cara LE salen rotas en producción.
- Fase 3: la anotación A25 no muestra imagen en producción.
- Confirmar con el cliente que se pueden mostrar los nombres de parques, montos y fotos de técnicos antes del evento.

## Cambio: fases de inspección con WindFarm Test

- Los slides 5 a 8 (fases 1 a 4) ahora usan la inspección de WindFarm Test, turbina FDM-T02, 9/8/2026, de producción: 469 fotos, 94 marcadas, 13 defectos (2 de categoría 5).
- Las fotos cargan completas en las fases 2 y 3. Las notas anteriores sobre miniaturas rotas ya no aplican a estas fases.
- El mapa de la fase 1 muestra una ubicación urbana (coordenadas de prueba de la turbina). Si no quieres mostrarla, recortar esa zona de la captura `img/w1-inspect.png`.
- Las fases se explican con 13 defectos en lugar de 82. Ajustar las cifras si las mencionas al hablar.

## Cambio: campañas de reparación con Talinay

- Nuevo slide 12: campaña de reparación CI791 en WTG23 de PTO Talinay Oriente (pestaña Reparación del parque, en progreso, 869 fotos, 19 defectos), de producción. El deck pasa a 20 slides; los números de slide posteriores se corren en +1.
- El slide siguiente (reparación por etapas, defecto A1) ya usa Talinay. Contar la historia en este orden: parque, campaña, defecto, etapas.


> Nota Fase 1 (slide 5): la imagen es ilustrativa (Etapa_inspeccion.png), no una fotografía original de campo.

## Slide 9 (nuevo): Ejemplo de informe
- Se agregó después de la Fase 4. Muestra la portada y el resumen ejecutivo del informe real de FDM-T02, WindFarm Test (PDF de 23 páginas, generado desde la plataforma en español).
- Mensaje: el dato capturado en las 4 fases termina en un informe entregable, con tabla de defectos por pala y categoría y su posición en la pala.
- Los slides posteriores se desplazan una posición (el deck tiene 21 slides).

> Se eliminó el slide "Punto de partida" (parque Fila de Mogote). El deck tiene 20 slides y los números posteriores se corren en -1. La tabla de tiempos de arriba aún usa la numeración anterior.

## Slide nuevo: App del técnico (reparación)
- Va antes de "Evidencia por defecto y por etapa" (después de la campaña de reparación). Muestra 3 capturas de la app móvil: 1) campañas de reparación (Fila de Mogote), 2) defectos por pala de WTG06, 3) captura de fotos por etapa (etapa 14 de 21, Laminación exterior).
- Mensaje: el técnico captura la evidencia en terreno y llega a la plataforma ya ordenada por defecto y etapa. El deck pasa a 21 slides.
