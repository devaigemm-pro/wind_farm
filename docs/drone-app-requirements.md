# Documento de Requerimientos — Aplicación Drone DJI Matrice 4E
## Inspección Automatizada de Turbinas Eólicas

**Proyecto**: CORE Insight — Módulo de Captura en Campo  
**Versión**: 1.0  
**Fecha**: 2026-08-26  
**Plataforma destino**: DJI Matrice 4E (Android — DJI MSDK V5)  
**Relación con sistema existente**: Integración directa con la plataforma web CORE Insight (Supabase + React)

---

## 1. Contexto y Propósito

La plataforma web CORE Insight ya gestiona el ciclo completo de inspección de palas eólicas: creación de campañas, visualización/anotación de fotos, análisis de defectos y generación de reportes PDF/XLSX.

Esta aplicación para el drone DJI Matrice 4E es el **componente de captura en campo** que alimenta la plataforma. Su función es:

1. Ejecutar planes de vuelo automatizados alrededor de turbinas eólicas
2. Capturar fotografías de alta resolución de cada cara de cada pala
3. Subir las fotos organizadas (por pala/cara/posición radial) a la plataforma
4. Sincronizar el estado de la campaña con la plataforma web

---

## 2. Arquitectura del Sistema Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE Insight Platform (Web)                    │
│  React + Vite + MUI │ Supabase (Auth + DB + Storage + RLS)      │
│  Vercel (deploy)    │ 4 Steps: INSPECT → ANNOTATE → ANALYZE →  │
│                     │          RESULTS                           │
└────────────────────────────────────┬────────────────────────────┘
                                     │ Supabase REST API + Storage API
                                     │ (Auth via JWT — email/password)
                                     │
┌────────────────────────────────────┴────────────────────────────┐
│              App Drone DJI Matrice 4E (este documento)           │
│  Android (Kotlin/Java) │ DJI MSDK V5                            │
│  Plan de vuelo auto    │ Captura fotos                          │
│  Upload a Supabase     │ Sync estado campaña                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Hardware de Referencia — DJI Matrice 4E

| Característica | Especificación |
|---|---|
| Cámara gran angular | 4/3" CMOS, 20MP, f/2.8-f/11, obturador mecánico |
| Cámara tele media | 1/1.3" CMOS, 48MP, 70mm equiv., f/2.8 |
| Cámara tele larga | 1/1.5" CMOS, 48MP, 168mm equiv. |
| Telémetro láser | Hasta 1,800m |
| Tiempo de vuelo | ~42 minutos |
| Velocidad máx. mapeo | 21 m/s |
| Intervalo disparo mín. | 0.5 segundos |
| RTK integrado | Sí (precisión centimétrica) |
| SDK soportado | DJI MSDK V5 (Android — Kotlin/Java) |
| Waypoint missions | Sí — via KMZ/Wayline con IWaypointMissionManager |

---

## 4. Requerimientos Funcionales

### 4.1 Autenticación y Conexión con la Plataforma

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-001 | Login con credenciales CORE Insight | La app debe autenticar al operador usando email + password contra Supabase Auth (`POST /auth/v1/token?grant_type=password`). El token JWT resultante se usa para todas las operaciones subsecuentes. |
| RF-002 | Persistencia de sesión | El token debe renovarse automáticamente. Si no hay conectividad, la sesión local debe mantenerse válida para operar offline y sincronizar después. |
| RF-003 | Roles permitidos | Solo usuarios con role `inspector` o `admin` pueden operar la app del drone. Validar contra tabla `profiles.role`. |
| RF-004 | Indicador de conectividad | Mostrar estado de conexión con la plataforma (online/offline/syncing). |

### 4.2 Selección de Campaña e Inspección

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-010 | Listar campañas activas | Obtener campañas del usuario con status `awaiting_photos` o `photos_uploaded`. Query: `campaign` filtrado por `created_by` = user.id o inspecciones asignadas. |
| RF-011 | Crear nueva campaña | Permitir crear campaña nueva desde la app: seleccionar wind_farm → turbinas → tipo inspección → nombre. Usa el mismo flujo que `newInspectionService.createCampaignWithInspections()`. |
| RF-012 | Mostrar información de turbina | Mostrar: nombre, modelo, potencia (kW), coordenadas GPS, número de palas, serial de cada pala, dirección de rotación (`anticlockwise`). |
| RF-013 | Mostrar progreso de captura | Indicar % de fotos capturadas por blade/face usando `droneUploadService.getUploadProgress(campaignId)`. |
| RF-014 | Seleccionar turbina de la campaña | Si la campaña tiene múltiples turbinas, permitir seleccionar cuál inspeccionar primero. |

### 4.3 Plan de Vuelo Automatizado

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-020 | Generación automática de plan de vuelo | Generar waypoints automáticamente basándose en: (1) modelo de turbina/longitud de pala, (2) coordenadas GPS de la turbina, (3) número de palas (siempre 3), (4) caras a inspeccionar (LE, TE, SS, PS). |
| RF-021 | Parámetros configurables por modelo | El plan de vuelo debe adaptarse según el modelo de turbina. Parámetros por modelo: altura del hub, longitud de pala, diámetro del rotor, distancia óptima de captura (3-5m), overlap entre fotos (70-80%). Estos parámetros se almacenan en una tabla `turbine_model_config` o similar. |
| RF-022 | Patrón de vuelo por cara | Para cada cara de cada pala, el drone debe volar una trayectoria lineal (root → tip o tip → root) capturando fotos a intervalos regulares. La posición radial se calcula como fracción normalizada (0.0 = root, 1.0 = tip). |
| RF-023 | Secuencia de captura | Orden sugerido por pala: LE → TE → SS → PS (consistente con el orden del sidebar de la plataforma web). Cada cara se recorre completa antes de pasar a la siguiente. |
| RF-024 | Visualización del plan en mapa | Mostrar waypoints sobre mapa (DJI MapWidget o similar) antes de ejecutar. Permitir ajustar manualmente si es necesario. |
| RF-025 | Ejecución vía Wayline Mission | Usar `IWaypointMissionManager` de MSDK V5 para: generar KMZ → cargar misión → ejecutar → monitorear progreso → actions (disparar cámara en cada waypoint). |
| RF-026 | Pausa y reanudación | El operador debe poder pausar la misión (hover), reanudar, o cancelar en cualquier momento. |
| RF-027 | RTK para posicionamiento preciso | Usar módulo RTK integrado del Matrice 4E para precisión centimétrica en waypoints. Cada foto debe registrar coordenadas con precisión RTK. |
| RF-028 | Distancia a la pala | Mantener distancia constante de 3-5m de la superficie de la pala. Usar telémetro láser para ajuste en tiempo real si es posible. |
| RF-029 | Orientación de cámara | El gimbal debe orientarse siempre perpendicular a la superficie de la pala que se está inspeccionando. Ajustar pitch/yaw según la cara (LE/TE requieren orientación frontal, SS/PS requieren orientación lateral). |
| RF-030 | Fotos por cara/pala | Cantidad configurable. Default: ~15-25 fotos por cara dependiendo de la longitud de pala. Fórmula: `ceil(blade_length_m / (FOV_width_at_distance * (1 - overlap)))`. |

### 4.4 Captura de Fotografías

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-040 | Cámara preferida | Usar la cámara tele media (70mm, 48MP) para capturas de inspección. Alternativa: tele larga (168mm) para close-ups de defectos visibles. |
| RF-041 | Resolución y formato | Captura en JPEG de máxima calidad. Tamaño esperado: 10-15 MB por foto. Formato: `image/jpeg`. |
| RF-042 | Metadatos EXIF | Cada foto debe incluir en su EXIF: coordenadas GPS (con precisión RTK), altitud, timestamp, orientación del gimbal (pitch/roll/yaw), modelo de cámara, focal length. |
| RF-043 | Naming convention | Filename: `{blade_serial}_{face}_{flight_plan_order:03d}.jpg` — Ejemplo: `BL-A001_leading_edge_007.jpg` |
| RF-044 | Thumbnail en tiempo real | Generar thumbnail de cada foto capturada (300x300px, quality 70%) para preview inmediato en la app y para subir como `thumbnail_path`. |
| RF-045 | Verificación de calidad | Validar que cada foto no esté borrosa (sharpness score) ni sobreexpuesta/subexpuesta (histogram check). Si no pasa validación → marcar para re-captura. |
| RF-046 | Metadatos adicionales (JSON) | Almacenar en campo `metadata` del registro: `{ gimbal_pitch, gimbal_yaw, altitude_agl, distance_to_blade, rtk_accuracy, sharpness_score, wind_speed_estimate }`. |

### 4.5 Upload y Sincronización con Plataforma

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-050 | Upload directo a Supabase Storage | Subir cada foto al bucket `inspection-photos` con path: `{campaign_id}/{blade_id}/{face}/{flight_plan_order}_{filename}`. |
| RF-051 | Registro en tabla inspection_photo | Después del upload exitoso, insertar registro en `inspection_photo` con todos los campos del `DroneUploadPayload`: `campaignId`, `bladeId`, `face`, `radialPosition`, `flightPlanOrder`, `filename`, `capturedAt`, `metadata`. |
| RF-052 | Upload del thumbnail | Subir thumbnail a path: `{campaign_id}/{blade_id}/{face}/thumb_{flight_plan_order}_{filename}` y guardar en campo `thumbnail_path`. |
| RF-053 | Batch upload | Si no hay conectividad durante el vuelo, almacenar fotos localmente y sincronizar en lote cuando se recupere conexión. Usar `droneUploadService.registerPhotoBatch()` para registro masivo. |
| RF-054 | Progreso de upload | Mostrar barra de progreso: X de Y fotos subidas, velocidad de transferencia, tiempo estimado restante. |
| RF-055 | Retry con backoff | Si un upload falla, reintentar con exponential backoff (1s, 2s, 4s, 8s, max 30s). Máximo 5 intentos por foto. |
| RF-056 | Transición de stage automática | Al subir la primera foto, la inspección asociada transiciona automáticamente de `planned` → `inspect` (ya implementado en el backend). |
| RF-057 | Actualización de campaign status | Al completar todas las fotos de todas las turbinas de la campaña, actualizar status a `photos_uploaded` via `droneUploadService.updateCampaignStatus(campaignId, 'photos_uploaded')`. |
| RF-058 | Validación de integridad | Después del upload, verificar que el count de fotos en BD coincide con el count local. Si hay discrepancia, re-subir las faltantes. |

### 4.6 Modo Offline

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-060 | Operación sin conexión | La app debe poder ejecutar vuelos completos sin conexión a internet. Las fotos se almacenan localmente con su metadata completa. |
| RF-061 | Cola de sincronización | Mantener una cola persistente (SQLite local) de operaciones pendientes: uploads de fotos, registros de DB, actualizaciones de status. |
| RF-062 | Sincronización automática | Al recuperar conexión, procesar la cola automáticamente en orden. Mostrar progreso. |
| RF-063 | Almacenamiento local | Capacidad para almacenar al menos 2000 fotos de 15MB cada una (~30GB). Verificar espacio disponible antes de iniciar misión. |

### 4.7 Interfaz de Usuario en Tableta/Control Remoto

| RF-ID | Requerimiento | Detalle |
|---|---|---|
| RF-070 | Dashboard de misión | Pantalla principal con: mapa con waypoints, video FPV en vivo, estado de batería, progreso de fotos capturadas/pendientes. |
| RF-071 | Panel de control de misión | Botones: Start, Pause, Resume, Cancel, Return-to-Home. Estado visible de la misión activa. |
| RF-072 | Preview de fotos | Mostrar thumbnails de las últimas fotos capturadas con indicador de calidad (OK/blur/exposure). |
| RF-073 | Vista de progreso por pala | Grid visual mostrando: Blade A/B/C × LE/TE/SS/PS con conteo de fotos capturadas vs esperadas. Verde = completa, amarillo = parcial, rojo = sin fotos. |
| RF-074 | Configuración de plan | Pantalla de configuración donde el operador ajusta: distancia a pala, overlap, cámara preferida, velocidad de vuelo. |
| RF-075 | Log de actividad | Panel de logs en tiempo real con eventos: "Foto 12/25 capturada — Blade A, LE", "Upload OK", "Error: retry…". |
| RF-076 | Idioma | Español e inglés (consistente con la plataforma web que ya tiene i18n). |

---

## 5. Requerimientos Técnicos

### 5.1 Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Plataforma | Android (mín. API 26 / Android 8.0) |
| Lenguaje | Kotlin (preferido) + Java (interop con MSDK) |
| SDK del drone | DJI Mobile SDK V5 (MSDK V5) |
| Backend | Supabase (mismo proyecto: `xyzcompany.supabase.co`) |
| Auth | Supabase Auth — JWT via email/password |
| Storage | Supabase Storage — bucket `inspection-photos` |
| Base de datos | Supabase PostgreSQL (tablas: `inspection_photo`, `campaign`, `inspection`, `blade`, `turbine`) |
| Base local | Room (SQLite) para cola offline y cache |
| HTTP client | OkHttp / Retrofit (para Supabase REST) |
| Maps | DJI MapWidget (Google Maps o Mapbox integrado) |
| Image processing | Android BitmapFactory + custom sharpness detection |
| Arquitectura | MVVM + Clean Architecture + Coroutines |

### 5.2 Contrato de Datos — Interfaces de Integración

#### 5.2.1 DroneUploadPayload (lo que la app envía por cada foto)

```typescript
interface DroneUploadPayload {
  campaignId: string;      // UUID de la campaña activa
  bladeId: string;         // UUID de la pala que se está inspeccionando
  face: BladeFace;         // 'leading_edge' | 'trailing_edge' | 'suction_side' | 'pressure_side'
  radialPosition: number;  // 0.0 (root) a 1.0 (tip) — posición normalizada
  flightPlanOrder: number; // Orden secuencial global dentro de la misión (1, 2, 3...)
  filename: string;        // Nombre del archivo con convención
  capturedAt?: string;     // ISO 8601 timestamp del momento de captura
  metadata?: {             // Datos adicionales del vuelo
    gimbal_pitch: number;
    gimbal_yaw: number;
    gimbal_roll: number;
    altitude_agl: number;         // Altura sobre el terreno (m)
    altitude_msl: number;         // Altura sobre nivel del mar (m)
    distance_to_blade: number;    // Distancia al objetivo medida por telémetro (m)
    rtk_accuracy_h: number;       // Precisión horizontal RTK (m)
    rtk_accuracy_v: number;       // Precisión vertical RTK (m)
    latitude: number;
    longitude: number;
    wind_speed_ms: number;        // Velocidad del viento estimada (m/s)
    sharpness_score: number;      // 0-100
    battery_percent: number;
    camera_focal_mm: number;
    iso: number;
    shutter_speed: string;        // "1/1000"
  };
}
```

#### 5.2.2 InspectionPhoto (lo que retorna después del upload)

```typescript
interface InspectionPhoto {
  id: string;                     // UUID generado por la BD
  campaignId: string;
  inspectionId: string | null;    // Se asocia automáticamente vía campaign → inspection
  bladeId: string;
  face: BladeFace;
  radialPosition: number;
  flightPlanOrder: number;
  storagePath: string;            // Path completo en Supabase Storage
  filename: string;
  thumbnailPath: string | null;   // Path del thumbnail en storage
  widthPx: number | null;
  heightPx: number | null;
  capturedAt: string | null;
  uploadedAt: string;             // Timestamp de upload a la BD
  analyzed: boolean;              // false por defecto — se marca true desde la web
  metadata: Record<string, unknown>;
}
```

#### 5.2.3 BladeFace (enum de caras)

```typescript
type BladeFace = 'leading_edge' | 'trailing_edge' | 'suction_side' | 'pressure_side';
```

#### 5.2.4 CampaignStatus (estados del workflow del drone)

```typescript
type CampaignStatus = 'awaiting_photos' | 'photos_uploaded' | 'annotating' | 'completed';
```

#### 5.2.5 BladeUploadProgress (progreso reportado)

```typescript
interface BladeUploadProgress {
  bladeId: string;
  bladePosition: number;  // 1=A, 2=B, 3=C
  face: BladeFace;
  photoCount: number;
  analyzedCount: number;
}
```

### 5.3 Storage — Convención de Paths

```
Bucket: inspection-photos

Estructura:
inspection-photos/
├── {campaign_id}/
│   ├── {blade_id_A}/
│   │   ├── leading_edge/
│   │   │   ├── 001_BL-A001_leading_edge_001.jpg
│   │   │   ├── 002_BL-A001_leading_edge_002.jpg
│   │   │   ├── thumb_001_BL-A001_leading_edge_001.jpg
│   │   │   └── ...
│   │   ├── trailing_edge/
│   │   ├── suction_side/
│   │   └── pressure_side/
│   ├── {blade_id_B}/
│   │   └── ...
│   └── {blade_id_C}/
│       └── ...
```

### 5.4 Endpoints de Supabase Consumidos

| Operación | Método | Endpoint | Auth |
|---|---|---|---|
| Login | POST | `/auth/v1/token?grant_type=password` | No (obtiene JWT) |
| Refresh token | POST | `/auth/v1/token?grant_type=refresh_token` | Bearer JWT |
| Get profile | GET | `/rest/v1/profiles?id=eq.{userId}` | Bearer JWT |
| List campaigns | GET | `/rest/v1/campaign?created_by=eq.{userId}` | Bearer JWT |
| Create campaign | POST | `/rest/v1/campaign` | Bearer JWT |
| Create inspection | POST | `/rest/v1/inspection` | Bearer JWT |
| Get turbines of farm | GET | `/rest/v1/turbine?wind_farm_id=eq.{farmId}&select=*,blade(*)` | Bearer JWT |
| Upload photo file | POST | `/storage/v1/object/inspection-photos/{path}` | Bearer JWT |
| Register photo record | POST | `/rest/v1/inspection_photo` | Bearer JWT |
| Batch register photos | POST | `/rest/v1/inspection_photo` (bulk insert) | Bearer JWT |
| Get upload progress | POST | `/rest/v1/rpc/get_campaign_upload_progress` | Bearer JWT |
| Update campaign status | PATCH | `/rest/v1/campaign?id=eq.{id}` | Bearer JWT |
| Update inspection stage | PATCH | `/rest/v1/inspection?id=eq.{id}` | Bearer JWT |

### 5.5 Tabla de Plan de Vuelo por Modelo (nueva tabla sugerida)

```sql
CREATE TABLE turbine_model_flight_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE,        -- Ej: "Vestas V90", "Siemens SG 3.4-132"
  hub_height_m NUMERIC NOT NULL,          -- Altura del hub (ej: 80m)
  rotor_diameter_m NUMERIC NOT NULL,      -- Diámetro del rotor (ej: 90m)
  blade_length_m NUMERIC NOT NULL,        -- Longitud de pala (ej: 44m)
  capture_distance_m NUMERIC DEFAULT 4,   -- Distancia drone-pala (ej: 4m)
  overlap_percent NUMERIC DEFAULT 75,     -- Overlap entre fotos (%)
  photos_per_face INTEGER DEFAULT 20,     -- Fotos por cara estimadas
  preferred_camera TEXT DEFAULT 'tele_70mm',  -- 'wide_24mm' | 'tele_70mm' | 'tele_168mm'
  flight_speed_ms NUMERIC DEFAULT 2,      -- Velocidad de vuelo (m/s)
  gimbal_pitch_le NUMERIC DEFAULT -90,    -- Pitch para Leading Edge
  gimbal_pitch_te NUMERIC DEFAULT -90,    -- Pitch para Trailing Edge
  gimbal_pitch_ss NUMERIC DEFAULT 0,      -- Pitch para Suction Side
  gimbal_pitch_ps NUMERIC DEFAULT 0,      -- Pitch para Pressure Side
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.6 Seguridad

| Aspecto | Implementación |
|---|---|
| Auth tokens | JWT de Supabase con refresh automático. Token almacenado en Android Keystore (no SharedPreferences). |
| RLS | Las Row Level Security policies de Supabase aplican: un inspector solo ve las campañas/inspecciones donde es `inspector_id` o `created_by`. |
| HTTPS | Todas las comunicaciones con Supabase son HTTPS obligatorio. |
| Datos locales | Las fotos almacenadas localmente deben cifrarse si el dispositivo no tiene cifrado completo de disco. |
| Permisos Android | Camera, Storage, Location (Fine + Background), Internet, ACCESS_NETWORK_STATE. |

### 5.7 Rendimiento y Límites

| Métrica | Valor |
|---|---|
| Tamaño máx. por foto | 20 MB (límite del bucket `inspection-photos`) |
| Timeout de upload | 60 segundos por foto |
| Batch máximo | 50 registros por insert batch |
| Fotos por inspección típica | 60-100 (3 palas × 4 caras × 5-8 fotos) |
| Fotos por campaña típica | 300-1000 (según turbinas seleccionadas) |
| Ancho de banda mínimo recomendado | 5 Mbps upload para sync en tiempo real |

---

## 6. Plan de Vuelo — Algoritmo de Generación de Waypoints

### 6.1 Inputs del Algoritmo

```
- turbine_lat, turbine_lng     → Posición GPS de la turbina
- hub_height_m                 → Altura del centro del rotor
- blade_length_m               → Longitud de cada pala
- capture_distance_m           → Distancia al objetivo (3-5m)
- blade_positions[]            → Ángulos actuales de las palas (0°, 120°, 240° o ajustados)
- vertical_blade               → Cuál pala está arriba (A, B o C)
- faces_to_inspect[]           → ['LE', 'TE', 'SS', 'PS']
- photos_per_face              → Cantidad de fotos por cara
- flight_speed_ms              → Velocidad de desplazamiento
```

### 6.2 Lógica del Plan (pseudocódigo)

```
PARA CADA pala IN [A, B, C]:
  PARA CADA cara IN [LE, TE, SS, PS]:
    // Calcular posición offset según la cara
    offset_direction = get_camera_offset(cara, blade_angle)
    
    // Generar waypoints desde raíz hasta punta
    PARA i = 0 TO photos_per_face - 1:
      radial_fraction = i / (photos_per_face - 1)  // 0.0 → 1.0
      
      // Posición a lo largo de la pala
      point_on_blade = hub_center + (blade_direction * radial_fraction * blade_length)
      
      // Offset para posicionar el drone frente a la cara correcta
      drone_position = point_on_blade + (offset_direction * capture_distance)
      
      waypoint = {
        lat: drone_position.lat,
        lng: drone_position.lng,
        altitude: drone_position.alt,
        gimbal_pitch: config.gimbal_pitch[cara],
        gimbal_yaw: calculate_yaw_to_face_blade(drone_position, point_on_blade),
        actions: [TAKE_PHOTO],
        flight_plan_order: global_counter++,
        metadata: { blade, cara, radial_fraction }
      }
      
      waypoints.add(waypoint)
```

### 6.3 Prerequisitos para el Vuelo

1. **Turbina detenida y bloqueada** — Las palas NO deben rotar durante la inspección
2. **Pala vertical identificada** — El operador confirma cuál pala está en posición vertical (12 o'clock). Esto se registra en `inspection.vertical_blade` y es usado por la plataforma web para el blade diagram.
3. **Viento < 12 m/s** — Por seguridad operacional
4. **Batería > 80%** — No iniciar misión con menos
5. **RTK fix adquirido** — Precisión horizontal < 0.02m

---

## 7. Flujo Operativo Completo

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. PREPARACIÓN (en oficina o base)                                │
├──────────────────────────────────────────────────────────────────┤
│ • Login en la app                                                 │
│ • Crear campaña o seleccionar campaña existente                   │
│ • Verificar que turbinas asignadas tienen datos correctos         │
│ • Pre-generar planes de vuelo (se pueden ajustar en campo)        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. EN CAMPO — PRE-VUELO                                           │
├──────────────────────────────────────────────────────────────────┤
│ • Confirmar turbina detenida y pala vertical                      │
│ • Adquirir RTK fix                                                │
│ • Verificar condiciones meteorológicas (viento, visibilidad)      │
│ • Revisar plan de vuelo en mapa — ajustar si necesario            │
│ • Verificar espacio de almacenamiento local                       │
│ • Confirmar batería y estado del drone                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. EJECUCIÓN DEL VUELO                                            │
├──────────────────────────────────────────────────────────────────┤
│ • Despegue automático a altura segura                             │
│ • Navegación a primer waypoint                                    │
│ • Captura secuencial: pala por pala, cara por cara                │
│ • Verificación de calidad en tiempo real                          │
│ • Si batería < 25% → Return to Home, recargar, continuar         │
│ • Aterrizaje automático al completar                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. POST-VUELO — SINCRONIZACIÓN                                    │
├──────────────────────────────────────────────────────────────────┤
│ • Upload de fotos a Supabase Storage (automático o manual)        │
│ • Registro de metadata en tabla inspection_photo                  │
│ • Verificación de integridad (count local = count BD)             │
│ • Actualizar campaign status → 'photos_uploaded'                  │
│ • Generar resumen de misión (duración, fotos, cobertura)          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. PLATAFORMA WEB (ya implementado)                               │
├──────────────────────────────────────────────────────────────────┤
│ • Inspector abre inspección → Stage: INSPECT                      │
│ • Revisa fotos en el sidebar → marca vistas                       │
│ • ANNOTATE: marca defectos sobre las fotos                        │
│ • ANALYZE: confirma y clasifica defectos                          │
│ • RESULTS: genera PDF/XLSX con todo el análisis                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Requerimientos No Funcionales

| NFR-ID | Categoría | Requerimiento |
|---|---|---|
| NFR-001 | Disponibilidad | La app debe funcionar 100% offline para captura. Solo necesita conexión para sync. |
| NFR-002 | Rendimiento | Upload de 100 fotos (15MB c/u) en < 30 minutos con conexión 4G (10 Mbps). |
| NFR-003 | Confiabilidad | Cero pérdida de datos: toda foto capturada debe persistirse localmente ANTES de intentar upload. |
| NFR-004 | Usabilidad | Operación con guantes de trabajo gruesos — botones grandes, áreas touch amplias. |
| NFR-005 | Mantenibilidad | Código modular que permita agregar modelos de turbina sin cambiar lógica core. |
| NFR-006 | Compatibilidad | Compatible con DJI RC Pro Enterprise y Smart Controller Enterprise. |
| NFR-007 | Actualización | OTA updates para la app sin necesidad de conectar al control remoto por USB. |
| NFR-008 | Logging | Registrar telemetría completa de cada vuelo (track GPS, eventos, errores) para auditoría. |
| NFR-009 | Internacionalización | Soporte ES/EN con el mismo sistema de i18n que la plataforma web (keys compatibles). |

---

## 9. Modelo de Datos — Tablas que la App del Drone Consume/Escribe

### Tablas que LEE (solo consulta):
- `profiles` — datos del usuario logueado
- `wind_farm` — lista de parques y coordenadas
- `turbine` — turbinas del parque (nombre, modelo, coords, power_kw, anticlockwise)
- `blade` — palas de cada turbina (position, serial_number, length_meters)
- `turbine_model_flight_config` — **NUEVA** — parámetros de vuelo por modelo

### Tablas que ESCRIBE:
- `campaign` — crear nueva campaña
- `inspection` — crear inspección por turbina (status: in_progress, stage: planned)
- `inspection_photo` — registrar cada foto subida
- `inspection.stage` — actualizar `planned` → `inspect` (automático al primer upload)

### Tablas que ACTUALIZA:
- `campaign.status` — `awaiting_photos` → `photos_uploaded`

### Buckets de Storage que USA:
- `inspection-photos` — upload de fotos y thumbnails

---

## 10. Consideraciones de Integración con la Plataforma Web

| Aspecto | Detalle |
|---|---|
| Mismo proyecto Supabase | La app del drone conecta al MISMO proyecto Supabase que la web. No hay API intermedia. |
| Supabase URL y anon key | Se comparten las mismas credenciales públicas (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). El acceso se controla vía RLS + JWT del usuario. |
| Consistencia de tipos | Los tipos `BladeFace`, `CampaignStatus`, `DroneUploadPayload`, `InspectionPhoto` deben ser idénticos a los de la plataforma web. Se recomienda un paquete compartido o generación desde la BD. |
| Transiciones de stage | El backend ya maneja las transiciones automáticas: primera foto → `inspect`, primera anotación → `annotate`. La app del drone NO necesita forzar transiciones manuales. |
| Thumbnail compatibility | Los thumbnails generados por la app deben seguir la misma convención de naming que los importados (`thumb_{filename}`). El sidebar de la web los busca con ese prefijo. |
| vertical_blade | La app debe registrar qué pala estaba en posición vertical al momento del vuelo. Este dato se usa en la web para orientar el blade diagram correctamente. Se guarda en `inspection.vertical_blade` (campo existente). |
| Orden de fotos | El campo `flight_plan_order` determina el orden de visualización en el sidebar de la web. DEBE ser consecutivo y global (no resetearse por cara). |
| face labels | La web muestra las fotos agrupadas por face en el sidebar: LE → TE → SS → PS. Respetar ese orden en la captura. |

---

## 11. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Pérdida de conexión durante upload | Fotos sin sincronizar | Cola offline + retry automático |
| Batería insuficiente mid-mission | Inspección incompleta | Auto-RTH a 25%, resume en siguiente batería |
| GPS drift sin RTK | Waypoints imprecisos | Validar RTK fix antes de iniciar. Fallback: operador manual. |
| Viento fuerte imprevisto | Fotos borrosas, riesgo de colisión | Monitoreo continuo + abort automático > 12 m/s |
| Turbina no detenida | Colisión con pala | Checklist pre-vuelo obligatorio + confirmación del operador |
| Storage lleno en dispositivo | No puede capturar más | Verificación pre-vuelo + alertas a 80% capacidad |
| API rate limits de Supabase | Uploads bloqueados | Throttling a 5 uploads/segundo, batch cuando sea posible |

---

## 12. Entregables del Nuevo Proyecto

1. **Aplicación Android (APK/AAB)** instalable en DJI RC Pro Enterprise
2. **Módulo de plan de vuelo** (biblioteca reutilizable) que genera KMZ para cualquier modelo de turbina
3. **Módulo de sync** (biblioteca) que maneja la cola offline + upload + retry
4. **Tabla `turbine_model_flight_config`** con seed de los modelos más comunes
5. **Documentación de API** — contrato exacto con Supabase (este documento + OpenAPI spec)
6. **Tests** — Unit tests para algoritmo de waypoints + integration tests para sync con Supabase
7. **Manual de operación** — guía para el piloto/inspector en campo

---

## 13. Dependencias del Proyecto Web (cambios necesarios)

Para la integración completa, el proyecto web actual (`wind_farm`) necesita:

| Cambio | Descripción | Prioridad |
|---|---|---|
| Crear tabla `turbine_model_flight_config` | Almacenar parámetros de vuelo por modelo de turbina | Alta |
| Campo `turbine.model` obligatorio | Actualmente nullable — debe completarse para todas las turbinas | Media |
| RPC `get_campaign_upload_progress` | Ya existe pero no está tipado en `supabase.ts`. Regenerar tipos. | Baja |
| RLS para role drone/inspector | Verificar que las policies permiten INSERT en `inspection_photo` al inspector owner de la campaña | Alta |
| Regenerar `src/types/supabase.ts` | Incluir `inspection_photo` y nuevas tablas en los tipos generados | Media |

---

## 14. Timeline Sugerido

| Fase | Duración | Entregable |
|---|---|---|
| 1. Setup proyecto + MSDK integration | 2 semanas | App base con conexión al drone y login Supabase |
| 2. Plan de vuelo automatizado | 3 semanas | Generación de waypoints + ejecución de misiones |
| 3. Captura y almacenamiento local | 2 semanas | Fotos con metadata + thumbnails + cola offline |
| 4. Sync con plataforma | 2 semanas | Upload + registro + progress + retry |
| 5. UI/UX de operación | 2 semanas | Dashboard, mapa, configuración, preview |
| 6. Testing en campo | 2 semanas | Validación con turbina real, ajustes |
| 7. Integración end-to-end | 1 semana | Flujo completo: drone → web → PDF |

**Total estimado: 14 semanas**

---

*Documento preparado como especificación de referencia para el desarrollo de la aplicación del drone. Todos los contratos de datos son consistentes con la plataforma web CORE Insight v0.1.x actualmente en producción.*
