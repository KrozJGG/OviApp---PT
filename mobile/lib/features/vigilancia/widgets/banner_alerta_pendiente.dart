import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formato.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/tema/ovi_tema.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';

/// Banner destacado en Vigilancia cuando existe una alerta PENDIENTE.
/// Permite a PRODUCTOR y TRABAJADOR marcarla como Resuelta o Descartada,
/// e indica en ambar si el conteo ya se normalizo (posible oclusion).
class BannerAlertaPendiente extends ConsumerStatefulWidget {
  const BannerAlertaPendiente({super.key, required this.alerta});

  final AlertaVigilancia alerta;

  @override
  ConsumerState<BannerAlertaPendiente> createState() => _BannerAlertaPendienteState();
}

class _BannerAlertaPendienteState extends ConsumerState<BannerAlertaPendiente> {
  String? _procesando;

  Future<void> _cambiarEstado(String nuevoEstado) async {
    setState(() => _procesando = nuevoEstado);
    try {
      await ref
          .read(vigilanciaRepositorioProvider)
          .cambiarEstadoAlerta(widget.alerta.id, nuevoEstado);
      if (!mounted) return;
      final etiqueta = nuevoEstado == 'RESUELTA' ? 'resuelta' : 'descartada';
      mostrarMensaje(context, 'Alerta marcada como $etiqueta.');
    } on ErrorApi catch (e) {
      if (mounted) mostrarMensaje(context, e.mensaje, esError: true);
    } finally {
      if (mounted) setState(() => _procesando = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final a = widget.alerta;
    final ocupada = _procesando != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: OviColores.peligroFondo,
        borderRadius: BorderRadius.circular(OviTema.radioTarjeta),
        border: Border.all(color: OviColores.peligro, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFC2381C),
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  Etiquetas.tipoAlerta(a.tipo),
                  style: texto.titleMedium?.copyWith(
                    color: const Color(0xFFC2381C),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const OviChip(texto: 'Pendiente', tono: TonoChip.peligro),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            a.descripcion,
            style: texto.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            '${a.dispositivo.nombre} · ${Fmt.fechaHora(a.fechaDeteccion)}',
            style: texto.bodySmall,
          ),
          if (a.esNormalizada) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: OviColores.advertenciaFondo,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: OviColores.advertencia),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: Color(0xFFB45309),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Conteo normalizado a las ${Fmt.hora(a.normalizadaEn!)} (posible oclusión). Las notificaciones sonoras se detuvieron.',
                      style: texto.bodySmall?.copyWith(
                        color: const Color(0xFF92400E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: ocupada ? null : () => _cambiarEstado('RESUELTA'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF15803D),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(44),
                  ),
                  icon: _procesando == 'RESUELTA'
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.check_circle_outline_rounded, size: 18),
                  label: const Text('Resuelta'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: ocupada ? null : () => _cambiarEstado('DESCARTADA'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFC2381C),
                    side: const BorderSide(color: Color(0xFFC2381C)),
                    minimumSize: const Size.fromHeight(44),
                  ),
                  icon: _procesando == 'DESCARTADA'
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.cancel_outlined, size: 18),
                  label: const Text('Descartada'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
