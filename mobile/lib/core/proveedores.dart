import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'almacenamiento/almacen_sesion.dart';
import 'red/cliente_api.dart';

/// Proveedores raiz de la aplicacion.
///
/// Todas las capas de datos de las features dependen de `dioProvider`; ninguna
/// construye su propio cliente HTTP. Asi el token, la renovacion de sesion y la
/// traduccion de errores ocurren en un solo lugar.

final almacenSesionProvider = Provider<AlmacenSesion>((ref) => AlmacenSesion());

final clienteApiProvider = Provider<ClienteApi>((ref) {
  final cliente = ClienteApi(almacen: ref.watch(almacenSesionProvider));
  ref.onDispose(cliente.cerrar);
  return cliente;
});

/// Cliente HTTP listo para usar: `ref.watch(dioProvider)`.
final dioProvider = Provider<Dio>((ref) => ref.watch(clienteApiProvider).dio);
