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
  AlmacenSesion({FlutterSecureStorage? almacen})
      : _almacen = almacen ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _almacen;

  static const _claveAcceso = 'oviapp.accessToken';
  static const _claveRefresh = 'oviapp.refreshToken';
  static const _claveUsuario = 'oviapp.usuario';

  Future<SesionGuardada?> leer() async {
    final acceso = await _almacen.read(key: _claveAcceso);
    final refresh = await _almacen.read(key: _claveRefresh);
    final usuario = await _almacen.read(key: _claveUsuario);

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
    await Future.wait([
      _almacen.write(key: _claveAcceso, value: sesion.accessToken),
      _almacen.write(key: _claveRefresh, value: sesion.refreshToken),
      _almacen.write(key: _claveUsuario, value: jsonEncode(sesion.usuario)),
    ]);
  }

  Future<void> actualizarTokens({required String accessToken, required String refreshToken}) async {
    await Future.wait([
      _almacen.write(key: _claveAcceso, value: accessToken),
      _almacen.write(key: _claveRefresh, value: refreshToken),
    ]);
  }

  Future<void> limpiar() async {
    await Future.wait([
      _almacen.delete(key: _claveAcceso),
      _almacen.delete(key: _claveRefresh),
      _almacen.delete(key: _claveUsuario),
    ]);
  }
}
