import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/paginado.dart';
import 'datos/entrada_bitacora.dart';

/// Bitácora de un animal (RF_05). Se pide una página amplia porque el
/// historial de un animal en un predio artesanal es corto y así la pantalla
/// no necesita scroll infinito.
final bitacoraProvider =
    FutureProvider.autoDispose.family<Paginado<EntradaBitacora>, String>((ref, idAnimal) {
  final dio = ref.watch(dioProvider);
  return dio.traerPaginado(
    '/animales/$idAnimal/bitacora',
    EntradaBitacora.desdeJson,
    consulta: {'tamano': 100},
  );
});
