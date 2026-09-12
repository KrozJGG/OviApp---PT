import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/paginado.dart';
import 'datos/alerta.dart';

/// Filtro por tipo del historial de alertas (RF_19). `null` = todas.
final filtroAlertasProvider = NotifierProvider<FiltroAlertasNotifier, String?>(
  FiltroAlertasNotifier.new,
);

class FiltroAlertasNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void filtrar(String? tipo) => state = tipo;
}

/// IF2-SAL — estado del dispositivo edge y última detección.
final estadoVigilanciaProvider = FutureProvider.autoDispose<EstadoVigilancia>((ref) async {
  final json = await ref.watch(dioProvider).traerMapa('/vigilancia/estado');
  return EstadoVigilancia.desdeJson(json);
});

/// RF_19 — historial de alertas del predio, filtrable por tipo.
final alertasProvider = FutureProvider.autoDispose<Paginado<Alerta>>((ref) {
  final tipo = ref.watch(filtroAlertasProvider);
  return ref.watch(dioProvider).traerPaginado(
        '/alertas',
        Alerta.desdeJson,
        consulta: {'tipo': tipo, 'tamano': 100},
      );
});

/// Detalle de una alerta; es también el destino del deep-link de la push.
final alertaProvider = FutureProvider.autoDispose.family<Alerta, String>((ref, id) async {
  final json = await ref.watch(dioProvider).traerMapa('/alertas/$id');
  return Alerta.desdeJson(json);
});

/// Marca una alerta como revisada.
final vigilanciaRepositorioProvider = Provider<VigilanciaRepositorio>(
  VigilanciaRepositorio.new,
);

class VigilanciaRepositorio {
  const VigilanciaRepositorio(this._ref);

  final Ref _ref;

  Future<Alerta> revisar(String id) async {
    final json = await _ref.read(dioProvider).enviar('/alertas/$id/revisar');
    return Alerta.desdeJson(json);
  }
}
