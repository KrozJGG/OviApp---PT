import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Servicio de notificaciones locales de alta prioridad para alertas de vigilancia.
///
/// En Web es un no-op seguro para no romper la compilacion ni ejecucion multiplataforma.
class NotificacionesLocales {
  NotificacionesLocales({FlutterLocalNotificationsPlugin? plugin})
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  static const String canalAlertasId = 'oviapp_alertas_criticas';
  static const String canalAlertasNombre = 'Alertas de vigilancia';
  static const String canalAlertasDescripcion =
      'Notificaciones de alta prioridad cuando faltan ovejas en el monitoreo.';

  final FlutterLocalNotificationsPlugin _plugin;
  final _alTocarRuta = StreamController<String>.broadcast();
  bool _inicializado = false;

  /// Emite la ruta destino (p. ej. `/vigilancia`) cuando el usuario toca una notificacion.
  Stream<String> get alTocarRuta => _alTocarRuta.stream;

  bool get _soportado =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  /// Convierte un UUID de alerta en un ID entero positivo estable de 31 bits.
  static int idDeAlerta(String alertaId) => alertaId.hashCode & 0x7fffffff;

  Future<void> inicializar() async {
    if (_inicializado || !_soportado) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const configuracion = InitializationSettings(
      android: android,
      iOS: darwin,
    );

    await _plugin.initialize(
      configuracion,
      onDidReceiveNotificationResponse: _manejarRespuesta,
    );

    if (defaultTargetPlatform == TargetPlatform.android) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          canalAlertasId,
          canalAlertasNombre,
          description: canalAlertasDescripcion,
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        ),
      );
    }

    _inicializado = true;
  }

  /// Solicita permiso POST_NOTIFICATIONS en Android 13+ (no-op en versiones anteriores).
  Future<void> solicitarPermisos() async {
    if (!_soportado) return;
    await inicializar();

    if (defaultTargetPlatform == TargetPlatform.android) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.requestNotificationsPermission();
    }
  }

  /// Verifica si la app se abrio desde el toque de una notificacion cuando estaba cerrada.
  Future<String?> rutaDeLanzamientoInicial() async {
    if (!_soportado) return null;
    await inicializar();

    final detalles = await _plugin.getNotificationAppLaunchDetails();
    if (detalles == null || !detalles.didNotificationLaunchApp) return null;
    return _extraerRuta(detalles.notificationResponse?.payload);
  }

  Future<void> mostrarAlertaConteo({
    required String alertaId,
    required String titulo,
    required String cuerpo,
  }) async {
    if (!_soportado) return;
    await inicializar();

    const detallesAndroid = AndroidNotificationDetails(
      canalAlertasId,
      canalAlertasNombre,
      channelDescription: canalAlertasDescripcion,
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      category: AndroidNotificationCategory.alarm,
      visibility: NotificationVisibility.public,
      ticker: 'Alerta de vigilancia OviApp',
    );
    const detallesDarwin = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      interruptionLevel: InterruptionLevel.timeSensitive,
    );

    final payload = jsonEncode({'ruta': '/vigilancia', 'alertaId': alertaId});

    await _plugin.show(
      idDeAlerta(alertaId),
      titulo,
      cuerpo,
      const NotificationDetails(android: detallesAndroid, iOS: detallesDarwin),
      payload: payload,
    );
  }

  Future<void> cancelarAlerta(String alertaId) async {
    if (!_soportado) return;
    await inicializar();
    await _plugin.cancel(idDeAlerta(alertaId));
  }

  Future<void> cancelarTodas() async {
    if (!_soportado) return;
    await inicializar();
    await _plugin.cancelAll();
  }

  void _manejarRespuesta(NotificationResponse respuesta) {
    final ruta = _extraerRuta(respuesta.payload);
    if (ruta != null && !_alTocarRuta.isClosed) {
      _alTocarRuta.add(ruta);
    }
  }

  static String? _extraerRuta(String? payload) {
    if (payload == null || payload.isEmpty) return null;
    try {
      final datos = jsonDecode(payload);
      if (datos is Map<String, dynamic> && datos['ruta'] is String) {
        return datos['ruta'] as String;
      }
    } catch (_) {
      return '/vigilancia';
    }
    return '/vigilancia';
  }

  void cerrar() {
    _alTocarRuta.close();
  }
}
