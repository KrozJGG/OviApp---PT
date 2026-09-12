import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../../calendario/calendario_proveedores.dart';
import '../datos/evento.dart';
import '../eventos_proveedores.dart';

/// Pantalla 08 — Detalle de un evento (RF_08).
///
/// Editar y eliminar son exclusivos del Productor (RF_09, RF_10): al Trabajador
/// no se le muestran, porque el backend se los rechazaría con 403.
class PantallaDetalleEvento extends ConsumerWidget {
  const PantallaDetalleEvento({super.key, required this.idEvento});

  final String idEvento;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final evento = ref.watch(eventoProvider(idEvento));
    final esProductor = ref.watch(esProductorProvider);
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Evento'),
        actions: [
          if (esProductor && (evento.valueOrNull?.estaEliminado == false)) ...[
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => context.goNamed(
                Rutas.eventoEditar,
                pathParameters: {'id': idEvento},
              ),
            ),
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: () => _confirmarEliminar(context, ref, idEvento),
            ),
          ],
        ],
      ),
      body: OviAsync<Evento>(
        valor: evento,
        alReintentar: () => ref.invalidate(eventoProvider(idEvento)),
        enDatos: (e) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            Row(
              children: [
                OviChip(
                  texto: Etiquetas.tipoEvento(e.tipo),
                  tono: TonoChip.info,
                  icono: Icons.event_rounded,
                ),
                const SizedBox(width: 8),
                if (e.estaEliminado)
                  const OviChip(texto: 'Eliminado', tono: TonoChip.peligro),
              ],
            ),
            const SizedBox(height: 16),
            Text(Fmt.fecha(e.fechaInicio), style: texto.headlineSmall),
            Text(
              '${Fmt.diaSemana(e.fechaInicio)} · ${Fmt.hora(e.fechaInicio)} h',
              style: texto.bodySmall,
            ),
            const SizedBox(height: 20),

            OviTarjeta(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const OviEncabezadoSeccion(titulo: 'Detalle'),
                  OviDato(etiqueta: 'Tipo', valor: Etiquetas.tipoEvento(e.tipo)),
                  OviDato(etiqueta: 'Estado', valor: _estado(e.estado)),
                  OviDato(
                    etiqueta: 'Registrado por',
                    valor: Fmt.oGuion(e.creador?.nombre),
                  ),
                  if (e.descripcion != null && e.descripcion!.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('Descripción', style: texto.bodySmall),
                    const SizedBox(height: 4),
                    Text(e.descripcion!, style: texto.bodyMedium),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),

            OviTarjeta(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  OviEncabezadoSeccion(
                    titulo: 'Animales involucrados',
                    detalle: '${e.animales.length}',
                  ),
                  if (e.animales.isEmpty)
                    Text('Sin animales asociados.', style: texto.bodySmall)
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final a in e.animales)
                          OviChip(
                            texto: '#${a.numeroOreja}',
                            tono: a.estado == 'ACTIVO' ? TonoChip.neutro : TonoChip.peligro,
                            icono: a.sexo == 'HEMBRA'
                                ? Icons.female_rounded
                                : Icons.male_rounded,
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _estado(String estado) => switch (estado) {
        'PROGRAMADO' => 'Programado',
        'REALIZADO' => 'Realizado',
        'ELIMINADO' => 'Eliminado',
        _ => estado,
      };
}

Future<void> _confirmarEliminar(
  BuildContext context,
  WidgetRef ref,
  String idEvento,
) async {
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Eliminar evento'),
      content: const Text(
        'El evento sale del calendario. Las entradas que ya generó en la '
        'bitácora de los animales se conservan como registro histórico.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: OviColores.peligro),
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Eliminar'),
        ),
      ],
    ),
  );

  if (confirmado != true || !context.mounted) return;

  try {
    await ref.read(eventosRepositorioProvider).eliminar(idEvento);
    ref.invalidate(agendaDelMesProvider);
    ref.invalidate(agendaDeHoyProvider);
    if (context.mounted) {
      mostrarMensaje(context, 'Evento eliminado.');
      context.pop();
    }
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
