/// Guardado/descarga multiplataforma de reportes exportados (PDF y CSV).
library;

export 'descargador_archivo_nativo.dart'
    if (dart.library.js_interop) 'descargador_archivo_web.dart';
