export type Locale = 'en' | 'es';

type TranslationMap = Record<string, Record<Locale, string>>;

export const translations: TranslationMap = {
  // ─── Sidebar ────────────────────────────────────────────────────────────────
  'sidebar.overview': { en: 'Overview', es: 'Resumen' },
  'sidebar.dashboard': { en: 'Dashboard', es: 'Panel' },
  'sidebar.inspections': { en: 'Inspections', es: 'Inspecciones' },
  'sidebar.reports': { en: 'Reports', es: 'Reportes' },
  'sidebar.windFarms': { en: 'Wind Farms', es: 'Parques Eólicos' },
  'sidebar.assets': { en: 'Assets', es: 'Activos' },
  'sidebar.campaigns': { en: 'Campaigns', es: 'Campañas' },
  'sidebar.profile': { en: 'Profile', es: 'Perfil' },
  'sidebar.logout': { en: 'Logout', es: 'Cerrar Sesión' },
  'sidebar.settings': { en: 'Settings', es: 'Configuración' },
  'sidebar.account': { en: 'Account', es: 'Cuenta' },
  'sidebar.new': { en: 'New', es: 'Nueva' },
  'sidebar.uploader': { en: 'Uploader', es: 'Subida' },
  'sidebar.ongoing': { en: 'Ongoing', es: 'En Curso' },
  'sidebar.expand': { en: 'Expand sidebar', es: 'Expandir barra lateral' },
  'sidebar.collapse': { en: 'Collapse sidebar', es: 'Colapsar barra lateral' },

  // ─── TopBar ─────────────────────────────────────────────────────────────────
  'topbar.notifications': { en: 'Notifications', es: 'Notificaciones' },
  'topbar.userMenu': { en: 'User menu', es: 'Menú de usuario' },
  'topbar.lightMode': { en: 'Light mode', es: 'Modo claro' },
  'topbar.darkMode': { en: 'Dark mode', es: 'Modo oscuro' },
  'topbar.toggleNav': { en: 'Toggle navigation menu', es: 'Alternar menú de navegación' },
  'topbar.language': { en: 'Change language', es: 'Cambiar idioma' },

  // ─── Page Titles ────────────────────────────────────────────────────────────
  'page.dashboard': { en: 'Dashboard', es: 'Panel' },
  'page.windFarms': { en: 'Wind Farms', es: 'Parques Eólicos' },
  'page.turbines': { en: 'Turbines', es: 'Turbinas' },
  'page.inspections': { en: 'Inspections', es: 'Inspecciones' },
  'page.defects': { en: 'Defects', es: 'Defectos' },
  'page.assets': { en: 'Assets', es: 'Activos' },
  'page.profile': { en: 'My profile', es: 'Mi perfil' },
  'page.reports': { en: 'Reports', es: 'Reportes' },
  'page.ongoingInspections': { en: 'Ongoing Inspections', es: 'Inspecciones en Curso' },
  'page.newInspection': { en: 'Create new inspection', es: 'Crear nueva inspección' },
  'page.uploadStatus': { en: 'Upload Status', es: 'Estado de Subida' },
  'page.sharedResults': { en: 'Shared Inspection Results', es: 'Resultados de Inspección Compartidos' },

  // ─── Tables (generic column headers) ───────────────────────────────────────
  'table.name': { en: 'Name', es: 'Nombre' },
  'table.status': { en: 'Status', es: 'Estado' },
  'table.date': { en: 'Date', es: 'Fecha' },
  'table.actions': { en: 'Actions', es: 'Acciones' },
  'table.photosUploaded': { en: 'Photos uploaded', es: 'Fotos subidas' },
  'table.power': { en: 'Power', es: 'Potencia' },
  'table.size': { en: 'Size', es: 'Tamaño' },
  'table.type': { en: 'Type', es: 'Tipo' },
  'table.severity': { en: 'Severity', es: 'Severidad' },
  'table.nextStep': { en: 'Next step', es: 'Siguiente paso' },
  'table.id': { en: 'ID', es: 'ID' },
  'table.blade': { en: 'Blade', es: 'Pala' },
  'table.farm': { en: 'Farm', es: 'Parque' },
  'table.inspector': { en: 'Inspector', es: 'Inspector' },
  'table.asset': { en: 'Asset', es: 'Activo' },
  'table.turbine': { en: 'Turbine', es: 'Turbina' },
  'table.stage': { en: 'Stage', es: 'Etapa' },
  'table.progress': { en: 'Progress', es: 'Progreso' },
  'table.model': { en: 'Model', es: 'Modelo' },
  'table.category': { en: 'Category', es: 'Categoría' },
  'table.action': { en: 'Action', es: 'Acción' },
  'table.side': { en: 'Side', es: 'Cara' },
  'table.resolved': { en: 'Resolved', es: 'Resuelto' },

  // ─── Buttons ────────────────────────────────────────────────────────────────
  'button.export': { en: 'Export', es: 'Exportar' },
  'button.exportList': { en: 'Export List', es: 'Exportar Lista' },
  'button.filter': { en: 'Filter', es: 'Filtrar' },
  'button.search': { en: 'Search', es: 'Buscar' },
  'button.save': { en: 'Save', es: 'Guardar' },
  'button.cancel': { en: 'Cancel', es: 'Cancelar' },
  'button.delete': { en: 'Delete', es: 'Eliminar' },
  'button.edit': { en: 'Edit', es: 'Editar' },
  'button.create': { en: 'Create', es: 'Crear' },
  'button.upload': { en: 'Upload', es: 'Subir' },
  'button.download': { en: 'Download', es: 'Descargar' },
  'button.apply': { en: 'Apply', es: 'Aplicar' },
  'button.clearAll': { en: 'Clear all', es: 'Limpiar todo' },
  'button.share': { en: 'Share', es: 'Compartir' },
  'button.newInspection': { en: 'New Inspection', es: 'Nueva Inspección' },
  'button.addWindFarm': { en: 'Add Wind Farm', es: 'Agregar Parque Eólico' },
  'button.addTurbine': { en: 'Add Turbine', es: 'Agregar Turbina' },
  'button.changePassword': { en: 'Change password', es: 'Cambiar contraseña' },
  'button.updatePassword': { en: 'Update password', es: 'Actualizar contraseña' },
  'button.planInspection': { en: 'Plan a new inspection', es: 'Planificar nueva inspección' },
  'button.planNextInspection': { en: 'PLAN NEXT INSPECTION', es: 'PLANIFICAR PRÓXIMA INSPECCIÓN' },
  'button.startAnalysis': { en: 'Start Analysis', es: 'Iniciar Análisis' },
  'button.selectAll': { en: 'Select all', es: 'Seleccionar todo' },
  'button.createInspection': { en: 'CREATE', es: 'CREAR' },
  'button.signingIn': { en: 'Signing in...', es: 'Iniciando sesión...' },
  'button.signIn': { en: 'Sign in', es: 'Iniciar sesión' },
  'button.addDocument': { en: 'Add Document', es: 'Agregar Documento' },
  'button.turbineSerialNumbers': { en: 'Turbines Serial Numbers', es: 'Números de Serie de Turbinas' },
  'button.view360': { en: 'View 360°', es: 'Ver 360°' },
  'button.exportXlsx': { en: 'Export XLSX for all turbines', es: 'Exportar XLSX para todas las turbinas' },

  // ─── Status ─────────────────────────────────────────────────────────────────
  'status.active': { en: 'Active', es: 'Activo' },
  'status.planned': { en: 'Planned', es: 'Planificado' },
  'status.completed': { en: 'Completed', es: 'Completado' },
  'status.inProgress': { en: 'In Progress', es: 'En Progreso' },
  'status.pending': { en: 'Pending', es: 'Pendiente' },
  'status.analyze': { en: 'Analyze', es: 'Analizar' },
  'status.approved': { en: 'Approved', es: 'Aprobado' },
  'status.awaitingPhotos': { en: 'Awaiting Photos', es: 'Esperando Fotos' },
  'status.photosUploaded': { en: 'Photos Uploaded', es: 'Fotos Subidas' },
  'status.annotating': { en: 'Annotating', es: 'Anotando' },

  // ─── General ────────────────────────────────────────────────────────────────
  'general.loading': { en: 'Loading...', es: 'Cargando...' },
  'general.noData': { en: 'No data', es: 'Sin datos' },
  'general.error': { en: 'Error', es: 'Error' },
  'general.confirm': { en: 'Confirm', es: 'Confirmar' },
  'general.close': { en: 'Close', es: 'Cerrar' },
  'general.back': { en: 'Back', es: 'Atrás' },
  'general.next': { en: 'Next', es: 'Siguiente' },
  'general.previous': { en: 'Previous', es: 'Anterior' },
  'general.unknown': { en: 'Unknown', es: 'Desconocido' },
  'general.of': { en: 'of', es: 'de' },
  'general.items': { en: 'items', es: 'elementos' },
  'general.item': { en: 'item', es: 'elemento' },

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  'dashboard.chartPipeline': { en: 'Inspection Pipeline', es: 'Pipeline de Inspección' },
  'dashboard.chartDefects': { en: 'Defects Spread', es: 'Dispersión de Defectos' },
  'dashboard.chartOperations': { en: 'Inspection Operations', es: 'Operaciones de Inspección' },
  'dashboard.chartSubassets': { en: 'Sub-assets Status', es: 'Estado de Sub-activos' },
  'dashboard.filterTypes': { en: 'Type(s)', es: 'Tipo(s)' },
  'dashboard.filterFarms': { en: 'Farm(s)', es: 'Parque(s)' },
  'dashboard.filterModels': { en: 'Model(s)', es: 'Modelo(s)' },
  'dashboard.filterSeverity': { en: 'Severity', es: 'Severidad' },
  'dashboard.allTypes': { en: 'All Types', es: 'Todos los Tipos' },
  'dashboard.blades': { en: 'Blades', es: 'Palas' },
  'dashboard.tower': { en: 'Tower', es: 'Torre' },
  'dashboard.nacelle': { en: 'Nacelle', es: 'Góndola' },
  'dashboard.allSeverities': { en: 'All', es: 'Todas' },
  'dashboard.severity': { en: 'Severity', es: 'Severidad' },
  'dashboard.allFarms': { en: 'All Farms', es: 'Todos los Parques' },
  'dashboard.allModels': { en: 'All Models', es: 'Todos los Modelos' },

  // ─── Inspections ────────────────────────────────────────────────────────────
  'inspections.allStatuses': { en: 'All Statuses', es: 'Todos los Estados' },
  'inspections.noFound': { en: 'No inspections found', es: 'No se encontraron inspecciones' },
  'inspections.noFoundFilterDesc': { en: 'Try adjusting your filters to find inspections.', es: 'Intenta ajustar tus filtros para encontrar inspecciones.' },
  'inspections.noFoundDesc': { en: 'Create your first inspection to get started.', es: 'Crea tu primera inspección para comenzar.' },
  'inspections.page': { en: 'Page', es: 'Página' },

  // ─── Assets ─────────────────────────────────────────────────────────────────
  'assets.createWindFarm': { en: 'Create Wind Farm', es: 'Crear Parque Eólico' },
  'assets.editWindFarm': { en: 'Edit Wind Farm', es: 'Editar Parque Eólico' },
  'assets.createTurbine': { en: 'Create Turbine', es: 'Crear Turbina' },
  'assets.editTurbine': { en: 'Edit Turbine', es: 'Editar Turbina' },
  'assets.deleteWindFarm': { en: 'Delete Wind Farm', es: 'Eliminar Parque Eólico' },
  'assets.deleteTurbine': { en: 'Delete Turbine', es: 'Eliminar Turbina' },
  'assets.confirmDeleteWindFarm': { en: 'Are you sure you want to delete this wind farm? This action cannot be undone.', es: '¿Estás seguro de que deseas eliminar este parque eólico? Esta acción no se puede deshacer.' },
  'assets.confirmDeleteTurbine': { en: 'Are you sure you want to delete this turbine? This action cannot be undone.', es: '¿Estás seguro de que deseas eliminar esta turbina? Esta acción no se puede deshacer.' },

  // ─── Profile ────────────────────────────────────────────────────────────────
  'profile.accountInfo': { en: 'Account information', es: 'Información de la cuenta' },
  'profile.firstName': { en: 'First name *', es: 'Nombre *' },
  'profile.lastName': { en: 'Last name *', es: 'Apellido *' },
  'profile.email': { en: 'Email', es: 'Correo electrónico' },
  'profile.existingPassword': { en: 'Existing password *', es: 'Contraseña actual *' },
  'profile.newPassword': { en: 'New password *', es: 'Nueva contraseña *' },
  'profile.confirmPassword': { en: 'Confirm new password *', es: 'Confirmar nueva contraseña *' },
  'profile.passwordMinChars': { en: 'Password must have at least 8 characters', es: 'La contraseña debe tener al menos 8 caracteres' },
  'profile.passwordLowercase': { en: 'Password must have at least 1 lowercase character', es: 'La contraseña debe tener al menos 1 carácter en minúscula' },
  'profile.passwordUppercase': { en: 'Password must have at least 1 uppercase character', es: 'La contraseña debe tener al menos 1 carácter en mayúscula' },
  'profile.passwordNumberSpecial': { en: 'Password must have at least 1 number or 1 special character', es: 'La contraseña debe tener al menos 1 número o 1 carácter especial' },
  'profile.passwordsNoMatch': { en: 'Passwords do not match', es: 'Las contraseñas no coinciden' },
  'profile.wind': { en: 'Wind', es: 'Eólico' },
  'profile.solar': { en: 'Solar', es: 'Solar' },
  'profile.noAssets': { en: 'No assets', es: 'Sin activos' },
  'profile.assets': { en: 'assets', es: 'activos' },
  'profile.asset': { en: 'asset', es: 'activo' },
  'profile.totalPower': { en: 'kW of total power', es: 'kW de potencia total' },

  // ─── Wind Farms Dashboard ───────────────────────────────────────────────────
  'windFarms.tabAssets': { en: 'Assets', es: 'Activos' },
  'windFarms.tabDefects': { en: 'Defects', es: 'Defectos' },
  'windFarms.tabGlobalMap': { en: 'Global Map', es: 'Mapa Global' },
  'windFarms.searchPlaceholder': { en: 'Search all and filter', es: 'Buscar y filtrar' },
  'windFarms.noFound': { en: 'No wind farms found', es: 'No se encontraron parques eólicos' },
  'windFarms.noFoundDesc': { en: 'Try adjusting your search to find wind farms.', es: 'Intenta ajustar tu búsqueda para encontrar parques eólicos.' },

  // ─── Wind Farm Detail ───────────────────────────────────────────────────────
  'windFarmDetail.tabGeneral': { en: 'General', es: 'General' },
  'windFarmDetail.tabDefects': { en: 'Defects', es: 'Defectos' },
  'windFarmDetail.deleteCampaign': { en: 'Delete this campaign?', es: '¿Eliminar esta campaña?' },
  'windFarmDetail.noDefectsExport': { en: 'No defects to export', es: 'No hay defectos para exportar' },

  // ─── Subasset Detail ────────────────────────────────────────────────────────
  'subassetDetail.details': { en: 'Details', es: 'Detalles' },
  'subassetDetail.model': { en: 'Model:', es: 'Modelo:' },
  'subassetDetail.latestInspection': { en: 'Latest inspection:', es: 'Última inspección:' },
  'subassetDetail.poweringDate': { en: 'Powering date:', es: 'Fecha de puesta en marcha:' },
  'subassetDetail.power': { en: 'Power:', es: 'Potencia:' },
  'subassetDetail.numberOfInspections': { en: 'Number of inspections:', es: 'Número de inspecciones:' },
  'subassetDetail.inspections': { en: 'Inspections', es: 'Inspecciones' },
  'subassetDetail.noInspections': { en: 'No inspections found for this subasset.', es: 'No se encontraron inspecciones para este sub-activo.' },
  'subassetDetail.windFarm': { en: 'Wind Farm', es: 'Parque Eólico' },
  'subassetDetail.colInspectionDate': { en: 'Inspection Date', es: 'Fecha de Inspección' },
  'subassetDetail.colSubassetName': { en: 'Subasset name', es: 'Nombre del sub-activo' },
  'subassetDetail.colStatus': { en: 'Status', es: 'Estado' },
  'subassetDetail.colType': { en: 'Type', es: 'Tipo' },
  'subassetDetail.colPhotos': { en: 'Photos uploaded', es: 'Fotos subidas' },
  'subassetDetail.colViewed': { en: 'Viewed %', es: '% Visto' },
  'subassetDetail.colDefects': { en: 'Defects', es: 'Defectos' },
  'subassetDetail.colNotes': { en: 'Notes', es: 'Notas' },
  'subassetDetail.colPdf': { en: 'PDF report', es: 'Reporte PDF' },

  // ─── Ongoing Inspections ────────────────────────────────────────────────────
  'ongoing.viewStatus': { en: 'Status', es: 'Estado' },
  'ongoing.viewList': { en: 'List', es: 'Lista' },
  'ongoing.colPlanned': { en: 'Planned', es: 'Planificado' },
  'ongoing.colUpload': { en: 'Upload', es: 'Subida' },
  'ongoing.colAnnotate': { en: 'Annotate', es: 'Anotar' },
  'ongoing.colAnalyze': { en: 'Analyze', es: 'Analizar' },
  'ongoing.colReport': { en: 'Report', es: 'Reporte' },
  'ongoing.actionNew': { en: 'New', es: 'Nueva' },
  'ongoing.actionUpload': { en: 'Upload', es: 'Subir' },
  'ongoing.actionReports': { en: 'Reports', es: 'Reportes' },
  'ongoing.viewed': { en: 'viewed', es: 'visto' },
  'ongoing.noFound': { en: 'No ongoing inspections found', es: 'No se encontraron inspecciones en curso' },

  // ─── Inspection Workflow ────────────────────────────────────────────────────
  'workflow.step1': { en: '1. INSPECT', es: '1. INSPECCIONAR' },
  'workflow.step2': { en: '2. ANNOTATE', es: '2. ANOTAR' },
  'workflow.step3': { en: '3. ANALYZE', es: '3. ANALIZAR' },
  'workflow.step4': { en: '4. RESULTS', es: '4. RESULTADOS' },

  // ─── Turbine Detail ─────────────────────────────────────────────────────────
  'turbineDetail.loadingData': { en: 'Loading inspection data...', es: 'Cargando datos de inspección...' },
  'turbineDetail.noInspections': { en: 'No finalized inspections for this turbine', es: 'No hay inspecciones finalizadas para esta turbina' },
  'turbineDetail.noInspectionsDesc': { en: 'Complete the inspection workflow to view results. The inspection must be finalized before data appears here.', es: 'Completa el flujo de inspección para ver resultados. La inspección debe finalizarse antes de que los datos aparezcan aquí.' },
  'turbineDetail.blades': { en: 'Blades', es: 'Palas' },
  'turbineDetail.statistics': { en: 'Statistics', es: 'Estadísticas' },
  'turbineDetail.details': { en: 'Details', es: 'Detalles' },
  'turbineDetail.defects': { en: 'defects', es: 'defectos' },
  'turbineDetail.resolved': { en: 'resolved', es: 'resueltos' },
  'turbineDetail.conclusion': { en: 'Conclusion', es: 'Conclusión' },
  'turbineDetail.noConclusion': { en: 'No conclusion.', es: 'Sin conclusión.' },
  'turbineDetail.breakdownByBlade': { en: 'Breakdown by blade', es: 'Desglose por pala' },
  'turbineDetail.breakdownByCategory': { en: 'Breakdown by category', es: 'Desglose por categoría' },
  'turbineDetail.breakdownByType': { en: 'Breakdown by type', es: 'Desglose por tipo' },
  'turbineDetail.cat': { en: 'Cat', es: 'Cat' },
  'turbineDetail.defectOverview': { en: 'Defect overview table', es: 'Tabla resumen de defectos' },
  'turbineDetail.defectsDetail': { en: 'Defects Detail', es: 'Detalle de Defectos' },
  'turbineDetail.filterType': { en: 'Type', es: 'Tipo' },
  'turbineDetail.filterCategory': { en: 'Category', es: 'Categoría' },
  'turbineDetail.filterBlade': { en: 'Blade', es: 'Pala' },
  'turbineDetail.filterSide': { en: 'Side', es: 'Cara' },
  'turbineDetail.phase1': { en: '1. INSPECT', es: '1. INSPECCIONAR' },
  'turbineDetail.phase2': { en: '2. ANNOTATE', es: '2. ANOTAR' },
  'turbineDetail.phase3': { en: '3. ANALYZE', es: '3. ANALIZAR' },
  'turbineDetail.phase4': { en: '4. RESULTS', es: '4. RESULTADOS' },

  // ─── Reports ────────────────────────────────────────────────────────────────
  'reports.searchPlaceholder': { en: 'Search all', es: 'Buscar todo' },
  'reports.colInspectionDate': { en: 'Inspection Date', es: 'Fecha de Inspección' },
  'reports.colAsset': { en: 'Asset', es: 'Activo' },
  'reports.colSubAsset': { en: 'SubAsset', es: 'SubActivo' },
  'reports.colType': { en: 'Type', es: 'Tipo' },
  'reports.colDefects': { en: 'Defects', es: 'Defectos' },
  'reports.colNote': { en: 'Note', es: 'Nota' },
  'reports.colPdf': { en: 'PDF report', es: 'Reporte PDF' },
  'reports.noFinalized': { en: 'No finalized inspections', es: 'No hay inspecciones finalizadas' },
  'reports.noFinalizedDesc': { en: 'Reports will appear here once inspections are completed and finalized.', es: 'Los reportes aparecerán aquí una vez que las inspecciones estén completadas y finalizadas.' },
  'reports.rowsPerPage': { en: 'Rows per page:', es: 'Filas por página:' },

  // ─── Campaign Results ───────────────────────────────────────────────────────
  'campaign.selectedTurbinesInfo': { en: 'Only the defects of the selected turbines are displayed', es: 'Solo se muestran los defectos de las turbinas seleccionadas' },
  'campaign.categoryRepartition': { en: 'Turbine defect category repartition', es: 'Distribución de categorías de defectos por turbina' },
  'campaign.typeRepartition': { en: 'Turbine defect type repartition', es: 'Distribución de tipos de defectos por turbina' },

  // ─── Campaign Upload Status ─────────────────────────────────────────────────
  'uploadStatus.waitingDrone': { en: 'Waiting for drone upload', es: 'Esperando subida del dron' },
  'uploadStatus.waitingDroneDesc': { en: 'The system is polling every 10 seconds for incoming photos.', es: 'El sistema consulta cada 10 segundos por fotos entrantes.' },
  'uploadStatus.totalPhotos': { en: 'Total Photos', es: 'Total de Fotos' },
  'uploadStatus.analyzed': { en: 'Analyzed', es: 'Analizadas' },
  'uploadStatus.blade360Viewer': { en: 'Blade 360° Viewer', es: 'Visor de Pala 360°' },
  'uploadStatus.campaignNotFound': { en: 'Campaign not found.', es: 'Campaña no encontrada.' },

  // ─── Shared Results ─────────────────────────────────────────────────────────
  'shared.invalidLink': { en: 'Invalid shared link.', es: 'Enlace compartido inválido.' },
  'shared.linkExpired': { en: 'Link Expired', es: 'Enlace Expirado' },
  'shared.linkExpiredDesc': { en: 'This shared link is no longer active.', es: 'Este enlace compartido ya no está activo.' },

  // ─── Login ──────────────────────────────────────────────────────────────────
  'login.email': { en: 'Email', es: 'Correo electrónico' },
  'login.password': { en: 'Password', es: 'Contraseña' },
  'login.emailPlaceholder': { en: 'you@example.com', es: 'tu@ejemplo.com' },
  'login.passwordPlaceholder': { en: 'Enter your password', es: 'Ingresa tu contraseña' },
  'login.invalidCredentials': { en: 'Invalid email or password. Please try again.', es: 'Correo o contraseña inválidos. Intenta de nuevo.' },

  // ─── Wind Farms Table ───────────────────────────────────────────────────────
  'windFarmsTable.assetName': { en: 'Asset Name', es: 'Nombre del Activo' },
  'windFarmsTable.subAssetsCount': { en: 'SubAssets Count', es: 'Cantidad de SubActivos' },
  'windFarmsTable.inspections': { en: '# Inspections', es: '# Inspecciones' },
  'windFarmsTable.totalPower': { en: 'Total Power', es: 'Potencia Total' },
  'windFarmsTable.poweringDate': { en: 'Powering Date', es: 'Fecha de Puesta en Marcha' },
  'windFarmsTable.oldestInspection': { en: 'Oldest Inspection', es: 'Inspección más Antigua' },

  // ─── Defects Table ──────────────────────────────────────────────────────────
  'defectsTable.asset': { en: 'Asset', es: 'Activo' },
  'defectsTable.turbine': { en: 'Turbine', es: 'Turbina' },
  'defectsTable.model': { en: 'Model', es: 'Modelo' },
  'defectsTable.type': { en: 'Type', es: 'Tipo' },
  'defectsTable.defectSize': { en: 'Defect size (cm)', es: 'Tamaño del defecto (cm)' },
  'defectsTable.category': { en: 'Category', es: 'Categoría' },
  'defectsTable.action': { en: 'Action', es: 'Acción' },
  'defectsTable.nextStep': { en: 'Next step', es: 'Siguiente paso' },
  'defectsTable.blade': { en: 'Blade', es: 'Pala' },
  'defectsTable.side': { en: 'Side', es: 'Cara' },
  'defectsTable.rootDistance': { en: 'Root distance (m)', es: 'Distancia a raíz (m)' },
  'defectsTable.resolved': { en: 'Resolved', es: 'Resuelto' },

  // ─── Subassets Table ────────────────────────────────────────────────────────
  'subassets.title': { en: 'Subassets', es: 'SubActivos' },
  'subassets.colName': { en: 'Name', es: 'Nombre' },
  'subassets.colModel': { en: 'Model', es: 'Modelo' },
  'subassets.colLastInspection': { en: 'Last Inspection', es: 'Última Inspección' },
  'subassets.colPoweringDate': { en: 'Powering Date', es: 'Fecha de Puesta en Marcha' },
  'subassets.colInspections': { en: '# Inspections', es: '# Inspecciones' },

  // ─── Inspection Config Form ─────────────────────────────────────────────────
  'inspectionForm.type': { en: 'Type', es: 'Tipo' },
  'inspectionForm.method': { en: 'Method', es: 'Método' },
  'inspectionForm.blades': { en: 'BLADES', es: 'PALAS' },
  'inspectionForm.tower': { en: 'TOWER', es: 'TORRE' },
  'inspectionForm.coreInsight': { en: 'CORE Insight', es: 'CORE Insight' },
  'inspectionForm.external': { en: 'External >', es: 'Externo >' },
  'inspectionForm.inspectionDate': { en: 'Inspection Date', es: 'Fecha de Inspección' },
  'inspectionForm.campaignName': { en: 'Campaign name', es: 'Nombre de campaña' },
  'inspectionForm.notes': { en: 'Notes', es: 'Notas' },

  // ─── Wind Farm Form ─────────────────────────────────────────────────────────
  'windFarmForm.name': { en: 'Name', es: 'Nombre' },
  'windFarmForm.location': { en: 'Location', es: 'Ubicación' },
  'windFarmForm.latitude': { en: 'Latitude', es: 'Latitud' },
  'windFarmForm.longitude': { en: 'Longitude', es: 'Longitud' },
  'windFarmForm.updateWindFarm': { en: 'Update Wind Farm', es: 'Actualizar Parque Eólico' },
  'windFarmForm.createWindFarm': { en: 'Create Wind Farm', es: 'Crear Parque Eólico' },
  'windFarmForm.namePlaceholder': { en: 'e.g. North Sea Wind Farm', es: 'ej. Parque Eólico Mar del Norte' },
  'windFarmForm.locationPlaceholder': { en: 'e.g. North Sea, Netherlands', es: 'ej. Mar del Norte, Países Bajos' },
  'windFarmForm.latPlaceholder': { en: 'e.g. 52.3676', es: 'ej. 52.3676' },
  'windFarmForm.lonPlaceholder': { en: 'e.g. 4.9041', es: 'ej. 4.9041' },
  'windFarmForm.latError': { en: 'Latitude must be a valid number', es: 'La latitud debe ser un número válido' },
  'windFarmForm.lonError': { en: 'Longitude must be a valid number', es: 'La longitud debe ser un número válido' },

  // ─── Turbine Form ───────────────────────────────────────────────────────────
  'turbineForm.name': { en: 'Name', es: 'Nombre' },
  'turbineForm.model': { en: 'Model', es: 'Modelo' },
  'turbineForm.updateTurbine': { en: 'Update Turbine', es: 'Actualizar Turbina' },
  'turbineForm.createTurbine': { en: 'Create Turbine', es: 'Crear Turbina' },
  'turbineForm.namePlaceholder': { en: 'e.g. Turbine A-01', es: 'ej. Turbina A-01' },
  'turbineForm.modelPlaceholder': { en: 'e.g. Vestas V164-9.5 MW', es: 'ej. Vestas V164-9.5 MW' },

  // ─── Chart Card ─────────────────────────────────────────────────────────────
  'chart.failed': { en: 'Failed to load chart data.', es: 'Error al cargar datos del gráfico.' },
  'chart.noData': { en: 'No data available.', es: 'No hay datos disponibles.' },

  // ─── Document Dropbox ───────────────────────────────────────────────────────
  'documents.title': { en: 'Documents dropbox', es: 'Buzón de documentos' },
  'documents.loadingDocs': { en: 'Loading documents...', es: 'Cargando documentos...' },
  'documents.placeholder': { en: 'Have all your key documents at your disposal here. Master service agreement, asset initial audit, insurance contracts, ...', es: 'Ten todos tus documentos clave aquí. Contrato de servicio, auditoría inicial, contratos de seguro, ...' },

  // ─── Confirm Dialog ─────────────────────────────────────────────────────────
  'confirmDialog.confirm': { en: 'Confirm', es: 'Confirmar' },
  'confirmDialog.cancel': { en: 'Cancel', es: 'Cancelar' },

  // ─── Search Bar ─────────────────────────────────────────────────────────────
  'search.placeholder': { en: 'Search all...', es: 'Buscar todo...' },
  'search.clear': { en: 'Clear search', es: 'Limpiar búsqueda' },

  // ─── Defect Comments ────────────────────────────────────────────────────────
  'comments.title': { en: 'Comments', es: 'Comentarios' },
  'comments.new': { en: 'New comment', es: 'Nuevo comentario' },

  // ─── Table Pagination ───────────────────────────────────────────────────────
  'pagination.rowsPerPage': { en: 'Rows per page:', es: 'Filas por página:' },

  // ─── Toast Messages ─────────────────────────────────────────────────────────
  'toast.windFarmCreated': { en: 'Wind farm created successfully', es: 'Parque eólico creado exitosamente' },
  'toast.windFarmUpdated': { en: 'Wind farm updated successfully', es: 'Parque eólico actualizado exitosamente' },
  'toast.windFarmDeleted': { en: 'Wind farm deleted successfully', es: 'Parque eólico eliminado exitosamente' },
  'toast.turbineCreated': { en: 'Turbine created successfully', es: 'Turbina creada exitosamente' },
  'toast.turbineUpdated': { en: 'Turbine updated successfully', es: 'Turbina actualizada exitosamente' },
  'toast.turbineDeleted': { en: 'Turbine deleted successfully', es: 'Turbina eliminada exitosamente' },
  'toast.deleteAssetFailed': { en: 'Failed to delete asset. Please try again.', es: 'Error al eliminar activo. Intenta de nuevo.' },
  'toast.saveWindFarmFailed': { en: 'Failed to save wind farm. Please try again.', es: 'Error al guardar parque eólico. Intenta de nuevo.' },
  'toast.saveTurbineFailed': { en: 'Failed to save turbine. Please try again.', es: 'Error al guardar turbina. Intenta de nuevo.' },
  'toast.campaignCreated': { en: 'Campaign created successfully', es: 'Campaña creada exitosamente' },
  'toast.campaignDeleted': { en: 'Campaign deleted', es: 'Campaña eliminada' },
  'toast.campaignDeleteFailed': { en: 'Failed to delete campaign', es: 'Error al eliminar campaña' },
  'toast.passwordUpdated': { en: 'Password updated successfully', es: 'Contraseña actualizada exitosamente' },
  'toast.passwordIncorrect': { en: 'Current password is incorrect', es: 'La contraseña actual es incorrecta' },
  'toast.passwordUpdateFailed': { en: 'Failed to update password', es: 'Error al actualizar contraseña' },
  'toast.documentUploaded': { en: 'Document uploaded successfully', es: 'Documento subido exitosamente' },
  'toast.documentUploadFailed': { en: 'Failed to upload document', es: 'Error al subir documento' },
  'toast.documentDeleted': { en: 'Document deleted', es: 'Documento eliminado' },
  'toast.documentDeleteFailed': { en: 'Failed to delete document', es: 'Error al eliminar documento' },
  'toast.documentDownloadFailed': { en: 'Failed to download document', es: 'Error al descargar documento' },
  'toast.fileTypeNotAllowed': { en: 'File type not allowed. Use PDF, DOCX, XLSX, PNG or JPG.', es: 'Tipo de archivo no permitido. Usa PDF, DOCX, XLSX, PNG o JPG.' },

  // ─── Export Button ──────────────────────────────────────────────────────────
  'export.list': { en: 'Export List', es: 'Exportar Lista' },

  // ─── Buttons (additional) ───────────────────────────────────────────────────
  'button.add': { en: 'Add', es: 'Agregar' },

  // ─── Comments ───────────────────────────────────────────────────────────────
  'comments.placeholder': { en: 'Write your comment...', es: 'Escribe tu comentario...' },

  // ─── Turbine Detail (additional) ────────────────────────────────────────────
  'turbineDetail.fullscreen': { en: 'Fullscreen', es: 'Pantalla completa' },

  // ─── Defect Types (visible labels — values stay in English for DB) ─────────
  'defect.leErosion': { en: 'LE EROSION', es: 'Erosión del borde de ataque (LE)' },
  'defect.vortex': { en: 'VORTEX (MISSING PANELS)', es: 'Vórtex (paneles faltantes)' },
  'defect.paintDamages': { en: 'PAINT DAMAGES', es: 'Daños de pintura' },
  'defect.addOnsMissing': { en: 'OTHER ADD-ONS MISSING', es: 'Accesorios faltantes' },
  'defect.hydraulicOil': { en: 'BLADES WITH HYDRAULIC OIL', es: 'Palas con aceite hidráulico' },
  'defect.crack': { en: 'CRACK', es: 'Fisura' },
  'defect.longitudinalCracks': { en: 'LONGITUDINAL CRACKS ON LE OR TE BOND LINES', es: 'Fisuras longitudinales en líneas de unión LE/TE' },

  // ─── Annotate Step ──────────────────────────────────────────────────────────
  'annotate.unseen': { en: 'UNSEEN', es: 'SIN VER' },
  'annotate.tagged': { en: 'TAGGED', es: 'MARCADO' },
  'annotate.annots': { en: 'ANNOTS', es: 'ANOT.' },
  'annotate.notePlaceholder': { en: 'Note', es: 'Nota' },
  'annotate.editAnnotation': { en: 'Edit annotation', es: 'Editar anotación' },
  'annotate.createAnnotation': { en: 'Create annotation', es: 'Crear anotación' },
  'annotate.downloadPhoto': { en: 'Download photo', es: 'Descargar foto' },
  'annotate.rotatePhoto': { en: 'Rotate 90°', es: 'Rotar 90°' },
  'annotate.saveFailed': { en: 'Failed to save annotation', es: 'Error al guardar la anotación' },
  'annotate.defectType': { en: 'Defect type', es: 'Tipo de defecto' },
  'annotate.type': { en: 'Type', es: 'Tipo' },
  'annotate.category': { en: 'Category', es: 'Categoría' },
  'annotate.note': { en: 'Note', es: 'Nota' },
  'annotate.rootDistance': { en: 'Root distance (m)', es: 'Distancia a raíz (m)' },

  // ─── Analyze Step ───────────────────────────────────────────────────────────
  'analyze.subassetNotes': { en: 'SubAsset notes', es: 'Notas del sub-activo' },
  'analyze.bladeNotes': { en: 'Blade {blade} notes', es: 'Notas de pala {blade}' },
  'analyze.select': { en: '— Select —', es: '— Seleccionar —' },

  // ─── Campaign Results ───────────────────────────────────────────────────────
  'campaign.notFound': { en: 'Campaign not found or has no inspection data yet.', es: 'Campaña no encontrada o sin datos de inspección aún.' },
  'campaign.noInspections': { en: 'No inspections assigned to this campaign yet.', es: 'Aún no hay inspecciones asignadas a esta campaña.' },
  'campaign.goToWindFarm': { en: 'Go to wind farm detail to assign inspections', es: 'Ir al detalle del parque eólico para asignar inspecciones' },
  'campaign.campaignOf': { en: 'Campaign of', es: 'Campaña del' },

  // ─── Ongoing Inspections (additional) ───────────────────────────────────────
  'ongoing.goToWindFarm': { en: 'Go to wind farm', es: 'Ir al parque eólico' },
  'ongoing.inspectionDetails': { en: 'Inspection details', es: 'Detalles de la inspección' },

  // ─── Inspections (additional) ───────────────────────────────────────────────
  'inspections.from': { en: 'From', es: 'Desde' },
  'inspections.to': { en: 'To', es: 'Hasta' },
  'inspections.filterByStatus': { en: 'Filter by status', es: 'Filtrar por estado' },
  'inspections.filterFromDate': { en: 'Filter from date', es: 'Filtrar desde fecha' },
  'inspections.filterToDate': { en: 'Filter to date', es: 'Filtrar hasta fecha' },

  // ─── Reports (additional) ──────────────────────────────────────────────────
  'reports.searchReports': { en: 'Search reports', es: 'Buscar reportes' },
  'reports.downloadReport': { en: 'Download report', es: 'Descargar reporte' },

  // ─── Assets (additional) ───────────────────────────────────────────────────
  'assets.backToTree': { en: 'Back to asset tree', es: 'Volver al árbol de activos' },

  // ─── Upload Status (additional) ────────────────────────────────────────────
  'uploadStatus.closeViewer': { en: 'Close viewer', es: 'Cerrar visor' },
  'uploadStatus.photos': { en: 'photos', es: 'fotos' },

  // ─── Uploads / Cargas view (/inspections/upload) ────────────────────────────
  'page.uploads': { en: 'Uploads', es: 'Cargas' },
  'uploads.turbine': { en: 'Inspection / Turbine', es: 'Inspección / Turbina' },
  'uploads.farm': { en: 'Wind Farm', es: 'Parque' },
  'uploads.photos': { en: 'Photos', es: 'Fotos' },
  'uploads.uploadedBy': { en: 'Uploaded by', es: 'Cargado por' },
  'uploads.date': { en: 'Date', es: 'Fecha' },
  'uploads.status': { en: 'Status', es: 'Estado' },
  'uploads.statusInProgress': { en: 'In progress', es: 'En progreso' },
  'uploads.statusUploaded': { en: 'Uploaded', es: 'Cargadas' },
  'uploads.noFound': { en: 'No uploads found', es: 'No hay cargas' },
  'uploads.noFoundDesc': {
    en: 'Photo syncs from the drone agent will appear here.',
    es: 'Las sincronizaciones de fotos del agente de drone aparecerán aquí.',
  },
  'uploads.moreTurbines': { en: 'more', es: 'más' },

  // ─── Annotate Step (additional) ─────────────────────────────────────────────
  'annotate.blade': { en: 'Blade: ', es: 'Pala: ' },
  'annotate.side': { en: 'Side: ', es: 'Cara: ' },
  'annotate.bladeRootDistance': { en: 'Blade root distance: ', es: 'Distancia a raíz de pala: ' },
  'annotate.distanceToBlade': { en: 'Distance to blade: ', es: 'Distancia a pala: ' },
  'annotate.confirmVerticalBlade': { en: 'Do you confirm setting the vertical blade to', es: '¿Confirmas configurar la pala vertical como' },

  // ─── Assets (additional keys) ──────────────────────────────────────────────
  'assets.noSelected': { en: 'No asset selected', es: 'Ningún activo seleccionado' },
  'assets.coordinates': { en: 'Coordinates', es: 'Coordenadas' },
  'assets.totalBlades': { en: 'Total Blades', es: 'Total de Palas' },
  'assets.bladePositions': { en: 'Blade Positions', es: 'Posiciones de Pala' },
  'assets.serialNumber': { en: 'Serial Number', es: 'Número de Serie' },
  'assets.length': { en: 'Length', es: 'Largo' },

  // ─── Blades Diagram ─────────────────────────────────────────────────────────
  'blades.defectCategories': { en: 'Defect Categories', es: 'Categorías de Defectos' },
  'blades.showCategories': { en: 'Show defect categories', es: 'Mostrar categorías de defectos' },

  // ─── Map ────────────────────────────────────────────────────────────────────
  'map.changeLayer': { en: 'Change map layer', es: 'Cambiar capa del mapa' },

  // ─── Compare Viewer ─────────────────────────────────────────────────────────
  'compare.selectInspection': { en: 'Select inspection', es: 'Seleccionar inspección' },
  'compare.compareMore': { en: 'Compare more', es: 'Comparar más' },
  'compare.noHistorical': { en: 'No historical inspections available', es: 'No hay inspecciones históricas disponibles' },

  // ─── Campaigns (additional) ─────────────────────────────────────────────────
  'campaigns.viewResults': { en: 'View Results', es: 'Ver Resultados' },
  'campaigns.editCampaign': { en: 'Edit campaign', es: 'Editar campaña' },
  'campaigns.loadingInspections': { en: 'Loading inspections...', es: 'Cargando inspecciones...' },
  'campaigns.noInspectionsInCampaign': { en: 'No inspections in this campaign', es: 'No hay inspecciones en esta campaña' },
  'campaigns.noInspectionsFor': { en: 'No inspections for', es: 'No hay inspecciones para' },
  'campaigns.saving': { en: 'Saving...', es: 'Guardando...' },
  'campaigns.nameRequired': { en: 'Campaign name is required', es: 'El nombre de la campaña es obligatorio' },

  // ─── Toast (additional) ─────────────────────────────────────────────────────
  'toast.campaignUpdated': { en: 'Campaign updated', es: 'Campaña actualizada' },
  'toast.campaignUpdateFailed': { en: 'Failed to update campaign', es: 'Error al actualizar la campaña' },

  // ─── Defects (more) ─────────────────────────────────────────────────────────
  'defects.delamination': { en: 'Delamination', es: 'Delaminación' },
  'defects.lightningDamage': { en: 'Lightning Damage', es: 'Daño por rayo' },
  'defects.other': { en: 'Other', es: 'Otro' },
  'defects.addDefect': { en: 'Add Defect', es: 'Agregar Defecto' },
  'defects.closed': { en: 'Defect closed', es: 'Defecto cerrado' },
  'defects.tryAdjusting': { en: 'Try adjusting your search to find defects.', es: 'Intenta ajustar tu búsqueda para encontrar defectos.' },
  'defects.noRegistered': { en: 'No defects have been registered yet.', es: 'Aún no se han registrado defectos.' },

  // ─── Evidence (additional) ──────────────────────────────────────────────────
  'evidence.deleted': { en: 'Evidence deleted', es: 'Evidencia eliminada' },
  'evidence.deleteFailed': { en: 'Failed to delete evidence', es: 'Error al eliminar evidencia' },
  'evidence.dropHere': { en: 'Drop files here', es: 'Suelta los archivos aquí' },
  'evidence.dragAndDrop': { en: 'Drag & drop JPEG or PNG files here', es: 'Arrastra y suelta archivos JPEG o PNG aquí' },

  // ─── Blade Categories (CATEGORIES_DATA) ─────────────────────────────────────
  'bladeCat.cosmetic': { en: 'Cosmetic', es: 'Cosmético' },
  'bladeCat.wearTear': { en: 'Damage below wear and tear', es: 'Daño por debajo del desgaste' },
  'bladeCat.physicalImpacts': { en: 'Damage below wear and tear, physical impacts', es: 'Daño por desgaste con impactos físicos' },
  'bladeCat.seriousDamage': { en: 'Serious damage', es: 'Daño grave' },
  'bladeCat.criticalDamage': { en: 'Critical damage', es: 'Daño crítico' },
  'bladeCat.colCategory': { en: 'Category', es: 'Categoría' },
  'bladeCat.colDamage': { en: 'Damage', es: 'Daño' },
  'bladeCat.colAction': { en: 'Recommended action', es: 'Acción recomendada' },
  'bladeCat.colNextStep': { en: 'Next step', es: 'Siguiente paso' },
  'bladeCat.action1': { en: 'No need for immediate repairs', es: 'No requiere reparación inmediata' },
  'bladeCat.action2': { en: 'Repair only if other damages are to be repaired', es: 'Reparar solo si hay otros daños a reparar' },
  'bladeCat.action3': { en: 'Repair to be performed within the next 6 months', es: 'Reparación en los próximos 6 meses' },
  'bladeCat.action4': { en: 'Repair to be performed in the next 3 months, monitor damage', es: 'Reparación en los próximos 3 meses, monitorear daño' },
  'bladeCat.action5': { en: 'Immediate action required, contact technical support', es: 'Acción inmediata requerida, contactar soporte técnico' },
  'bladeCat.continueOp': { en: 'Continue operation', es: 'Continuar operación' },
  'bladeCat.stop': { en: 'STOP! Safety not ensured!', es: '¡DETENER! ¡Seguridad no garantizada!' },

  // ─── Map layers ─────────────────────────────────────────────────────────────
  'map.satellite': { en: 'Satellite', es: 'Satélite' },
  'map.street': { en: 'Street', es: 'Callejero' },
  'map.hybrid': { en: 'Hybrid', es: 'Híbrido' },

  // ─── Analyze (additional) ───────────────────────────────────────────────────
  'analyze.dropAnnotation': { en: 'Drop annotation here', es: 'Suelta la anotación aquí' },

  // ─── General (additional) ───────────────────────────────────────────────────
  'general.yes': { en: 'Yes', es: 'Sí' },
  'general.no': { en: 'No', es: 'No' },

  // ─── Defects (additional) ───────────────────────────────────────────────────
  'defects.markResolved': { en: 'Mark as resolved', es: 'Marcar como resuelto' },
  'defects.descriptionPlaceholder': { en: 'Visual description of the defect', es: 'Descripción visual del defecto' },
  'defects.causePlaceholder': { en: 'Probable cause of the defect', es: 'Causa probable del defecto' },
  'defects.actionPlaceholder': { en: 'Recommended action and urgency', es: 'Acción recomendada y urgencia' },
  'defects.description': { en: 'Description', es: 'Descripción' },
  'defects.widthCm': { en: 'Width (cm)', es: 'Ancho (cm)' },
  'defects.heightCm': { en: 'Height (cm)', es: 'Alto (cm)' },
  'defects.noRecorded': { en: 'No defects recorded', es: 'No se registraron defectos' },
  'defects.noRecordedDesc': { en: 'Add defects found during the blade inspection.', es: 'Agrega los defectos encontrados durante la inspección de palas.' },
  'defects.noFound': { en: 'No defects found', es: 'No se encontraron defectos' },

  // ─── Evidence ───────────────────────────────────────────────────────────────
  'evidence.uploadPhotos': { en: 'Upload evidence photos', es: 'Subir fotos de evidencia' },
  'evidence.selectPhotos': { en: 'Select photos to upload', es: 'Seleccionar fotos para subir' },

  // ─── Map (additional) ──────────────────────────────────────────────────────
  'map.loading': { en: 'Loading map data...', es: 'Cargando datos del mapa...' },

  // ─── Miscellaneous UI ───────────────────────────────────────────────────────
  'misc.selectAllTurbines': { en: 'Select all turbines', es: 'Seleccionar todos los aerogeneradores' },
  'misc.selectWindFarm': { en: 'Select wind farm', es: 'Seleccionar parque eólico' },
  'misc.openCalendar': { en: 'Open calendar', es: 'Abrir calendario' },
  'misc.sendComment': { en: 'Send comment', es: 'Enviar comentario' },
  'misc.weatherForecast': { en: 'Weather forecast map', es: 'Mapa de pronóstico meteorológico' },
  'misc.exportDefects': { en: 'Export defects list', es: 'Exportar lista de defectos' },

  // ─── Inspect Step ───────────────────────────────────────────────────────────
  'inspect.detailsTitle': { en: 'Inspection Details', es: 'Detalles de Inspección' },
  'inspect.assetName': { en: 'Asset Name', es: 'Nombre del Activo' },
  'inspect.inspectionType': { en: 'Inspection type', es: 'Tipo de Inspección' },
  'inspect.turbine': { en: 'Turbine', es: 'Aerogenerador' },
  'inspect.model': { en: 'Model', es: 'Modelo' },
  'inspect.date': { en: 'Date', es: 'Fecha' },
  'inspect.notes': { en: 'Notes', es: 'Notas' },
  'inspect.legislation': { en: 'Legislation', es: 'Legislación' },
  'inspect.legislationText': { en: 'Please check local legislation before your flight', es: 'Verifique la legislación local antes de su vuelo' },
  'inspect.status': { en: 'Status', es: 'Estado' },
  'inspect.documentsTitle': { en: 'Documents dropbox', es: 'Buzón de documentos' },
  'inspect.addDocument': { en: 'Add document', es: 'Agregar documento' },
  'inspect.documentsPlaceholder': { en: 'Have all your key documents at your disposal here.', es: 'Ten todos tus documentos clave aquí.' },
  'inspect.documentsExamples': { en: 'Master service agreement, asset initial audit, insurance contracts, …', es: 'Contrato de servicio, auditoría inicial del activo, contratos de seguro, …' },
  'inspect.switchToSatellite': { en: 'Switch to satellite', es: 'Cambiar a satélite' },
  'inspect.switchToStreetMap': { en: 'Switch to street map', es: 'Cambiar a mapa callejero' },
  'inspect.complete': { en: 'Complete', es: 'Completo' },
  'inspect.pending': { en: 'Pending', es: 'Pendiente' },
  'inspect.acquisition': { en: 'Acquisition', es: 'Adquisición' },
  'inspect.dateAndTime': { en: 'Date and time', es: 'Fecha y hora' },
  'inspect.photos': { en: 'Photos', es: 'Fotografías' },
  'inspect.taggedPhotos': { en: 'Tagged photos', es: 'Fotos marcadas' },
  'inspect.inspectionDuration': { en: 'Inspection duration', es: 'Duración de inspección' },
  'inspect.rtkStatus': { en: 'RTK Status', es: 'Estado RTK' },
  'inspect.rtkFixed': { en: 'Fixed (100%)', es: 'Fijo (100%)' },
  'inspect.minutes': { en: 'minutes', es: 'minutos' },
  'inspect.photoUpload': { en: 'Photo upload', es: 'Subida de fotos' },
  'inspect.uploadedPhotos': { en: 'Uploaded photos', es: 'Fotos subidas' },
  'inspect.pendingPhotos': { en: 'Pending photos', es: 'Fotos pendientes' },
  'inspect.save': { en: 'Save', es: 'Guardar' },
  'inspect.editNotes': { en: 'Edit notes', es: 'Editar notas' },

  // ─── Details Block ──────────────────────────────────────────────────────────
  'details.title': { en: 'Details', es: 'Detalles' },
  'details.oldestInspection': { en: 'Oldest inspection', es: 'Inspección más antigua' },
  'details.totalPower': { en: 'Total power', es: 'Potencia total' },
  'details.poweringDate': { en: 'Powering date', es: 'Fecha de puesta en marcha' },
  'details.numberOfSubassets': { en: 'Number of sub-assets', es: 'Número de sub-activos' },
  'details.planInspection': { en: 'Plan a New Inspection', es: 'Planificar Nueva Inspección' },

  // ─── Campaigns Panel ────────────────────────────────────────────────────────
  'campaigns.title': { en: 'Campaigns', es: 'Campañas' },
  'campaigns.filteredBy': { en: 'Filtered by', es: 'Filtrado por' },
  'campaigns.clearFilter': { en: 'Clear filter', es: 'Limpiar filtro' },
  'campaigns.noCampaigns': { en: 'No campaigns yet.', es: 'Sin campañas aún.' },

  // ─── Results Step ───────────────────────────────────────────────────────────
  'results.loading': { en: 'Loading results...', es: 'Cargando resultados...' },
  'results.noConfirmedDefects': { en: 'No confirmed defects', es: 'Sin defectos confirmados' },
  'results.noConfirmedDefectsDesc': { en: 'Go to step 3 (Analyze) and confirm annotations as defects to see them here.', es: 'Ve al paso 3 (Analizar) y confirma anotaciones como defectos para verlos aquí.' },
  'results.title': { en: 'Inspection Results', es: 'Resultados de Inspección' },
  'results.defectsPlural': { en: 'defects', es: 'defectos' },
  'results.defectSingular': { en: 'defect', es: 'defecto' },
  'results.confirmed': { en: 'confirmed', es: 'confirmados' },
  'results.blade': { en: 'Blade', es: 'Pala' },
  'results.type': { en: 'Type', es: 'Tipo' },
  'results.face': { en: 'Face', es: 'Cara' },
  'results.category': { en: 'Category', es: 'Categoría' },
  'results.rootM': { en: 'Root (m)', es: 'Raíz (m)' },

  // ─── Turbine Result Accordion ───────────────────────────────────────────────
  'turbineResult.resolved': { en: 'resolved', es: 'resueltos' },
  'turbineResult.downloadPdf': { en: 'Download PDF', es: 'Descargar PDF' },
  'turbineResult.downloadXlsx': { en: 'Download XLSX', es: 'Descargar XLSX' },
  'turbineResult.openInspection': { en: 'Open inspection', es: 'Abrir inspección' },
  'turbineResult.blade': { en: 'BLADE', es: 'PALA' },

  // ─── Defect Detail Sidebar ──────────────────────────────────────────────────
  'defectSidebar.selectDefect': { en: 'Select a defect to view details', es: 'Seleccione un defecto para ver detalles' },
  'defectSidebar.category': { en: 'Category', es: 'Categoría' },
  'defectSidebar.status': { en: 'Status', es: 'Estado' },
  'defectSidebar.markResolved': { en: 'Mark as resolved', es: 'Marcar como resuelto' },
  'defectSidebar.markUnresolved': { en: 'Mark as unresolved', es: 'Marcar como no resuelto' },
  'defectSidebar.defectSize': { en: 'Defect size', es: 'Tamaño del defecto' },
  'defectSidebar.bladeSide': { en: 'Blade Side', es: 'Cara de pala' },
  'defectSidebar.rootCause': { en: 'Root Cause', es: 'Causa raíz' },
  'defectSidebar.nextStep': { en: 'Next Step', es: 'Siguiente paso' },
  'defectSidebar.note': { en: 'Note', es: 'Nota' },

  // ─── Defect Image Viewer ────────────────────────────────────────────────────
  'defectImage.noImage': { en: 'No image available', es: 'Sin imagen disponible' },
  'defectImage.compare': { en: 'Compare', es: 'Comparar' },

  // ─── Blade Diagram ──────────────────────────────────────────────────────────
  'bladeDiagram.ariaLabel': { en: 'Blade diagram showing defect at {distance}m on {side} side', es: 'Diagrama de pala mostrando defecto a {distance}m en cara {side}' },
  'bladeDiagram.expand': { en: 'Expand blade view', es: 'Expandir vista de pala' },

  // ─── Asset Tree ─────────────────────────────────────────────────────────────
  'assetTree.loading': { en: 'Loading asset tree', es: 'Cargando árbol de activos' },

  // ─── Charts ─────────────────────────────────────────────────────────────────
  'chart.inspectionsToPlan': { en: 'Inspections to Plan', es: 'Inspecciones por Planificar' },
  'chart.inspectionsPlanned': { en: 'Inspections Planned', es: 'Inspecciones Planificadas' },
  'chart.inspectionsDone': { en: 'Inspections Done', es: 'Inspecciones Realizadas' },
  'chart.now': { en: 'Now', es: 'Ahora' },
  'chart.totalAssets': { en: 'Total assets', es: 'Activos totales' },
  'chart.lessThan3Months': { en: '< 3 months', es: '< 3 meses' },
  'chart.6to3Months': { en: '6 to 3 months', es: '6 a 3 meses' },
  'chart.moreThan6Months': { en: '> 6 months', es: '> 6 meses' },
  'chart.severity': { en: 'Severity', es: 'Severidad' },

  // ─── Analyze Step (i18n) ────────────────────────────────────────────────────
  'analyze.annotations': { en: 'Annotations', es: 'Anotaciones' },
  'analyze.saveAsDefects': { en: 'Save as defects', es: 'Guardar como defectos' },
  'analyze.allConfirmed': { en: 'All annotations for Blade have been confirmed', es: 'Todas las anotaciones de la Pala han sido confirmadas' },
  'analyze.categoryLabel': { en: 'Category', es: 'Categoría' },
  'analyze.open': { en: 'OPEN', es: 'ABRIR' },
  'analyze.selectOrDrag': { en: 'Select or drag an annotation to view it', es: 'Selecciona o arrastra una anotación para verla' },
  'analyze.defectEditor': { en: 'Defect Editor', es: 'Editor de Defectos' },
  'analyze.type': { en: 'Type', es: 'Tipo' },
  'analyze.category': { en: 'Category', es: 'Categoría' },
  'analyze.bladeFace': { en: 'Blade face', es: 'Cara de pala' },
  'analyze.noteLabel': { en: 'Note', es: 'Nota' },
  'analyze.rootCause': { en: 'Root cause', es: 'Causa raíz' },
  'analyze.nextStep': { en: 'Next step', es: 'Siguiente paso' },
  'analyze.clear': { en: 'CLEAR', es: 'LIMPIAR' },
  'analyze.saving': { en: 'SAVING...', es: 'GUARDANDO...' },
  'analyze.saved': { en: '✓ SAVED', es: '✓ GUARDADO' },
  'analyze.saveAsDefect': { en: 'SAVE AS DEFECT', es: 'GUARDAR COMO DEFECTO' },
  'analyze.markAnalyzed': { en: 'MARK AS ANALYZED', es: 'MARCAR COMO ANALIZADO' },
  'analyze.removing': { en: 'REMOVING...', es: 'ELIMINANDO...' },
  'analyze.summaryTitle': { en: 'Summary and Reviews', es: 'Resumen y Revisiones' },
  'analyze.noConfirmed': { en: 'No confirmed defects yet', es: 'Sin defectos confirmados aún' },

  // ─── Annotate Step (tooltips & texts) ──────────────────────────────────────
  'annotate.previous': { en: 'Previous', es: 'Anterior' },
  'annotate.next': { en: 'Next', es: 'Siguiente' },
  'annotate.flag': { en: 'Flag', es: 'Marcar' },
  'annotate.rectangle': { en: 'Rectangle', es: 'Rectángulo' },
  'annotate.oval': { en: 'Oval', es: 'Óvalo' },
  'annotate.pencil': { en: 'Pencil (freehand line)', es: 'Lápiz (línea continua)' },
  'annotate.zoomOut': { en: 'Zoom out', es: 'Alejar' },
  'annotate.resetZoom': { en: 'Reset zoom', es: 'Restablecer zoom' },
  'annotate.zoomIn': { en: 'Zoom in', es: 'Acercar' },
  'annotate.bladeFaceView': { en: 'Blade face view', es: 'Vista de cara de pala' },
  'annotate.imageAdjustments': { en: 'Image adjustments', es: 'Ajustes de imagen' },
  'annotate.deletePhoto': { en: 'Delete photo', es: 'Eliminar foto' },
  'annotate.fastForwardMode': { en: 'Fast forward mode', es: 'Modo avance rápido' },
  'annotate.bladeOrderCW': { en: 'Blade order from the outside is set to', es: 'El orden de las palas desde el exterior está configurado en' },
  'annotate.clockwise': { en: 'clockwise', es: 'sentido horario' },
  'annotate.updateVerticalBlade': { en: 'Update vertical blade', es: 'Actualizar pala vertical' },
  'annotate.verticalBladeWarning': { en: 'You are about to change the vertical blade, this action will change the blade picture distribution according to the specified blade ordering (CW or CCW).', es: 'Está a punto de cambiar la pala vertical, esta acción cambiará la distribución de las imágenes de pala según el orden especificado (CW o CCW).' },
  'annotate.contrast': { en: 'Contrast', es: 'Contraste' },
  'annotate.brightness': { en: 'Brightness', es: 'Brillo' },
  'annotate.saturation': { en: 'Saturation', es: 'Saturación' },

  // ─── Defect Edit Form ──────────────────────────────────────────────────────
  'defectEdit.type': { en: 'Type', es: 'Tipo' },
  'defectEdit.category': { en: 'Category', es: 'Categoría' },
  'defectEdit.rootDistance': { en: 'Root distance (m)', es: 'Distancia a raíz (m)' },
  'defectEdit.bladeFace': { en: 'Blade face', es: 'Cara de pala' },
  'defectEdit.note': { en: 'Note', es: 'Nota' },
  'defectEdit.rootCause': { en: 'Root cause', es: 'Causa raíz' },
  'defectEdit.nextStep': { en: 'Next step', es: 'Siguiente paso' },
  'defectEdit.removeDefect': { en: 'Remove Defect', es: 'Eliminar Defecto' },
  'defectEdit.close': { en: 'Close', es: 'Cerrar' },
  'defectEdit.update': { en: 'Update', es: 'Actualizar' },
  'defectEdit.selectPlaceholder': { en: '-- Select --', es: '-- Seleccionar --' },

  // ─── Quotes & Work Orders ────────────────────────────────────────────────────
  'sidebar.quotes': { en: 'Quotes', es: 'Cotizaciones' },
  'button.requestQuote': { en: 'REQUEST QUOTE', es: 'SOLICITAR COTIZACIÓN' },
  'page.quotes': { en: 'Quotes', es: 'Cotizaciones' },
  'page.newQuote': { en: 'New quote request', es: 'Nueva solicitud de cotización' },
  'page.quoteDetail': { en: 'Quote detail', es: 'Detalle de cotización' },
  'page.traceability': { en: 'Cost traceability', es: 'Trazabilidad de costos' },

  // Quote statuses
  'quote.status.requested': { en: 'Requested', es: 'Solicitada' },
  'quote.status.quoted': { en: 'Quoted', es: 'Cotizada' },
  'quote.status.approved': { en: 'Approved', es: 'Aprobada' },
  'quote.status.rejected': { en: 'Rejected', es: 'Rechazada' },

  // Work order statuses
  'workOrder.status.open': { en: 'Open', es: 'Abierta' },
  'workOrder.status.in_progress': { en: 'In progress', es: 'En progreso' },
  'workOrder.status.done': { en: 'Done', es: 'Completada' },
  'workOrder.status.cancelled': { en: 'Cancelled', es: 'Cancelada' },

  // Quotes list
  'quotes.title': { en: 'Quotes', es: 'Cotizaciones' },
  'quotes.subtitleClient': { en: 'Your quote requests and their status', es: 'Tus solicitudes de cotización y su estado' },
  'quotes.subtitleTeam': { en: 'Manage and respond to quote requests', es: 'Gestiona y responde solicitudes de cotización' },
  'quotes.traceabilityLink': { en: 'Cost traceability', es: 'Trazabilidad de costos' },
  'quotes.empty': { en: 'No quotes yet.', es: 'Sin cotizaciones aún.' },
  'quotes.loading': { en: 'Loading quotes...', es: 'Cargando cotizaciones...' },
  'quotes.colTurbine': { en: 'Turbine', es: 'Aerogenerador' },
  'quotes.colWindFarm': { en: 'Wind farm', es: 'Parque eólico' },
  'quotes.colRequestedBy': { en: 'Requested by', es: 'Solicitado por' },
  'quotes.colDefects': { en: 'Defects', es: 'Defectos' },
  'quotes.colStatus': { en: 'Status', es: 'Estado' },
  'quotes.colTotal': { en: 'Total', es: 'Total' },
  'quotes.colDate': { en: 'Date', es: 'Fecha' },
  'quotes.colActions': { en: 'Actions', es: 'Acciones' },
  'quotes.view': { en: 'View', es: 'Ver' },
  'quotes.quoteNow': { en: 'Quote', es: 'Cotizar' },

  // New quote screen (drag & drop)
  'newQuote.title': { en: 'Request a quote', es: 'Solicitar cotización' },
  'newQuote.available': { en: 'Available defects', es: 'Defectos disponibles' },
  'newQuote.availableHint': { en: 'Drag defects to the right to include them in the quote request.', es: 'Arrastra los defectos a la derecha para incluirlos en la solicitud.' },
  'newQuote.toQuote': { en: 'Defects to quote', es: 'Defectos a cotizar' },
  'newQuote.toQuoteHint': { en: 'Drop defects here. Click × to remove.', es: 'Suelta los defectos aquí. Haz clic en × para quitarlos.' },
  'newQuote.dropHere': { en: 'Drop defects here', es: 'Suelta los defectos aquí' },
  'newQuote.category': { en: 'Category', es: 'Categoría' },
  'newQuote.noDefects': { en: 'No unresolved defects for this turbine.', es: 'No hay defectos sin resolver para este aerogenerador.' },
  'newQuote.allSelected': { en: 'All defects have been added.', es: 'Todos los defectos han sido agregados.' },
  'newQuote.submit': { en: 'Send request', es: 'Enviar solicitud' },
  'newQuote.submitting': { en: 'Sending...', es: 'Enviando...' },
  'newQuote.selectedCount': { en: 'selected', es: 'seleccionados' },
  'newQuote.blade': { en: 'Blade', es: 'Pala' },
  'newQuote.side': { en: 'Side', es: 'Cara' },
  'newQuote.size': { en: 'Size', es: 'Tamaño' },
  'newQuote.remove': { en: 'Remove', es: 'Quitar' },

  // Quote detail
  'quoteDetail.loading': { en: 'Loading quote...', es: 'Cargando cotización...' },
  'quoteDetail.notFound': { en: 'Quote not found.', es: 'Cotización no encontrada.' },
  'quoteDetail.info': { en: 'Quote information', es: 'Información de la cotización' },
  'quoteDetail.currency': { en: 'Currency', es: 'Moneda' },
  'quoteDetail.status': { en: 'Status', es: 'Estado' },
  'quoteDetail.items': { en: 'Defects', es: 'Defectos' },
  'quoteDetail.defect': { en: 'Defect', es: 'Defecto' },
  'quoteDetail.category': { en: 'Category', es: 'Categoría' },
  'quoteDetail.laborHours': { en: 'Labor hours (HH)', es: 'Horas hombre (HH)' },
  'quoteDetail.hourlyRate': { en: 'Hourly rate', es: 'Tarifa por hora' },
  'quoteDetail.laborSubtotal': { en: 'Labor subtotal', es: 'Subtotal HH' },
  'quoteDetail.materials': { en: 'Materials', es: 'Materiales' },
  'quoteDetail.materialsSubtotal': { en: 'Materials subtotal', es: 'Subtotal materiales' },
  'quoteDetail.subtotal': { en: 'Subtotal', es: 'Subtotal' },
  'quoteDetail.itemTotal': { en: 'Defect total', es: 'Total defecto' },
  'quoteDetail.total': { en: 'Total', es: 'Total' },
  'quoteDetail.addMaterial': { en: 'Add material', es: 'Agregar material' },
  'quoteDetail.materialDescription': { en: 'Description', es: 'Descripción' },
  'quoteDetail.quantity': { en: 'Quantity', es: 'Cantidad' },
  'quoteDetail.unitCost': { en: 'Unit cost', es: 'Costo unitario' },
  'quoteDetail.saveQuote': { en: 'Save quote', es: 'Guardar cotización' },
  'quoteDetail.saving': { en: 'Saving...', es: 'Guardando...' },
  'quoteDetail.approve': { en: 'Approve', es: 'Aprobar' },
  'quoteDetail.reject': { en: 'Reject', es: 'Rechazar' },
  'quoteDetail.processing': { en: 'Processing...', es: 'Procesando...' },
  'quoteDetail.workOrders': { en: 'Work orders', es: 'Órdenes de trabajo' },
  'quoteDetail.woDefect': { en: 'Defect', es: 'Defecto' },
  'quoteDetail.woSide': { en: 'Side', es: 'Cara' },
  'quoteDetail.woCost': { en: 'Cost', es: 'Costo' },
  'quoteDetail.woStatus': { en: 'Status', es: 'Estado' },
  'quoteDetail.awaitingQuote': { en: 'Awaiting the technical team\'s quote.', es: 'A la espera de la cotización del equipo técnico.' },
  'quoteDetail.back': { en: 'Back to quotes', es: 'Volver a cotizaciones' },

  // Traceability
  'traceability.title': { en: 'Cost traceability', es: 'Trazabilidad de costos' },
  'traceability.subtitle': { en: 'Defects, repairs and accumulated costs over time', es: 'Defectos, reparaciones y costos acumulados en el tiempo' },
  'traceability.loading': { en: 'Loading traceability...', es: 'Cargando trazabilidad...' },
  'traceability.byWindFarm': { en: 'Cost by wind farm', es: 'Costo por parque eólico' },
  'traceability.byTurbine': { en: 'Cost by turbine', es: 'Costo por aerogenerador' },
  'traceability.timeline': { en: 'Repairs over time', es: 'Reparaciones en el tiempo' },
  'traceability.empty': { en: 'No work orders yet.', es: 'Sin órdenes de trabajo aún.' },
  'traceability.colDate': { en: 'Date', es: 'Fecha' },
  'traceability.colWindFarm': { en: 'Wind farm', es: 'Parque' },
  'traceability.colTurbine': { en: 'Turbine', es: 'Aerogenerador' },
  'traceability.colBladeSide': { en: 'Blade / Side', es: 'Pala / Cara' },
  'traceability.colDefect': { en: 'Defect', es: 'Defecto' },
  'traceability.colStatus': { en: 'Status', es: 'Estado' },
  'traceability.colCost': { en: 'Cost', es: 'Costo' },
  'traceability.orders': { en: 'orders', es: 'órdenes' },

  // Quote toasts
  'toast.quoteRequested': { en: 'Quote request sent', es: 'Solicitud de cotización enviada' },
  'toast.quoteRequestFailed': { en: 'Failed to send quote request', es: 'Error al enviar la solicitud' },
  'toast.quoteSaved': { en: 'Quote saved', es: 'Cotización guardada' },
  'toast.quoteSaveFailed': { en: 'Failed to save quote', es: 'Error al guardar la cotización' },
  'toast.quoteApproved': { en: 'Quote approved, work orders created', es: 'Cotización aprobada, órdenes de trabajo creadas' },
  'toast.quoteRejected': { en: 'Quote rejected', es: 'Cotización rechazada' },
  'toast.quoteActionFailed': { en: 'Action failed. Please try again.', es: 'Error en la acción. Intenta de nuevo.' },
  'toast.noDefectsSelected': { en: 'Select at least one defect', es: 'Selecciona al menos un defecto' },
};
