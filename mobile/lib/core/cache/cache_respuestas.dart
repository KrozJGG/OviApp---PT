import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Una respuesta guardada y el momento en que se obtuvo del servidor.
class EntradaCache {
  const EntradaCache({required this.datos, required this.guardadoEn});

  final Map<String, dynamic> datos;
  final DateTime guardadoEn;
}

/// Caché de solo lectura de las respuestas GET de la API.
///
/// Cubre cortes del WiFi del predio: si el servidor no responde, la app
/// muestra lo último que vio en vez de una pantalla de error. No hay escritura
/// offline (el informe la declara fuera de alcance): crear o editar sin red
/// sigue fallando con un mensaje claro.
///
/// Va en el almacén seguro y no en SharedPreferences: son datos del predio y
/// asi quedan cifrados en reposo (RNF_03). Se vacia al cerrar sesion y al
/// iniciar una nueva, para que otro usuario o predio nunca vea datos ajenos
/// (RNF_08).
class CacheRespuestas {
  CacheRespuestas({FlutterSecureStorage? almacen})
      : _almacen = almacen ?? const FlutterSecureStorage();

  final FlutterSecureStorage _almacen;

  static const _prefijo = 'oviapp.cache.';

  /// Igual que `AlmacenSesion`: si el almacen no responde, la consecuencia es
  /// «no hay caché», nunca una excepcion que impida salir a la red.
  Future<void> guardar(String clave, Map<String, dynamic> datos) async {
    try {
      await _almacen.write(
        key: '$_prefijo$clave',
        value: jsonEncode({
          'guardadoEn': DateTime.now().toUtc().toIso8601String(),
          'datos': datos,
        }),
      );
    } catch (_) {}
  }

  Future<EntradaCache?> leer(String clave) async {
    try {
      final crudo = await _almacen.read(key: '$_prefijo$clave');
      if (crudo == null) return null;

      final json = jsonDecode(crudo) as Map<String, dynamic>;
      return EntradaCache(
        datos: Map<String, dynamic>.from(json['datos'] as Map),
        guardadoEn: DateTime.parse(json['guardadoEn'] as String),
      );
    } catch (_) {
      // Ausente, corrupto o almacen caido: en los tres casos no hay caché.
      return null;
    }
  }

  /// Borra solo las claves del caché; la sesion guardada no se toca.
  Future<void> limpiar() async {
    try {
      final todo = await _almacen.readAll();
      for (final clave in todo.keys.where((k) => k.startsWith(_prefijo))) {
        try {
          await _almacen.delete(key: clave);
        } catch (_) {}
      }
    } catch (_) {}
  }
}

