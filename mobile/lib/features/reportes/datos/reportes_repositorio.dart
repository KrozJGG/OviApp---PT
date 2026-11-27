import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/red/cliente_api.dart';
import 'reporte.dart';

class ArchivoExportado {
  const ArchivoExportado({
    required this.bytes,
    required this.nombreArchivo,
    required this.tipoMime,
  });

  final Uint8List bytes;
  final String nombreArchivo;
  final String tipoMime;
}

class ReportesRepositorio {
  const ReportesRepositorio(this._api);

  final ClienteApi _api;

  /// RF23 — Consulta el panel consolidado para el rango indicado.
  Future<ResumenReporte> obtenerResumen(RangoReporte rango) async {
    final r = await _api.dio.get<Map<String, dynamic>>(
      '/reportes/resumen',
      queryParameters: {
        'desde': rango.desde,
        'hasta': rango.hasta,
      },
    );
    return ResumenReporte.desdeJson(r.data!);
  }

  /// RF24 / IF4-SAL — Descarga el reporte en PDF o CSV desde el backend.
  Future<ArchivoExportado> exportar({
    required RangoReporte rango,
    required String formato,
  }) async {
    final r = await _api.dio.get<List<int>>(
      '/reportes/exportar',
      queryParameters: {
        'desde': rango.desde,
        'hasta': rango.hasta,
        'formato': formato,
      },
      options: Options(responseType: ResponseType.bytes),
    );

    final bytes = Uint8List.fromList(r.data ?? const <int>[]);
    final nombreArchivo =
        'oviapp-reporte-${rango.desde}_a_${rango.hasta}.$formato';
    final tipoMime = formato == 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';

    return ArchivoExportado(
      bytes: bytes,
      nombreArchivo: nombreArchivo,
      tipoMime: tipoMime,
    );
  }
}
