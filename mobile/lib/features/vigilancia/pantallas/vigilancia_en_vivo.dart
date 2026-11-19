import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../datos/acceso_stream.dart';
import '../datos/alerta.dart';
import '../datos/region_interes.dart';
import '../vigilancia_proveedores.dart';
import '../widgets/editor_roi.dart';
import '../widgets/reproductor_vivo.dart';

/// Transmisión en vivo de la cámara del rebaño y edición de su Región de Interés.
///
/// El permiso para ver el video dura poco y se renueva solo mientras la
/// pantalla esté abierta, así que una sesión larga nunca se interrumpe y entrar
/// a esta pantalla siempre funciona sin pasos previos.
class PantallaVigilanciaEnVivo extends ConsumerStatefulWidget {
  const PantallaVigilanciaEnVivo({
    super.key,
    required this.idDispositivo,
    this.iniciarEdicionRoi = false,
  });

  final String idDispositivo;
  final bool iniciarEdicionRoi;

  @override
  ConsumerState<PantallaVigilanciaEnVivo> createState() => _PantallaVigilanciaEnVivoState();
}

class _PantallaVigilanciaEnVivoState extends ConsumerState<PantallaVigilanciaEnVivo> {
  /// Se renueva bastante antes de que venza, para que un fallo puntual de red
  /// deje margen de reintento sin cortar la emisión.
  static const _fraccionRenovacion = 0.7;

  AsyncValue<Uri> _estado = const AsyncValue.loading();
  Timer? _renovacion;

  bool _editandoRoi = false;
  bool _mostrarRoi = true;
  bool _guardandoRoi = false;
  late bool _inicializacionEdicionPendiente;
  TipoRegionInteres _modoEditor = TipoRegionInteres.rectangulo;
  List<PuntoNormalizado> _puntosBorrador = const [];

  @override
  void initState() {
    super.initState();
    _inicializacionEdicionPendiente = widget.iniciarEdicionRoi;
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
      _editandoRoi = false;
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

  void _entrarEdicion(RegionInteres? roiActual) {
    setState(() {
      _inicializacionEdicionPendiente = false;
      _editandoRoi = true;
      _modoEditor = roiActual?.tipo ?? TipoRegionInteres.rectangulo;
      _puntosBorrador = roiActual != null
          ? List<PuntoNormalizado>.of(roiActual.puntos)
          : const [];
    });
  }

  void _cancelarEdicion() {
    setState(() {
      _editandoRoi = false;
      _puntosBorrador = const [];
    });
  }

  void _cambiarModo(TipoRegionInteres nuevoModo) {
    if (nuevoModo == _modoEditor) return;
    setState(() {
      _modoEditor = nuevoModo;
      if (nuevoModo == TipoRegionInteres.rectangulo) {
        _puntosBorrador = rectanguloDesdePuntos(_puntosBorrador);
      }
    });
  }

  void _deshacerPunto() {
    if (_puntosBorrador.isEmpty) return;
    setState(() {
      _puntosBorrador = _puntosBorrador.sublist(0, _puntosBorrador.length - 1);
    });
  }

  void _limpiarBorrador() {
    setState(() => _puntosBorrador = const []);
  }

  RegionInteres get _roiBorrador => RegionInteres(
        tipo: _modoEditor,
        puntos: _puntosBorrador,
      );

  Future<void> _guardarRoi() async {
    final roi = _roiBorrador;
    if (!roi.esValida || _guardandoRoi) return;

    setState(() => _guardandoRoi = true);
    try {
      await ref
          .read(vigilanciaRepositorioProvider)
          .guardarRegionInteres(widget.idDispositivo, roi);
      if (!mounted) return;
      setState(() {
        _guardandoRoi = false;
        _editandoRoi = false;
        _mostrarRoi = true;
      });
      mostrarMensaje(
        context,
        'Zona de detección guardada. El conteo se actualizará en unos segundos.',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _guardandoRoi = false);
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }

  Future<void> _restablecerImagenCompleta() async {
    if (_guardandoRoi) return;

    setState(() => _guardandoRoi = true);
    try {
      await ref
          .read(vigilanciaRepositorioProvider)
          .eliminarRegionInteres(widget.idDispositivo);
      if (!mounted) return;
      setState(() {
        _guardandoRoi = false;
        _editandoRoi = false;
        _puntosBorrador = const [];
      });
      mostrarMensaje(context, 'Detección restablecida a imagen completa.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _guardandoRoi = false);
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final esProductor = ref.watch(esProductorProvider);
    final dispositivos =
        ref.watch(estadoVigilanciaProvider).valueOrNull?.dispositivos ?? const [];
    DispositivoEdge? dispositivo;
    for (final d in dispositivos) {
      if (d.id == widget.idDispositivo) {
        dispositivo = d;
        break;
      }
    }

    final conteo = dispositivo?.ultimoConteo;
    final roiGuardada = dispositivo?.regionInteres;

    if (_inicializacionEdicionPendiente) {
      if (!esProductor) {
        _inicializacionEdicionPendiente = false;
      } else if (dispositivo != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _inicializacionEdicionPendiente && !_editandoRoi) {
            _entrarEdicion(roiGuardada);
          }
        });
      }
    }

    final roiBorrador = _roiBorrador;
    final borradorValida = roiBorrador.esValida;

    Widget? superposicion;
    if (_editandoRoi && esProductor) {
      superposicion = EditorRoiInteractivo(
        modo: _modoEditor,
        puntos: _puntosBorrador,
        valido: borradorValida,
        alCambiar: (pts) => setState(() => _puntosBorrador = pts),
      );
    } else if (_mostrarRoi && roiGuardada != null) {
      superposicion = CapaRoi(region: roiGuardada);
    }

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(
              _editandoRoi ? Icons.crop_free_rounded : Icons.sensors_rounded,
              color: OviColores.primary,
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                _editandoRoi ? 'Zona de detección' : 'Cámara en vivo',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          if (!_editandoRoi && conteo != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: OviChip(
                texto: conteo == 1 ? '1 oveja' : '$conteo ovejas',
                icono: Icons.visibility_outlined,
                tono: TonoChip.info,
              ),
            ),
          if (!_editandoRoi && roiGuardada != null)
            IconButton(
              onPressed: () => setState(() => _mostrarRoi = !_mostrarRoi),
              tooltip: _mostrarRoi ? 'Ocultar zona' : 'Mostrar zona',
              icon: Icon(
                _mostrarRoi
                    ? Icons.layers_outlined
                    : Icons.layers_clear_outlined,
              ),
            ),
          if (!_editandoRoi && esProductor && _estado.hasValue)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                onPressed: () => _entrarEdicion(roiGuardada),
                tooltip: 'Editar zona de detección',
                icon: const Icon(Icons.crop_free_rounded),
              ),
            ),
        ],
        titleSpacing: 20,
      ),
      backgroundColor: Colors.black,
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: OviAsync<Uri>(
                valor: _estado,
                alReintentar: _conectar,
                enDatos: (url) => ReproductorVivo(
                  url: url,
                  alFallar: _alCortarse,
                  superposicion: superposicion,
                  bloquearControles: _editandoRoi && esProductor,
                ),
              ),
            ),
          ),
          if (_editandoRoi && esProductor && _estado.hasValue)
            _PanelEdicionRoi(
              modo: _modoEditor,
              puntos: _puntosBorrador,
              mensajeError: _puntosBorrador.isEmpty ? null : roiBorrador.mensajeValidacion,
              valido: borradorValida,
              tieneRoiGuardada: roiGuardada != null,
              guardando: _guardandoRoi,
              alCambiarModo: _cambiarModo,
              alDeshacer: _deshacerPunto,
              alLimpiar: _limpiarBorrador,
              alRestablecerCompleta: _restablecerImagenCompleta,
              alCancelar: _cancelarEdicion,
              alGuardar: _guardarRoi,
            ),
        ],
      ),
    );
  }
}

class _PanelEdicionRoi extends StatelessWidget {
  const _PanelEdicionRoi({
    required this.modo,
    required this.puntos,
    required this.mensajeError,
    required this.valido,
    required this.tieneRoiGuardada,
    required this.guardando,
    required this.alCambiarModo,
    required this.alDeshacer,
    required this.alLimpiar,
    required this.alRestablecerCompleta,
    required this.alCancelar,
    required this.alGuardar,
  });

  final TipoRegionInteres modo;
  final List<PuntoNormalizado> puntos;
  final String? mensajeError;
  final bool valido;
  final bool tieneRoiGuardada;
  final bool guardando;
  final ValueChanged<TipoRegionInteres> alCambiarModo;
  final VoidCallback alDeshacer;
  final VoidCallback alLimpiar;
  final VoidCallback alRestablecerCompleta;
  final VoidCallback alCancelar;
  final VoidCallback alGuardar;

  String get _textoAyuda {
    if (mensajeError != null) return mensajeError!;
    if (modo == TipoRegionInteres.rectangulo) {
      return puntos.isEmpty
          ? 'Arrastra sobre el video para marcar el rectángulo.'
          : 'Arrastra las esquinas o el interior para ajustar.';
    }
    return puntos.isEmpty
        ? 'Toca el video para añadir puntos (mín. 3).'
        : 'Toca para añadir puntos (${puntos.length}/${RegionInteres.maxPuntosPoligono}) o arrastra los vértices.';
  }

  @override
  Widget build(BuildContext context) {
    final estiloCompacto = OutlinedButton.styleFrom(
      minimumSize: const Size(0, 44),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      foregroundColor: Colors.white,
      side: const BorderSide(color: Colors.white30),
      textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
    );

    return Container(
      width: double.infinity,
      color: OviColores.textoPrimario,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<TipoRegionInteres>(
              segments: const [
                ButtonSegment(
                  value: TipoRegionInteres.rectangulo,
                  icon: Icon(Icons.crop_square_rounded, size: 18),
                  label: Text('Rectángulo'),
                ),
                ButtonSegment(
                  value: TipoRegionInteres.poligono,
                  icon: Icon(Icons.pentagon_outlined, size: 18),
                  label: Text('Polígono'),
                ),
              ],
              selected: {modo},
              onSelectionChanged: guardando
                  ? null
                  : (seleccion) => alCambiarModo(seleccion.first),
              style: SegmentedButton.styleFrom(
                backgroundColor: Colors.white10,
                selectedBackgroundColor: OviColores.primary,
                foregroundColor: Colors.white70,
                selectedForegroundColor: Colors.white,
                side: const BorderSide(color: Colors.white24),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _textoAyuda,
              style: TextStyle(
                fontSize: 12.5,
                color: mensajeError != null ? OviColores.peligro : Colors.white70,
                fontWeight: mensajeError != null ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (modo == TipoRegionInteres.poligono)
                      OutlinedButton.icon(
                        onPressed: (!guardando && puntos.isNotEmpty) ? alDeshacer : null,
                        style: estiloCompacto,
                        icon: const Icon(Icons.undo_rounded, size: 17),
                        label: const Text('Deshacer'),
                      ),
                    if (puntos.isNotEmpty)
                      OutlinedButton(
                        onPressed: guardando ? null : alLimpiar,
                        style: estiloCompacto,
                        child: const Text('Limpiar'),
                      ),
                    if (tieneRoiGuardada)
                      OutlinedButton.icon(
                        onPressed: guardando ? null : alRestablecerCompleta,
                        style: estiloCompacto.copyWith(
                          foregroundColor: const WidgetStatePropertyAll(
                            OviColores.superficieSecundaria,
                          ),
                        ),
                        icon: const Icon(Icons.fullscreen_rounded, size: 18),
                        label: const Text('Imagen completa'),
                      ),
                  ],
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: guardando ? null : alCancelar,
                      style: estiloCompacto,
                      child: const Text('Cancelar'),
                    ),
                    FilledButton(
                      onPressed: (valido && !guardando) ? alGuardar : null,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 44),
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                      child: guardando
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Guardar'),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
