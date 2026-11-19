import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/administracion/pantallas/formulario_usuario.dart';
import '../../features/administracion/pantallas/usuarios.dart';
import '../../features/auth/pantallas/arranque.dart';
import '../../features/auth/pantallas/login.dart';
import '../../features/auth/sesion.dart';
import '../../features/bitacora/pantallas/bitacora.dart';
import '../../features/calendario/pantallas/calendario.dart';
import '../../features/eventos/pantallas/detalle_evento.dart';
import '../../features/eventos/pantallas/formulario_evento.dart';
import '../../features/inicio/pantallas/inicio.dart';
import '../../features/mas/pantallas/mas.dart';
import '../../features/rebano/pantallas/ficha_animal.dart';
import '../../features/rebano/pantallas/formulario_animal.dart';
import '../../features/rebano/pantallas/rebano.dart';
import '../../features/tareas/pantallas/detalle_tarea.dart';
import '../../features/tareas/pantallas/formulario_tarea.dart';
import '../../features/tareas/pantallas/tareas.dart';
import '../../features/vigilancia/pantallas/vigilancia.dart';
import '../../features/vigilancia/pantallas/vigilancia_en_vivo.dart';
import 'shell_principal.dart';

/// Rutas de la aplicacion.
///
/// Los nombres son la unica forma de navegar: ninguna pantalla escribe una ruta
/// a mano. Asi cambiar un camino no obliga a buscar cadenas por todo el codigo.
abstract final class Rutas {
  static const arranque = 'arranque';
  static const login = 'login';

  static const inicio = 'inicio';

  static const rebano = 'rebano';
  static const animalNuevo = 'animalNuevo';
  static const animalFicha = 'animalFicha';
  static const animalEditar = 'animalEditar';
  static const animalBitacora = 'animalBitacora';

  static const calendario = 'calendario';
  static const eventoNuevo = 'eventoNuevo';
  static const eventoDetalle = 'eventoDetalle';
  static const eventoEditar = 'eventoEditar';
  static const tareas = 'tareas';
  static const tareaNueva = 'tareaNueva';
  static const tareaDetalle = 'tareaDetalle';
  static const tareaEditar = 'tareaEditar';

  static const vigilancia = 'vigilancia';
  static const vigilanciaEnVivo = 'vigilanciaEnVivo';

  static const mas = 'mas';
  static const usuarios = 'usuarios';
  static const usuarioNuevo = 'usuarioNuevo';
  static const usuarioEditar = 'usuarioEditar';
}

final _raiz = GlobalKey<NavigatorState>(debugLabel: 'raiz');

final routerProvider = Provider<GoRouter>((ref) {
  // El router se reconstruye cuando cambia el estado de sesion, y el `redirect`
  // decide a donde va el usuario. No hay navegacion imperativa tras el login ni
  // tras el cierre de sesion: se deduce del estado.
  final sesion = ref.watch(sesionProvider);

  return GoRouter(
    navigatorKey: _raiz,
    initialLocation: '/inicio',
    debugLogDiagnostics: false,
    redirect: (context, estado) {
      final cargando = sesion.isLoading;
      final autenticado = sesion.valueOrNull != null;
      final ruta = estado.matchedLocation;

      if (cargando) return ruta == '/arranque' ? null : '/arranque';
      if (!autenticado) return ruta == '/login' ? null : '/login';
      if (ruta == '/login' || ruta == '/arranque') return '/inicio';
      return null;
    },
    routes: [
      GoRoute(
        path: '/arranque',
        name: Rutas.arranque,
        builder: (_, _) => const PantallaArranque(),
      ),
      GoRoute(
        path: '/login',
        name: Rutas.login,
        builder: (_, _) => const PantallaLogin(),
      ),

      // Las cinco pestañas fijas del mockup: Inicio, Rebaño, Calendario,
      // Vigilancia y Más. Cada rama conserva su propia pila de navegacion, de
      // modo que volver a una pestaña no pierde donde estaba el usuario.
      StatefulShellRoute.indexedStack(
        builder: (_, _, navegacion) => ShellPrincipal(navegacion: navegacion),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/inicio',
                name: Rutas.inicio,
                builder: (_, _) => const PantallaInicio(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/rebano',
                name: Rutas.rebano,
                builder: (_, _) => const PantallaRebano(),
                routes: [
                  GoRoute(
                    path: 'nuevo',
                    name: Rutas.animalNuevo,
                    builder: (_, _) => const PantallaFormularioAnimal(),
                  ),
                  GoRoute(
                    path: ':id',
                    name: Rutas.animalFicha,
                    builder: (_, e) =>
                        PantallaFichaAnimal(idAnimal: e.pathParameters['id']!),
                    routes: [
                      GoRoute(
                        path: 'editar',
                        name: Rutas.animalEditar,
                        builder: (_, e) => PantallaFormularioAnimal(
                          idAnimal: e.pathParameters['id'],
                        ),
                      ),
                      GoRoute(
                        path: 'bitacora',
                        name: Rutas.animalBitacora,
                        builder: (_, e) => PantallaBitacora(
                          idAnimal: e.pathParameters['id']!,
                          numeroOreja: e.uri.queryParameters['oreja'],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/calendario',
                name: Rutas.calendario,
                builder: (_, _) => const PantallaCalendario(),
                routes: [
                  GoRoute(
                    path: 'tareas',
                    name: Rutas.tareas,
                    builder: (_, _) => const PantallaTareas(),
                  ),
                  GoRoute(
                    path: 'evento/nuevo',
                    name: Rutas.eventoNuevo,
                    builder: (_, e) => PantallaFormularioEvento(
                      fechaSugerida: e.uri.queryParameters['fecha'],
                    ),
                  ),
                  GoRoute(
                    path: 'evento/:id',
                    name: Rutas.eventoDetalle,
                    builder: (_, e) =>
                        PantallaDetalleEvento(idEvento: e.pathParameters['id']!),
                    routes: [
                      GoRoute(
                        path: 'editar',
                        name: Rutas.eventoEditar,
                        builder: (_, e) => PantallaFormularioEvento(
                          idEvento: e.pathParameters['id'],
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'tarea/nueva',
                    name: Rutas.tareaNueva,
                    builder: (_, e) => PantallaFormularioTarea(
                      fechaSugerida: e.uri.queryParameters['fecha'],
                    ),
                  ),
                  GoRoute(
                    path: 'tarea/:id',
                    name: Rutas.tareaDetalle,
                    builder: (_, e) =>
                        PantallaDetalleTarea(idTarea: e.pathParameters['id']!),
                    routes: [
                      GoRoute(
                        path: 'editar',
                        name: Rutas.tareaEditar,
                        builder: (_, e) => PantallaFormularioTarea(
                          idTarea: e.pathParameters['id'],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/vigilancia',
                name: Rutas.vigilancia,
                builder: (_, _) => const PantallaVigilancia(),
                routes: [
                  GoRoute(
                    path: 'vivo/:idDispositivo',
                    name: Rutas.vigilanciaEnVivo,
                    builder: (_, e) => PantallaVigilanciaEnVivo(
                      idDispositivo: e.pathParameters['idDispositivo']!,
                      iniciarEdicionRoi:
                          e.uri.queryParameters['editarRoi'] == 'true',
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/mas',
                name: Rutas.mas,
                builder: (_, _) => const PantallaMas(),
                routes: [
                  GoRoute(
                    path: 'usuarios',
                    name: Rutas.usuarios,
                    builder: (_, _) => const PantallaUsuarios(),
                    routes: [
                      GoRoute(
                        path: 'nuevo',
                        name: Rutas.usuarioNuevo,
                        builder: (_, _) => const PantallaFormularioUsuario(),
                      ),
                      GoRoute(
                        path: ':id/editar',
                        name: Rutas.usuarioEditar,
                        builder: (_, e) => PantallaFormularioUsuario(
                          idUsuario: e.pathParameters['id'],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
