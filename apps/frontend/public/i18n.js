// UI translations for Ghostdrop.
//
// Keys are flat dotted strings and values may contain `{placeholder}` tokens
// filled in by t(). The English catalog doubles as the source of truth for API
// error messages: test/i18n.test.js checks that every catalog has the same keys
// and that `error.*` entries match the backend's httpError() messages.
//
// Pick a language in this order: ?lang= query parameter, saved choice,
// browser preferences, English.

export const languages = [
  { code: 'en', tag: 'en', label: 'English' },
  { code: 'es', tag: 'es-ES', label: 'Español' },
];

const en = {
  'meta.title': 'Ghostdrop · temporary file sharing',
  'meta.description': 'Drop a file. Share a link. Let it disappear.',
  'brand.home': 'Ghostdrop home',
  'footer.tagline': 'Drop a file. Share a link. Let it disappear.',
  'footer.source': 'Source',
  'language.label': 'Language',

  'landing.dropTitle': 'Drop a file.',
  'landing.chooseHtml': 'Or <span class="text-link">choose a file</span> to share.',
  'landing.selectFile': 'Select a file',
  'landing.chooseFile': 'Choose a file',
  'landing.checkingLimit': 'Checking upload limit…',
  'landing.limit': 'Up to {size} per file.',
  'landing.limitUnavailable': 'Upload limit unavailable. Please refresh.',

  'upload.ready': 'Ready when you are',
  'upload.stateReady': '{size} · ready to upload',
  'upload.changeFile': 'Choose another file',
  'upload.replaceFile': 'Replace selected file',
  'upload.removeFile': 'Remove selected file',
  'upload.keepFor': 'Keep it for',
  'upload.oneHour': 'One hour',
  'upload.oneDay': 'One day',
  'upload.oneWeek': 'One week',
  'upload.oneMonth': 'One month',
  'upload.password': 'Password',
  'upload.optional': 'Optional',
  'upload.passwordNote': 'Access protection, without encryption.',
  'upload.oneTime': 'One-time download',
  'upload.oneTimeNote': 'Deleted after the first download starts, even if interrupted.',
  'upload.notUploaded': 'Not uploaded yet',
  'upload.submit': 'Upload file',
  'upload.oneFileAtATime': 'Choose one file at a time.',
  'upload.eyebrowUploading': 'Uploading',
  'upload.stateUploading': '{size} · uploading',
  'upload.noteInProgress': 'Upload in progress',
  'upload.progressLabel': 'Upload progress',
  'upload.starting': 'Starting upload…',
  'upload.cancel': 'Cancel upload',
  'upload.cancelling': 'Cancelling upload…',
  'upload.retrying': 'Connection interrupted. Retrying…',
  'upload.connectionLost': 'The connection was interrupted.',
  'upload.timeout': 'The upload request timed out.',
  'upload.requestFailed': 'The upload request failed. Try again.',
  'upload.badAck': 'Invalid upload acknowledgement.',
  'upload.saveSlow': 'Saving is taking longer than expected. Click Upload to check again.',
  'upload.tooLarge': 'This file is too large. The limit is {size}.',
  'upload.progress': 'Uploading… {percent}%',
  'upload.saving': 'Saving your file…',
  'upload.cancelledSelected': 'Upload cancelled. Your file is still selected.',
  'upload.cancelledExpire': 'Upload cancelled. Unfinished uploads expire automatically.',
  'upload.retryHint': '{message} Your file is still selected; click Upload to retry.',

  'receipt.eyebrow': 'Ready to share',
  'receipt.title': 'Your file is up.',
  'receipt.shareLink': 'Share file',
  'receipt.copyShare': 'Copy share link',
  'receipt.directLink': 'Direct download',
  'receipt.copyDirect': 'Copy direct download link',
  'receipt.deleteLink': 'Delete file',
  'receipt.copyDelete': 'Copy private deletion link',
  'receipt.keepPrivate': ' · keep this private',
  'receipt.copy': 'Copy',
  'receipt.copied': 'Copied',
  'receipt.linkCopied': 'Link copied.',
  'receipt.copyManually': 'Select and copy the link manually.',
  'receipt.passwordBadge': 'Password protected',
  'receipt.oneTimeBadge': 'One-time download',
  'receipt.expires': 'Expires {date}.',
  'receipt.oneTimeExpires':
    'Deleted when the first download starts, even if interrupted. Otherwise, expires {date}.',
  'receipt.passwordNote':
    'Share the password separately. It protects access; the file is not encrypted.',
  'receipt.uploadAnother': 'Upload another file',
  'receipt.saveDeletion': 'Save the private deletion link if you want to remove the file early.',

  'file.finding': 'Finding your file…',
  'file.goneEyebrow': 'Gone for good',
  'file.unavailableTitle': 'File unavailable.',
  'file.shareNew': 'Share a new file',
  'file.deleted': 'The file has been deleted.',
  'file.privateEyebrow': 'Private deletion link',
  'file.sharedEyebrow': 'Shared file',
  'file.sizeExpires': '{size} · Expires {date}',
  'file.oneTimeNote':
    'One-time file. Starting the download deletes the stored file, even if the transfer is interrupted.',
  'file.deleteWarning': 'This permanently deletes the file and its sharing links.',
  'file.deleteButton': 'Delete this file',
  'file.passwordLabel': 'File password',
  'file.unlock': 'Unlock file',
  'file.download': 'Download file',
  'file.previewDisabled': 'Preview is disabled for password-protected files.',
  'file.oneTimeStarted': 'The one-time download has started. This link has been consumed.',
  'file.previewFailed': 'The image preview could not be loaded. You can still download the file.',

  'restricted.eyebrow': 'Uploads restricted',
  'restricted.title': 'Uploads are private here.',
  'restricted.body':
    'This Ghostdrop server only accepts uploads from approved networks. Shared links still work.',

  'unlock.eyebrow': 'Private uploads',
  'unlock.title': 'Enter the upload password.',
  'unlock.password': 'Upload password',
  'unlock.submit': 'Unlock uploads',

  'admin.eyebrow': 'Ghostdrop admin',
  'admin.welcome': 'Welcome back.',
  'admin.password': 'Admin password',
  'admin.signIn': 'Sign in',
  'admin.yourFiles': 'Your files.',
  'admin.signOut': 'Sign out',
  'admin.searchFiles': 'Search files',
  'admin.searchPlaceholder': 'Search files…',
  'admin.searchBy': 'Search by',
  'admin.byName': 'Filename',
  'admin.byHash': 'SHA-256',
  'admin.byLink': 'Link or ID',
  'admin.search': 'Search',
  'admin.cleanup': 'Clean expired & unfinished uploads',
  'admin.refresh': 'Refresh',
  'admin.cleanupDone': 'Removed {files} files and {partials} unfinished uploads.',
  'admin.stats': '{count} files · {stored} stored · {partial} in progress',
  'admin.colFile': 'File',
  'admin.colAccess': 'Size & access',
  'admin.colDates': 'Dates',
  'admin.colActions': 'Actions',
  'admin.passwordProtected': 'Password protected',
  'admin.noPassword': 'No password',
  'admin.oneTime': 'One-time download',
  'admin.reusable': 'Reusable download',
  'admin.uploaded': 'Uploaded {date}',
  'admin.expires': 'Expires {date}',
  'admin.download': 'Download',
  'admin.delete': 'Delete',
  'admin.empty': 'No files found.',
  'admin.confirmDelete': 'Permanently delete “{name}” and its sharing links?',
  'admin.confirmOneTime':
    'This is a one-time file. Downloading it deletes the stored file. Continue?',
  'admin.deleted': 'File deleted.',
  'admin.previous': 'Previous',
  'admin.next': 'Next',
  'admin.range': '{from}–{to} of {total}',
  'admin.sessionExpired': 'Your session has expired. Please sign in again.',
  'admin.stateExpired': 'Expired',
  'admin.stateDeleting': 'Being deleted',

  'error.request_failed': 'Request failed.',
  'error.internal_error': 'Something went wrong. Please try again.',
  'error.route_not_found': 'API route not found.',
  'error.backend_unavailable': 'Backend is unavailable. Please try again.',
  'error.save_failed': 'The file could not be saved. Try again.',
  'error.cross_site': 'Cross-site requests are not allowed.',
  'error.rate_limited': 'Too many requests. Please try again later.',
  'error.too_many_attempts': 'Too many attempts. Please try again in 15 minutes.',
  'error.try_again_later': 'Please try again later.',
  'error.incorrect_password': 'That password is incorrect.',
  'error.admin_disabled': 'Admin access is disabled. Configure an admin password hash first.',
  'error.sign_in_required': 'Sign in to continue.',
  'error.session_invalid': 'Your session could not authorize this request. Refresh and try again.',
  'error.storage_unavailable': 'File storage is unavailable. Please try again.',
  'error.storage_full': 'This server is out of upload space. Try again later.',
  'error.invalid_pagination': 'Invalid pagination.',
  'error.search_too_long': 'The search is too long.',
  'error.invalid_hash': 'Enter a complete SHA-256 hash.',
  'error.invalid_file_reference': 'Enter a share ID or a Ghostdrop file link.',
  'error.invalid_search_type': 'Choose a valid search type.',
  'error.file_unavailable': 'This file is no longer available.',
  'error.file_expired': 'This file has expired and has been deleted.',
  'error.file_password_required': 'Enter the file password to continue.',
  'error.invalid_deletion_link': 'This deletion link is invalid.',
  'error.download_method_not_allowed': 'Use the download page to start a download.',
  'error.range_not_supported': 'Partial downloads are not supported.',
  'error.preview_unavailable': 'Preview is not available for this file.',
  'error.upload_session_not_found': 'Upload session not found.',
  'error.upload_session_expired': 'This upload session has expired. Start again.',
  'error.upload_busy': 'This upload is busy. Try again.',
  'error.upload_not_accepting': 'This upload is not accepting chunks.',
  'error.upload_cancelled': 'Upload cancelled.',
  'error.upload_id_in_use': 'This upload ID is already in use.',
  'error.upload_settings_changed': 'The upload settings have changed. Start a new upload.',
  'error.upload_incomplete': 'The upload is not complete yet.',
  'error.too_many_uploads': 'Too many active uploads. Try again later.',
  'error.invalid_file': 'Choose a valid file.',
  'error.file_exceeds_limit': 'This file exceeds the upload limit.',
  'error.invalid_upload_settings': 'Invalid upload settings.',
  'error.invalid_upload_credentials': 'Invalid upload credentials.',
  'error.missing_chunk_offset': 'Provide a valid chunk offset.',
  'error.invalid_chunk_offset': 'Invalid chunk offset.',
  'error.send_raw_bytes': 'Send raw file bytes.',
  'error.chunk_too_large': 'The upload chunk is too large.',
  'error.chunk_empty': 'The chunk is empty.',
  'error.chunk_interrupted': 'The chunk was interrupted. Retry it.',
  'error.chunk_offset_ahead': 'The chunk offset is ahead of the upload.',
  'error.chunk_exceeds_size': 'The chunk exceeds the declared file size.',
  'error.chunk_overlap': 'The chunk overlaps unacknowledged bytes.',
  'error.chunk_mismatch': 'The retried chunk does not match the stored bytes.',
  'error.uploads_restricted': 'Uploads are restricted on this server.',
  'error.upload_password_required': 'Enter the upload password to continue.',
};

const es = {
  'meta.title': 'Ghostdrop · compartir archivos temporales',
  'meta.description': 'Suelta un archivo. Comparte un enlace. Déjalo desaparecer.',
  'brand.home': 'Inicio de Ghostdrop',
  'footer.tagline': 'Suelta un archivo. Comparte un enlace. Déjalo desaparecer.',
  'footer.source': 'Código fuente',
  'language.label': 'Idioma',

  'landing.dropTitle': 'Suelta un archivo.',
  'landing.chooseHtml': 'O <span class="text-link">elige un archivo</span> para compartir.',
  'landing.selectFile': 'Selecciona un archivo',
  'landing.chooseFile': 'Elige un archivo',
  'landing.checkingLimit': 'Comprobando el límite de subida…',
  'landing.limit': 'Hasta {size} por archivo.',
  'landing.limitUnavailable': 'El límite de subida no está disponible. Recarga la página.',

  'upload.ready': 'Listo cuando quieras',
  'upload.stateReady': '{size} · listo para subir',
  'upload.changeFile': 'Elige otro archivo',
  'upload.replaceFile': 'Sustituir el archivo seleccionado',
  'upload.removeFile': 'Quitar el archivo seleccionado',
  'upload.keepFor': 'Conservar durante',
  'upload.oneHour': 'Una hora',
  'upload.oneDay': 'Un día',
  'upload.oneWeek': 'Una semana',
  'upload.oneMonth': 'Un mes',
  'upload.password': 'Contraseña',
  'upload.optional': 'Opcional',
  'upload.passwordNote': 'Protege el acceso, sin cifrado.',
  'upload.oneTime': 'Descarga única',
  'upload.oneTimeNote': 'Se elimina al empezar la primera descarga, aunque se interrumpa.',
  'upload.notUploaded': 'Aún no se ha subido',
  'upload.submit': 'Subir archivo',
  'upload.oneFileAtATime': 'Elige un archivo cada vez.',
  'upload.eyebrowUploading': 'Subiendo',
  'upload.stateUploading': '{size} · subiendo',
  'upload.noteInProgress': 'Subida en curso',
  'upload.progressLabel': 'Progreso de la subida',
  'upload.starting': 'Iniciando la subida…',
  'upload.cancel': 'Cancelar subida',
  'upload.cancelling': 'Cancelando la subida…',
  'upload.retrying': 'Se ha interrumpido la conexión. Reintentando…',
  'upload.connectionLost': 'Se ha interrumpido la conexión.',
  'upload.timeout': 'La solicitud de subida ha agotado el tiempo de espera.',
  'upload.requestFailed': 'La solicitud de subida ha fallado. Inténtalo de nuevo.',
  'upload.badAck': 'Confirmación de subida no válida.',
  'upload.saveSlow':
    'El guardado está tardando más de lo esperado. Pulsa Subir para volver a comprobarlo.',
  'upload.tooLarge': 'Este archivo es demasiado grande. El límite es {size}.',
  'upload.progress': 'Subiendo… {percent} %',
  'upload.saving': 'Guardando tu archivo…',
  'upload.cancelledSelected': 'Subida cancelada. Tu archivo sigue seleccionado.',
  'upload.cancelledExpire': 'Subida cancelada. Las subidas sin terminar caducan solas.',
  'upload.retryHint': '{message} Tu archivo sigue seleccionado; pulsa Subir para reintentarlo.',

  'receipt.eyebrow': 'Listo para compartir',
  'receipt.title': 'Tu archivo ya está disponible.',
  'receipt.shareLink': 'Enlace para compartir',
  'receipt.copyShare': 'Copiar enlace para compartir',
  'receipt.directLink': 'Descarga directa',
  'receipt.copyDirect': 'Copiar enlace de descarga directa',
  'receipt.deleteLink': 'Eliminar archivo',
  'receipt.copyDelete': 'Copiar enlace privado de borrado',
  'receipt.keepPrivate': ' · guárdalo en privado',
  'receipt.copy': 'Copiar',
  'receipt.copied': 'Copiado',
  'receipt.linkCopied': 'Enlace copiado.',
  'receipt.copyManually': 'Selecciona y copia el enlace a mano.',
  'receipt.passwordBadge': 'Protegido con contraseña',
  'receipt.oneTimeBadge': 'Descarga única',
  'receipt.expires': 'Caduca el {date}.',
  'receipt.oneTimeExpires':
    'Se elimina al empezar la primera descarga, aunque se interrumpa. Si no, caduca el {date}.',
  'receipt.passwordNote':
    'Comparte la contraseña por otro medio. Protege el acceso, pero el archivo no está cifrado.',
  'receipt.uploadAnother': 'Subir otro archivo',
  'receipt.saveDeletion':
    'Guarda el enlace privado de borrado si quieres eliminar el archivo antes de tiempo.',

  'file.finding': 'Buscando tu archivo…',
  'file.goneEyebrow': 'Ya no está',
  'file.unavailableTitle': 'Archivo no disponible.',
  'file.shareNew': 'Compartir otro archivo',
  'file.deleted': 'El archivo se ha eliminado.',
  'file.privateEyebrow': 'Enlace privado de borrado',
  'file.sharedEyebrow': 'Archivo compartido',
  'file.sizeExpires': '{size} · Caduca el {date}',
  'file.oneTimeNote':
    'Archivo de descarga única. Al empezar la descarga se borra el archivo guardado, aunque la transferencia se interrumpa.',
  'file.deleteWarning': 'Esto borra para siempre el archivo y sus enlaces para compartirlo.',
  'file.deleteButton': 'Eliminar este archivo',
  'file.passwordLabel': 'Contraseña del archivo',
  'file.unlock': 'Desbloquear archivo',
  'file.download': 'Descargar archivo',
  'file.previewDisabled': 'La vista previa está desactivada en los archivos con contraseña.',
  'file.oneTimeStarted': 'La descarga única ha comenzado. Este enlace ya se ha usado.',
  'file.previewFailed':
    'No se ha podido cargar la vista previa de la imagen. Puedes descargar el archivo igualmente.',

  'restricted.eyebrow': 'Subidas restringidas',
  'restricted.title': 'Aquí las subidas son privadas.',
  'restricted.body':
    'Este servidor de Ghostdrop solo acepta subidas desde redes autorizadas. Los enlaces compartidos siguen funcionando.',

  'unlock.eyebrow': 'Subidas privadas',
  'unlock.title': 'Introduce la contraseña de subida.',
  'unlock.password': 'Contraseña de subida',
  'unlock.submit': 'Desbloquear subidas',

  'admin.eyebrow': 'Administración de Ghostdrop',
  'admin.welcome': 'Bienvenido de nuevo.',
  'admin.password': 'Contraseña de administración',
  'admin.signIn': 'Iniciar sesión',
  'admin.yourFiles': 'Tus archivos.',
  'admin.signOut': 'Cerrar sesión',
  'admin.searchFiles': 'Buscar archivos',
  'admin.searchPlaceholder': 'Buscar archivos…',
  'admin.searchBy': 'Buscar por',
  'admin.byName': 'Nombre',
  'admin.byHash': 'SHA-256',
  'admin.byLink': 'Enlace o ID',
  'admin.search': 'Buscar',
  'admin.cleanup': 'Limpiar archivos caducados y subidas a medias',
  'admin.refresh': 'Actualizar',
  'admin.cleanupDone': 'Se han eliminado {files} archivos y {partials} subidas a medias.',
  'admin.stats': '{count} archivos · {stored} almacenados · {partial} en curso',
  'admin.colFile': 'Archivo',
  'admin.colAccess': 'Tamaño y acceso',
  'admin.colDates': 'Fechas',
  'admin.colActions': 'Acciones',
  'admin.passwordProtected': 'Con contraseña',
  'admin.noPassword': 'Sin contraseña',
  'admin.oneTime': 'Descarga única',
  'admin.reusable': 'Descarga reutilizable',
  'admin.uploaded': 'Subido el {date}',
  'admin.expires': 'Caduca el {date}',
  'admin.download': 'Descargar',
  'admin.delete': 'Eliminar',
  'admin.empty': 'No se han encontrado archivos.',
  'admin.confirmDelete': '¿Eliminar para siempre «{name}» y sus enlaces para compartirlo?',
  'admin.confirmOneTime':
    'Este archivo es de descarga única. Si lo descargas, se borra el archivo guardado. ¿Continuar?',
  'admin.deleted': 'Archivo eliminado.',
  'admin.previous': 'Anterior',
  'admin.next': 'Siguiente',
  'admin.range': '{from}–{to} de {total}',
  'admin.sessionExpired': 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  'admin.stateExpired': 'Caducado',
  'admin.stateDeleting': 'Borrándose',

  'error.request_failed': 'La solicitud ha fallado.',
  'error.internal_error': 'Algo ha ido mal. Inténtalo de nuevo.',
  'error.route_not_found': 'Ruta de la API no encontrada.',
  'error.backend_unavailable': 'El servidor no está disponible. Inténtalo de nuevo.',
  'error.save_failed': 'No se ha podido guardar el archivo. Inténtalo de nuevo.',
  'error.cross_site': 'No se permiten solicitudes desde otros sitios.',
  'error.rate_limited': 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  'error.too_many_attempts': 'Demasiados intentos. Inténtalo de nuevo dentro de 15 minutos.',
  'error.try_again_later': 'Inténtalo de nuevo más tarde.',
  'error.incorrect_password': 'Esa contraseña no es correcta.',
  'error.admin_disabled':
    'El acceso de administración está desactivado. Configura antes un hash de contraseña.',
  'error.sign_in_required': 'Inicia sesión para continuar.',
  'error.session_invalid':
    'Tu sesión no ha podido autorizar esta solicitud. Recarga la página e inténtalo de nuevo.',
  'error.storage_unavailable': 'El almacenamiento no está disponible. Inténtalo de nuevo.',
  'error.storage_full': 'Este servidor no tiene espacio para más subidas. Inténtalo más tarde.',
  'error.invalid_pagination': 'Paginación no válida.',
  'error.search_too_long': 'La búsqueda es demasiado larga.',
  'error.invalid_hash': 'Introduce un hash SHA-256 completo.',
  'error.invalid_file_reference': 'Introduce un ID de archivo o un enlace de Ghostdrop.',
  'error.invalid_search_type': 'Elige un tipo de búsqueda válido.',
  'error.file_unavailable': 'Este archivo ya no está disponible.',
  'error.file_expired': 'Este archivo ha caducado y se ha borrado.',
  'error.file_password_required': 'Introduce la contraseña del archivo para continuar.',
  'error.invalid_deletion_link': 'Este enlace de borrado no es válido.',
  'error.download_method_not_allowed': 'Usa la página de descarga para iniciar una descarga.',
  'error.range_not_supported': 'No se admiten descargas parciales.',
  'error.preview_unavailable': 'La vista previa no está disponible para este archivo.',
  'error.upload_session_not_found': 'No se ha encontrado la sesión de subida.',
  'error.upload_session_expired': 'Esta sesión de subida ha caducado. Empieza de nuevo.',
  'error.upload_busy': 'Esta subida está ocupada. Inténtalo de nuevo.',
  'error.upload_not_accepting': 'Esta subida no acepta fragmentos.',
  'error.upload_cancelled': 'Subida cancelada.',
  'error.upload_id_in_use': 'Este ID de subida ya está en uso.',
  'error.upload_settings_changed': 'Los ajustes de subida han cambiado. Empieza una subida nueva.',
  'error.upload_incomplete': 'La subida todavía no ha terminado.',
  'error.too_many_uploads': 'Hay demasiadas subidas activas. Inténtalo de nuevo más tarde.',
  'error.invalid_file': 'Elige un archivo válido.',
  'error.file_exceeds_limit': 'Este archivo supera el límite de subida.',
  'error.invalid_upload_settings': 'Ajustes de subida no válidos.',
  'error.invalid_upload_credentials': 'Credenciales de subida no válidas.',
  'error.missing_chunk_offset': 'Indica un desplazamiento de fragmento válido.',
  'error.invalid_chunk_offset': 'Desplazamiento de fragmento no válido.',
  'error.send_raw_bytes': 'Envía los bytes del archivo en bruto.',
  'error.chunk_too_large': 'El fragmento de la subida es demasiado grande.',
  'error.chunk_empty': 'El fragmento está vacío.',
  'error.chunk_interrupted': 'El fragmento se ha interrumpido. Reinténtalo.',
  'error.chunk_offset_ahead': 'El desplazamiento del fragmento va por delante de la subida.',
  'error.chunk_exceeds_size': 'El fragmento supera el tamaño declarado del archivo.',
  'error.chunk_overlap': 'El fragmento se solapa con bytes sin confirmar.',
  'error.chunk_mismatch': 'El fragmento reintentado no coincide con los bytes guardados.',
  'error.uploads_restricted': 'Las subidas están restringidas en este servidor.',
  'error.upload_password_required': 'Introduce la contraseña de subida para continuar.',
};

export const catalogs = { en, es };
export const defaultLanguage = 'en';

const storageKey = 'ghostdrop.language';
let current = defaultLanguage;
const listeners = new Set();

export const supported = (code) =>
  typeof code === 'string' && Object.hasOwn(catalogs, code) ? code : undefined;

export function language() {
  return current;
}

export function languageTag() {
  return (languages.find(({ code }) => code === current) || languages[0]).tag;
}

export function hasMessage(key) {
  return key in en;
}

export function t(key, params) {
  const message = catalogs[current]?.[key] ?? en[key];
  if (message === undefined) {
    console.warn(`Missing translation: ${key}`);
    return key;
  }
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

// Turns an API error code into a localized message. Older servers only send a
// message, so anything that is not a known code is shown as-is.
export function errorText(code, fallback) {
  if (typeof code !== 'string' || !code) return fallback || t('error.request_failed');
  const key = `error.${code}`;
  return hasMessage(key) ? t(key) : fallback || code;
}

export function storedLanguage() {
  try {
    return supported(localStorage.getItem(storageKey));
  } catch {
    return undefined;
  }
}

function persist(code) {
  try {
    localStorage.setItem(storageKey, code);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies); the choice
    // then only lasts for the current page.
  }
}

// Matches "es-ES", "es-419" and "es" to the closest catalog, ignoring case.
export function preferredLanguage(candidates) {
  for (const candidate of candidates || [])
    if (
      supported(
        String(candidate ?? '')
          .toLowerCase()
          .split('-')[0],
      )
    )
      return String(candidate).toLowerCase().split('-')[0];
  return undefined;
}

export function resolveLanguage() {
  const fromUrl = supported(new URLSearchParams(location.search).get('lang'));
  if (fromUrl) {
    persist(fromUrl);
    return fromUrl;
  }
  const saved = storedLanguage();
  if (saved) return saved;
  return preferredLanguage([...(navigator.languages || []), navigator.language]) || defaultLanguage;
}

const translationAttributes = [
  ['data-i18n', (element, value) => (element.textContent = value)],
  ['data-i18n-html', (element, value) => (element.innerHTML = value)],
  ['data-i18n-label', (element, value) => element.setAttribute('aria-label', value)],
  ['data-i18n-placeholder', (element, value) => element.setAttribute('placeholder', value)],
  ['data-i18n-content', (element, value) => element.setAttribute('content', value)],
];

// Translates a subtree, including the shell markup from index.html, so views
// re-inserted after a language change keep their data-i18n hooks.
export function applyTranslations(root = document) {
  if (!root?.querySelectorAll) return;
  for (const [attribute, apply] of translationAttributes)
    for (const element of root.querySelectorAll(`[${attribute}]`))
      apply(element, t(element.getAttribute(attribute)));
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyLanguage(code) {
  current = supported(code) || defaultLanguage;
  persist(current);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = languageTag();
    applyTranslations(document);
    for (const button of document.querySelectorAll('#language button'))
      button.setAttribute('aria-pressed', String(button.value === current));
  }
  for (const listener of listeners) listener(current);
  return current;
}

export function initLanguage() {
  const picker = document.querySelector('#language');
  if (picker) {
    picker.insertAdjacentHTML(
      'beforeend',
      languages
        .map(
          ({ code, tag, label }) =>
            `<button type="button" value="${code}" lang="${tag}">${label}</button>`,
        )
        .join(''),
    );
    picker.onclick = ({ target }) => {
      if (target.closest('button')) applyLanguage(target.closest('button').value);
    };
    picker.hidden = false;
  }
  return applyLanguage(resolveLanguage());
}
