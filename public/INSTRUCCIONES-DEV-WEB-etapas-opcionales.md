# Instrucciones para el dev web — Etapas opcionales de reparación + Z1/Z2 + defect_identifier

Contexto: la app móvil del técnico (proyecto `wind_farm_drone`) y la web comparten la misma BD
Supabase (proyecto `esphlzrzwmzeozjmyvqm`). La app ya aplicó las migraciones y los cambios de datos.
Este documento describe **qué debe considerar la web** para que el informe y las vistas reflejen
lo mismo que la app.

---

## 1. Cambios de esquema YA APLICADOS en la BD (no hay que crearlos)

Ya existen en producción, aplicados desde la app:

### Tabla `repair_stage`
- `optional BOOLEAN DEFAULT false` — la etapa es parte de un grupo opcional.
- `enabled  BOOLEAN DEFAULT true`  — si el grupo opcional está activado por el técnico.
- `z1 NUMERIC` — solo se usa en la etapa `analisis_falla`.
- `z2 NUMERIC` — solo se usa en la etapa `analisis_falla`.

### Tabla `repair_stage_catalog`
- `optional BOOLEAN DEFAULT false`
- Nuevas filas de catálogo (ver punto 2).

### Tabla `defect`
- `defect_identifier TEXT` — identificador que se carga por planilla (lado web).

---

## 2. Catálogo de etapas COMPLETO (orden real, sort_order 1..21)

Este es el catálogo actual en `repair_stage_catalog`. Las marcadas `[opcional]` pertenecen a
un grupo opcional que el técnico activa deslizando en la app.

| sort_order | code                   | opcional | label (nombre visible)                        |
|-----------:|------------------------|:--------:|-----------------------------------------------|
| 1  | etiqueta               |    no    | Etiqueta                                       |
| 2  | analisis_falla         |    no    | Análisis de daño   (usa Z1/Z2)                 |
| 3  | saneado                |    no    | Saneado                                        |
| 4  | lam_int                |   SÍ     | Laminación interior            (encabezado)    |
| 5  | lam_int_vacio          |   SÍ     | Sistema de vacío                               |
| 6  | lam_int_manta          |   SÍ     | Manta térmica inicio postcurado                |
| 7  | lam_int_resultado      |   SÍ     | Resultado postcurado laminación                |
| 8  | lam_int_ajuste         |   SÍ     | Ajuste de laminación interior                  |
| 9  | nucleo                 |   SÍ     | Instalación de núcleo          (encabezado)    |
| 10 | nucleo_vacio           |   SÍ     | Sistema de vacío                               |
| 11 | nucleo_manta           |   SÍ     | Manta térmica inicio post-curado               |
| 12 | nucleo_resultado       |   SÍ     | Resultado post-curado núcleo                   |
| 13 | nucleo_ajuste          |   SÍ     | Ajuste de núcleo                               |
| 14 | laminacion             |    no    | Laminación exterior                            |
| 15 | sistema_vacio          |    no    | Sistema de vacío                               |
| 16 | manta_termica          |    no    | Manta térmica inicio postcurado                |
| 17 | resultado_laminacion   |    no    | Resultado de laminación                        |
| 18 | ajuste_post_laminado   |    no    | Ajustado de superficie post laminado           |
| 19 | aplicacion_filler      |    no    | Aplicación de filler                           |
| 20 | ajuste_post_filler     |    no    | Ajustado de superficie post filler             |
| 21 | pintura_primera_mano   |    no    | Aplicación de pintura primera mano             |

Grupos opcionales:
- **"Laminación interior"** = encabezado `lam_int` + sub-etapas `lam_int_vacio`, `lam_int_manta`,
  `lam_int_resultado`, `lam_int_ajuste`.
- **"Instalación de núcleo"** = encabezado `nucleo` + sub-etapas `nucleo_vacio`, `nucleo_manta`,
  `nucleo_resultado`, `nucleo_ajuste`.

---

## 3. Lógica de "desbloqueo" que la web debe respetar

Cada grupo opcional se activa/desactiva en la app deslizando la fila del **encabezado**
(`lam_int` o `nucleo`). Al hacerlo, se hace un UPDATE de `enabled` sobre las 5 filas del grupo
(encabezado + 4 sub-etapas) en `repair_stage`.

Regla de visibilidad (misma que usa la app):
- Etapas **no opcionales** (`optional = false`): siempre presentes.
- **Encabezado** de un grupo opcional (`lam_int`, `nucleo`): siempre visible (en la app aparece
  "bloqueado" con candado cuando `enabled = false`).
- **Sub-etapas** de un grupo opcional: se consideran parte del flujo **solo cuando su encabezado
  tiene `enabled = true`**.

En el informe / vistas web:
- Si un grupo opcional está **habilitado** (`repair_stage.enabled = true` para su encabezado),
  incluir el encabezado y sus 4 sub-etapas con sus fotos.
- Si está **deshabilitado**, NO incluir ese grupo (ni encabezado ni sub-etapas) en el informe
  final — el técnico decidió no realizar ese trabajo. (Las filas existen en BD con `enabled=false`,
  pero no deben mostrarse como etapas realizadas.)

Consulta recomendada para listar las etapas efectivas de una reparación:

```sql
SELECT rs.*
FROM repair_stage rs
WHERE rs.repair_id = :repairId
  AND (
    rs.optional = false                              -- etapas obligatorias
    OR rs.stage_code IN ('lam_int','nucleo')         -- encabezados (opcional mostrar si tu UI lo requiere)
    OR rs.enabled = true                             -- sub-etapas solo si el grupo está activo
  )
ORDER BY rs.sort_order;
```

Para el INFORME (solo trabajo realmente ejecutado), lo más simple es incluir solo lo habilitado:

```sql
SELECT rs.*
FROM repair_stage rs
WHERE rs.repair_id = :repairId
  AND (rs.optional = false OR rs.enabled = true)
ORDER BY rs.sort_order;
```

Las fotos de cada etapa están en `repair_photo` (FK `repair_stage_id`).

---

## 4. Z1 / Z2 en la etapa "Análisis de daño" (`analisis_falla`)

- El técnico ingresa `z1` y `z2` (numéricos) en la app; se guardan en
  `repair_stage.z1` / `repair_stage.z2` de la fila con `stage_code = 'analisis_falla'`.
- **Ubicación del daño = (z1 + z2) / 2** (punto medio). La web debe calcularlo así en el informe.
- Pueden venir en null si el técnico aún no los ingresó.

---

## 5. Numeración VISIBLE (opcional, solo si el informe usa números de etapa)

La app muestra los grupos opcionales como **una etapa cada uno** con sub-numeración jerárquica.
Si el informe numera etapas, usar este mapeo (independiente del `sort_order` físico):

- 1 Etiqueta · 2 Análisis de daño · 3 Saneado
- **4** Laminación interior → 4.1 / 4.2 / 4.3 / 4.4
- **5** Instalación de núcleo → 5.1 / 5.2 / 5.3 / 5.4
- 6 Laminación exterior · 7 Sistema de vacío · 8 Manta térmica inicio postcurado ·
  9 Resultado de laminación · 10 Ajustado post laminado · 11 Aplicación de filler ·
  12 Ajustado post filler · 13 Aplicación de pintura primera mano

(Cada grupo opcional cuenta como 1 en la numeración visible; las obligatorias siguientes continúan
consecutivas. Esto es solo presentación.)

---

## 6. Nombre compuesto del defecto

El nombre del defecto se compone de **tipo de daño + defect_number + "-" + defect_identifier**.
El tipo se separa por espacio; el número y el identificador se unen con un guion `-`
(se omite la parte que esté vacía). Ejemplo: `Crack A27-XYZ` (o `Crack A27` si no hay identificador).

- **tipo de daño**: `defect.type` (mismo diccionario de labels que ya usa la web).
- **número**: `defect.defect_number` (ej. A27).
- **identificador**: `defect.defect_identifier` (columna NUEVA, la web la **carga por planilla de
  defectos**). Mientras esté null, el nombre solo muestra tipo + número.

La web debe:
1. Poblar `defect.defect_identifier` desde la planilla de defectos.
2. Componer el nombre del defecto igual que la app (`type + " " + defect_number + "-" + defect_identifier`)
   en sus vistas y en el informe.

---

## Resumen de acciones para el dev web
1. En el informe, incluir los grupos opcionales (`lam_int`, `nucleo`) y sus sub-etapas **solo si
   están habilitados** (`repair_stage.enabled = true`).
2. Calcular la ubicación del daño como `(z1 + z2) / 2` en la etapa `analisis_falla`.
3. Cargar `defect.defect_identifier` por planilla y componer el nombre del defecto como
   `type + " " + defect_number + "-" + defect_identifier`.
4. (Opcional) Aplicar la numeración visible del punto 5 si el informe muestra números de etapa.
