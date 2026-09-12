import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/calendario/datos/agenda.dart';
import '../formato.dart';
import '../router/rutas.dart';
import '../tema/ovi_colores.dart';
import 'ovi_widgets.dart';

/// Fila de un evento o una tarea en el calendario y en la pantalla de inicio.
///
/// Vive en el núcleo porque la comparten dos features (mockups 02 y 06) y
/// porque el estándar visual —barra de color a la izquierda, chip de tipo,
/// título y detalle— tiene que ser idéntico en ambas.
class FilaAgenda extends StatelessWidget {
  const FilaAgenda({super.key, required this.item});

  final ItemAgenda item;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final esEvento = item.esEvento;

    // Azul para eventos, verde para tareas: es el código de color del mockup.
    final color = esEvento ? OviColores.primary : OviColores.exito;
    final completada = item.estado == 'COMPLETADA';

    return OviTarjeta(
      padding: EdgeInsets.zero,
      atenuada: completada,
      alTocar: () => _abrirDetalle(context),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Barra vertical de color del mockup.
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: color,
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        OviChip(
                          texto: esEvento
                              ? Etiquetas.tipoEvento(item.tipo)
                              : (completada ? 'Completada' : 'Tarea'),
                          tono: esEvento ? TonoChip.info : TonoChip.exito,
                        ),
                        const Spacer(),
                        Text(
                          esEvento ? Fmt.hora(item.fecha) : Fmt.fechaRelativa(item.fecha),
                          style: texto.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.titulo,
                      style: texto.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (_subtitulo != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        _subtitulo!,
                        style: texto.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: Icon(Icons.chevron_right_rounded, color: OviColores.textoSecundario),
            ),
          ],
        ),
      ),
    );
  }

  /// Para una tarea, sus responsables; para un evento, su descripción.
  String? get _subtitulo {
    if (item.esEvento) {
      final d = item.descripcion?.trim();
      return (d == null || d.isEmpty) ? null : d;
    }
    final nombres = item.responsables.map((r) => r.nombre).join(', ');
    return nombres.isEmpty ? null : 'Asignada a $nombres';
  }

  void _abrirDetalle(BuildContext context) {
    context.goNamed(
      item.esEvento ? Rutas.eventoDetalle : Rutas.tareaDetalle,
      pathParameters: {'id': item.id},
    );
  }
}
