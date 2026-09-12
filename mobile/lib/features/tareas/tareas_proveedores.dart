import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formato.dart';
import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/paginado.dart';
import 'datos/tarea.dart';

/// Filtro del listado de tareas: `null` = todas.
final filtroTareasProvider = NotifierProvider<FiltroTareasNotifier, String?>(
  FiltroTareasNotifier.new,
);

class FiltroTareasNotifier extends Notifier<String?> {
  @override
  String? build() => 'ACTIVA';

  void filtrar(String? estado) => state = estado;
}

/// Listado de tareas del predio (RF_11 a RF_14).
final tareasProvider = FutureProvider.autoDispose<Paginado<Tarea>>((ref) {
  final estado = ref.watch(filtroTareasProvider);
  return ref.watch(dioProvider).traerPaginado(
        '/tareas',
        Tarea.desdeJson,
        consulta: {'estado': estado, 'tamano': 100},
      );
});

/// Detalle de una tarea.
final tareaProvider = FutureProvider.autoDispose.family<Tarea, String>((ref, id) async {
  final json = await ref.watch(dioProvider).traerMapa('/tareas/$id');
  return Tarea.desdeJson(json);
});

/// Escrituras del Módulo 4. A diferencia de los eventos, las tareas las
/// gestionan tanto el Productor como el Trabajador.
class TareasRepositorio {
  const TareasRepositorio(this._ref);

  final Ref _ref;

  Future<Tarea> crear({
    required String titulo,
    required DateTime fechaLimite,
    required List<String> idResponsables,
    List<String> idAnimales = const [],
    String? descripcion,
  }) async {
    final json = await _ref.read(dioProvider).enviar('/tareas', cuerpo: {
      'titulo': titulo,
      'fechaLimite': Fmt.iso(fechaLimite),
      'idResponsables': idResponsables,
      'idAnimales': idAnimales,
      'descripcion': descripcion,
    });
    return Tarea.desdeJson(json);
  }

  Future<Tarea> editar(
    String id, {
    required String titulo,
    required DateTime fechaLimite,
    required List<String> idResponsables,
    List<String> idAnimales = const [],
    String? descripcion,
  }) async {
    final json = await _ref.read(dioProvider).parchar('/tareas/$id', cuerpo: {
      'titulo': titulo,
      'fechaLimite': Fmt.iso(fechaLimite),
      'idResponsables': idResponsables,
      'idAnimales': idAnimales,
      'descripcion': descripcion,
    });
    return Tarea.desdeJson(json);
  }

  /// RF_13 — marca la tarea como completada y registra quién y cuándo.
  Future<Tarea> completar(String id) async {
    final json = await _ref.read(dioProvider).enviar('/tareas/$id/completar');
    return Tarea.desdeJson(json);
  }

  /// RF_14 — eliminación permanente.
  Future<void> eliminar(String id) => _ref.read(dioProvider).borrar('/tareas/$id');
}

final tareasRepositorioProvider = Provider<TareasRepositorio>(TareasRepositorio.new);
