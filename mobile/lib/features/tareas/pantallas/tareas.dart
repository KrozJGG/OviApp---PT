import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/paginado.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/tarea.dart';
import '../tareas_proveedores.dart';

/// Pantalla de tareas del predio — Módulo 4 (RF_11 a RF_14).
///
/// Se llega desde el Calendario. El calendario muestra las tareas por día; esta
/// pantalla las muestra todas juntas, que es como se revisa el pendiente.
class PantallaTareas extends ConsumerWidget {
  const PantallaTareas({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tareas = ref.watch(tareasProvider);
    final filtro = ref.watch(filtroTareasProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tareas')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final (etiqueta, valor) in const <(String, String?)>[
                    ('Activas', 'ACTIVA'),
                    ('Completadas', 'COMPLETADA'),
                    ('Todas', null),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(etiqueta),
                        selected: filtro == valor,
                        showCheckmark: false,
                        onSelected: (_) =>
                            ref.read(filtroTareasProvider.notifier).filtrar(valor),
                        labelStyle: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: filtro == valor
                              ? Colors.white
                              : OviColores.textoSecundario,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: OviAsync<Paginado<Tarea>>(
              valor: tareas,
              alReintentar: () => ref.invalidate(tareasProvider),
              estaVacio: (p) => p.estaVacio,
              vacio: OviEstadoVacio(
                mensaje: switch (filtro) {
                  'ACTIVA' => 'No hay tareas pendientes',
                  'COMPLETADA' => 'Todavía no hay tareas completadas',
                  _ => 'No hay tareas registradas',
                },
                detalle: 'Usa el botón + para planificar una actividad del predio.',
                icono: Icons.task_alt_rounded,
              ),
              enDatos: (p) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(tareasProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
                  itemCount: p.datos.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _TarjetaTarea(tarea: p.datos[i]),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.goNamed(Rutas.tareaNueva),
        tooltip: 'Nueva tarea',
        child: const Icon(Icons.add_rounded, size: 28),
      ),
    );
  }
}

class _TarjetaTarea extends StatelessWidget {
  const _TarjetaTarea({required this.tarea});

  final Tarea tarea;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final responsables = tarea.responsables.map((r) => r.nombre).join(', ');

    return OviTarjeta(
      atenuada: tarea.estaCompletada,
      alTocar: () => context.goNamed(
        Rutas.tareaDetalle,
        pathParameters: {'id': tarea.id},
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            tarea.estaCompletada
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            color: tarea.estaCompletada ? OviColores.exito : OviColores.borde,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tarea.titulo, style: texto.titleSmall),
                const SizedBox(height: 2),
                Text(
                  responsables.isEmpty ? 'Sin responsable' : responsables,
                  style: texto.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    OviChip(
                      texto: tarea.estaCompletada
                          ? 'Completada'
                          : 'Vence ${Fmt.fechaRelativa(tarea.fechaLimite).toLowerCase()}',
                      tono: tarea.estaCompletada
                          ? TonoChip.exito
                          : (tarea.estaVencida ? TonoChip.peligro : TonoChip.neutro),
                    ),
                    if (tarea.animales.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      OviChip(
                        texto: '${tarea.animales.length} animal'
                            '${tarea.animales.length == 1 ? '' : 'es'}',
                        tono: TonoChip.neutro,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
