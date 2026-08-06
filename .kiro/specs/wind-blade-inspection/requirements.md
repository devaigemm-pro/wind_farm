# Requirements: Wind Blade Inspection

## 1. Gestión de Autenticación y Sesiones

### Req-1.1: Autenticación por email/contraseña
- El sistema debe permitir inicio de sesión mediante email y contraseña usando Supabase Auth.
- Los formularios deben validarse con Zod antes de enviar la solicitud.
- Si las credenciales son inválidas, se debe mostrar un error claro al usuario.
- Al autenticarse correctamente, se redirige al dashboard.

### Req-1.2: Control de acceso basado en roles (RBAC)
- El sistema soporta tres roles: `inspector`, `supervisor` y `admin`.
- Las rutas protegidas redirigen a usuarios no autenticados a la página de login.
- Las acciones de escritura sobre activos (wind farms, turbines) requieren rol `supervisor` o `admin`.
- Los inspectores solo pueden modificar inspecciones propias en estado `in_progress`.

### Req-1.3: Gestión de sesión
- La sesión debe expirar tras 30 minutos de inactividad, cerrando sesión automáticamente.
- El refresh de tokens se debe manejar de forma transparente.
- Al expirar la sesión, se redirige al login con un mensaje explicativo.

---

## 2. Gestión de Activos (Wind Farms, Turbines, Blades)

### Req-2.1: Estructura jerárquica de activos
- Los activos se organizan jerárquicamente: Wind Farm → Turbine → Blade.
- Cada turbina posee exactamente 3 palas (blades), creadas automáticamente al registrar la turbina.
- Los nombres de wind farms deben ser únicos.

### Req-2.2: CRUD de activos
- Los usuarios con rol `supervisor` o `admin` pueden crear, editar y eliminar wind farms y turbines.
- La eliminación de activos debe respetar integridad referencial (no eliminar si tiene dependencias activas).
- Se muestra un diálogo de confirmación antes de eliminar.

### Req-2.3: Visualización de activos
- Se presenta un árbol expandible/colapsable (AssetTree) con selección y carga diferida.
- Al seleccionar un activo, se muestra un panel lateral con sus detalles.
- La vista es responsive (adaptable a dispositivos móviles).

---

## 3. Inspecciones

### Req-3.1: Creación de inspecciones
- Un inspector puede crear una inspección asociada a una pala (blade) con fecha.
- La selección de blade es obligatoria.
- Al crear exitosamente, se navega al detalle de la inspección.

### Req-3.2: Listado y filtrado de inspecciones
- Se muestra un listado paginado de inspecciones con columnas ordenables.
- Se pueden aplicar filtros por estado, fecha, turbina y wind farm.
- Los filtros activos se muestran como chips con opción de limpiar.
- Se muestra un estado vacío cuando no hay resultados.

### Req-3.3: Máquina de estados de inspección
- Las inspecciones siguen un flujo de estados: `scheduled` → `in_progress` → `completed` → `approved`.
- Solo el inspector asignado puede completar una inspección en progreso.
- Solo un supervisor puede aprobar una inspección completada.
- Las transiciones se ejecutan mediante Edge Functions que validan JWT, rol y estado previo.

### Req-3.4: Inmutabilidad post-completado
- Una inspección completada o aprobada no puede editarse (evidencia, defectos).
- Las acciones de edición se deshabilitan visualmente en la interfaz.

### Req-3.5: Detalle de inspección
- La página de detalle muestra encabezado con estado y acciones contextuales.
- Incluye pestañas: Evidencia, Defectos, Línea de tiempo.
- Las acciones disponibles dependen del estado actual y el rol del usuario.

---

## 4. Evidencia (Fotos/Imágenes)

### Req-4.1: Subida de evidencia
- Los inspectores pueden subir imágenes como evidencia en inspecciones en progreso.
- Se valida tipo MIME (solo imágenes) y tamaño máximo de archivo en el cliente.
- Se extrae geolocalización de metadatos EXIF cuando están disponibles.
- Se muestra progreso de subida por archivo.

### Req-4.2: Galería de evidencia
- Se muestra una cuadrícula de miniaturas (thumbnails) generadas con transformaciones de Supabase.
- Incluye lightbox para vista ampliada.
- Soporta drag-and-drop para subida.
- La eliminación solo es posible en inspecciones en progreso.

### Req-4.3: Almacenamiento
- Las imágenes se almacenan en un bucket privado `evidence` de Supabase Storage.
- Políticas de acceso: lectura para usuarios autenticados, escritura/eliminación para inspectores.

---

## 5. Defectos

### Req-5.1: Registro de defectos
- Un inspector puede registrar defectos en una inspección en progreso.
- Cada defecto incluye: tipo, severidad, distancia, descripción y enlace a imágenes de evidencia.
- Se valida con Zod antes de enviar.

### Req-5.2: Clasificación y severidad
- Cada defecto tiene un tipo (categoría) y un nivel de severidad definido.
- Los defectos se muestran con indicadores visuales de severidad.

### Req-5.3: Panel de defectos
- Se muestra una lista de defectos con detalle expandible.
- Se puede crear, editar y eliminar defectos solo cuando la inspección está en progreso.
- Se permite vincular/desvincular imágenes de evidencia a cada defecto.

---

## 6. Dashboard

### Req-6.1: Visualización de métricas
- El dashboard presenta 4 gráficos en layout 2×2:
  - **Inspection Pipeline**: barras verticales con 6 etapas del flujo.
  - **Defects Spread**: barras apiladas por tipo × severidad.
  - **Inspection Operations**: barras agrupadas por mes.
  - **Subassets Status**: gráfico de dona con 3 segmentos de salud.

### Req-6.2: Filtros por gráfico
- Cada gráfico tiene controles de filtro independientes.
- Los gráficos se actualizan de forma asíncrona al cambiar filtros.
- Se manejan estados de carga, error y vacío por cada gráfico.

### Req-6.3: Agregaciones
- Los datos del dashboard se calculan mediante una Edge Function (`dashboard-aggregate`).
- La función verifica JWT y acepta parámetros de filtro.

---

## 7. Reportes

### Req-7.1: Reporte de inspección individual
- Se puede generar un PDF para una inspección específica.
- Incluye datos de la inspección, defectos encontrados y evidencia.
- Maneja correctamente inspecciones sin defectos.
- El PDF se almacena en el bucket `reports` y se crea un registro en la base de datos.

### Req-7.2: Reporte consolidado
- Un supervisor puede generar un reporte consolidado por wind farm.
- Agrupa defectos por turbina y severidad.
- Requiere rol `supervisor`.

### Req-7.3: Visualización de reportes
- Se presenta una página de reportes con vista dividida (split view).
- Se incluye preview del reporte seleccionado.
- Se pueden generar reportes desde el detalle de inspección y desde el detalle de wind farm.

---

## 8. Historial y Búsqueda

### Req-8.1: Historial de inspección por pala
- En el panel de detalle de una blade, se muestra el historial de inspecciones previas.
- Se permite filtrar por rango de fechas, severidad y estado.
- Los resultados se ordenan cronológicamente (más reciente primero).

### Req-8.2: Búsqueda global
- La barra de búsqueda en el TopBar permite buscar en todo el sistema.
- Se busca en activos, inspecciones y defectos.
- Los resultados se muestran con navegación directa al elemento encontrado.

---

## 9. Interfaz de Usuario y Diseño

### Req-9.1: Sistema de diseño
- Se utilizan tokens CSS para colores, tipografía, espaciado y sombras.
- Se soportan temas claro y oscuro con toggle.
- Se respeta `prefers-reduced-motion` para accesibilidad.

### Req-9.2: Componentes reutilizables
- La UI se construye con una arquitectura atómica: atoms, molecules, organisms.
- Componentes incluyen: Button, Input, Badge, Icon, Skeleton, Avatar, Tooltip, FormField, SearchBar, FilterChip, StatCard, NavItem, Toast, EmptyState, Sidebar, TopBar, Breadcrumbs, Layout, ConfirmDialog.

### Req-9.3: Notificaciones
- Se utiliza un sistema de toasts para feedback de acciones (éxito, error, información).
- Los toasts se auto-descartan tras un tiempo configurable.

---

## 10. Manejo de Errores y Validación

### Req-10.1: Manejo centralizado de errores
- Los errores de Supabase se mapean a mensajes legibles para el usuario.
- Se categorizan los errores (red, validación, permisos, conflicto, etc.).
- Se muestra feedback visual claro en cada caso.

### Req-10.2: Validación del lado del cliente
- Todos los formularios se validan con esquemas Zod antes de enviar.
- Los errores de campo se muestran inline debajo del campo correspondiente.
- Se implementa scroll-to-first-error para mejorar UX.

---

## 11. Infraestructura y Despliegue

### Req-11.1: Stack tecnológico
- Frontend: Vite + React + TypeScript.
- State management: Zustand (auth), React Query (server state).
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions).
- Gráficos: Recharts.
- Iconos: Lucide React.
- Validación: Zod.

### Req-11.2: Despliegue frontend
- La aplicación se despliega en Vercel como SPA.
- Se configura redirect para SPA routing.
- Se definen variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Req-11.3: Despliegue backend
- Las migraciones de Supabase se aplican con el CLI.
- Los buckets de storage se crean manualmente o mediante scripts.
- Las Edge Functions se despliegan con `supabase functions deploy`.
- Se configuran políticas CORS adecuadas.

### Req-11.4: CI/CD
- GitHub Actions ejecuta lint, type-check y tests en cada push.
- El pipeline valida que la aplicación compile correctamente.

---

## 12. Seguridad

### Req-12.1: Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado.
- Las políticas garantizan que cada usuario solo accede a los datos según su rol.
- SELECT está disponible para todos los usuarios autenticados.
- INSERT/UPDATE/DELETE se restringe según rol y propiedad del recurso.

### Req-12.2: Almacenamiento seguro
- Los buckets son privados con políticas de acceso.
- Los archivos de evidencia solo pueden ser subidos/eliminados por inspectores.
- Los reportes son accesibles en lectura para usuarios autenticados.

### Req-12.3: Edge Functions seguras
- Todas las Edge Functions verifican JWT antes de procesar.
- Se valida el rol del usuario para operaciones sensibles.
- Los cambios de estado se auditan (actor, timestamp).

---

## 13. Módulo de Gestión de Parques Eólicos — Vista de Assets (Wind Farms Dashboard)

### Req-13.1: Navegación por Pestañas (Tabs)
- El sistema debe permitir alternar entre tres vistas principales sin recargar la página completa: **Assets** (Activos), **Defects** (Defectos) y **Global Map** (Mapa Global).
- La pestaña **Assets** debe estar activa por defecto al acceder a la ruta `/assets-wind`.
- La pestaña activa se indica con una línea inferior azul y texto resaltado; las inactivas muestran texto gris sin línea.

### Req-13.2: Búsqueda y Filtrado Global
- Se debe incluir una barra de búsqueda con placeholder "Search all and filter" e icono de lupa.
- El filtrado se ejecuta dinámicamente sobre los registros de la tabla por coincidencia de texto (ej. nombre del parque).
- Se aplica un debounce de 300 ms antes de disparar la consulta para evitar saturación de peticiones.

### Req-13.3: Tabla de Activos (Wind Farms)
- Presentar la información detallada de los parques eólicos en formato tabular con las siguientes columnas:
  - **Asset Name**: Nombre del parque eólico.
  - **SubAssets Count**: Cantidad de sub-activos (turbinas) asociados.
  - **# Inspections**: Número total de inspecciones realizadas en el parque.
  - **Total Power**: Potencia total instalada del parque (en MW).
  - **Powering Date**: Fecha de entrada en operación del parque.
  - **Oldest Inspection**: Fecha de la inspección más antigua registrada.
- Las cabeceras tienen fondo gris claro, texto en negrita y tamaño reducido.
- Las filas tienen líneas divisorias de 1px gris claro (#E5E7EB).

### Req-13.4: Ordenamiento de Columnas
- Permitir al usuario ordenar la tabla de forma ascendente o descendente al hacer clic en las cabeceras de las columnas.
- Se muestra un icono de flecha (arriba/abajo) junto al texto de la cabecera activa para indicar la dirección del orden.

### Req-13.5: Paginación de Datos
- Controlar la cantidad de registros visibles por página mediante un menú desplegable con valores permitidos: 5, 10, 25, 100.
- Mostrar el rango actual de registros y el total (ej. "1-1 of 1").
- Botones de navegación con iconos `<` (anterior) y `>` (siguiente).
- Los botones se deshabilitan si no hay páginas anteriores/siguientes correspondientes.
- La etiqueta del selector muestra "Rows per page:".

### Req-13.6: Skeleton Loader en Carga
- Mientras los datos de la tabla se están cargando, se debe mostrar un efecto de carga tipo "Skeleton" simulando las filas.
- El skeleton mejora la percepción de velocidad y proporciona feedback visual durante la carga asíncrona.

### Req-13.7: Especificación Visual (UI)
- **Contenedor Principal:** Fondo blanco (#FFFFFF), bordes redondeados (border-radius: 4-8px), sombra ligera para elevación.
- **Tipografía:** Fuente sans-serif legible (Inter, Roboto o System UI) con variaciones de grosor para jerarquía visual.
- **Título del Módulo:** Encabezado "Wind Farms" en color gris oscuro/negro (#111827), alineado a la parte superior izquierda.
- **Barra de Búsqueda:** Borde gris claro con cambio de color en hover/focus (azul #0070F3).
- **Paginador:** Ubicado en la esquina inferior derecha de la tabla, con dropdown estilizado, indicador de rango y botones de flecha.

### Req-13.8: Carga Inicial Asíncrona
- Al acceder a la ruta `/assets-wind`, la pestaña Assets carga los registros disponibles de forma asíncrona desde la base de datos.
- Se integra con React Query para manejo de estado del servidor (cache, refetch, loading, error).


---

## 14. Módulo de Gestión de Defectos — Vista de Defects (Wind Farms)

### Req-14.1: Navegación y Contexto de Pestañas
- El sistema debe mantener la navegación por pestañas (*Assets*, *Defects*, *Global Map*), estando activa por defecto la pestaña **Defects** al acceder a la ruta `/defects-wind`.
- La pestaña activa se indica con línea inferior azul (#00A3E0) y texto resaltado; las inactivas muestran texto gris sin línea.

### Req-14.2: Exportación de Datos
- Incluir un botón **EXPORT LIST** con icono de descarga ubicado junto a las pestañas.
- Estilo visual: fondo verde bosque, bordes redondeados y texto blanco.
- Al hacer clic, se exporta la lista filtrada de defectos en formato CSV o XLSX.
- La exportación respeta los filtros activos aplicados en la tabla.

### Req-14.3: Tabla Dinámica de Defectos
- Presentar los defectos en una tabla paginada con las siguientes columnas ordenables:
  - **Asset:** Nombre del parque eólico.
  - **Turbine:** Identificador del aerogenerador (ej. *WT01*).
  - **Model:** Modelo de la turbina (ej. *Vestas V90*).
  - **Type:** Tipo de defecto (ej. *LE EROSION*, *VORTEX (MISSING PANELS)*, *PAINT DAMAGES*, *BLADES WITH HYDRAULIC OIL*, *OTHER ADD-ONS MISSING*).
  - **Defect size (cm):** Dimensiones del defecto en formato "ancho x alto" (ej. *17 x 332*).
  - **Category:** Nivel de severidad numérica representado como badge de color:
    - Badge naranja (#F2994A) para categoría 3.
    - Badge naranja oscuro/rojo (#E06300) para categoría 4.
    - Texto blanco dentro del badge con bordes redondeados.
  - **Action:** Acción recomendada con indicador visual de prioridad (barra vertical de color naranja o amarillo según urgencia). Textos posibles: "Repair within next 6 months", "Repair within next 3 months".
  - **Next step:** Descripción corta de la acción a seguir (ej. "Reparar de forma previa a daños en terrazados", "Instalar vortex nuevos").
  - **Blade:** Pala afectada (A, B o C).
  - **Side:** Lado de la pala (ej. LE - Leading Edge, SS - Suction Side, TE - Trailing Edge, PS - Pressure Side).
  - **Root distance (m):** Distancia desde la raíz de la pala en metros.
- Las cabeceras permiten ordenamiento ascendente/descendente con icono indicador.
- La fila seleccionada se resalta con fondo azul claro translúcido.

### Req-14.4: Paginación
- Controlar la cantidad de registros visibles por página con menú desplegable (valores: 5, 10, 25, 100). Valor por defecto: 25.
- Mostrar el rango actual y total de registros (ej. "1-25 of 322").
- Botones `<` y `>` para navegación entre páginas, deshabilitados cuando corresponda.
- Ubicación: esquina inferior derecha de la tabla.

### Req-14.5: Panel de Detalle Lateral (Drawer/Sidebar)
- Al seleccionar una fila de la tabla, se despliega un panel lateral derecho que muestra la información detallada del defecto.
- El panel ocupa aproximadamente **30%** del ancho de la pantalla; la tabla ocupa el **70%** restante.
- El panel tiene scroll vertical independiente de la tabla.
- Contenido del panel:
  - **Encabezado:** Nombre/tipo del defecto en texto grande con icono de enlace externo.
  - **Category:** Badge de categoría idéntico al de la tabla.
  - **Status:** Toggle/Switch interactivo para marcar como resuelto o no resuelto (gris/apagado = no resuelto).
  - **Defect size:** Dimensiones en formato "ancho x alto" (cm).
  - **Blade Side:** Lado de la pala afectado.
  - **Root Cause:** Texto descriptivo de la causa raíz del defecto.
  - **Next Step:** Acción recomendada a seguir.
  - **Notes:** Notas adicionales sobre el defecto.

### Req-14.6: Sección de Comentarios
- Dentro del panel de detalle, incluir una sección **Comments** con:
  - Historial de comentarios existentes mostrando: autor, fecha y texto del comentario.
  - Campo de entrada de texto con placeholder "New comment" y botón de envío (icono de flecha) integrado a la derecha.
  - Los comentarios se ordenan cronológicamente (más recientes primero).
  - Al enviar un comentario, se agrega al historial sin recargar la página.

### Req-14.7: Visualizador de Imagen del Defecto
- Espacio rectangular para renderizar la fotografía del defecto detectado.
- Herramientas de zoom: botones **+** y **-** en la esquina inferior derecha del visor.
- Indicador numérico de escala actual (ej. "x1.00").
- Botón **COMPARE** en la parte inferior del visor para permitir la comparación de imágenes del mismo defecto en diferentes inspecciones.

### Req-14.8: Esquema de Pala (Blade Diagram)
- Gráfico vectorial SVG estilizado que representa ambos lados de la pala:
  - **SS** (Suction Side) a la izquierda.
  - **PS** (Pressure Side) a la derecha.
- Un punto/indicador amarillo marca dinámicamente la posición exacta del defecto según la distancia de la raíz (*Root distance*).
- El gráfico se actualiza al seleccionar un defecto diferente.

### Req-14.9: Layout de Doble Panel
- **Panel Izquierdo (Tabla de Datos):** Ocupa aproximadamente el 70% del ancho para garantizar la lectura completa de todas las columnas.
- **Panel Derecho (Detalle del Defecto):** Ocupa aproximadamente el 30% restante, de forma fija o deslizante.
- Ambos paneles tienen scroll vertical independiente.
- La transición de apertura/cierre del panel derecho es suave (animación CSS).

### Req-14.10: Comportamiento de Selección de Fila
- Al hacer clic en cualquier parte de una fila de la tabla, esta adquiere estado activo (resaltado azul) y actualiza inmediatamente la información e imágenes del Panel Derecho sin recargar la página.
- Solo una fila puede estar activa a la vez.
- Al abrir la vista por primera vez, la primera fila se selecciona automáticamente.

### Req-14.11: Zoom de Imagen Interactivo
- El usuario puede interactuar con la imagen del defecto mediante los botones + y - ubicados en la esquina inferior derecha del visor.
- El multiplicador de escala se actualiza dinámicamente (ej. x1.00, x1.50, x2.00).
- Se permite hacer zoom in/out con scroll del mouse sobre la imagen.

### Req-14.12: Búsqueda y Filtrado
- La barra de búsqueda "Search all and filter" permite filtrar los defectos por coincidencia de texto en cualquier campo visible de la tabla.
- Se aplica un debounce de 300 ms antes de disparar la consulta.
- Los filtros activos se reflejan en la exportación (RF-02/Req-14.2).

### Req-14.13: Especificación Visual
- **Tabla:** Fondo oscuro/azul marino profundo (#0A1929 o similar) para las filas de datos, texto blanco/gris claro para alta legibilidad.
- **Panel Derecho:** Fondo blanco (#FFFFFF) con texto oscuro para contraste.
- **Botón Export List:** Fondo verde (#27AE60), texto blanco, icono de descarga, bordes redondeados.
- **Badge Category:** Caja con bordes redondeados, fondo naranja (#F2994A para cat. 3, #E06300 para cat. 4), texto blanco centrado.
- **Action column:** Texto acompañado de barra vertical de color (naranja para urgencia alta, amarillo para urgencia media) a la izquierda del texto.
- **Toggle Status:** Componente Switch estándar (gris = no resuelto, verde/azul = resuelto).
- **Esquema de pala:** Fondo gris claro con silueta de pala en verde/teal y punto indicador amarillo.


---

## 15. Módulo de Ficha del Parque Eólico (Asset Detail View)

### Req-15.1: Vista General de la Ficha del Parque
- Al hacer clic en un parque eólico desde la tabla de Wind Farms (sección 13), el sistema debe navegar a una vista de detalle dividida en dos columnas principales:
  - **Columna Izquierda (~35%):** Información estática/documental del parque (detalles técnicos, tabla de subactivos, documentos).
  - **Columna Derecha (~65%):** Sección dinámica de campañas de inspección.
- La vista debe incluir un encabezado con el nombre del parque y pestañas de navegación interna: **General** y **Defects**.
- La pestaña **General** muestra por defecto el contenido completo de la ficha.
- La pestaña **Defects** redirige a la vista filtrada de defectos del parque (reutilizando la vista de la sección 14 con filtro pre-aplicado por el asset seleccionado).

### Req-15.2: Bloque de Detalles Técnicos
- Dentro de la columna izquierda, se muestra un bloque **"Details"** con los siguientes metadatos calculados dinámicamente:
  - **Oldest inspection:** Fecha de la inspección más antigua registrada en el parque (MIN de `inspection.created_at` vía turbines/blades).
  - **Powering date:** Fecha de puesta en marcha del activo (`wind_farm.powering_date`).
  - **Total power:** Potencia total instalada (SUM de `turbine.power_kw` del parque) expresada en kW.
  - **Number of sub-assets:** Cantidad total de turbinas asociadas al parque (COUNT de `turbine` WHERE `wind_farm_id`).
- **Botón "Plan a New Inspection":** Estilo azul primario con texto blanco, redirige al formulario de creación de nueva inspección pre-seleccionando el parque actual como contexto.

### Req-15.3: Tabla de Subactivos (Turbinas)
- Debajo del bloque de detalles, se presenta una tabla paginada con las turbinas del parque.
- Columnas:
  - **Name:** Nombre de la turbina (ej. WT01). Ordenable ascendente/descendente.
  - **Model:** Modelo de turbina (ej. Vestas V90).
  - **Last Inspection:** Fecha de la última inspección registrada para esa turbina.
  - **Powering Date:** Fecha de conexión/comisionamiento de la turbina.
  - **# Inspections:** Número total de inspecciones realizadas en esa turbina.
- **Paginación:** Control inferior con selector de filas por página (10, 5, 25, 100) y navegación entre páginas con indicador de rango (ej. "1-7 of 7").
- Al hacer clic en una fila de turbina, se navega a la ficha de detalle de la turbina correspondiente.

### Req-15.4: Modal de Números de Serie de Turbinas
- Un botón **"Turbines Serial Numbers"** (estilo azul outline) debajo de la tabla de subactivos abre un modal/dialog superpuesto.
- El modal muestra una tabla editable con las siguientes columnas:
  - **Name:** Nombre de la turbina (solo lectura).
  - **Turbine:** Número de serie de la turbina (input editable).
  - **Blade A:** Número de serie de la pala A (input editable).
  - **Blade B:** Número de serie de la pala B (input editable).
  - **Blade C:** Número de serie de la pala C (input editable).
  - **Tower:** Número de serie de la torre (input editable).
  - **Anticlockwise:** Checkbox indicando si el orden de las palas es antihorario.
- Botones de acción:
  - **Cancel:** Cierra el modal sin guardar cambios.
  - **Update:** Persiste los cambios de números de serie en la base de datos.
- Solo usuarios con rol `supervisor` o `admin` pueden editar estos campos.

### Req-15.5: Dropbox de Documentos del Parque
- Sección **"Documents dropbox"** en la parte inferior de la columna izquierda.
- Texto descriptivo: "Have all your key documents at your disposal here. Master service agreement, asset initial audit, insurance contracts, ..."
- **Botón "Add Document":** Estilo verde con icono de archivo, permite la carga de archivos en formatos: PDF, DOCX, XLSX, PNG, JPG.
- Los documentos se almacenan en un bucket privado `asset-documents` de Supabase Storage.
- Se listan los documentos ya subidos con opción de descarga y eliminación (requiere rol `supervisor` o `admin` para eliminar).

### Req-15.6: Panel de Campañas de Inspección (Columna Derecha)
- Encabezado **"Campaigns"** con botón **"Manage Campaigns"** alineado a la derecha (estilo outline oscuro).
- Las campañas se presentan como un listado colapsable (acordeón):
  - Cada campaña muestra su nombre y la cantidad de inspecciones entre paréntesis (ej. "June 2026 (Copy) (7)").
  - Botón **"View Results"** en la cabecera de cada campaña (estilo azul primario) que navega al reporte global de la campaña (Req-15.8).
  - Menú de opciones (**"..."**) para acciones adicionales: renombrar, duplicar, eliminar campaña.
- Al expandir una campaña, se despliega una tabla con las inspecciones de esa campaña.

### Req-15.7: Tabla de Inspecciones por Campaña (Expandida)
- Columnas de la tabla interna de cada campaña:
  - **Inspection Date:** Fecha de la inspección (ej. 6/3/2026).
  - **Subasset name:** Nombre de la turbina inspeccionada (enlace clickeable que navega a la ficha de la turbina).
  - **Status:** Badge visual de estado:
    - Verde "Report" = inspección finalizada con reporte generado.
    - Azul "Annotate" = en proceso de anotación.
    - Gris "Pending" = pendiente de procesamiento.
  - **Type:** Tipo de inspección (ej. Blades, Tower, Nacelle).
  - **Photos uploaded:** Número de imágenes procesadas/subidas.
  - **Viewed %:** Porcentaje de revisión de imágenes por parte del inspector (barra de progreso o texto porcentual).
  - **Defects:** Número total de defectos identificados en esa inspección.
  - **Notes:** Campo de texto libre con observaciones breves (ej. "Correct one").
  - **PDF report:** Botón con icono de descarga para obtener el reporte PDF individual.
- La descarga de PDF valida permisos del rol antes de iniciar.
- Ordenamiento por columna `Inspection Date` (descendente por defecto) con toggle ascendente.

### Req-15.8: Modal de Creación/Gestión de Campañas
- Al hacer clic en **"Manage Campaigns"**, se abre un modal con:
  - Campo de texto **"Name"** para el nombre de la nueva campaña.
  - Tabla de inspecciones disponibles del parque con las columnas:
    - Checkbox de selección múltiple.
    - **Inspection Date:** Fecha ordenable.
    - **Subasset:** Nombre de la turbina.
    - **Status:** Badge de estado.
    - **Notes:** Notas de la inspección.
    - **Campaign:** Campaña actualmente asignada (si tiene).
  - El usuario puede seleccionar inspecciones (checkboxes) y asignarlas a la campaña creada.
  - Botones: **Cancel** (cierra sin guardar) y **Save** (persiste la campaña y asociaciones).
- Solo usuarios con rol `supervisor` o `admin` pueden crear/editar campañas.

---

## 16B. Reporte Global de Campaña (Campaign Results View)

### Req-16B.1: Vista General del Reporte de Campaña
- Al hacer clic en **"View Results"** de una campaña, el sistema navega a una vista de reporte global.
- Breadcrumb de navegación: `[Asset Name] > Global report of campaign [Campaign Name]`.
- Subtítulo: "Campaign of [fecha]".
- La vista está dividida en:
  - **Panel Superior Izquierdo:** Mapa de ubicación de turbinas (mapa interactivo con marcadores y rutas de vuelo del dron).
  - **Panel Superior Derecho:** Resumen de defectos y listado por turbina.
  - **Panel Inferior Izquierdo:** Gráficos estadísticos de defectos.
  - **Panel Inferior Derecho:** Galería de imágenes de defectos por categoría.

### Req-16B.2: Resumen de Defectos por Categoría (Header)
- Barra horizontal con badges numéricos para cada categoría de severidad:
  - **Cat 5:** Número de defectos categoría 5 (badge rojo/crítico).
  - **Cat 4:** Número de defectos categoría 4 (badge naranja).
  - **Cat 3:** Número de defectos categoría 3 (badge amarillo).
  - **Cat 2:** Número de defectos categoría 2 (badge azul).
  - **Cat 1:** Número de defectos categoría 1 (badge verde/gris).
- Panel lateral derecho verde mostrando:
  - `[X] resolved` — cantidad de defectos marcados como resueltos.
  - `[Y] defects` — total de defectos en la campaña.

### Req-16B.3: Listado de Turbinas con Resumen
- Lista colapsable de turbinas (acordeón) con:
  - Checkbox de selección para operaciones en lote.
  - Nombre de la turbina (ej. "Turbine WT01").
  - Badges de categoría por turbina (distribución Cat5-Cat1 individual).
  - Indicador: "X / Y resolved" (resueltos sobre total).
  - Iconos de acción: Descargar PDF, Copiar, Abrir en nueva pestaña.
- Al expandir una turbina, se muestra el desglose por pala:
  - **BLADE A:** Badges Cat5-Cat1 individuales + "X / Y resolved".
  - **BLADE B:** Ídem.
  - **BLADE C:** Ídem.

### Req-16B.4: Mapa Interactivo de Turbinas
- Mapa satelital (tiles OpenStreetMap o similar) con:
  - Marcadores de posición para cada turbina del parque.
  - Líneas de ruta de vuelo del dron (polylines naranjas con flechas direccionales).
  - Controles de zoom (+/-) y fullscreen en la esquina del mapa.
  - Checkbox **"Select all"** para selección masiva de turbinas.
- Al hacer clic en un marcador de turbina, se resalta la fila correspondiente en el listado.

### Req-16B.5: Gráficos Estadísticos
- **Turbine defect category repartition:** Gráfico de barras apiladas (stacked bar chart) que muestra la distribución de categorías de defectos por turbina. Colores: rojo (Cat5), naranja (Cat4), amarillo (Cat3), verde/teal (Cat2), gris (Cat1).
- **Turbine defect type repartition:** Gráfico de barras apiladas por tipo de defecto (LE Erosion, Vortex Missing, Paint Damages, etc.) por turbina.
- Ambos gráficos comparten el eje X (nombres de turbinas: WT01, WT03, WT05, WT07).

### Req-16B.6: Galería de Imágenes por Categoría
- Sección **"Category [N]"** (ej. "Category 4") con título coloreado según severidad.
- Grid de imágenes (thumbnails) de los defectos pertenecientes a esa categoría.
- Las imágenes se muestran con un borde de color según categoría (rojo para Cat4/5).
- Clic en imagen abre el visor ampliado (lightbox) con navegación entre imágenes.

### Req-16B.7: Acciones de Exportación y Compartir
- **Botón "Export CSV for All Turbines":** Estilo verde, exporta datos consolidados de defectos de todas las turbinas de la campaña.
- **Botón "Share":** Genera un enlace compartible o envía por correo el reporte.
- Ambos botones ubicados en la esquina superior derecha.

---

## 17. Inspección Detallada — Flujo de 4 Pasos (Inspection Workflow)

### Req-17.1: Navegación por Pasos (Stepper)
- La vista de inspección detallada de una turbina presenta un flujo secuencial de 4 pasos visualizado como un stepper horizontal:
  1. **INSPECT** — Datos de la inspección y estado de adquisición.
  2. **ANNOTATE** — Visor de imágenes con herramientas de anotación.
  3. **ANALYZE** — Editor de defectos y resumen por pala.
  4. **RESULTS** — Estadísticas finales y tabla de defectos.
- Breadcrumb: `[Asset Name] > Turbine [WT0X] > [Fecha]`.
- El paso activo se resalta con fondo azul/sólido; los completados muestran un checkmark verde; los futuros están en gris.
- Los pasos completados son navegables (click para volver); los futuros no son clickeables hasta completar el paso actual.

### Req-17.2: Paso 1 — INSPECT (Detalles de la Inspección)
- **Panel Izquierdo:** Ficha de "Inspection Details" con campos:
  - **Asset Name:** Nombre del parque (solo lectura).
  - **Inspection type:** Tipo de inspección (ej. Blades) (solo lectura).
  - **Turbine number:** Selector desplegable de turbina (ej. WT01).
  - **Model:** Modelo de turbina (solo lectura, derivado de la selección).
  - **Date:** Fecha de la inspección (editable con icono de lápiz).
  - **Notes:** Campo de texto editable (icono de lápiz para activar edición).
  - **Legislation:** Texto de regulaciones aplicables con estilo de alerta rojo ("Please check coal legislation before your flight").
  - **Weather:** Información meteorológica del día de la inspección (ej. "Cloudy 30°C - rain 0.67mm/hr - vrais: 6.7m/s - wind gust: 11.7m/s").
- **Documents dropbox:** Sección para documentos adicionales de la inspección (mismo patrón que Req-15.5).
- **Mapa de Ubicación:** Mapa satelital mostrando la posición geográfica de la turbina con marcador azul.
- **Panel Derecho Superior:** Barra de progreso con dos checkpoints verdes:
  - Primer checkpoint: "Complete" (adquisición terminada).
  - Segundo checkpoint: "Complete" (upload terminado).
- **Panel Derecho — Acquisition:** Tabla con datos de adquisición:
  - Date and time (ej. 03-06-2026 / 9:21).
  - Photos (total capturadas, ej. 498).
  - Tagged photos (cantidad etiquetadas, ej. 0).
  - Inspection duration (ej. 14 minutes).
  - RTK Status (ej. "Fixed (100%)").
- **Panel Derecho — Photo upload:** Tabla con:
  - Uploaded photos (ej. 498 (100%)).
  - Pending photos (ej. 0).

### Req-17.3: Paso 2 — ANNOTATE (Visor y Anotación de Imágenes)
- **Panel Izquierdo:** Grid de thumbnails de todas las imágenes capturadas.
  - Miniaturas organizadas en cuadrícula con scroll vertical.
  - La imagen seleccionada se resalta con borde azul.
  - Contadores de estado: `[X] UNSEEN` (naranja), `[Y] TAGGED` (azul), `[Z] ANNOT` (verde).
  - Indicador de pala seleccionada (ej. "A - LE").
- **Selector de Pala y Lado:**
  - Tabs de palas: A, B, C.
  - Tabs de lados: SS, PS, LE, TL.
  - Representación visual del perfil de la pala con indicador de posición (línea punteada mostrando distancia desde raíz).
- **Panel Central:** Visor de imagen a pantalla completa.
  - Imagen de alta resolución con controles de navegación (flechas izquierda/derecha) y zoom.
  - Toggle **"Fast forward mode"** para avanzar rápidamente entre imágenes.
  - Barra de información superior: `Blade: A-82618 | Side: LE | Blade root distance: 0 m | Distance to blade: 6.2 m` con botón EXIT.
  - **Review progress: [X]%** — Barra de progreso indicando el porcentaje de imágenes revisadas.
  - Botones de acción de imagen: Marcar como defecto (icono azul upload), Eliminar (icono rojo basura).
  - Toggle de contraste/brillo para mejora visual de la imagen.
- **Panel Derecho:**
  - **Comparison:** Checkboxes con timestamps de inspecciones anteriores para comparar imágenes del mismo ángulo.
  - **Exif & metadata:** Información técnica de la foto:
    - Original name, Photo, Type (MISSION), ApertureValue, ExposureTime, ISOSpeedRatings, DateTime, ImageWidth, ImageHeight.
  - **Turbine Information:** Model, Power (kW), Commissioning date.
  - **Change vertical blade:** Selector para cambiar la pala vertical activa con diagrama de orientación (clockwise/anticlockwise) y botón SAVE.

### Req-17.4: Paso 3 — ANALYZE (Editor de Defectos)
- **Panel Izquierdo — Annotations:**
  - Tabs de pala: BLADE A, BLADE B, BLADE C (con badge de conteo de anotaciones).
  - Lista de anotaciones pendientes de clasificar.
  - Mensaje "All annotations have been processed" cuando no quedan pendientes.
  - Área para previsualizar una anotación seleccionada o un defecto.
- **Panel Central — Defect Editor:**
  - Imagen del defecto con indicadores de posición (ej. "42m" y "LE" superpuestos).
  - Navegación entre imágenes del mismo defecto (flechas `<` `>`).
  - Campos editables:
    - **Type:** Selector desplegable (ej. LE EROSION, VORTEX (MISSING PANELS), PAINT DAMAGES, etc.).
    - **Category:** Selector numérico visual 1-5 con el número activo resaltado en azul.
    - **Root distance (m):** Input numérico.
    - **Blade face:** Selector desplegable (LE, SS, TE, PS).
  - **Automatic category suggestions:** Sección colapsable con IA que sugiere categoría.
  - **Note:** Campo de texto para observaciones (con botón X para limpiar).
  - **Root cause:** Campo de texto (con botón X para limpiar).
  - **Next step:** Campo de texto (con botón X para limpiar).
  - Botones: **Clear** (limpia todos los campos) y **Save as Defect** (persiste el defecto).
- **Panel Derecho — Summary and Reviews:**
  - Acordeón por pala (Blade A, B, C) con conteo de defectos.
  - Tabla resumen por pala expandida con columnas: #, Type, Face, Category, Root (m), Copy.
  - Fila seleccionada resaltada en azul (ej. "B6 - LE EROSION - LE - 3 - 41.6").
  - Al hacer clic en un defecto del resumen, se carga en el Defect Editor para edición.
  - **Blade notes:** Campo de texto libre para notas generales de la pala.
  - **SubAsset:** Total de defectos del subasset con **SubAsset notes**.

### Req-17.5: Paso 4 — RESULTS (Estadísticas y Tabla de Defectos)
- **Panel Izquierdo — Blades:**
  - Diagrama visual de las 3 palas (A, B, C) con sus números de serie.
  - Representación visual de las palas con puntos naranjas indicando la posición exacta de cada defecto detectado a lo largo de la pala (eje vertical = distancia desde raíz, 0m a 43m+).
  - Escala de distancia en metros en el eje vertical izquierdo.
  - Las palas se muestran como siluetas grises con perfil aerodinámico.
  - Indicadores numéricos circulares rojos para defectos de alta severidad.
  - Contadores: `[X] defects` y `[Y] resolved` en la parte inferior.
  - **Conclusion:** Sección con conclusiones por turbina y por pala (ej. "Turbine (48806): No conclusion." / "Blade A (82618): No conclusion for the blade.").
  - **Botón "Plan Next Inspection":** Estilo azul primario de ancho completo para programar la siguiente inspección de la turbina.
- **Panel Derecho — Vista "Statistics":**
  - Toggle tabs: **Statistics** | **Details**.
  - **Breakdown by blade:** Gráficos de dona (donut charts) para Blade A, B y C mostrando distribución porcentual de defectos.
  - **Breakdown by category:** Badges Cat5-Cat1 con conteo (misma visualización que Req-16B.2).
  - **Breakdown by type:** Gráfico de barras verticales agrupadas por tipo de defecto (LE EROSION, VORTEX MISSING PANELS, BLADES WITH HYDRAULIC OIL, OTHER ADD-ONS MISSING, PAINT DAMAGES).
  - **Defect overview table:** Tabla resumen cruzando:
    - Filas: Tipos de defecto.
    - Columnas: Total/Type, Category 5, Category 4, Category 3, Category 2, Category 1.
    - Última fila: Total/Category (suma por columna).
    - Colores de cabecera de categoría: rojo (Cat5), naranja (Cat4), amarillo (Cat3), azul (Cat2), verde (Cat1).
- **Panel Derecho — Vista "Details":**
  - Tabla completa de defectos con columnas:
    - **Id:** Identificador del defecto (ej. A1, B1, C2).
    - **Type:** Tipo de defecto con filtro de columna (dropdown).
    - **Category:** Badge numérico coloreado con filtro.
    - **Blade:** Pala afectada (A, B, C) con filtro.
    - **Side:** Lado de la pala con filtro.
    - **Root distance (m):** Distancia desde raíz.
    - **Defect size (cm):** Dimensiones.
    - **Edit:** Botón de edición (icono lápiz azul).
    - **Resolved (0):** Toggle/switch para marcar como resuelto, con contador en cabecera.
  - Al seleccionar un defecto en la tabla, se muestra debajo:
    - **Note:** Texto del defecto.
    - **Root cause:** Causa raíz.
    - **Next step:** Siguiente acción.
    - **Comments:** Sección de comentarios con historial y campo "Add" para nuevo comentario.
  - Al activar un defecto (fila resaltada azul), se muestra la imagen del defecto en un visor debajo con controles de zoom y fullscreen.

### Req-15.9: Responsividad y Permisos
- La interfaz de la ficha del parque debe ser responsive:
  - En resoluciones menores a 1024px, las dos columnas colapsan a una sola columna vertical (detalles arriba, campañas abajo).
  - En dispositivos móviles, los acordeones de campaña se mantienen funcionales con scroll horizontal en la tabla interna.
- Las acciones de descarga de PDF y visualización de resultados validan permisos de lectura del rol del usuario antes de iniciar descarga o redirección.
- El botón "Plan a New Inspection" solo es visible para usuarios con rol `inspector`, `supervisor` o `admin`.
- La edición de notas y campos solo está disponible para el inspector asignado (en inspecciones `in_progress`) o `supervisor`/`admin`.

### Req-15.10: Datos de Campaña — Modelo de Datos
- Se requiere una entidad **Campaign** para agrupar inspecciones:
  - **id:** UUID, PK.
  - **name:** TEXT, nombre de la campaña.
  - **wind_farm_id:** UUID, FK → wind_farm.
  - **created_at:** TIMESTAMPTZ.
  - **created_by:** UUID, FK → profiles.
- Relación: Una inspección puede pertenecer a una campaña (campo `campaign_id` en tabla `inspection`).
- Una campaña pertenece a un solo parque eólico.
- Las campañas se pueden crear, renombrar, duplicar y eliminar (solo `supervisor`/`admin`).

### Req-15.11: Números de Serie — Modelo de Datos
- Se requieren campos adicionales en las tablas existentes:
  - **turbine:** `serial_number TEXT`, `anticlockwise BOOLEAN DEFAULT FALSE`.
  - **blade:** `serial_number TEXT`.
  - Nuevo campo en turbine: `tower_serial_number TEXT`.
- Los números de serie son opcionales y editables desde el modal de Req-15.4.


---

## 18. Módulo de Planificación y Registro de Nueva Inspección (RF-002)

### Req-18.1: Descripción General
- El sistema debe permitir a los usuarios programar y dar de alta una nueva campaña de inspección para un activo eólico (parque eólico) específico.
- El formulario recopila parámetros de configuración (tipo, método, fecha, nombre de campaña y notas), permite asociar qué aerogeneradores (*subassets*) formarán parte de la inspección, muestra un mapa meteorológico en tiempo real para evaluar la viabilidad de la operación y envía notificaciones de confirmación.
- Layout de 3 columnas: Panel Izquierdo (Formulario), Columna Central (Tabla de subactivos), Panel Derecho (Mapa meteorológico).

---

### Req-18.2: Formulario de Configuración de la Inspección (Panel Izquierdo)

#### Req-18.2.1: Selector de Activo (Asset)
- **Tipo de componente:** Menú desplegable (*Dropdown*).
- **Comportamiento:** Muestra por defecto el parque eólico seleccionado previamente (ej. *Fila de Mogote*).
- Debe permitir la búsqueda o cambio de parque si el usuario cuenta con los permisos necesarios.
- Al cambiar el parque, se actualizan dinámicamente la tabla de subactivos y las coordenadas del mapa meteorológico.

#### Req-18.2.2: Selector de Tipo (Type)
- **Tipo de componente:** Botones de selección única (*Segmented Control / Radio Buttons*).
- **Opciones:** `BLADES` (Palas) o `TOWER` (Torre).
- El valor por defecto es `BLADES`.
- Al seleccionar una opción, se resalta con fondo azul (#00A3E0) y texto blanco; la opción inactiva muestra fondo gris claro.

#### Req-18.2.3: Selector de Método (Method)
- **Tipo de componente:** Botones de selección única (*Segmented Control / Radio Buttons*).
- **Opciones:** `SKYVISOR` o `External >`.
- El valor por defecto es `SKYVISOR`.
- Misma estilización visual que el selector de Tipo.

#### Req-18.2.4: Selector de Fecha de Inspección (Inspection Date)
- **Tipo de componente:** Campo de texto con máscara de fecha e icono de calendario interactivo (*DatePicker*).
- **Formato:** `DD/MM/YYYY`.
- **Comportamiento:** Por defecto, sugiere la fecha actual del sistema (ej. `15/07/2026`).
- El usuario puede escribir directamente o seleccionar fecha desde el calendario.

#### Req-18.2.5: Nombre de la Campaña (Campaign name)
- **Tipo de componente:** Campo de entrada de texto (*Text Input*) **obligatorio**.
- **Comportamiento:** Autocompletar sugerido según el mes y año en curso (ej. *"July 2026"*), editable por el usuario.
- Validación: No puede estar vacío. Se muestra error inline si se intenta enviar sin valor.

#### Req-18.2.6: Notas (Notes)
- **Tipo de componente:** Área de texto multilínea (*Text Area*) opcional.
- Sirve para observaciones del planificador o piloto.
- Sin límite estricto de caracteres, pero con scroll interno si el contenido excede el alto visible.

#### Req-18.2.7: Notificaciones por Correo (Toggle)
- **Tipo de componente:** Interruptor (*Toggle switch*).
- **Etiqueta:** *"Subscribe to email notifications for new inspections"*.
- **Comportamiento:** Si está activo (verde), el sistema enviará un correo automático a los inspectores y responsables cuando la campaña sea creada formalmente.
- Por defecto: activado.

---

### Req-18.3: Tabla de Selección de Subactivos (Columna Central)

#### Req-18.3.1: Cabecera con Selección Múltiple
- **Master Checkbox:** Permite marcar o desmarcar todas las turbinas de la lista de un solo clic.
- Estado visual: checked (azul con checkmark blanco), unchecked (borde gris), indeterminate (cuando solo algunas están seleccionadas).

#### Req-18.3.2: Listado de Turbinas
- Tabla con las siguientes columnas:
  1. **Checkbox de selección individual:** Define si esa turbina específica será inspeccionada.
  2. **Icono de turbina:** Icono representativo del aerogenerador.
  3. **Name:** Nombre identificador del subactivo (ej. *WT01*, *WT02*, ..., *WT07*).
  4. **Model:** Modelo del aerogenerador (ej. *Vestas V90*).
  5. **Last inspection:** Tiempo transcurrido desde su última revisión (ej. *1 months*).
  6. **Last defects detected:** Cantidad de anomalías registradas en la campaña anterior (ej. *17*, *18*, *21*, *13*, *16*, *12*, *21*).
- Las filas son clickeables para toggle de selección.
- Si no hay turbinas disponibles para el parque seleccionado, se muestra un estado vacío.

---

### Req-18.4: Integración de Mapa y Clima en Tiempo Real (Panel Derecho)

#### Req-18.4.1: Widget Meteorológico (Iframe)
- **Componente:** Iframe embebido que apunta al proveedor meteorológico Windy.com.
- **Funcionalidad:**
  - Visualización de la capa del mapa de viento centrada en las coordenadas geográficas del activo seleccionado.
  - Coordenadas por defecto: *N10°42'32", W85°15'10"* (Costa Rica) para el parque *Fila de Mogote*.
  - Al cambiar el parque en el selector de Asset, las coordenadas del iframe se actualizan dinámicamente.

#### Req-18.4.2: Tabla de Pronósticos
- Debajo del mapa se muestra una tabla de pronósticos por hora y días con:
  - **Hora:** Franja horaria (0, 3, 6, 9, 12, 15, 18, 21).
  - **Iconos meteorológicos:** Representación gráfica de las condiciones (sol, nubes, lluvia).
  - **Temperatura (°C):** Valores numéricos por hora.
  - **Lluvia (mm):** Precipitación esperada.
  - **Velocidad del viento (m/s):** Valores numéricos con código de color (verde = seguro, naranja = precaución, rojo = peligro).
  - **Rachas de viento (m/s):** Indicadores de ráfagas máximas.
  - **Dirección del viento:** Iconos con orientación de la flecha.
- La tabla abarca al menos 3 días (ej. Miércoles 15, Jueves 16, Viernes 17).

---

### Req-18.5: Acciones del Formulario

#### Req-18.5.1: Botón "CREATE"
- **Tipo de componente:** Botón de acción principal (*CTA - Call to Action*).
- **Estilo visual:** Fondo azul primario (#00A3E0), texto blanco "CREATE", bordes redondeados, alineado en la esquina inferior derecha de la columna central.
- **Lógica de validación:** Al hacer clic, debe validar:
  - `Campaign name` no vacío.
  - Al menos un subactivo (turbina) seleccionado en la tabla.
- **Estado deshabilitado:** El botón permanece deshabilitado (opacidad reducida, cursor no permitido) si las validaciones no se cumplen.
- **Acción posterior (éxito):**
  - Registra la inspección con estado "Planificada" (`scheduled`).
  - Crea la campaña asociada al parque eólico seleccionado.
  - Asocia las turbinas seleccionadas a la campaña.
  - Gatilla las notificaciones por correo si el toggle de suscripción está activo.
  - Redirige al usuario al módulo de carga de imágenes (**Uploader**) o a la lista de inspecciones en curso (**Ongoing**).
- **Feedback visual:** Muestra un toast de confirmación al crear exitosamente o un toast de error si la operación falla.

---

### Req-18.6: Criterios de Aceptación Técnicos

1. El botón **"CREATE"** permanecerá deshabilitado o mostrará un error de validación en pantalla si el campo de `Campaign name` se encuentra vacío o si no hay ninguna turbina seleccionada en la tabla.
2. Las coordenadas de geolocalización enviadas al widget de mapa (iframe Windy) deben actualizarse dinámicamente cada vez que se cambie el parque eólico en el selector de `Asset`.
3. El formulario debe inicializarse con los valores por defecto: Type = BLADES, Method = SKYVISOR, Inspection Date = fecha actual, Campaign name = "[Mes actual] [Año actual]", toggle de notificaciones activo, todas las turbinas seleccionadas.
4. La tabla de subactivos debe cargarse de forma asíncrona al seleccionar/cambiar el parque eólico (mostrar skeleton loader durante la carga).
5. Solo usuarios con rol `inspector`, `supervisor` o `admin` pueden acceder a este formulario.
6. La creación de la campaña debe persistirse en la tabla `campaigns` y las inspecciones individuales (una por turbina seleccionada) en la tabla `inspections` con estado `scheduled`.

---

### Req-18.7: Especificación Visual (UI)

- **Layout General:** 3 columnas responsivas — Panel izquierdo (~25%), Columna central (~35%), Panel derecho (~40%).
- **Encabezado:** "Create new inspection" en texto grande (#111827), negrita, alineado a la izquierda.
- **Barra de búsqueda global:** Input con placeholder "Search all" centrado en la parte superior, con icono de lupa.
- **Segmented Controls (Type/Method):** Bordes redondeados, opción activa fondo azul (#00A3E0) texto blanco, opción inactiva fondo gris claro (#F3F4F6) texto gris oscuro.
- **DatePicker:** Borde gris (#D1D5DB), icono de calendario a la derecha, fondo blanco.
- **Tabla de subactivos:** Sin bordes exteriores, separadores horizontales finos, checkboxes azules al activarse.
- **Iframe meteorológico:** Bordes redondeados, sin borde visible, ocupa todo el alto disponible del panel derecho.
- **Responsividad:**
  - En pantallas < 1280px: las 3 columnas colapsan a 2 (formulario + tabla en una fila, mapa debajo).
  - En pantallas < 768px: layout de una sola columna apilada (formulario → tabla → mapa).
