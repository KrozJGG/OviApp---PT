import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Descarga el archivo PDF o CSV directamente desde el navegador en Flutter Web.
Future<String> guardarArchivoExportado({
  required Uint8List bytes,
  required String nombreArchivo,
  required String tipoMime,
}) async {
  final blob = web.Blob(
    <JSAny>[bytes.toJS].toJS,
    web.BlobPropertyBag(type: tipoMime),
  );
  final url = web.URL.createObjectURL(blob);
  final enlace = web.HTMLAnchorElement()
    ..href = url
    ..download = nombreArchivo;
  enlace.click();
  web.URL.revokeObjectURL(url);
  return 'Descarga iniciada: $nombreArchivo';
}
