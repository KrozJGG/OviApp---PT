import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/almacenamiento/almacen_sesion.dart';
import '../../core/proveedores.dart';
import '../../core/red/cliente_api.dart';

/// Estado de sesion de la aplicacion — IF6-ENT.
///
/// Es la fuente de verdad del router: mientras esta en `loading` se muestra la
/// pantalla de arranque, con `null` se va a login y con sesion se entra a la app.
class SesionNotifier extends AsyncNotifier<SesionGuardada?> {
  AlmacenSesion get _almacen => ref.read(almacenSesionProvider);
  ClienteApi get _cliente => ref.read(clienteApiProvider);

  @override
  Future<SesionGuardada?> build() async {
    // Si el cliente detecta que la sesion ya no puede renovarse, el estado
    // vuelve a "sin sesion" y el router redirige al login por si solo.
    final suscripcion = _cliente.sesionCaducada.listen((_) {
      state = const AsyncValue.data(null);
    });
    ref.onDispose(suscripcion.cancel);

    final sesion = await _almacen.leer();
    _cliente.usarToken(sesion?.accessToken);
    return sesion;
  }

  /// RF_00 / IF6-ENT — inicia sesion y deja los tokens listos para el cliente.
  Future<void> iniciarSesion(String email, String password) async {
    // Ojo: aqui NO se pasa el estado a `loading`. El router interpreta
    // «cargando» como «la app esta arrancando» y redirige a /arranque, lo que
    // destruiria la pantalla de login a mitad de la peticion y se llevaria por
    // delante el mensaje de error. El indicador de progreso del boton Entrar es
    // local a esa pantalla y basta.
    try {
      final dio = ref.read(dioProvider);
      final r = await dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email.trim(), 'password': password},
        options: Options(extra: {'sinAuth': true}),
      );

      final datos = r.data!;
      final sesion = SesionGuardada(
        accessToken: datos['accessToken'] as String,
        refreshToken: datos['refreshToken'] as String,
        usuario: Map<String, dynamic>.from(datos['usuario'] as Map),
      );

      await _almacen.guardar(sesion);
      _cliente.usarToken(sesion.accessToken);
      state = AsyncValue.data(sesion);
    } catch (e, s) {
      // El estado vuelve a "sin sesion": un login fallido no debe dejar la app
      // atrapada en un error del que no se puede salir.
      state = const AsyncValue.data(null);
      Error.throwWithStackTrace(comoErrorApi(e), s);
    }
  }

  Future<void> cerrarSesion() async {
    final sesion = state.valueOrNull;

    if (sesion != null) {
      try {
        await ref.read(dioProvider).post<void>(
              '/auth/logout',
              data: {'refreshToken': sesion.refreshToken},
            );
      } catch (_) {
        // Cerrar sesion nunca falla desde el punto de vista del usuario: si el
        // servidor no responde, igual se borran las credenciales locales.
      }
    }

    await _almacen.limpiar();
    _cliente.usarToken(null);
    state = const AsyncValue.data(null);
  }
}

final sesionProvider =
    AsyncNotifierProvider<SesionNotifier, SesionGuardada?>(SesionNotifier.new);

/// Atajos de lectura para las pantallas.
final estaAutenticadoProvider = Provider<bool>(
  (ref) => ref.watch(sesionProvider).valueOrNull != null,
);

final esProductorProvider = Provider<bool>(
  (ref) => ref.watch(sesionProvider).valueOrNull?.esProductor ?? false,
);

final usuarioActualProvider = Provider<SesionGuardada?>(
  (ref) => ref.watch(sesionProvider).valueOrNull,
);
