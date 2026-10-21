# Contrato de datos — Campañas de "Certificación de polipastos" (hoist_certification)

Instrucciones para el equipo del **app móvil** para enlazar la información de las campañas de certificación de polipastos con la plataforma web.

El flujo es el mismo de reparación/limpieza, renombrado a `hoist_certification`, con una diferencia clave: cada paso contiene **ítems tipados** (Foto / Check / Medición), no solo fotos. La web **solo lee**; el app móvil **escribe** los ítems (checks, mediciones) y las fotos. La web nunca crea ni sube datos de certificación.

---

## 1. Resumen del flujo

1. La campaña de certificación se **crea desde la web** (pestaña "Certificación de polipastos" → botón "Nueva campaña de certificación" → selecciona turbina). Esto inserta una fila en `campaign` con `type = 'hoist_certification'`, `status = 'hoist_open'` y el `turbine_id`.
2. El **app móvil** realiza la inspección por ítems y, por cada ítem con datos, inserta/actualiza una fila en `hoist_cert_item` (estado del check o valor de medición) y sube las fotos al storage + inserta filas en `hoist_cert_photo`.
3. La web lee los ítems y fotos agrupados por paso/ítem vía el RPC `get_hoist_cert_items(campaign_id_param)` y los muestra en el workflow.
4. La selección de fotos para el reporte la escribe **la web** en `hoist_cert_photo.metadata.selected_for_report` (no la toca el app).

> Equivalencia: `cleaning_photo` → `hoist_cert_photo`, `get_cleaning_photos_by_zone` → `get_hoist_cert_items`, `zone_code` → `item_code`. NUEVO respecto a limpieza: la tabla `hoist_cert_item` con el estado tipado (check/medición).

---

## 2. Tabla `campaign` (ya existe, ya ampliada)

- `campaign.type` admite: `'inspection' | 'repair' | 'cleaning' | 'hoist_certification'`
- `campaign.status` admite (para certificación): `'hoist_open' | 'hoist_in_progress' | 'hoist_done'`

El app móvil **no crea** la campaña; solo lee `campaign.id` (el `campaign_id`) y su `turbine_id`.

---

## 3. Tipos de ítem (`item_type`)

| `item_type`     | Qué captura el app móvil                                             | Qué muestra la web                                  |
|-----------------|---------------------------------------------------------------------|-----------------------------------------------------|
| `photo`         | Una o más fotos                                                     | Galería de fotos con selección para reporte         |
| `check`         | Un booleano cumple/no cumple (`passed`). Opcionalmente fotos         | Badge "Cumple" (verde) / "No cumple" (rojo)         |
| `measurement`   | Un valor numérico/texto (`measurement_value`) + fotos               | Valor + unidad y galería de fotos                   |

---

## 4. Tabla a crear: `hoist_cert_item`

Una fila por **ítem con datos** de la campaña (el estado del check o el valor de medición).

| Columna            | Tipo            | Notas                                                            |
|--------------------|-----------------|------------------------------------------------------------------|
| `id`               | `uuid` PK       | `default gen_random_uuid()`                                      |
| `campaign_id`      | `uuid`          | FK → `campaign.id` (de la campaña `type='hoist_certification'`)  |
| `item_code`        | `text`          | **Debe coincidir con los códigos fijos de §7**                   |
| `item_type`        | `text`          | `'photo' \| 'check' \| 'measurement'`                            |
| `passed`           | `boolean` null  | Para `check`: cumple (`true`) / no cumple (`false`) / sin dato (`null`) |
| `measurement_value`| `text` null     | Para `measurement`: el valor (numérico enviado como texto o número) |
| `measurement_unit` | `text` null     | Unidad opcional (ej. `mm`, `%`)                                  |
| `metadata`         | `jsonb`         | Reservado para uso futuro                                        |

> El `item_type` del catálogo web es el autoritativo; el que mande el app es informativo. Aun así, envíenlo coherente con §7.

---

## 5. Tabla a crear: `hoist_cert_photo`

Una fila por **foto**, enlazada al ítem al que pertenece. Espeja `cleaning_photo`.

| Columna          | Tipo            | Notas                                                       |
|------------------|-----------------|-------------------------------------------------------------|
| `id`             | `uuid` PK       | `default gen_random_uuid()`                                 |
| `campaign_id`    | `uuid`          | FK → `campaign.id`                                          |
| `hoist_item_id`  | `uuid` null     | FK → `hoist_cert_item.id` (el ítem dueño de la foto)        |
| `item_code`      | `text`          | **Debe coincidir con los códigos fijos de §7**             |
| `storage_path`   | `text`          | Ruta en el bucket público `inspection-photos` (ver §8)      |
| `thumbnail_path` | `text` null     | Ruta del thumbnail; si es null la web usa la full-size      |
| `filename`       | `text`          | Nombre del archivo                                          |
| `capture_order`  | `int`           | Orden de captura (la web ordena las fotos por este campo asc)|
| `captured_at`    | `timestamptz` null |                                                          |
| `metadata`       | `jsonb`         | `{ "selected_for_report": boolean }` — **lo escribe la web**|

---

## 6. RPC a crear: `get_hoist_cert_items(campaign_id_param uuid)`

Read-only. Devuelve **una fila por ítem que tenga datos** (foto, check o medición), con un array JSON de fotos.

**Columnas de cada fila:**

| Campo               | Tipo          | Notas                                              |
|---------------------|---------------|----------------------------------------------------|
| `hoist_item_id`     | `uuid`        | Id de la instancia de ítem (`hoist_cert_item.id`)  |
| `item_code`         | `text`        | Debe coincidir con los códigos de §7               |
| `item_type`         | `text`        | `'photo' \| 'check' \| 'measurement'`              |
| `item_label`        | `text` null   | Etiqueta opcional (si null, la web usa su label)   |
| `item_order`        | `int` null    |                                                    |
| `passed`            | `boolean` null| Para `check` (y opcionalmente `measurement`)        |
| `measurement_value` | `text` null   | Para `measurement`                                 |
| `measurement_unit`  | `text` null   | Unidad opcional                                    |
| `photo_count`       | `int` null    |                                                    |
| `photos`            | `jsonb`       | Array de objetos foto (ver abajo)                  |

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

> Mientras este RPC o las tablas no existan, la web degrada con gracia: muestra el esqueleto de pasos/ítems vacío. No se rompe. Pero para ver datos, el app debe crear ambos.

---

## 7. Códigos fijos de pasos / sub-grupos / ítems

La estructura es fija e igual para toda turbina. El app debe escribir `item_code` con uno de los **códigos de ítem** (las hojas). Los pasos y sub-grupos son solo agrupadores (NO reciben datos directamente).

### Paso 1 — `preparativos`
| `item_code`              | Ítem                          | Tipo  |
|--------------------------|-------------------------------|-------|
| `prep_viento`            | Viento inferior a 15 m/s      | photo |
| `prep_certificado_peso`  | Certificado de peso patrón    | photo |

### Paso 2 — `inspeccion_visual`
| `item_code`                 | Ítem                          | Tipo  |
|-----------------------------|-------------------------------|-------|
| `visual_caja_cadena`        | Caja de cadena y suspensión   | photo |
| `visual_gancho`             | Gancho                        | photo |
| `visual_goma_plastico`      | Piezas de goma y plásticas    | check |
| `visual_cable_control`      | Cable de control y colgante   | photo |
| `visual_sin_ruido`          | Funcionamiento sin ruido      | check |
| `visual_lubricacion_cadena` | Lubricación de cadena         | check |
| `visual_nivel_aceite`       | Nivel de aceite               | check |
| `visual_switch_limite`      | Switch de límite de carrera   | check |

### Paso 3 — `inspeccion_critica` (con dos sub-grupos)
**Sub-grupo `cadena_carga` (Cadena de carga):**
| `item_code`            | Ítem                                                               | Tipo        |
|------------------------|--------------------------------------------------------------------|-------------|
| `cadena_sin_desgaste`  | Sin desgaste, abrasión, grietas, deformación ni eslabones rígidos  | measurement |
| `cadena_espesor`       | Espesor no inferior al 10%                                         | measurement |
| `cadena_alargamiento`  | Alargamiento no mayor al 5% o 2% en 11 eslabones                   | measurement |
| `cadena_rueda_guia`    | Rueda y guía de cadena sin desgaste excesivo                       | photo       |

**Sub-grupo `ojales_aluminio` (Ojales de aluminio fundido):**
| `item_code`                 | Ítem                                                      | Tipo  |
|-----------------------------|-----------------------------------------------------------|-------|
| `ojales_tintas_penetrantes` | Inspección de grietas tintas penetrantes                  | photo |
| `ojales_arandela_seguro`    | Reemplazar arandela y seguro                              | photo |
| `ojales_distancia`          | Medir distancia de ojales y suspensión (menor a 2mm)      | check |

### Paso 4 — `verificacion_torques`
| `item_code`              | Ítem                          | Tipo  |
|--------------------------|-------------------------------|-------|
| `torque_caja_cadena`     | Caja de cadena y suspensión   | check |
| `torque_viga_transversal`| Viga transversal              | check |

### Paso 5 — `prueba_carga`
| `item_code`        | Ítem                          | Tipo  |
|--------------------|-------------------------------|-------|
| `carga_dinamica`   | Prueba dinámica               | check |
| `carga_estatica`   | Prueba estática (peso patrón) | check |

### Paso 6 — `certificacion_cierre`
| `item_code`        | Ítem                                    | Tipo  |
|--------------------|-----------------------------------------|-------|
| `cierre_pegatina`  | Pegatina de certificación (verde ó rojo)| photo |

> Códigos de paso (agrupadores, NO reciben datos): `preparativos`, `inspeccion_visual`, `inspeccion_critica`, `verificacion_torques`, `prueba_carga`, `certificacion_cierre`.
> Códigos de sub-grupo (agrupadores, NO reciben datos): `cadena_carga`, `ojales_aluminio`.

---

## 8. Storage

Bucket **público** `inspection-photos` (el mismo de reparación/limpieza). Las fotos de certificación van bajo:

```
hoist/{campaign_id}/{item_code}/{filename}
```

Así `storage_path` resuelve a una URL pública. Guardar en `hoist_cert_photo.storage_path` la ruta **completa relativa al bucket** (incluyendo el prefijo `hoist/...`).

Ejemplo:
```
hoist/8f3a.../prep_viento/IMG_0007.jpg
```

---

## 9. Qué NO debe hacer el app móvil

- **No** escribir `hoist_cert_photo.metadata.selected_for_report` — eso lo gestiona la web.
- **No** crear la campaña `hoist_certification` — se crea desde la web.
- **No** poner datos/fotos en los códigos de paso ni de sub-grupo (solo en los `item_code` hoja de §7).

---

## 10. Checklist de implementación (app móvil)

- [ ] Crear tabla `hoist_cert_item` (§4) y `hoist_cert_photo` (§5).
- [ ] Crear el RPC read-only `get_hoist_cert_items(campaign_id_param uuid)` (§6).
- [ ] Por cada ítem evaluado, insertar/actualizar `hoist_cert_item` con `campaign_id`, `item_code` (de §7), `item_type`, y según el tipo: `passed` (check) o `measurement_value` + `measurement_unit` (medición).
- [ ] Subir las fotos al bucket `inspection-photos` bajo `hoist/{campaign_id}/{item_code}/{filename}`.
- [ ] Insertar la fila en `hoist_cert_photo` con `campaign_id`, `hoist_item_id`, `item_code`, `storage_path`, `filename`, `capture_order`.
- [ ] (Opcional) generar y subir thumbnail → `thumbnail_path`.
- [ ] Inicializar `metadata` de las fotos como `{}` (la web agregará `selected_for_report`).

Cualquier duda sobre un campo, comparar 1:1 contra el modelo de limpieza ya en producción (`cleaning_photo` + `get_cleaning_photos_by_zone`), que tiene la misma forma salvo por la tabla extra `hoist_cert_item` con el estado tipado.
