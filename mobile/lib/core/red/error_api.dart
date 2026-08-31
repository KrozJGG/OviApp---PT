import 'package:dio/dio.dart';

/// Error de negocio devuelto por la API.
///
/// El backend responde siempre con `{ error: { codigo, mensaje, detalles? } }`,
/// asi que la app tiene un unico punto de traduccion: el `mensaje` ya viene
/// redactado en espanol y se puede mostrar tal cual al usuario.
class ErrorApi implements Exception {
  const ErrorApi({
    required this.codigo,
    required this.mensaje,
    this.status,
    this.detalles,
  });

  final String codigo;
  final String mensaje;
  final int? status;
  final List<DetalleCampo>? detalles;

  /// La sesion caduco o fue revocada: la app debe volver al login.
  bool get requiereReautenticar =>
      status == 401 &&
      (codigo == 'TOKEN_EXPIRADO' ||
          codigo == 'TOKEN_INVALIDO' ||
          codigo == 'NO_AUTENTICADO' ||
          codigo == 'USUARIO_INHABILITADO');

  bool get esDeRed => codigo == 'SIN_CONEXION' || codigo == 'TIEMPO_AGOTADO';

  /// Mensaje de validacion asociado a un campo del formulario, si lo hay.
  String? mensajeDe(String campo) {
    for (final d in detalles ?? const <DetalleCampo>[]) {
      if (d.campo == campo) return d.mensaje;
    }
    return null;
  }

  factory ErrorApi.desdeDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ErrorApi(
          codigo: 'TIEMPO_AGOTADO',
          mensaje: 'El servidor tardó demasiado en responder. Revisa tu señal e inténtalo de nuevo.',
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return const ErrorApi(
          codigo: 'SIN_CONEXION',
          mensaje: 'No hay conexión con el servidor. Revisa tu señal e inténtalo de nuevo.',
        );
      case DioExceptionType.cancel:
        return const ErrorApi(codigo: 'CANCELADO', mensaje: 'La operación fue cancelada.');
      case DioExceptionType.badCertificate:
        return const ErrorApi(
          codigo: 'CERTIFICADO_INVALIDO',
          mensaje: 'No se pudo verificar la seguridad de la conexión.',
        );
      case DioExceptionType.badResponse:
        return ErrorApi.desdeRespuesta(e.response);
    }
  }

  factory ErrorApi.desdeRespuesta(Response<dynamic>? respuesta) {
    final status = respuesta?.statusCode;
    final cuerpo = respuesta?.data;

    if (cuerpo is Map && cuerpo['error'] is Map) {
      final error = cuerpo['error'] as Map;
      final detallesCrudos = error['detalles'];
      return ErrorApi(
        codigo: (error['codigo'] as String?) ?? 'DESCONOCIDO',
        mensaje: (error['mensaje'] as String?) ?? 'Ocurrió un error inesperado.',
        status: status,
        detalles: detallesCrudos is List
            ? detallesCrudos
                .whereType<Map>()
                .map(DetalleCampo.desdeMapa)
                .toList(growable: false)
            : null,
      );
    }

    return ErrorApi(
      codigo: 'DESCONOCIDO',
      mensaje: switch (status) {
        401 => 'Tu sesión expiró. Vuelve a iniciar sesión.',
        403 => 'Tu rol no permite realizar esta acción.',
        404 => 'No se encontró lo que buscabas.',
        >= 500 => 'El servidor tuvo un problema. Inténtalo nuevamente en unos minutos.',
        _ => 'Ocurrió un error inesperado.',
      },
      status: status,
    );
  }

  @override
  String toString() => 'ErrorApi($codigo, $status): $mensaje';
}

class DetalleCampo {
  const DetalleCampo({required this.campo, required this.mensaje});

  final String campo;
  final String mensaje;

  factory DetalleCampo.desdeMapa(Map<dynamic, dynamic> m) => DetalleCampo(
        campo: (m['campo'] as String?) ?? '',
        mensaje: (m['mensaje'] as String?) ?? '',
      );
}
