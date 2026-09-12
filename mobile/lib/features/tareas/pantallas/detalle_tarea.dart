import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../calendario/calendario_proveedores.dart';
import '../datos/tarea.dart';
import '../tareas_proveedores.dart';

/// Pantalla 09 — Detalle de una tarea (RF_12 a RF_14).
///
/// A diferencia de los eventos, las tareas las gestionan los dos roles.
class PantallaDetalleTarea extends ConsumerWidget {
  const PantallaDetalleTarea({super.key, required this.idTarea});

  final String idTarea;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tarea = ref.watch(tareaProvider(idTarea));
    final texto = Theme.of(context).textTheme;
    final completada = tarea.valueOrNull?.estaCompletada ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarea'),
        actions: [
          // RF_12 — solo se edita una tarea que no esté completada.
          if (tarea.valueOrNull != null && !completada)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => context.goNamed(
                Rutas.tareaEditar,
                pathParameters: {'id': idTarea},
              ),
            ),
          if (tarea.valueOrNull != null)
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: () => _confirmarEliminar(context, ref, idTarea),
            ),
        ],
      ),
      body: OviAsync<Tarea>(
        valor: tarea,
        alReintentar: () => ref.invalidate(tareaProvider(idTarea)),
        enDatos: (t) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            Row(
              children: [
                OviChip(
                  texto: Etiquetas.estadoTarea(t.estado),
                  tono: t.estaCompletada ? TonoChip.exito : TonoChip.info,
                ),
                if (t.estaVencida) ...[
                  const SizedBox(width: 8),
                  const OviChip(texto: 'Vencida', tono: TonoChip.peligro),
                ],
              ],
            ),
            const SizedBox(height: 14),
            Text(t.titulo, style: texto.headlineSmall),
            const SizedBox(height: 20),

            OviTarjeta(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const OviEncabezadoSeccion(titulo: 'Detalle'),
                  OviDato(
                    etiqueta: 'Vence',
                    valor: '${Fmt.fecha(t.fechaLimite)} · ${Fmt.fechaRelativa(t.fechaLimite)}',
                  ),
                  OviDato(etiqueta: 'Creada por', valor: Fmt.oGuion(t.creador?.nombre)),
                  if (t.estaCompletada) ...[
                    OviDato(
                      etiqueta: 'Completada',
                      valor: t.completadaEn == null ? '—' : Fmt.fecha(t.completadaEn!),
                    ),
                    OviDato(
                      etiqueta: 'Marcada por',
                      valor: Fmt.oGuion(t.completadaPor?.nombre),
                    ),
                  ],
                  if (t.descripcion != null && t.descripcion!.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('Descripción', style: texto.bodySmall),
                    const SizedBox(height: 4),
                    Text(t.descripcion!, style: texto.bodyMedium),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),

            OviTarjeta(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const OviEncabezadoSeccion(titulo: 'Responsables'),
                  if (t.responsables.isEmpty)
                    Text('Sin responsables asignados.', style: texto.bodySmall)
                  else
                    for (final r in t.responsables)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: const BoxDecoration(
                                color: OviColores.superficieSecundaria,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.person_rounded,
                                  size: 18, color: OviColores.primary),
                            ),
                            const SizedBox(width: 12),
                            Text(r.nombre, style: texto.bodyMedium),
                          ],
                        ),
                      ),
                ],
              ),
            ),

            if (t.animales.isNotEmpty) ...[
              const SizedBox(height: 14),
              OviTarjeta(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OviEncabezadoSeccion(
                      titulo: 'Animales',
                      detalle: '${t.animales.length}',
                    ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final a in t.animales)
                          OviChip(texto: '#${a.numeroOreja}', tono: TonoChip.neutro),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            // RF_13 — completar. Una tarea completada no vuelve atrás.
            if (!t.estaCompletada) ...[
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => _completar(context, ref, t),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Marcar como completada'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

Future<void> _completar(BuildContext context, WidgetRef ref, Tarea tarea) async {
  try {
    await ref.read(tareasRepositorioProvider).completar(tarea.id);
    ref.invalidate(tareaProvider(tarea.id));
    ref.invalidate(tareasProvider);
    ref.invalidate(agendaDelMesProvider);
    ref.invalidate(agendaDeHoyProvider);
    ref.invalidate(resumenInicioProvider);
    if (context.mounted) mostrarMensaje(context, 'Tarea completada.');
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}

Future<void> _confirmarEliminar(
  BuildContext context,
  WidgetRef ref,
  String idTarea,
) async {
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Eliminar tarea'),
      content: const Text('La tarea se quita del calendario de forma permanente.'),
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
    await ref.read(tareasRepositorioProvider).eliminar(idTarea);
    ref.invalidate(tareasProvider);
    ref.invalidate(agendaDelMesProvider);
    ref.invalidate(agendaDeHoyProvider);
    ref.invalidate(resumenInicioProvider);
    if (context.mounted) {
      mostrarMensaje(context, 'Tarea eliminada.');
      context.pop();
    }
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
