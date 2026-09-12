import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:oviapp/core/almacenamiento/almacen_sesion.dart';
import 'package:oviapp/core/red/cliente_api.dart';

class _AlmacenFalso extends Mock implements FlutterSecureStorage {}

/// El almacenamiento seguro no está disponible en todas partes: en web depende
/// de SubtleCrypto y del contexto seguro, y puede lanzar. Estas pruebas fijan
/// que un fallo del almacén degrade la sesión (no persiste) en lugar de dejar
/// la aplicación inutilizable.
void main() {
  late _AlmacenFalso almacen;

  setUp(() {
    almacen = _AlmacenFalso();
  });

  group('AlmacenSesion tolera un almacén que falla', () {
    test('leer() devuelve null en vez de propagar la excepción', () async {
      when(() => almacen.read(key: any(named: 'key')))
          .thenThrow(Exception('SubtleCrypto no disponible'));

      final sesion = AlmacenSesion(almacen: almacen);

      await expectLater(sesion.leer(), completion(isNull));
    });

    test('guardar() no lanza aunque el almacén rechace la escritura', () async {
      when(() => almacen.write(key: any(named: 'key'), value: any(named: 'value')))
          .thenThrow(Exception('almacenamiento no disponible'));

      final sesion = AlmacenSesion(almacen: almacen);

      await expectLater(
        sesion.guardar(const SesionGuardada(
          accessToken: 'a',
          refreshToken: 'r',
          usuario: {'id': 'u1', 'nombre': 'Manuel', 'rol': 'PRODUCTOR'},
        )),
        completes,
      );
    });

    test('limpiar() no lanza aunque el almacén rechace el borrado', () async {
      when(() => almacen.delete(key: any(named: 'key')))
          .thenThrow(Exception('almacenamiento no disponible'));

      await expectLater(AlmacenSesion(almacen: almacen).limpiar(), completes);
    });
  });

  group('ClienteApi', () {
    test(
      'envía la petición aunque no se pueda leer el token guardado',
      () async {
        // Este es el fallo que dejaba el login muerto en web: el interceptor
        // leía el almacén antes de cada petición y, al lanzar, la petición
        // nunca salía a la red.
        when(() => almacen.read(key: any(named: 'key')))
            .thenThrow(Exception('SubtleCrypto no disponible'));

        final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
        dio.httpClientAdapter = _AdaptadorFijo();

        final cliente = ClienteApi(
          almacen: AlmacenSesion(almacen: almacen),
          dio: dio,
        );

        final r = await cliente.dio.post<Map<String, dynamic>>(
          '/auth/login',
          data: {'email': 'manuel@oviapp.cl', 'password': 'Ovi2026!'},
          options: Options(extra: {'sinAuth': true}),
        );

        expect(r.statusCode, 200);
        expect(r.data?['accessToken'], 'token-de-prueba');

        cliente.cerrar();
      },
    );
  });
}

/// Adaptador que responde siempre 200 sin tocar la red.
class _AdaptadorFijo implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{"accessToken":"token-de-prueba","refreshToken":"r","usuario":{}}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
