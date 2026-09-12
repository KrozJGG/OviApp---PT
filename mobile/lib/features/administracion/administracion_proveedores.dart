import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import '../../core/red/paginado.dart';
import 'datos/usuario.dart';

/// Usuarios del predio (RF_20 a RF_22). Todo el módulo es exclusivo del
/// Productor: los cinco endpoints llevan `soloProductor` en el backend.
final usuariosProvider = FutureProvider.autoDispose<Paginado<Usuario>>((ref) {
  return ref.watch(dioProvider).traerPaginado(
        '/usuarios',
        Usuario.desdeJson,
        consulta: {'tamano': 100},
      );
});

final usuarioProvider =
    FutureProvider.autoDispose.family<Usuario, String>((ref, id) async {
  final json = await ref.watch(dioProvider).traerMapa('/usuarios/$id');
  return Usuario.desdeJson(json);
});

class UsuariosRepositorio {
  const UsuariosRepositorio(this._ref);

  final Ref _ref;

  /// RF_20 — alta. El correo debe ser único en todo el sistema.
  Future<Usuario> crear({
    required String nombre,
    required String email,
    required String password,
    required String rol,
    String? rut,
    String? telefono,
  }) async {
    final json = await _ref.read(dioProvider).enviar('/usuarios', cuerpo: {
      'nombre': nombre,
      'email': email,
      'password': password,
      'rol': rol,
      'rut': rut,
      'telefono': telefono,
    });
    return Usuario.desdeJson(json);
  }

  /// RF_21 — edición. La contraseña no se toca desde aquí.
  Future<Usuario> editar(
    String id, {
    required String nombre,
    required String email,
    required String rol,
    String? rut,
    String? telefono,
  }) async {
    final json = await _ref.read(dioProvider).parchar('/usuarios/$id', cuerpo: {
      'nombre': nombre,
      'email': email,
      'rol': rol,
      'rut': rut,
      'telefono': telefono,
    });
    return Usuario.desdeJson(json);
  }

  /// RF_22 — revoca el acceso sin borrar el histórico del usuario.
  Future<Usuario> inhabilitar(String id) async {
    final json = await _ref.read(dioProvider).enviar('/usuarios/$id/inhabilitar');
    return Usuario.desdeJson(json);
  }
}

final usuariosRepositorioProvider =
    Provider<UsuariosRepositorio>(UsuariosRepositorio.new);
