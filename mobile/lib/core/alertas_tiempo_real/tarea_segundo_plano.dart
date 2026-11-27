import 'package:dio/dio.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../almacenamiento/almacen_sesion.dart';
import 'notificaciones_locales.dart';

/// Claves compartidas entre el isolate principal y el Foreground Service de Android.
abstract final class ClavesTareaAlertas {
  static const urlSocket = 'oviapp.alertas.urlSocket';
  static const urlApi = 'oviapp.alertas.urlApi';
  static const accessToken = 'oviapp.alertas.accessToken';
}

/// Punto de entrada top-level requerido por `flutter_foreground_task` en Android.
@pragma('vm:entry-point')
void iniciarTareaAlertas() {
  FlutterForegroundTask.setTaskHandler(AlertasTaskHandler());
}

/// Mantiene viva la conexion Socket.IO en segundo plano en Android, dispara
/// notificaciones locales de alta prioridad ante `alerta:nueva` y
/// `alerta:recordatorio`, y reenvia los eventos al isolate principal para
/// sincronizar Riverpod en tiempo real.
class AlertasTaskHandler extends TaskHandler {
  final _notificaciones = NotificacionesLocales();
  final _almacen = AlmacenSesion();

  io.Socket? _socket;
  String? _urlSocket;
  String? _urlApi;
  String? _accessToken;
  bool _renovandoToken = false;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    await _notificaciones.inicializar();

    _urlSocket = await FlutterForegroundTask.getData<String>(
      key: ClavesTareaAlertas.urlSocket,
    );
    _urlApi = await FlutterForegroundTask.getData<String>(
      key: ClavesTareaAlertas.urlApi,
    );
    _accessToken = await FlutterForegroundTask.getData<String>(
      key: ClavesTareaAlertas.accessToken,
    );

    _conectarSocket();
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    final socket = _socket;
    if (socket != null && !socket.connected && !_renovandoToken) {
      socket.connect();
    }
  }

  @override
  void onReceiveData(Object data) {
    if (data is! Map) return;
    final tipo = data['tipo'];

    if (tipo == 'actualizar_token') {
      final nuevo = data['accessToken'];
      if (nuevo is String && nuevo.isNotEmpty) {
        _accessToken = nuevo;
        final socket = _socket;
        if (socket != null) {
          socket.auth = {'token': nuevo};
          if (!socket.connected) socket.connect();
        } else {
          _conectarSocket();
        }
      }
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    _desconectarSocket();
    _notificaciones.cerrar();
  }

  void _conectarSocket() {
    _desconectarSocket();
    final url = _urlSocket;
    final token = _accessToken;
    if (url == null || url.isEmpty || token == null || token.isEmpty) return;

    final socket = io.io(
      url,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(15000)
          .disableAutoConnect()
          .build(),
    );

    socket.on('alerta:nueva', (payload) {
      final mapa = _aMapa(payload);
      if (mapa == null) return;
      _mostrarNotificacion(mapa, esRecordatorio: false);
      FlutterForegroundTask.sendDataToMain({
        'evento': 'alerta:nueva',
        'payload': mapa,
      });
    });

    socket.on('alerta:recordatorio', (payload) {
      final mapa = _aMapa(payload);
      if (mapa == null) return;
      _mostrarNotificacion(mapa, esRecordatorio: true);
      FlutterForegroundTask.sendDataToMain({
        'evento': 'alerta:recordatorio',
        'payload': mapa,
      });
    });

    socket.on('alerta:actualizada', (payload) {
      final mapa = _aMapa(payload);
      if (mapa == null) return;

      final id = mapa['id'] as String?;
      final estado = mapa['estado'] as String?;
      final normalizadaEn = mapa['normalizadaEn'];
      if (id != null && (estado != 'PENDIENTE' || normalizadaEn != null)) {
        _notificaciones.cancelarAlerta(id);
      }

      FlutterForegroundTask.sendDataToMain({
        'evento': 'alerta:actualizada',
        'payload': mapa,
      });
    });

    socket.onConnectError((error) {
      final texto = error?.toString() ?? '';
      if (texto.contains('TOKEN_EXPIRADO') && !_renovandoToken) {
        _renovarTokenYReconectar();
      }
    });

    _socket = socket;
    socket.connect();
  }

  void _desconectarSocket() {
    _socket?.dispose();
    _socket = null;
  }

  Future<void> _renovarTokenYReconectar() async {
    final urlApi = _urlApi;
    if (urlApi == null || urlApi.isEmpty) return;

    _renovandoToken = true;
    try {
      final sesion = await _almacen.leer();
      if (sesion == null) return;

      final dio = Dio(
        BaseOptions(
          baseUrl: urlApi,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );
      final r = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': sesion.refreshToken},
      );
      final datos = r.data;
      if (datos == null) return;

      final nuevoAccess = datos['accessToken'] as String?;
      final nuevoRefresh = datos['refreshToken'] as String?;
      if (nuevoAccess == null || nuevoRefresh == null) return;

      _accessToken = nuevoAccess;
      await _almacen.actualizarTokens(
        accessToken: nuevoAccess,
        refreshToken: nuevoRefresh,
      );
      await FlutterForegroundTask.saveData(
        key: ClavesTareaAlertas.accessToken,
        value: nuevoAccess,
      );

      FlutterForegroundTask.sendDataToMain({
        'evento': 'token_renovado',
        'accessToken': nuevoAccess,
      });

      final socket = _socket;
      if (socket != null) {
        socket.auth = {'token': nuevoAccess};
        socket.connect();
      }
    } catch (_) {
      // Si el servidor no responde aun en LAN, el siguiente intento reintentara.
    } finally {
      _renovandoToken = false;
    }
  }

  void _mostrarNotificacion(Map<String, dynamic> mapa, {required bool esRecordatorio}) {
    final id = (mapa['id'] as String?) ?? 'alerta-conteo';
    final detectadas =
        (mapa['conteoActualDetectado'] as num?)?.toInt() ??
        (mapa['conteoDetectado'] as num?)?.toInt();
    final esperadas =
        (mapa['conteoActualEsperado'] as num?)?.toInt() ??
        (mapa['conteoEsperado'] as num?)?.toInt();

    final hora = _formatearHora(
      (mapa['recordatorioEn'] as String?) ?? (mapa['fechaDeteccion'] as String?),
    );

    final titulo = esRecordatorio
        ? 'Recordatorio: Faltan ovejas'
        : 'Alerta: Faltan ovejas';

    final resumenConteo = (detectadas != null && esperadas != null)
        ? '$detectadas de $esperadas detectadas'
        : ((mapa['descripcion'] as String?) ?? 'Déficit en el conteo del rebaño');

    final cuerpo = hora.isEmpty ? resumenConteo : '$resumenConteo · $hora';

    _notificaciones.mostrarAlertaConteo(
      alertaId: id,
      titulo: titulo,
      cuerpo: cuerpo,
    );
  }

  static String _formatearHora(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final fecha = DateTime.tryParse(iso)?.toLocal();
    if (fecha == null) return '';
    final hh = fecha.hour.toString().padLeft(2, '0');
    final mm = fecha.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  static Map<String, dynamic>? _aMapa(dynamic payload) {
    if (payload is Map<String, dynamic>) return payload;
    if (payload is Map) return Map<String, dynamic>.from(payload);
    return null;
  }
}
