import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/cliente_api.dart';
import 'datos/acceso_stream.dart';
import 'datos/alerta.dart';

/// IF2-SAL — estado del dispositivo edge y último conteo detectado.
final estadoVigilanciaProvider = FutureProvider.autoDispose<EstadoVigilancia>((ref) async {
  final json = await ref.watch(dioProvider).traerMapa('/vigilancia/estado');
  return EstadoVigilancia.desdeJson(json);
});

/// Detalle de una alerta; es el destino del deep-link de la push.
final alertaProvider = FutureProvider.autoDispose.family<Alerta, String>((ref, id) async {
  final json = await ref.watch(dioProvider).traerMapa('/alertas/$id');
  return Alerta.desdeJson(json);
});

final vigilanciaRepositorioProvider = Provider<VigilanciaRepositorio>(
  VigilanciaRepositorio.new,
);

class VigilanciaRepositorio {
  const VigilanciaRepositorio(this._ref);

  final Ref _ref;

  /// Marca una alerta como revisada.
  Future<Alerta> revisar(String id) async {
    final json = await _ref.read(dioProvider).enviar('/alertas/$id/revisar');
    return Alerta.desdeJson(json);
  }

  /// Pide permiso para ver la cámara en vivo y deja lista la URL del manifiesto.
  ///
  /// Antes de devolverla comprueba que el manifiesto responda: el permiso se
  /// emite sin consultar al servidor de streaming, así que esta es la primera
  /// señal de que la cámara está transmitiendo de verdad. Sin esta comprobación
  /// el reproductor se quedaría cargando para siempre con la cámara apagada, sin
  /// poder explicar por qué.
  Future<AccesoStream> accesoStream(String idDispositivo) async {
    final dio = _ref.read(dioProvider);

    final json = await dio.enviar(
      '/streaming/token',
      cuerpo: {'idDispositivo': idDispositivo},
    );

    final url = Uri.parse('${dio.options.baseUrl}${json['url']}');

    try {
      await dio.get<String>(
        url.toString(),
        options: Options(responseType: ResponseType.plain),
      );
    } catch (e, s) {
      Error.throwWithStackTrace(comoErrorApi(e), s);
    }

    return AccesoStream(
      url: url,
      expiraEnSeg: (json['expiraEnSeg'] as num?)?.toInt() ?? 600,
    );
  }
}
