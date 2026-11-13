import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../calendario/calendario_proveedores.dart';
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';
import 'vigilancia.dart' show aspectoDeAlerta;

/// Detalle de una alerta de vigilancia (RF_19).
///
/// Es también el destino del deep-link de la notificación push (IF3-SAL).
class PantallaDetalleAlerta extends ConsumerWidget {
  const PantallaDetalleAlerta({super.key, required this.idAlerta});

  final String idAlerta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerta = ref.watch(alertaProvider(idAlerta));
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Alerta')),
      body: OviAsync<Alerta>(
        valor: alerta,
        alReintentar: () => ref.invalidate(alertaProvider(idAlerta)),
        enDatos: (a) {
          final (color, fondo, icono) = aspectoDeAlerta(a.tipoAlerta);

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(color: fondo, shape: BoxShape.circle),
                    child: Icon(icono, size: 28, color: color),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Etiquetas.tipoAlerta(a.tipoAlerta),
                          style: texto.titleLarge,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            OviChip(
                              texto: Etiquetas.nivelAlerta(a.nivel),
                              tono: switch (a.nivel) {
                                'CRITICA' => TonoChip.peligro,
                                'ADVERTENCIA' => TonoChip.advertencia,
                                _ => TonoChip.info,
                              },
                            ),
                            const SizedBox(width: 6),
                            OviChip(
                              texto: a.estaRevisada ? 'Revisada' : 'Nueva',
                              tono: a.estaRevisada ? TonoChip.neutro : TonoChip.exito,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              if (a.descripcion != null && a.descripcion!.trim().isNotEmpty) ...[
                OviTarjeta(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const OviEncabezadoSeccion(titulo: 'Qué se detectó'),
                      Text(a.descripcion!, style: texto.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              OviTarjeta(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const OviEncabezadoSeccion(titulo: 'Detalle'),
                    OviDato(
                      etiqueta: 'Fecha y hora',
                      valor: '${Fmt.fecha(a.fechaHora)} · ${Fmt.hora(a.fechaHora)}',
                    ),
                    OviDato(
                      etiqueta: 'Detectadas',
                      valor: a.conteoAnimales?.toString() ?? '—',
                    ),
                    OviDato(
                      etiqueta: 'Esperadas',
                      valor: a.conteoEsperado?.toString() ?? '—',
                    ),
                    if (a.faltantes != null)
                      OviDato(
                        etiqueta: 'Diferencia',
                        valor: '${a.faltantes} sin detectar',
                      ),
                    OviDato(
                      etiqueta: 'Dispositivo',
                      valor: Fmt.oGuion(a.dispositivo?.nombre),
                    ),
                    if (a.estaRevisada) ...[
                      OviDato(
                        etiqueta: 'Revisada por',
                        valor: Fmt.oGuion(a.revisadoPor?.nombre),
                      ),
                      OviDato(
                        etiqueta: 'Revisada el',
                        valor: a.fechaRevision == null
                            ? '—'
                            : Fmt.fecha(a.fechaRevision!),
                      ),
                    ],
                  ],
                ),
              ),

              if (!a.estaRevisada) ...[
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () => _marcarRevisada(context, ref, idAlerta),
                  icon: const Icon(Icons.done_all_rounded),
                  label: const Text('Marcar como revisada'),
                ),
                const SizedBox(height: 8),
                Text(
                  'Al revisarla deja de contarse en el resumen de inicio.',
                  textAlign: TextAlign.center,
                  style: texto.bodySmall,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

Future<void> _marcarRevisada(
  BuildContext context,
  WidgetRef ref,
  String idAlerta,
) async {
  try {
    await ref.read(vigilanciaRepositorioProvider).revisar(idAlerta);
    ref.invalidate(alertaProvider(idAlerta));
    ref.invalidate(estadoVigilanciaProvider);
    ref.invalidate(resumenInicioProvider);
    if (context.mounted) mostrarMensaje(context, 'Alerta marcada como revisada.');
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
