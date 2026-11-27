import 'package:flutter/foundation.dart';

/// Configuración global del frontend (OviApp).
///
/// Centraliza la URL base de la API y los tiempos de espera para poder cambiar
/// entre entorno local y un túnel/servidor remoto en un solo lugar.
///
/// También sigue respetando `--dart-define=API_URL=...` si se pasa al compilar
/// o ejecutar la app.
abstract final class ConfGlobal {
  /// Cambia esta constante cuando necesites apuntar a un túnel o servidor remoto
  /// (por ejemplo, Cloudflare Tunnel o producción).
  ///
  /// - Web (Edge/Chrome) y Desktop en tu PC: `http://localhost:3000/api/v1`
  /// - Emulador Android: `http://10.0.2.2:3000/api/v1`
  /// - Celular físico / Túnel: `https://tu-tunel.trycloudflare.com/api/v1`
  static const String urlApiPorDefecto = 'http://localhost:3000/api/v1';

  /// URL usada en emulador Android cuando no se especifica `--dart-define=API_URL`
  /// y `urlApiPorDefecto` apunta a localhost.
  static const String urlApiAndroidEmulador = 'http://10.0.2.2:3000/api/v1';

  static const String _urlDesdeEntorno = String.fromEnvironment('API_URL');

  /// URL efectiva que consume [ClienteApi].
  static String get urlBaseApi {
    if (_urlDesdeEntorno.isNotEmpty) return _urlDesdeEntorno;

    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        urlApiPorDefecto.contains('localhost')) {
      return urlApiAndroidEmulador;
    }

    return urlApiPorDefecto;
  }

  /// Origen HTTP/WS para Socket.IO (mismo host y puerto que la API, sin `/api/v1`).
  static String get urlBaseSocket => Uri.parse(urlBaseApi).origin;

  /// Tiempos de espera HTTP (RNF_01: margen para señal rural).
  static const Duration timeoutConexion = Duration(seconds: 15);
  static const Duration timeoutRecepcion = Duration(seconds: 20);
  static const Duration timeoutEnvio = Duration(seconds: 20);
}

