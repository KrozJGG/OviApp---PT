import 'dart:io';
import 'dart:typed_data';

/// Guarda el archivo exportado en el almacenamiento local del dispositivo
/// (carpeta Descargas en Android si es escribible, o carpeta temporal del sistema)
/// y retorna un mensaje legible con la ubicación guardada.
Future<String> guardarArchivoExportado({
  required Uint8List bytes,
  required String nombreArchivo,
  required String tipoMime,
}) async {
  Directory destino = Directory.systemTemp;

  if (Platform.isAndroid) {
    final descargas = Directory('/storage/emulated/0/Download');
    try {
      if (await descargas.exists()) {
        final prueba = File('${descargas.path}/$nombreArchivo');
        await prueba.writeAsBytes(bytes, flush: true);
        return 'Guardado en Descargas/$nombreArchivo';
      }
    } catch (_) {
      // Sin permiso de almacenamiento externo: usamos el directorio temporal.
    }
  }

  final archivo = File('${destino.path}${Platform.pathSeparator}$nombreArchivo');
  await archivo.writeAsBytes(bytes, flush: true);
  return 'Reporte guardado en ${archivo.path}';
}
