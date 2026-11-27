import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formato.dart';
import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/cliente_api.dart';
import '../../core/red/paginado.dart';
import 'datos/acceso_stream.dart';
import 'datos/alerta.dart';
import 'datos/region_interes.dart';

/// IF2-SAL — estado del dispositivo edge y último conteo detectado.
/// Se refresca cada 5 s para reflejar los heartbeats del ia-engine (< 10 s).
final estadoVigilanciaProvider = FutureProvider.autoDispose<EstadoVigilancia>((ref) async {
  final timer = Timer(const Duration(seconds: 5), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  final json = await ref.watch(dioProvider).traerMapa('/vigilancia/estado');
  return EstadoVigilancia.desdeJson(json);
});

/// Alertas actualmente PENDIENTE del predio. Se actualiza al instante via Socket.IO
/// (invalidado desde `CoordinadorAlertasRealtime`) y tambien en cada apertura.
final alertasPendientesProvider = FutureProvider.autoDispose<List<AlertaVigilancia>>((ref) async {
  final paginado = await ref.watch(dioProvider).traerPaginado<AlertaVigilancia>(
        '/alertas',
        AlertaVigilancia.desdeJson,
        consulta: const {'estado': 'PENDIENTE', 'tamano': 20},
      );
  return paginado.datos;
});

/// Filtros inmutables del Historial de Alertas.
class FiltroHistorialAlertas {
  const FiltroHistorialAlertas({
    this.estado,
    this.desde,
    this.hasta,
    this.pagina = 1,
    this.tamano = 20,
  });

  final String? estado;
  final DateTime? desde;
  final DateTime? hasta;
  final int pagina;
  final int tamano;

  Map<String, dynamic> aConsulta() => {
        if (estado != null) 'estado': estado,
        if (desde != null) 'desde': Fmt.iso(desde!),
        if (hasta != null) 'hasta': Fmt.iso(hasta!),
        'pagina': pagina,
        'tamano': tamano,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FiltroHistorialAlertas &&
          estado == other.estado &&
          desde == other.desde &&
          hasta == other.hasta &&
          pagina == other.pagina &&
          tamano == other.tamano;

  @override
  int get hashCode => Object.hash(estado, desde, hasta, pagina, tamano);
}

final historialAlertasProvider = FutureProvider.autoDispose
    .family<Paginado<AlertaVigilancia>, FiltroHistorialAlertas>((ref, filtro) async {
  return ref.watch(dioProvider).traerPaginado<AlertaVigilancia>(
        '/alertas',
        AlertaVigilancia.desdeJson,
        consulta: filtro.aConsulta(),
      );
});

final vigilanciaRepositorioProvider = Provider<VigilanciaRepositorio>(
  VigilanciaRepositorio.new,
);

class VigilanciaRepositorio {
  const VigilanciaRepositorio(this._ref);

  final Ref _ref;

  /// Pide permiso para ver la cámara en vivo y deja lista la URL del manifiesto.
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

  /// Guarda o reemplaza la Región de Interés del dispositivo (solo Productor).
  Future<void> guardarRegionInteres(String idDispositivo, RegionInteres roi) async {
    final dio = _ref.read(dioProvider);
    await dio.poner('/vigilancia/dispositivos/$idDispositivo/roi', cuerpo: roi.aJson());
    _ref.invalidate(estadoVigilanciaProvider);
  }

  /// Elimina la Región de Interés para volver al análisis de imagen completa.
  Future<void> eliminarRegionInteres(String idDispositivo) async {
    final dio = _ref.read(dioProvider);
    await dio.borrar('/vigilancia/dispositivos/$idDispositivo/roi');
    _ref.invalidate(estadoVigilanciaProvider);
  }

  /// Marca una alerta PENDIENTE como RESUELTA o DESCARTADA (Productor o Trabajador).
  Future<AlertaVigilancia> cambiarEstadoAlerta(String idAlerta, String estado) async {
    final dio = _ref.read(dioProvider);
    final json = await dio.parchar(
      '/alertas/$idAlerta/estado',
      cuerpo: {'estado': estado},
    );
    _ref.invalidate(alertasPendientesProvider);
    _ref.invalidate(historialAlertasProvider);
    return AlertaVigilancia.desdeJson(json);
  }
}
