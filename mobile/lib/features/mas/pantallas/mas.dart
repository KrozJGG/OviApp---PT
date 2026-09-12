import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';

/// Pantalla «Más»: perfil del usuario, accesos de administración y salida.
///
/// Es la única puerta al cierre de sesión, así que existe aunque el Trabajador
/// no vea ninguna de las opciones de administración.
class PantallaMas extends ConsumerWidget {
  const PantallaMas({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(usuarioActualProvider);
    final esProductor = ref.watch(esProductorProvider);
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Más')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          OviTarjeta(
            child: Row(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: const BoxDecoration(
                    color: OviColores.superficieSecundaria,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_rounded,
                      size: 28, color: OviColores.primary),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Fmt.oGuion(usuario?.nombre),
                        style: texto.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        (usuario?.usuario['email'] as String?) ?? '—',
                        style: texto.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      OviChip(
                        texto: Etiquetas.rol(usuario?.rol ?? 'TRABAJADOR'),
                        tono: esProductor ? TonoChip.info : TonoChip.neutro,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (usuario?.usuario['predio'] != null) ...[
            OviTarjeta(
              child: OviDato(
                etiqueta: 'Predio',
                valor: usuario!.usuario['predio'] as String,
                icono: Icons.landscape_outlined,
              ),
            ),
            const SizedBox(height: 14),
          ],

          // RF_20 a RF_22 — administración, exclusiva del Productor. Se oculta
          // en lugar de deshabilitarse: el backend responde 403 igualmente.
          if (esProductor) ...[
            OviTarjeta(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.group_outlined,
                        color: OviColores.primary),
                    title: const Text('Usuarios del predio'),
                    subtitle: const Text('Crear, editar e inhabilitar accesos'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.goNamed(Rutas.usuarios),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          OviTarjeta(
            padding: EdgeInsets.zero,
            child: ListTile(
              leading: const Icon(Icons.logout_rounded, color: OviColores.peligro),
              title: const Text(
                'Cerrar sesión',
                style: TextStyle(color: OviColores.peligro),
              ),
              onTap: () => _confirmarSalida(context, ref),
            ),
          ),

          const SizedBox(height: 28),
          Center(
            child: Text(
              'OviApp · versión 1.0.0',
              style: texto.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmarSalida(BuildContext context, WidgetRef ref) async {
  final salir = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Cerrar sesión'),
      content: const Text('Tendrás que volver a ingresar tu correo y contraseña.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: OviColores.peligro),
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Cerrar sesión'),
        ),
      ],
    ),
  );

  if (salir != true) return;
  // El router redirige solo al login cuando el estado de sesión pasa a null.
  await ref.read(sesionProvider.notifier).cerrarSesion();
}
