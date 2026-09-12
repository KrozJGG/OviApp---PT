import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/red/paginado.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../administracion_proveedores.dart';
import '../datos/usuario.dart';

/// Pantalla de administración de usuarios (RF_20 a RF_22). Solo Productor.
class PantallaUsuarios extends ConsumerWidget {
  const PantallaUsuarios({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuarios = ref.watch(usuariosProvider);
    final yo = ref.watch(usuarioActualProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Usuarios')),
      body: OviAsync<Paginado<Usuario>>(
        valor: usuarios,
        alReintentar: () => ref.invalidate(usuariosProvider),
        estaVacio: (p) => p.estaVacio,
        vacio: const OviEstadoVacio(
          mensaje: 'No hay usuarios registrados',
          detalle: 'Usa el botón + para dar acceso a un trabajador del predio.',
          icono: Icons.group_outlined,
        ),
        enDatos: (p) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(usuariosProvider),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 96),
            itemCount: p.datos.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _TarjetaUsuario(
              usuario: p.datos[i],
              esUnoMismo: p.datos[i].id == yo?.idUsuario,
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.goNamed(Rutas.usuarioNuevo),
        tooltip: 'Nuevo usuario',
        child: const Icon(Icons.person_add_alt_rounded),
      ),
    );
  }
}

class _TarjetaUsuario extends ConsumerWidget {
  const _TarjetaUsuario({required this.usuario, required this.esUnoMismo});

  final Usuario usuario;
  final bool esUnoMismo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final texto = Theme.of(context).textTheme;

    return OviTarjeta(
      atenuada: !usuario.estaHabilitado,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: OviColores.superficieSecundaria,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.person_rounded, size: 22, color: OviColores.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        usuario.nombre,
                        style: texto.titleSmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (esUnoMismo) ...[
                      const SizedBox(width: 6),
                      const OviChip(texto: 'Tú', tono: TonoChip.info),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  usuario.email,
                  style: texto.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    OviChip(
                      texto: Etiquetas.rol(usuario.rol),
                      tono: usuario.esProductor ? TonoChip.info : TonoChip.neutro,
                    ),
                    if (!usuario.estaHabilitado) ...[
                      const SizedBox(width: 6),
                      const OviChip(texto: 'Inhabilitado', tono: TonoChip.peligro),
                    ],
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Acciones',
            onSelected: (accion) => switch (accion) {
              'editar' => context.goNamed(
                  Rutas.usuarioEditar,
                  pathParameters: {'id': usuario.id},
                ),
              _ => _confirmarInhabilitar(context, ref, usuario),
            },
            itemBuilder: (_) => [
              // RF_21 — solo se edita un usuario habilitado.
              if (usuario.estaHabilitado)
                const PopupMenuItem(value: 'editar', child: Text('Editar')),
              // RF_22 — inhabilitar. Uno no puede quitarse el acceso a sí mismo.
              if (usuario.estaHabilitado && !esUnoMismo)
                const PopupMenuItem(
                  value: 'inhabilitar',
                  child: Text('Inhabilitar', style: TextStyle(color: OviColores.peligro)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmarInhabilitar(
  BuildContext context,
  WidgetRef ref,
  Usuario usuario,
) async {
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: Text('Inhabilitar a ${usuario.nombre}'),
      content: const Text(
        'La persona deja de poder iniciar sesión. Sus registros históricos '
        '—animales que dio de alta, tareas que completó— se conservan.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: OviColores.peligro),
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Inhabilitar'),
        ),
      ],
    ),
  );

  if (confirmado != true || !context.mounted) return;

  try {
    await ref.read(usuariosRepositorioProvider).inhabilitar(usuario.id);
    ref.invalidate(usuariosProvider);
    if (context.mounted) {
      mostrarMensaje(context, '${usuario.nombre} ya no puede iniciar sesión.');
    }
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
