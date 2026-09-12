import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formato.dart';
import '../../../core/proveedores.dart';
import '../../../core/red/api.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/red/paginado.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../bitacora_proveedores.dart';
import '../datos/entrada_bitacora.dart';

/// Pantalla 07 — Bitácora del animal (RF_05, RF_06).
///
/// Es un historial de solo lectura: lo único que el usuario puede hacer es
/// añadir una nota. Las demás entradas las genera el sistema.
class PantallaBitacora extends ConsumerWidget {
  const PantallaBitacora({super.key, required this.idAnimal, this.numeroOreja});

  final String idAnimal;
  final String? numeroOreja;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entradas = ref.watch(bitacoraProvider(idAnimal));

    return Scaffold(
      appBar: AppBar(
        title: Text(numeroOreja == null ? 'Bitácora' : 'Bitácora #$numeroOreja'),
      ),
      body: OviAsync<Paginado<EntradaBitacora>>(
        valor: entradas,
        alReintentar: () => ref.invalidate(bitacoraProvider(idAnimal)),
        estaVacio: (p) => p.estaVacio,
        vacio: const OviEstadoVacio(
          mensaje: 'Sin movimientos todavía',
          detalle: 'Cada alta, cambio o evento del animal quedará registrado aquí.',
          icono: Icons.history_rounded,
        ),
        enDatos: (p) => ListView.builder(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
          itemCount: p.datos.length,
          itemBuilder: (_, i) => _Entrada(
            entrada: p.datos[i],
            esUltima: i == p.datos.length - 1,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _agregarNota(context, ref, idAnimal),
        icon: const Icon(Icons.edit_note_rounded),
        label: const Text('Nota'),
      ),
    );
  }
}

/// Fila del timeline: punto de color según el tipo, línea vertical y tarjeta.
class _Entrada extends StatelessWidget {
  const _Entrada({required this.entrada, required this.esUltima});

  final EntradaBitacora entrada;
  final bool esUltima;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final (color, icono) = _aspecto(entrada.tipo);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Carril del timeline.
          Column(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: Icon(icono, size: 16, color: Colors.white),
              ),
              if (!esUltima)
                Expanded(
                  child: Container(width: 2, color: OviColores.borde),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: esUltima ? 0 : 14),
              child: OviTarjeta(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(entrada.titulo, style: texto.titleSmall),
                        ),
                        const SizedBox(width: 8),
                        Text(Fmt.diaMes(entrada.fecha), style: texto.bodySmall),
                      ],
                    ),
                    if (entrada.descripcion != null &&
                        entrada.descripcion!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(entrada.descripcion!, style: texto.bodyMedium),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        OviChip(
                          texto: Etiquetas.tipoBitacora(entrada.tipo),
                          tono: entrada.esAutomatica ? TonoChip.neutro : TonoChip.info,
                        ),
                        // RF_10 — la entrada sobrevive al evento que la originó.
                        if (entrada.eventoEliminado) ...[
                          const SizedBox(width: 6),
                          const OviChip(
                            texto: 'Evento eliminado',
                            tono: TonoChip.advertencia,
                          ),
                        ],
                        const Spacer(),
                        if (entrada.usuario != null)
                          Flexible(
                            child: Text(
                              entrada.usuario!.nombre,
                              overflow: TextOverflow.ellipsis,
                              style: texto.bodySmall,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static (Color, IconData) _aspecto(String tipo) => switch (tipo) {
        'ALTA' => (OviColores.exito, Icons.add_rounded),
        'BAJA' => (OviColores.peligro, Icons.remove_rounded),
        'MODIFICACION' => (OviColores.advertencia, Icons.edit_rounded),
        'EVENTO' => (OviColores.primary, Icons.event_rounded),
        _ => (OviColores.acento, Icons.sticky_note_2_rounded),
      };
}

/// Diálogo para añadir una nota manual (el único tipo que escribe el usuario).
Future<void> _agregarNota(BuildContext context, WidgetRef ref, String idAnimal) async {
  final controlador = TextEditingController();

  final contenido = await showDialog<String>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Nueva nota'),
      content: TextField(
        controller: controlador,
        autofocus: true,
        maxLines: 4,
        maxLength: 1000,
        decoration: const InputDecoration(
          hintText: 'Qué observaste del animal…',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogo).pop(controlador.text.trim()),
          child: const Text('Guardar'),
        ),
      ],
    ),
  );

  controlador.dispose();
  if (contenido == null || contenido.isEmpty || !context.mounted) return;

  try {
    await ref.read(dioProvider).enviar(
          '/animales/$idAnimal/bitacora',
          cuerpo: {'contenido': contenido},
        );
    ref.invalidate(bitacoraProvider(idAnimal));
    if (context.mounted) mostrarMensaje(context, 'Nota agregada a la bitácora.');
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
