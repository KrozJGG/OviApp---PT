import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../features/auth/sesion.dart';
import '../../features/vigilancia/vigilancia_proveedores.dart';
import '../config/conf_global.dart';
import '../proveedores.dart';
import 'notificaciones_locales.dart';
import 'tarea_segundo_plano.dart';

final notificacionesLocalesProvider = Provider<NotificacionesLocales>((ref) {
  final servicio = NotificacionesLocales();
  ref.onDispose(servicio.cerrar);
  return servicio;
});

/// Coordina la conexion Socket.IO de alertas en tiempo real segun la plataforma:
/// - Android: arranca/detiene el Foreground Service (`flutter_foreground_task`)
///   para mantener la escucha viva con la app minimizada o pantalla bloqueada.
/// - iOS / Web / Desktop: mantiene un cliente Socket.IO en primer plano sin
///   invocar APIs exclusivas de Android.
class CoordinadorAlertasRealtime {
  CoordinadorAlertasRealtime(this._ref) {
    _subToken = _ref.read(clienteApiProvider).tokenRenovado.listen(_sincronizarToken);
  }

  final Ref _ref;
  StreamSubscription<String>? _subToken;
  io.Socket? _socketPrimerPlano;
  bool _callbackRegistrado = false;
  bool _androidInicializado = false;
  String? _idUsuarioActivo;

  bool get _esAndroid =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<void> sincronizarConSesion(String? idUsuario, String? accessToken) async {
    if (idUsuario == null || accessToken == null || accessToken.isEmpty) {
      await detener();
      return;
    }

    if (_idUsuarioActivo == idUsuario) {
      _sincronizarToken(accessToken);
      return;
    }

    _idUsuarioActivo = idUsuario;

    final notificaciones = _ref.read(notificacionesLocalesProvider);
    await notificaciones.inicializar();
    await notificaciones.solicitarPermisos();

    if (_esAndroid) {
      await _iniciarServicioAndroid(accessToken);
    } else {
      _iniciarSocketPrimerPlano(accessToken);
    }
  }

  Future<void> detener() async {
    _idUsuarioActivo = null;

    if (_esAndroid) {
      if (_callbackRegistrado) {
        FlutterForegroundTask.removeTaskDataCallback(_alRecibirDatosDeTarea);
        _callbackRegistrado = false;
      }
      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.stopService();
      }
      await FlutterForegroundTask.clearAllData();
    } else {
      _socketPrimerPlano?.dispose();
      _socketPrimerPlano = null;
    }

    await _ref.read(notificacionesLocalesProvider).cancelarTodas();
  }

  Future<void> _iniciarServicioAndroid(String accessToken) async {
    if (!_androidInicializado) {
      FlutterForegroundTask.init(
        androidNotificationOptions: AndroidNotificationOptions(
          channelId: 'oviapp_monitoreo_activo',
          channelName: 'Monitoreo activo de OviApp',
          channelDescription:
              'Mantiene activa la recepción de alertas del rebaño en red local.',
          onlyAlertOnce: true,
          channelImportance: NotificationChannelImportance.LOW,
          priority: NotificationPriority.LOW,
        ),
        iosNotificationOptions: const IOSNotificationOptions(
          showNotification: false,
          playSound: false,
        ),
        foregroundTaskOptions: ForegroundTaskOptions(
          eventAction: ForegroundTaskEventAction.repeat(30000),
          autoRunOnBoot: false,
          autoRunOnMyPackageReplaced: false,
          allowWakeLock: true,
          allowWifiLock: true,
        ),
      );
      _androidInicializado = true;
    }

    if (!_callbackRegistrado) {
      FlutterForegroundTask.addTaskDataCallback(_alRecibirDatosDeTarea);
      _callbackRegistrado = true;
    }

    await FlutterForegroundTask.saveData(
      key: ClavesTareaAlertas.urlSocket,
      value: ConfGlobal.urlBaseSocket,
    );
    await FlutterForegroundTask.saveData(
      key: ClavesTareaAlertas.urlApi,
      value: ConfGlobal.urlBaseApi,
    );
    await FlutterForegroundTask.saveData(
      key: ClavesTareaAlertas.accessToken,
      value: accessToken,
    );

    if (await FlutterForegroundTask.isRunningService) {
      FlutterForegroundTask.sendDataToTask({
        'tipo': 'actualizar_token',
        'accessToken': accessToken,
      });
      return;
    }

    await FlutterForegroundTask.startService(
      serviceId: 9101,
      notificationTitle: 'OviApp: Monitoreo activo',
      notificationText: 'Conectado a la red del predio para alertas en tiempo real',
      serviceTypes: [ForegroundServiceTypes.dataSync],
      callback: iniciarTareaAlertas,
    );
  }

  void _iniciarSocketPrimerPlano(String accessToken) {
    _socketPrimerPlano?.dispose();

    final socket = io.io(
      ConfGlobal.urlBaseSocket,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': accessToken})
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(15000)
          .disableAutoConnect()
          .build(),
    );

    socket.on('alerta:nueva', (payload) {
      _manejarEventoPrimerPlano('alerta:nueva', payload);
    });
    socket.on('alerta:recordatorio', (payload) {
      _manejarEventoPrimerPlano('alerta:recordatorio', payload);
    });
    socket.on('alerta:actualizada', (payload) {
      _manejarEventoPrimerPlano('alerta:actualizada', payload);
    });

    _socketPrimerPlano = socket;
    socket.connect();
  }

  void _manejarEventoPrimerPlano(String evento, dynamic payload) {
    final mapa = payload is Map ? Map<String, dynamic>.from(payload) : null;
    if (mapa != null && !kIsWeb) {
      final notificaciones = _ref.read(notificacionesLocalesProvider);
      final id = (mapa['id'] as String?) ?? 'alerta-conteo';

      if (evento == 'alerta:nueva' || evento == 'alerta:recordatorio') {
        final detectadas =
            (mapa['conteoActualDetectado'] as num?)?.toInt() ??
            (mapa['conteoDetectado'] as num?)?.toInt();
        final esperadas =
            (mapa['conteoActualEsperado'] as num?)?.toInt() ??
            (mapa['conteoEsperado'] as num?)?.toInt();
        final cuerpo = (detectadas != null && esperadas != null)
            ? '$detectadas de $esperadas ovejas detectadas'
            : ((mapa['descripcion'] as String?) ?? 'Faltan ovejas en el rebaño');

        notificaciones.mostrarAlertaConteo(
          alertaId: id,
          titulo: evento == 'alerta:recordatorio'
              ? 'Recordatorio: Faltan ovejas'
              : 'Alerta: Faltan ovejas',
          cuerpo: cuerpo,
        );
      } else if (evento == 'alerta:actualizada') {
        if (mapa['estado'] != 'PENDIENTE' || mapa['normalizadaEn'] != null) {
          notificaciones.cancelarAlerta(id);
        }
      }
    }

    _invalidarProveedoresVigilancia();
  }

  void _alRecibirDatosDeTarea(Object data) {
    if (data is! Map) return;
    final evento = data['evento'];

    if (evento == 'token_renovado') {
      final token = data['accessToken'];
      if (token is String && token.isNotEmpty) {
        _ref.read(clienteApiProvider).usarToken(token);
      }
      return;
    }

    if (evento == 'alerta:nueva' ||
        evento == 'alerta:recordatorio' ||
        evento == 'alerta:actualizada') {
      _invalidarProveedoresVigilancia();
    }
  }

  void _sincronizarToken(String accessToken) {
    if (_idUsuarioActivo == null) return;

    if (_esAndroid) {
      FlutterForegroundTask.saveData(
        key: ClavesTareaAlertas.accessToken,
        value: accessToken,
      );
      FlutterForegroundTask.sendDataToTask({
        'tipo': 'actualizar_token',
        'accessToken': accessToken,
      });
    } else {
      final socket = _socketPrimerPlano;
      if (socket != null) {
        socket.auth = {'token': accessToken};
        if (!socket.connected) socket.connect();
      }
    }
  }

  void _invalidarProveedoresVigilancia() {
    _ref.invalidate(alertasPendientesProvider);
    _ref.invalidate(historialAlertasProvider);
    _ref.invalidate(estadoVigilanciaProvider);
  }

  void cerrar() {
    _subToken?.cancel();
    _socketPrimerPlano?.dispose();
    if (_esAndroid && _callbackRegistrado) {
      FlutterForegroundTask.removeTaskDataCallback(_alRecibirDatosDeTarea);
      _callbackRegistrado = false;
    }
  }
}

final coordinadorAlertasProvider = Provider<CoordinadorAlertasRealtime>((ref) {
  final coordinador = CoordinadorAlertasRealtime(ref);

  ref.listen(
    sesionProvider,
    (_, siguiente) {
      final sesion = siguiente.valueOrNull;
      unawaited(
        coordinador.sincronizarConSesion(sesion?.idUsuario, sesion?.accessToken),
      );
    },
    fireImmediately: true,
  );

  ref.onDispose(coordinador.cerrar);
  return coordinador;
});
