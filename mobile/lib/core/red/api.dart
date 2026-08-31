import 'package:dio/dio.dart';

import 'cliente_api.dart';
import 'paginado.dart';

/// Acceso a la API con los errores ya traducidos.
///
/// Toda la capa de datos de las features pasa por aqui y nunca captura
/// `DioException`: lo que sale de estos metodos es siempre un [ErrorApi], que es
/// lo unico que las pantallas saben mostrar.
extension ApiDio on Dio {
  /// GET que devuelve un objeto.
  Future<Map<String, dynamic>> traerMapa(
    String ruta, {
    Map<String, dynamic>? consulta,
  }) async {
    return _intentar(() async {
      final r = await get<Map<String, dynamic>>(
        ruta,
        queryParameters: _limpiar(consulta),
      );
      return r.data ?? const {};
    });
  }

  /// GET de un listado paginado `{ datos, meta }`.
  Future<Paginado<T>> traerPaginado<T>(
    String ruta,
    T Function(Map<String, dynamic>) mapear, {
    Map<String, dynamic>? consulta,
  }) async {
    final json = await traerMapa(ruta, consulta: consulta);
    return Paginado.desdeJson<T>(json, mapear);
  }

  Future<Map<String, dynamic>> enviar(
    String ruta, {
    Object? cuerpo,
    Map<String, dynamic>? consulta,
  }) async {
    return _intentar(() async {
      final r = await post<Map<String, dynamic>>(
        ruta,
        data: cuerpo,
        queryParameters: _limpiar(consulta),
      );
      return r.data ?? const {};
    });
  }

  Future<Map<String, dynamic>> parchar(String ruta, {Object? cuerpo}) async {
    return _intentar(() async {
      final r = await patch<Map<String, dynamic>>(ruta, data: cuerpo);
      return r.data ?? const {};
    });
  }

  /// DELETE. El backend responde 204 sin cuerpo.
  Future<void> borrar(String ruta) async {
    await _intentar(() async {
      await delete<void>(ruta);
      return const <String, dynamic>{};
    });
  }
}

Future<T> _intentar<T>(Future<T> Function() accion) async {
  try {
    return await accion();
  } catch (e, s) {
    Error.throwWithStackTrace(comoErrorApi(e), s);
  }
}

/// Quita las claves sin valor para no enviar `?estado=null` a la API.
Map<String, dynamic>? _limpiar(Map<String, dynamic>? consulta) {
  if (consulta == null) return null;
  final limpio = <String, dynamic>{};
  for (final (clave, valor) in consulta.entries.map((e) => (e.key, e.value))) {
    if (valor == null) continue;
    if (valor is String && valor.trim().isEmpty) continue;
    limpio[clave] = valor;
  }
  return limpio.isEmpty ? null : limpio;
}
