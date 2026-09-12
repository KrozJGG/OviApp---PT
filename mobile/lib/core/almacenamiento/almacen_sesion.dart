import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Sesion guardada en el dispositivo.
class SesionGuardada {
  const SesionGuardada({
    required this.accessToken,
    required this.refreshToken,
    required this.usuario,
  });

  final String accessToken;
  final String refreshToken;
  final Map<String, dynamic> usuario;

  String get rol => (usuario['rol'] as String?) ?? 'TRABAJADOR';
  bool get esProductor => rol == 'PRODUCTOR';
  String get nombre => (usuario['nombre'] as String?) ?? '';
  String get idUsuario => (usuario['id'] as String?) ?? '';
}

/// Persistencia de los tokens de sesion.
///
/// Va en almacenamiento seguro (Keystore en Android, Keychain en iOS) y no en
/// SharedPreferences: RNF_03 pide proteger el acceso al predio, y un token en
/// texto plano en el dispositivo seria la puerta mas facil.
class AlmacenSesion {
  // Desde flutter_secure_storage 10 el respaldo cifrado es el comportamiento
  // por defecto en Android y la opcion `encryptedSharedPreferences` ya no
  // existe, asi que no hay nada que configurar.
  AlmacenSesion({FlutterSecureStorage? almacen})
      : _almacen = almacen ?? const FlutterSecureStorage();

  final FlutterSecureStorage _almacen;

  static const _claveAcceso = 'oviapp.accessToken';
  static const _claveRefresh = 'oviapp.refreshToken';
  static const _claveUsuario = 'oviapp.usuario';

  /// El almacen seguro no esta disponible en todas partes: en web se apoya en
  /// SubtleCrypto y en un contexto seguro, y sus operaciones pueden lanzar.
  ///
  /// Ninguna de las de abajo propaga ese fallo. Si el almacen no responde, la
  /// consecuencia correcta es que la sesion no sobreviva a un reinicio de la
  /// app; NO que la app deje de funcionar. El interceptor de red llama a
  /// `leer()` antes de cada peticion, asi que una excepcion aqui impedia que
  /// saliera cualquier peticion y el login moria antes de tocar la red.
  Future<SesionGuardada?> leer() async {
    final String? acceso;
    final String? refresh;
    final String? usuario;

    try {
      acceso = await _almacen.read(key: _claveAcceso);
      refresh = await _almacen.read(key: _claveRefresh);
      usuario = await _almacen.read(key: _claveUsuario);
    } catch (_) {
      return null;
    }

    if (acceso == null || refresh == null || usuario == null) return null;

    try {
      return SesionGuardada(
        accessToken: acceso,
        refreshToken: refresh,
        usuario: jsonDecode(usuario) as Map<String, dynamic>,
      );
    } on FormatException {
      // Un perfil corrupto no debe dejar la app inutilizable: se descarta.
      await limpiar();
      return null;
    }
  }

  Future<void> guardar(SesionGuardada sesion) async {
    await _intentar([
      () => _almacen.write(key: _claveAcceso, value: sesion.accessToken),
      () => _almacen.write(key: _claveRefresh, value: sesion.refreshToken),
      () => _almacen.write(key: _claveUsuario, value: jsonEncode(sesion.usuario)),
    ]);
  }

  Future<void> actualizarTokens({required String accessToken, required String refreshToken}) async {
    await _intentar([
      () => _almacen.write(key: _claveAcceso, value: accessToken),
      () => _almacen.write(key: _claveRefresh, value: refreshToken),
    ]);
  }

  Future<void> limpiar() async {
    await _intentar([
      () => _almacen.delete(key: _claveAcceso),
      () => _almacen.delete(key: _claveRefresh),
      () => _almacen.delete(key: _claveUsuario),
    ]);
  }

  /// Ejecuta las escrituras ignorando un almacen que no responde.
  static Future<void> _intentar(List<Future<void> Function()> operaciones) async {
    for (final operacion in operaciones) {
      try {
        await operacion();
      } catch (_) {
        // Sin almacen persistente la sesion vive solo en memoria.
      }
    }
  }
}
