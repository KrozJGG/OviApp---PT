import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/acceso_stream.dart';
import '../vigilancia_proveedores.dart';
import '../widgets/reproductor_vivo.dart';

/// Transmisión en vivo de la cámara del rebaño.
///
/// El permiso para ver el video dura poco y se renueva solo mientras la
/// pantalla esté abierta, así que una sesión larga nunca se interrumpe y entrar
/// a esta pantalla siempre funciona sin pasos previos.
class PantallaVigilanciaEnVivo extends ConsumerStatefulWidget {
  const PantallaVigilanciaEnVivo({super.key, required this.idDispositivo});

  final String idDispositivo;

  @override
  ConsumerState<PantallaVigilanciaEnVivo> createState() => _PantallaVigilanciaEnVivoState();
}

class _PantallaVigilanciaEnVivoState extends ConsumerState<PantallaVigilanciaEnVivo> {
  /// Se renueva bastante antes de que venza, para que un fallo puntual de red
  /// deje margen de reintento sin cortar la emisión.
  static const _fraccionRenovacion = 0.7;

  AsyncValue<Uri> _estado = const AsyncValue.loading();
  Timer? _renovacion;

  @override
  void initState() {
    super.initState();
    _conectar();
  }

  @override
  void dispose() {
    _renovacion?.cancel();
    super.dispose();
  }

  /// Primera conexión y reintento manual: sí pasa por el estado de carga.
  Future<void> _conectar() async {
    setState(() => _estado = const AsyncValue.loading());

    try {
      _aplicar(await _pedirAcceso());
    } catch (e, s) {
      if (mounted) setState(() => _estado = AsyncValue.error(comoErrorApi(e), s));
    }
  }

  /// Renovación en segundo plano: no toca el estado visible hasta tener la URL
  /// nueva, así el reproductor sigue mostrando la emisión sin parpadeos.
  Future<void> _renovar() async {
    try {
      _aplicar(await _pedirAcceso());
    } catch (_) {
      // Se sigue viendo con el permiso vigente; queda margen para reintentar
      // antes de que caduque.
      if (mounted) _renovacion = Timer(const Duration(seconds: 30), _renovar);
    }
  }

  Future<AccesoStream> _pedirAcceso() {
    return ref.read(vigilanciaRepositorioProvider).accesoStream(widget.idDispositivo);
  }

  void _aplicar(AccesoStream acceso) {
    if (!mounted) return;

    setState(() => _estado = AsyncValue.data(acceso.url));

    _renovacion?.cancel();
    _renovacion = Timer(
      Duration(seconds: (acceso.expiraEnSeg * _fraccionRenovacion).round()),
      _renovar,
    );
  }

  void _alCortarse() {
    if (!mounted) return;

    _renovacion?.cancel();
    setState(() {
      _estado = AsyncValue.error(
        const ErrorApi(
          codigo: 'STREAM_INTERRUMPIDO',
          mensaje: 'Se interrumpió la transmisión de la cámara.',
          status: null,
        ),
        StackTrace.current,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final dispositivos =
        ref.watch(estadoVigilanciaProvider).valueOrNull?.dispositivos ?? const [];
    int? conteo;
    for (final d in dispositivos) {
      if (d.id == widget.idDispositivo) {
        conteo = d.ultimoConteo;
        break;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.sensors_rounded, color: OviColores.primary),
            SizedBox(width: 10),
            Text('Cámara en vivo'),
          ],
        ),
        actions: [
          if (conteo != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: OviChip(
                texto: conteo == 1 ? '1 oveja' : '$conteo ovejas',
                icono: Icons.visibility_outlined,
                tono: TonoChip.info,
              ),
            ),
        ],
        titleSpacing: 20,
      ),
      backgroundColor: Colors.black,
      body: Center(
        child: OviAsync<Uri>(
          valor: _estado,
          alReintentar: _conectar,
          enDatos: (url) => ReproductorVivo(url: url, alFallar: _alCortarse),
        ),
      ),
    );
  }
}
