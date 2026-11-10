import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:oviapp/core/almacenamiento/almacen_sesion.dart';
import 'package:oviapp/core/cache/cache_respuestas.dart';
import 'package:oviapp/core/red/cliente_api.dart';
import 'package:oviapp/core/red/error_api.dart';

class _SeguroFalso extends Mock implements FlutterSecureStorage {}

/// Almacén seguro en memoria: lo justo para ejercitar el caché sin plataforma.
_SeguroFalso _seguroEnMemoria() {
  final seguro = _SeguroFalso();
  final datos = <String, String>{};

  when(() => seguro.read(key: any(named: 'key')))
      .thenAnswer((i) async => datos[i.namedArguments[#key] as String]);
  when(() => seguro.write(key: any(named: 'key'), value: any(named: 'value')))
      .thenAnswer((i) async {
    datos[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
  });
  when(() => seguro.delete(key: any(named: 'key'))).thenAnswer((i) async {
    datos.remove(i.namedArguments[#key] as String);
  });
  when(() => seguro.readAll()).thenAnswer((_) async => Map.of(datos));

  return seguro;
}

/// Adaptador controlable: responde 200, 500 o simula que no hay red.
class _AdaptadorControlable implements HttpClientAdapter {
  bool hayRed = true;
  int status = 200;
  String cuerpo = '{"datos":[{"id":"a1"}]}';

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (!hayRed) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
      );
    }
    return ResponseBody.fromString(
      status == 200 ? cuerpo : '{"error":{"codigo":"INTERNO","mensaje":"falla"}}',
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  late _SeguroFalso seguro;
  late _AdaptadorControlable red;
  late ClienteApi cliente;

  setUp(() {
    seguro = _seguroEnMemoria();
    red = _AdaptadorControlable();
    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://localhost:3000/api/v1',
        validateStatus: (s) => s != null && s < 400,
      ),
    )..httpClientAdapter = red;

    cliente = ClienteApi(
      almacen: AlmacenSesion(almacen: seguro),
      cache: CacheRespuestas(almacen: seguro),
      dio: dio,
    );
  });

  tearDown(() => cliente.cerrar());

  group('caché de lecturas', () {
    test('sin red devuelve la última respuesta guardada y avisa que es del caché',
        () async {
      await cliente.dio.get<Map<String, dynamic>>('/animales');
      expect(cliente.datosDeCache.value, isNull);

      red.hayRed = false;
      final r = await cliente.dio.get<Map<String, dynamic>>('/animales');

      expect(r.data?['datos'], isNotEmpty);
      expect(r.extra['desdeCache'], isTrue);
      expect(cliente.datosDeCache.value, isNotNull);
    });

    test('distingue por consulta: otra búsqueda sin caché falla', () async {
      await cliente.dio.get<Map<String, dynamic>>(
        '/animales',
        queryParameters: {'q': '0042'},
      );

      red.hayRed = false;

      await expectLater(
        cliente.dio.get<Map<String, dynamic>>(
          '/animales',
          queryParameters: {'q': '0099'},
        ),
        throwsA(isA<DioException>()),
      );
    });

    test('al volver la red limpia el aviso de datos del caché', () async {
      await cliente.dio.get<Map<String, dynamic>>('/animales');
      red.hayRed = false;
      await cliente.dio.get<Map<String, dynamic>>('/animales');
      expect(cliente.datosDeCache.value, isNotNull);

      red.hayRed = true;
      await cliente.dio.get<Map<String, dynamic>>('/animales');

      expect(cliente.datosDeCache.value, isNull);
    });

    test('sin red y sin nada guardado entrega SIN_CONEXION', () async {
      red.hayRed = false;

      try {
        await cliente.dio.get<Map<String, dynamic>>('/animales');
        fail('debía lanzar');
      } on DioException catch (e) {
        expect((e.error as ErrorApi).codigo, 'SIN_CONEXION');
      }
    });

    test('un error del servidor (500) no se disfraza con el caché', () async {
      await cliente.dio.get<Map<String, dynamic>>('/animales');
      red.status = 500;

      await expectLater(
        cliente.dio.get<Map<String, dynamic>>('/animales'),
        throwsA(isA<DioException>()),
      );
      expect(cliente.datosDeCache.value, isNull);
    });
  });

  group('lo que NO se cachea', () {
    test('las escrituras fallan sin red aunque exista caché del mismo path',
        () async {
      await cliente.dio.get<Map<String, dynamic>>('/animales');
      red.hayRed = false;

      await expectLater(
        cliente.dio.post<Map<String, dynamic>>('/animales', data: {'sexo': 'H'}),
        throwsA(isA<DioException>()),
      );
    });

    test('el streaming nunca se guarda', () async {
      await cliente.dio.get<Map<String, dynamic>>('/streaming/rebano/index.m3u8');
      red.hayRed = false;

      await expectLater(
        cliente.dio.get<Map<String, dynamic>>('/streaming/rebano/index.m3u8'),
        throwsA(isA<DioException>()),
      );
    });

    test('las rutas de sesión nunca se guardan', () async {
      await cliente.dio.get<Map<String, dynamic>>('/auth/yo');
      red.hayRed = false;

      await expectLater(
        cliente.dio.get<Map<String, dynamic>>('/auth/yo'),
        throwsA(isA<DioException>()),
      );
    });
  });

  group('CacheRespuestas', () {
    test('limpiar() vacía el caché (cierre de sesión / cambio de usuario)',
        () async {
      final cache = CacheRespuestas(almacen: seguro);
      await cache.guardar('/animales?', {'datos': []});
      expect(await cache.leer('/animales?'), isNotNull);

      await cache.limpiar();

      expect(await cache.leer('/animales?'), isNull);
    });

    test('limpiar() no borra la sesión guardada', () async {
      final sesion = AlmacenSesion(almacen: seguro);
      await sesion.guardar(const SesionGuardada(
        accessToken: 'a',
        refreshToken: 'r',
        usuario: {'id': 'u1', 'rol': 'PRODUCTOR'},
      ));
      final cache = CacheRespuestas(almacen: seguro);
      await cache.guardar('/animales?', {'datos': []});

      await cache.limpiar();

      expect(await sesion.leer(), isNotNull);
    });

    test('un almacén que falla degrada a «sin caché», no rompe la app', () async {
      final roto = _SeguroFalso();
      when(() => roto.read(key: any(named: 'key'))).thenThrow(Exception('x'));
      when(() => roto.write(key: any(named: 'key'), value: any(named: 'value')))
          .thenThrow(Exception('x'));
      when(() => roto.readAll()).thenThrow(Exception('x'));

      final cache = CacheRespuestas(almacen: roto);

      await expectLater(cache.guardar('k', {'a': 1}), completes);
      await expectLater(cache.leer('k'), completion(isNull));
      await expectLater(cache.limpiar(), completes);
    });

    test('un valor corrupto se ignora', () async {
      await seguro.write(key: 'oviapp.cache./animales?', value: '{no es json');

      final cache = CacheRespuestas(almacen: seguro);

      expect(await cache.leer('/animales?'), isNull);
    });
  });
}

