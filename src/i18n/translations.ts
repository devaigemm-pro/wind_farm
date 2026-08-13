export type Locale = 'en' | 'es';

type TranslationMap = Record<string, Record<Locale, string>>;

export const translations: TranslationMap = {
  // Sidebar sections
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

  // TopBar
  'topbar.notifications': { en: 'Notifications', es: 'Notificaciones' },
  'topbar.userMenu': { en: 'User menu', es: 'Menú de usuario' },
  'topbar.lightMode': { en: 'Light mode', es: 'Modo claro' },
  'topbar.darkMode': { en: 'Dark mode', es: 'Modo oscuro' },
  'topbar.toggleNav': { en: 'Toggle navigation menu', es: 'Alternar menú de navegación' },
  'topbar.language': { en: 'Change language', es: 'Cambiar idioma' },

  // Pages
  'page.dashboard': { en: 'Dashboard', es: 'Panel' },
  'page.windFarms': { en: 'Wind Farms', es: 'Parques Eólicos' },
  'page.turbines': { en: 'Turbines', es: 'Turbinas' },
  'page.inspections': { en: 'Inspections', es: 'Inspecciones' },
  'page.defects': { en: 'Defects', es: 'Defectos' },

  // Tables
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

  // Buttons
  'button.export': { en: 'Export', es: 'Exportar' },
  'button.filter': { en: 'Filter', es: 'Filtrar' },
  'button.search': { en: 'Search', es: 'Buscar' },
  'button.save': { en: 'Save', es: 'Guardar' },
  'button.cancel': { en: 'Cancel', es: 'Cancelar' },
  'button.delete': { en: 'Delete', es: 'Eliminar' },
  'button.edit': { en: 'Edit', es: 'Editar' },
  'button.create': { en: 'Create', es: 'Crear' },
  'button.upload': { en: 'Upload', es: 'Subir' },
  'button.download': { en: 'Download', es: 'Descargar' },

  // States
  'status.active': { en: 'Active', es: 'Activo' },
  'status.planned': { en: 'Planned', es: 'Planificado' },
  'status.completed': { en: 'Completed', es: 'Completado' },
  'status.inProgress': { en: 'In Progress', es: 'En Progreso' },
  'status.pending': { en: 'Pending', es: 'Pendiente' },
  'status.analyze': { en: 'Analyze', es: 'Analizar' },

  // General
  'general.loading': { en: 'Loading', es: 'Cargando' },
  'general.noData': { en: 'No data', es: 'Sin datos' },
  'general.error': { en: 'Error', es: 'Error' },
  'general.confirm': { en: 'Confirm', es: 'Confirmar' },
  'general.close': { en: 'Close', es: 'Cerrar' },
  'general.back': { en: 'Back', es: 'Atrás' },
  'general.next': { en: 'Next', es: 'Siguiente' },
  'general.previous': { en: 'Previous', es: 'Anterior' },

  // Sidebar collapse
  'sidebar.expand': { en: 'Expand sidebar', es: 'Expandir barra lateral' },
  'sidebar.collapse': { en: 'Collapse sidebar', es: 'Colapsar barra lateral' },
};
