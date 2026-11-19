import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../almacenamiento/almacen_sesion.dart';
import '../cache/cache_respuestas.dart';
import 'error_api.dart';

// URL De Cloudflare (proxy inverso) el cual luego se comunicará con el servidor

String get urlBaseApi => const String.fromEnvironment(
  'API_URL',
  defaultValue:
      'https://attached-grammar-college-biodiversity.trycloudflare.com/api/v1',
);

// Cliente HTTP
/// Resuelve tres cosas de una vez: adjunta el token a cada peticion, renueva la
/// sesion cuando el access token expira (y reintenta la peticion original), y
/// traduce cualquier fallo a [ErrorApi] para que las pantallas nunca vean un
/// DioException.
class ClienteApi {
  ClienteApi({
    required AlmacenSesion almacen,
    CacheRespuestas? cache,
    String? urlBase,
    Dio? dio,
  }) : _almacen = almacen,
       _cache = cache,
       dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: urlBase ?? urlBaseApi,
               // RNF_01 pide respuestas bajo 3 s en 4G; 15 s da margen para una
               // señal rural mala antes de declarar el intento perdido.
               connectTimeout: const Duration(seconds: 15),
               receiveTimeout: const Duration(seconds: 20),
               sendTimeout: const Duration(seconds: 20),
               contentType: Headers.jsonContentType,
               // Los status de error los traduce el interceptor, no Dio.
               validateStatus: (s) => s != null && s < 400,
             ),
           ) {
    // `this.` es obligatorio: dentro del cuerpo, `dio` es el parametro
    // opcional (nullable), no el campo ya inicializado.
    this.dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: _alEnviar,
        onResponse: _alResponder,
        onError: _alFallar,
      ),
    );
  }

  final Dio dio;
  final AlmacenSesion _almacen;
  final CacheRespuestas? _cache;

  /// Momento en que se obtuvo lo que la app muestra, cuando viene del caché
  /// porque no hubo conexión; `null` si los datos son recién traídos.
  final datosDeCache = ValueNotifier<DateTime?>(null);

  /// Se dispara cuando la sesion ya no puede renovarse: la app vuelve al login.
  final _sesionCaducada = StreamController<void>.broadcast();
  Stream<void> get sesionCaducada => _sesionCaducada.stream;

  String? _accessToken;
  bool _renovando = false;

  void usarToken(String? token) => _accessToken = token;

  Future<void> _alEnviar(
    RequestOptions opciones,
    RequestInterceptorHandler handler,
  ) async {
    _accessToken ??= (await _almacen.leer())?.accessToken;
    if (_accessToken != null && !opciones.extra.containsKey('sinAuth')) {
      opciones.headers['Authorization'] = 'Bearer $_accessToken';
    }
    handler.next(opciones);
  }

  /// Solo se cachean lecturas de datos del predio. Las escrituras no (el caché
  /// es de solo lectura), ni la sesion, ni el streaming: un permiso de video
  /// guardado seria un token vencido.
  bool _cacheable(RequestOptions o) =>
      _cache != null &&
      o.method == 'GET' &&
      !o.path.startsWith('/auth/') &&
      !o.path.contains('/streaming/');

  /// Clave estable: ruta + consulta ordenada, para que dos peticiones iguales
  /// con los parametros en distinto orden compartan entrada.
  static String _claveDe(RequestOptions o) {
    final consulta =
        o.queryParameters.entries.map((e) => '${e.key}=${e.value}').toList()
          ..sort();
    return '${o.path}?${consulta.join('&')}';
  }

  Future<void> _alResponder(
    Response<dynamic> r,
    ResponseInterceptorHandler handler,
  ) async {
    final opciones = r.requestOptions;
    if (_cacheable(opciones)) {
      final datos = r.data;
      if (datos is Map<String, dynamic>) {
        await _cache!.guardar(_claveDe(opciones), datos);
      }
      datosDeCache.value = null;
    }
    handler.next(r);
  }

  Future<void> _alFallar(
    DioException e,
    ErrorInterceptorHandler handler,
  ) async {
    final error = ErrorApi.desdeDio(e);
    final esRutaDeSesion = e.requestOptions.path.startsWith('/auth/');

    // Sin conexion (o tiempo agotado) se responde con la ultima lectura buena.
    // Un 4xx/5xx NO entra aqui: el servidor si respondio y hay que decirlo.
    if (error.esDeRed && _cacheable(e.requestOptions)) {
      final entrada = await _cache!.leer(_claveDe(e.requestOptions));
      if (entrada != null) {
        datosDeCache.value = entrada.guardadoEn;
        handler.resolve(
          Response<dynamic>(
            requestOptions: e.requestOptions,
            data: entrada.datos,
            statusCode: 200,
            extra: {'desdeCache': true},
          ),
        );
        return;
      }
    }

    // Un access token vencido se renueva una vez y se reintenta la peticion.
    // El QueuedInterceptor serializa las peticiones, asi que dos llamadas
    // simultaneas no disparan dos renovaciones.
    if (error.status == 401 && !esRutaDeSesion && !_renovando) {
      final renovado = await _renovarSesion();
      if (renovado) {
        try {
          final reintento = await dio.fetch<dynamic>(
            _conTokenNuevo(e.requestOptions),
          );
          handler.resolve(reintento);
          return;
        } on DioException catch (e2) {
          handler.reject(_envolver(e2, ErrorApi.desdeDio(e2)));
          return;
        }
      }
      await _almacen.limpiar();
      await _cache?.limpiar();
      datosDeCache.value = null;
      _accessToken = null;
      if (!_sesionCaducada.isClosed) _sesionCaducada.add(null);
    }

    handler.reject(_envolver(e, error));
  }

  RequestOptions _conTokenNuevo(RequestOptions original) {
    final opciones = original.copyWith();
    opciones.headers['Authorization'] = 'Bearer $_accessToken';
    return opciones;
  }

  Future<bool> _renovarSesion() async {
    final sesion = await _almacen.leer();
    if (sesion == null) return false;

    _renovando = true;
    try {
      // Cliente aparte: si usara `dio`, el interceptor se llamaria a si mismo.
      final limpio = Dio(BaseOptions(baseUrl: dio.options.baseUrl));
      final r = await limpio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': sesion.refreshToken},
      );

      final datos = r.data;
      if (datos == null) return false;

      _accessToken = datos['accessToken'] as String;
      await _almacen.actualizarTokens(
        accessToken: datos['accessToken'] as String,
        refreshToken: datos['refreshToken'] as String,
      );
      return true;
    } on DioException {
      return false;
    } finally {
      _renovando = false;
    }
  }

  DioException _envolver(DioException e, ErrorApi error) => DioException(
    requestOptions: e.requestOptions,
    response: e.response,
    type: e.type,
    error: error,
  );

  void cerrar() {
    _sesionCaducada.close();
    datosDeCache.dispose();
    dio.close(force: true);
  }
}

/// Extrae el [ErrorApi] de cualquier excepcion lanzada por el cliente.
ErrorApi comoErrorApi(Object e) {
  if (e is ErrorApi) return e;
  if (e is DioException) {
    final adjunto = e.error;
    return adjunto is ErrorApi ? adjunto : ErrorApi.desdeDio(e);
  }
  return ErrorApi(
    codigo: 'DESCONOCIDO',
    mensaje: 'Ocurrió un error inesperado.',
    status: null,
  );
}
