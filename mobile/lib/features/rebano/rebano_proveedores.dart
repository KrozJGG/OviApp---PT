import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import 'datos/animal.dart';
import 'datos/rebano_repositorio.dart';

final rebanoRepositorioProvider = Provider<RebanoRepositorio>(
  (ref) => RebanoRepositorio(ref.watch(dioProvider)),
);

/// Filtros del listado del mockup 03: buscador + chips Todos/Activos/Inactivos.
class FiltroRebano {
  const FiltroRebano({this.busqueda = '', this.estado});

  final String busqueda;

  /// `null` = «Todos». Si no, `ACTIVO` o `INACTIVO`.
  final String? estado;

  FiltroRebano conBusqueda(String v) => FiltroRebano(busqueda: v, estado: estado);
  FiltroRebano conEstado(String? v) => FiltroRebano(busqueda: busqueda, estado: v);

  @override
  bool operator ==(Object other) =>
      other is FiltroRebano && other.busqueda == busqueda && other.estado == estado;

  @override
  int get hashCode => Object.hash(busqueda, estado);
}

final filtroRebanoProvider =
    NotifierProvider<FiltroRebanoNotifier, FiltroRebano>(FiltroRebanoNotifier.new);

class FiltroRebanoNotifier extends Notifier<FiltroRebano> {
  @override
  FiltroRebano build() => const FiltroRebano();

  void buscar(String texto) => state = state.conBusqueda(texto.trim());
  void filtrarPorEstado(String? estado) => state = state.conEstado(estado);
}

/// Listado del rebaño. Se reconstruye solo cuando cambian los filtros.
///
/// `cargarMas()` concatena la página siguiente en lugar de reemplazarla, que es
/// lo que espera el scroll infinito de la lista.
final rebanoProvider =
    AsyncNotifierProvider<RebanoNotifier, ListadoRebano>(RebanoNotifier.new);

class RebanoNotifier extends AsyncNotifier<ListadoRebano> {
  bool _cargandoMas = false;

  @override
  Future<ListadoRebano> build() {
    final filtro = ref.watch(filtroRebanoProvider);
    return ref.read(rebanoRepositorioProvider).listar(
          q: filtro.busqueda.isEmpty ? null : filtro.busqueda,
          estado: filtro.estado,
        );
  }

  Future<void> recargar() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() {
      final filtro = ref.read(filtroRebanoProvider);
      return ref.read(rebanoRepositorioProvider).listar(
            q: filtro.busqueda.isEmpty ? null : filtro.busqueda,
            estado: filtro.estado,
          );
    });
  }

  Future<void> cargarMas() async {
    final actual = state.valueOrNull;
    if (actual == null || _cargandoMas || !actual.pagina.hayMas) return;

    _cargandoMas = true;
    try {
      final filtro = ref.read(filtroRebanoProvider);
      final siguiente = await ref.read(rebanoRepositorioProvider).listar(
            pagina: actual.pagina.meta.pagina + 1,
            q: filtro.busqueda.isEmpty ? null : filtro.busqueda,
            estado: filtro.estado,
          );
      state = AsyncValue.data(actual.mas(siguiente));
    } finally {
      _cargandoMas = false;
    }
  }
}

/// Ficha individual (RF_02). `autoDispose` para que volver a entrar a una ficha
/// recién editada muestre los datos nuevos y no los de la visita anterior.
final fichaAnimalProvider =
    FutureProvider.autoDispose.family<FichaAnimal, String>((ref, id) {
  return ref.watch(rebanoRepositorioProvider).obtener(id);
});
