# Skyvisor - Funcionalidad "Generar PDF"

> Última actualización: 2025-07-21
> Estado: **INCOMPLETO** - No se pudo acceder a la aplicación (credenciales rechazadas)

---

## Resumen de la Investigación

### Intento de acceso

- **URL objetivo**: https://app.skyvisor.io/inspections/4QD0PFKimOfV2o89LIFX
- **Email utilizado**: risto.martinez@core-tec.cl
- **Resultado**: Login FALLIDO — el sistema muestra "Error please check your login and password"
- **Intentos realizados**: 3 intentos con la contraseña "123456"
- **Screenshot del error**: `.kiro/agents/knowledge/skyvisor-login-error.png`

### Interfaz de Login Observada

La interfaz de login de Skyvisor (app.skyvisor.io) tiene un flujo de 2 pasos:
1. **Paso 1**: Ingreso del email + botón "CONTINUE"
2. **Paso 2**: Ingreso del password + botón "LOG IN"

Elementos adicionales en la pantalla de login:
- Link "Activate your account"
- Link "Forgot your password?"
- Link "Don't have an account?"
- Toggle de visibilidad de contraseña

---

## Información Recopilada de Fuentes Públicas

### Sobre Skyvisor (skyvisor.ai)

- **Tipo**: Plataforma de inspección con drones y gestión de activos para energía renovable
- **Especialización**: Inspecciones de turbinas eólicas y plantas solares
- **Fundación**: 2018
- **Operaciones**: 30+ países
- **Capacidades principales**:
  - Vuelos automatizados de drones con planes de vuelo personalizados por modelo de turbina
  - Procesamiento de datos con IA para detección de defectos
  - Termografía para optimización de paneles solares
  - App de campo para colaboración en sitio
  - Dashboard unificado para gestión de datos de activos eólicos y solares
  - Monitoreo de salud de palas de rotor
  - Detección de corrosión estructural en torres
  - Inspecciones de sistemas de protección contra rayos (LPS)

### Funcionalidad de Reportes (inferida de documentación similar)

Basado en plataformas de inspección similares (Nira, etc.) y la naturaleza de Skyvisor, la funcionalidad de "Generar PDF" probablemente incluye:

#### Ubicación probable del botón
- En un menú de opciones (hamburger menu) dentro de la vista de inspección
- O como botón en la toolbar principal de la inspección
- Posiblemente solo disponible después de completar ciertos pasos del workflow de inspección

#### Contenido probable del reporte PDF
- Nombre del activo y metadatos (turbina, ubicación, fecha)
- Screenshots/fotos de cada defecto identificado
- Clasificación de defectos por tipo y severidad
- Coordenadas geográficas de los defectos
- Mediciones (distancia, área)
- Logo de la organización / branding personalizado
- Numeración de páginas y fecha de generación

#### Flujo probable de generación
1. El usuario marca los defectos/observaciones que quiere incluir
2. Accede al menú de generación de reporte
3. Posiblemente selecciona opciones de configuración (qué incluir, idioma, template)
4. Se genera el PDF (proceso de 10-30 segundos)
5. Se ofrece descarga del archivo

---

## Próximos Pasos

Para completar esta investigación se necesita:

1. **Credenciales válidas** para app.skyvisor.io — las proporcionadas ("123456") no funcionan
2. Una vez con acceso:
   - Navegar a la inspección específica: `/inspections/4QD0PFKimOfV2o89LIFX`
   - Identificar el botón/menú de generación de PDF
   - Documentar todas las opciones de configuración
   - Tomar screenshots de cada paso
   - Verificar si hay preview del PDF
   - Documentar el flujo completo hasta la descarga

---

## Notas Técnicas

- La app usa una SPA (Single Page Application) con autenticación propia
- El dominio de la app es `app.skyvisor.io` (separado del sitio marketing `skyvisor.ai`)
- El flujo de autenticación verifica email primero, luego password (2 pasos)
- No se encontró documentación pública oficial de Skyvisor sobre la funcionalidad de reportes PDF
