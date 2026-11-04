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
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';

/// Pantalla 10 — Vigilancia y detección (RF_19, IF2-SAL).
///
/// La tarjeta superior muestra el estado del dispositivo edge; abajo va el
/// historial de alertas filtrable por tipo.
class PantallaVigilancia extends ConsumerWidget {
  const PantallaVigilancia({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estado = ref.watch(estadoVigilanciaProvider);
    final alertas = ref.watch(alertasProvider);
    final filtro = ref.watch(filtroAlertasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.videocam_rounded, color: OviColores.primary),
            SizedBox(width: 10),
            Text('Vigilancia del rebaño'),
          ],
        ),
        titleSpacing: 20,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(estadoVigilanciaProvider);
          ref.invalidate(alertasProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          children: [
            OviAsync<EstadoVigilancia>(
              valor: estado,
              alReintentar: () => ref.invalidate(estadoVigilanciaProvider),
              enDatos: (e) => _TarjetaEstado(estado: e),
            ),
            const SizedBox(height: 24),

            OviEncabezadoSeccion(
              titulo: 'Historial de alertas',
              accion: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // El contador del estado cuenta el predio entero, que es
                  // justo lo que marca el boton: no depende del filtro activo.
                  if ((estado.valueOrNull?.alertasSinRevisar ?? 0) > 0)
                    IconButton(
                      tooltip: 'Marcar todas como leídas',
                      icon: const Icon(Icons.done_all_rounded),
                      color: OviColores.primary,
                      onPressed: () => _marcarTodasLeidas(
                        context,
                        ref,
                        estado.valueOrNull!.alertasSinRevisar,
                      ),
                    ),
                  _MenuFiltro(
                    seleccionado: filtro,
                    alElegir: (t) => ref.read(filtroAlertasProvider.notifier).filtrar(t),
                  ),
                ],
              ),
            ),

            OviAsync<Paginado<Alerta>>(
              valor: alertas,
              alReintentar: () => ref.invalidate(alertasProvider),
              estaVacio: (p) => p.estaVacio,
              vacio: const Padding(
                padding: EdgeInsets.only(top: 12),
                child: OviEstadoVacio(
                  mensaje: 'Sin alertas registradas',
                  detalle: 'Cuando el módulo de detección identifique algo anormal, '
                      'aparecerá aquí.',
                  icono: Icons.shield_outlined,
                ),
              ),
              enDatos: (p) => Column(
                children: [
                  for (final alerta in p.datos)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _FilaAlerta(alerta: alerta),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Vacía la bandeja de alertas pendientes.
///
/// Se confirma antes porque no hay vuelta atrás: no existe forma de volver a
/// dejar una alerta como no leída.
Future<void> _marcarTodasLeidas(
  BuildContext context,
  WidgetRef ref,
  int pendientes,
) async {
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Marcar todas como leídas'),
      content: Text(
        pendientes == 1
            ? 'Se marcará como revisada la alerta pendiente. No se puede deshacer.'
            : 'Se marcarán como revisadas las $pendientes alertas pendientes. '
                'No se puede deshacer.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Marcar todas'),
        ),
      ],
    ),
  );

  if (confirmado != true || !context.mounted) return;

  try {
    final revisadas = await ref.read(vigilanciaRepositorioProvider).revisarTodas();
    ref.invalidate(estadoVigilanciaProvider);
    ref.invalidate(alertasProvider);
    if (!context.mounted) return;
    mostrarMensaje(
      context,
      revisadas == 0
          ? 'No quedaban alertas pendientes.'
          : revisadas == 1
              ? '1 alerta marcada como leída.'
              : '$revisadas alertas marcadas como leídas.',
    );
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}

/// Estado del dispositivo: última detección, conteo y si está en línea.
class _TarjetaEstado extends StatelessWidget {
  const _TarjetaEstado({required this.estado});

  final EstadoVigilancia estado;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final d = estado.principal;

    if (d == null) {
      return const OviEstadoVacio(
        mensaje: 'No hay cámaras registradas',
        detalle: 'El predio todavía no tiene un dispositivo de detección asociado.',
        icono: Icons.videocam_off_outlined,
      );
    }

    return OviTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(d.nombre, style: texto.titleMedium)),
              OviChip(
                texto: d.enLinea ? 'En línea' : 'Sin señal',
                tono: d.enLinea ? TonoChip.exito : TonoChip.neutro,
                icono: d.enLinea
                    ? Icons.circle
                    : Icons.signal_wifi_statusbar_null_rounded,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Dato(
                  etiqueta: 'Última detección',
                  valor: d.ultimoHeartbeat == null
                      ? 'Sin datos'
                      : Fmt.hace(d.ultimoHeartbeat!),
                ),
              ),
              Expanded(
                child: _Dato(
                  etiqueta: 'Ovejas detectadas',
                  valor: d.ultimoConteo == null
                      ? '—'
                      : '${d.ultimoConteo}${d.conteoEsperado == null ? '' : ' / ${d.conteoEsperado}'}',
                ),
              ),
              if (d.ultimoConteo != null && d.conteoEsperado != null)
                OviChip(
                  texto: d.conteoNormal ? 'Normal' : 'Faltan',
                  tono: d.conteoNormal ? TonoChip.exito : TonoChip.peligro,
                ),
            ],
          ),
          const SizedBox(height: 14),
          // Siempre disponible, incluso con el chip en "Sin señal": ese estado
          // dice que el módulo de detección dejó de latir, no que no haya
          // imagen — la cámara emite por otra vía. Justamente cuando la
          // detección se cae es cuando se quiere mirar. Si no hubiera video, lo
          // informa la propia pantalla al conectarse.
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.goNamed(
                Rutas.vigilanciaEnVivo,
                pathParameters: {'idDispositivo': d.id},
              ),
              icon: const Icon(Icons.play_circle_outline_rounded, size: 20),
              label: const Text('Ver en vivo'),
            ),
          ),
          if (estado.alertasSinRevisar > 0) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: OviColores.peligroFondo,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      size: 18, color: OviColores.peligro),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${estado.alertasSinRevisar} '
                      '${estado.alertasSinRevisar == 1 ? 'alerta' : 'alertas'} sin revisar',
                      style: texto.bodySmall?.copyWith(color: const Color(0xFFC2381C)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(etiqueta, style: texto.bodySmall),
        const SizedBox(height: 2),
        Text(valor, style: texto.titleSmall),
      ],
    );
  }
}

/// Filtro por tipo de alerta del mockup («≡ Filtrar»).
class _MenuFiltro extends StatelessWidget {
  const _MenuFiltro({required this.seleccionado, required this.alElegir});

  final String? seleccionado;
  final ValueChanged<String?> alElegir;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String?>(
      tooltip: 'Filtrar por tipo',
      onSelected: (v) => alElegir(v == '_TODAS' ? null : v),
      itemBuilder: (_) => [
        const PopupMenuItem(value: '_TODAS', child: Text('Todas')),
        const PopupMenuItem(value: 'CONTEO', child: Text('Conteo')),
        const PopupMenuItem(value: 'DISPERSION', child: Text('Dispersión anormal')),
        const PopupMenuItem(value: 'AMENAZA', child: Text('Intruso detectado')),
      ],
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.tune_rounded, size: 18, color: OviColores.primary),
          const SizedBox(width: 6),
          Text(
            seleccionado == null ? 'Filtrar' : Etiquetas.tipoAlerta(seleccionado!),
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: OviColores.primary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Fila del historial: icono circular por tipo, título, detalle y hora.
class _FilaAlerta extends StatelessWidget {
  const _FilaAlerta({required this.alerta});

  final Alerta alerta;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final (color, fondo, icono) = aspectoDeAlerta(alerta.tipoAlerta);

    return OviTarjeta(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      atenuada: alerta.estaRevisada,
      alTocar: () => context.goNamed(
        Rutas.alertaDetalle,
        pathParameters: {'id': alerta.id},
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: fondo, shape: BoxShape.circle),
            child: Icon(icono, size: 19, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(Etiquetas.tipoAlerta(alerta.tipoAlerta), style: texto.titleSmall),
                const SizedBox(height: 1),
                Text(
                  alerta.descripcion ?? _resumenConteo(alerta),
                  style: texto.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                Fmt.fechaHoraRelativa(alerta.fechaHora),
                style: texto.bodySmall,
              ),
              if (!alerta.estaRevisada) ...[
                const SizedBox(height: 6),
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: OviColores.primary,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  static String _resumenConteo(Alerta a) {
    if (a.conteoAnimales == null) return 'Sin detalle';
    final esperado = a.conteoEsperado;
    return esperado == null
        ? '${a.conteoAnimales} detectadas'
        : '${a.conteoAnimales} detectadas (esperadas: $esperado)';
  }
}

/// Color, fondo e icono por tipo de alerta. Compartido con el detalle.
(Color, Color, IconData) aspectoDeAlerta(String tipo) => switch (tipo) {
      'DISPERSION' => (
          OviColores.advertencia,
          OviColores.advertenciaFondo,
          Icons.warning_amber_rounded,
        ),
      'AMENAZA' => (
          OviColores.peligro,
          OviColores.peligroFondo,
          Icons.gpp_maybe_rounded,
        ),
      _ => (OviColores.exito, OviColores.exitoFondo, Icons.check_circle_outline_rounded),
    };
