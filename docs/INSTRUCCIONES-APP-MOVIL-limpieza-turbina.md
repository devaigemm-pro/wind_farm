# Contrato de datos — Campañas de "Limpieza de Turbina" (cleaning)

Instrucciones para el equipo del **app móvil** para enlazar la información de las campañas de limpieza con la plataforma web.

El flujo es **idéntico al de reparación**, solo que renombrado a `cleaning` y con una estructura de **zonas** en vez de etapas. La web **solo lee**; el app móvil **escribe** las fotos. La web nunca crea ni sube fotos de limpieza.

---

## 1. Resumen del flujo

1. La campaña de limpieza se **crea desde la web** (botón "Nueva campaña de limpieza" → selecciona turbina). Esto inserta una fila en `campaign` con `type = 'cleaning'`, `status = 'cleaning_open'` y el `turbine_id`.
2. El **app móvil** captura fotos por zona y las sube al storage + inserta filas en `cleaning_photo`, enlazando por `campaign_id` + `zone_code`.
3. La web lee las fotos agrupadas por zona vía el RPC `get_cleaning_photos_by_zone(campaign_id_param)` y las muestra en el workflow.
4. La selección de fotos para el reporte la escribe **la web** en `cleaning_photo.metadata.selected_for_report` (no la toca el app).

> Equivalencia con reparación: `repair` → `cleaning`, `repair_photo` → `cleaning_photo`, `get_repair_photos_by_stage` → `get_cleaning_photos_by_zone`, `stage_code` → `zone_code`.

---

## 2. Tabla `campaign` (ya existe, ya ampliada)

- `campaign.type` admite: `'inspection' | 'repair' | 'cleaning' | 'hoist_certification'`
- `campaign.status` admite (para cleaning): `'cleaning_open' | 'cleaning_in_progress' | 'cleaning_done'`

El app móvil **no crea** la campaña; solo lee `campaign.id` (el `campaign_id`) y su `turbine_id`.

---

## 3. Tabla a crear: `cleaning_photo`

Las fotos de limpieza viven **exclusivamente** en esta tabla (nunca en `inspection_photo`). Espeja `repair_photo`.

| Columna            | Tipo            | Notas                                                             |
|--------------------|-----------------|-------------------------------------------------------------------|
| `id`               | `uuid` PK       | `default gen_random_uuid()`                                       |
| `campaign_id`      | `uuid`          | FK → `campaign.id` (de la campaña `type='cleaning'`)              |
| `cleaning_zone_id` | `uuid` null     | Id de la instancia de zona (opcional; ver §4)                     |
| `zone_code`        | `text`          | **Debe coincidir con los códigos fijos de §5**                    |
| `storage_path`     | `text`          | Ruta en el bucket público `inspection-photos` (ver §6)            |
| `thumbnail_path`   | `text` null     | Ruta del thumbnail; si es null la web usa la full-size            |
| `filename`         | `text`          | Nombre del archivo                                                |
| `capture_order`    | `int`           | Orden de captura (la web ordena las fotos por este campo asc)     |
| `captured_at`      | `timestamptz` null |                                                                |
| `metadata`         | `jsonb`         | `{ "selected_for_report": boolean }` — **lo escribe la web**      |

---

## 4. RPC a crear: `get_cleaning_photos_by_zone(campaign_id_param uuid)`

Read-only. Devuelve **una fila por zona que tenga fotos**, con un array JSON de fotos. Espeja `get_repair_photos_by_stage`.

**Columnas de cada fila:**

| Campo              | Tipo         | Notas                                            |
|--------------------|--------------|--------------------------------------------------|
| `cleaning_zone_id` | `uuid`       | Id de la instancia de zona                       |
| `zone_code`        | `text`       | Debe coincidir con los códigos de §5             |
| `zone_label`       | `text` null  | Etiqueta opcional (si null, la web usa su label) |
| `zone_order`       | `int` null   |                                                  |
| `photo_count`      | `int` null   |                                                  |
| `photos`           | `jsonb`      | Array de objetos foto (ver abajo)                |

**Cada elemento de `photos[]`:**

```json
{
  "photo_id": "uuid",
  "storage_path": "text",
  "thumbnail_path": "text|null",
  "filename": "text",
  "capture_order": 0,
  "captured_at": "timestamptz|null"
}
```

> Mientras este RPC o la tabla no existan, la web degrada con gracia: muestra el esqueleto de zonas vacío. No se rompe. Pero para ver fotos, el app debe crear ambos.

---

## 5. Códigos de zona (FIJOS — usar exactamente estos `zone_code`)

Las zonas son fijas e iguales para toda turbina. El app debe escribir `cleaning_photo.zone_code` con uno de los códigos **hoja** (donde realmente van las fotos). Las zonas contenedoras (Palas, Nacelle) NO reciben fotos directamente — sus fotos van en las sub-zonas.

| `zone_code`         | Zona / Sub-zona            | ¿Recibe fotos? |
|---------------------|----------------------------|----------------|
| `palas`             | Palas (contenedor)         | No             |
| `palas_a`           | Pala A                     | Sí             |
| `palas_b`           | Pala B                     | Sí             |
| `palas_c`           | Pala C                     | Sí             |
| `nacelle`           | Nacelle (contenedor)       | No             |
| `nacelle_superior`  | Nacelle · Lado superior (techo) | Sí        |
| `nacelle_derecho`   | Nacelle · Lado derecho     | Sí             |
| `nacelle_inferior`  | Nacelle · Lado inferior    | Sí             |
| `nacelle_izquierdo` | Nacelle · Lado izquierdo   | Sí             |
| `nacelle_trasero`   | Nacelle · Lado trasero     | Sí             |
| `hub`               | Hub (zona hoja)            | Sí             |
| `torre`             | Torre (zona hoja)          | Sí             |

> Las fotos solo se asocian a los códigos marcados "Sí". Palas y Nacelle son solo agrupadores.
> NOTA: `nacelle_superior` (Lado superior / techo) es la PRIMERA sub-zona de Nacelle.

---

## 6. Storage

Bucket **público** `inspection-photos` (el mismo de reparación). Las fotos nativas de limpieza van bajo:

```
cleaning/{campaign_id}/{zone_code}/{filename}
```

Así `storage_path` resuelve a una URL pública (igual que `repairs/...`). Guardar en `cleaning_photo.storage_path` la ruta **completa relativa al bucket** (incluyendo el prefijo `cleaning/...`).

Ejemplo:
```
cleaning/8f3a.../palas_a/IMG_0012.jpg
```

---

## 7. Qué NO debe hacer el app móvil

- **No** escribir `cleaning_photo.metadata.selected_for_report` — eso lo gestiona la web (selección de fotos para el reporte).
- **No** crear la campaña `cleaning` — se crea desde la web.
- **No** poner fotos en los códigos contenedores `palas` ni `nacelle`.

---

## 8. Checklist de implementación (app móvil)

- [ ] Crear tabla `cleaning_photo` con las columnas de §3.
- [ ] Crear el RPC read-only `get_cleaning_photos_by_zone(campaign_id_param uuid)` de §4.
- [ ] Subir las fotos al bucket `inspection-photos` bajo `cleaning/{campaign_id}/{zone_code}/{filename}`.
- [ ] Insertar la fila en `cleaning_photo` con `campaign_id`, `zone_code` (de §5), `storage_path`, `filename`, `capture_order`.
- [ ] (Opcional) generar y subir thumbnail → `thumbnail_path`.
- [ ] Inicializar `metadata` como `{}` (la web agregará `selected_for_report`).

Cualquier duda sobre un campo, comparar 1:1 contra el modelo de reparación ya en producción (`repair_photo` + `get_repair_photos_by_stage`), que tiene exactamente la misma forma.
