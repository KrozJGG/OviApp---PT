import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/tema/ovi_colores.dart';
import '../datos/region_interes.dart';

/// Capa de solo lectura que muestra la Región de Interés activa sobre el video.
class CapaRoi extends StatelessWidget {
  const CapaRoi({super.key, required this.region});

  final RegionInteres region;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        painter: _PintorRoi(
          puntos: region.puntos,
          valido: true,
          editable: false,
          indiceActivo: null,
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

/// Lienzo interactivo sobre el video para dibujar o ajustar un rectángulo o polígono.
class EditorRoiInteractivo extends StatefulWidget {
  const EditorRoiInteractivo({
    super.key,
    required this.modo,
    required this.puntos,
    required this.valido,
    required this.alCambiar,
  });

  final TipoRegionInteres modo;
  final List<PuntoNormalizado> puntos;
  final bool valido;
  final ValueChanged<List<PuntoNormalizado>> alCambiar;

  @override
  State<EditorRoiInteractivo> createState() => _EditorRoiInteractivoState();
}

class _EditorRoiInteractivoState extends State<EditorRoiInteractivo> {
  static const double _radioTactilPx = 28.0;

  int? _indiceArrastrado;
  bool _moviendoRectangulo = false;
  Offset? _puntoDownPx;
  Offset? _inicioPanPx;
  PuntoNormalizado? _anclaOpuestaRect;
  List<PuntoNormalizado>? _puntosAlIniciarPan;

  int? _buscarVerticeCercano(Offset posicionPx, Size tamano) {
    int? mejorIndice;
    var mejorDistancia = _radioTactilPx;

    for (var i = 0; i < widget.puntos.length; i++) {
      final centro = widget.puntos[i].aOffset(tamano);
      final distancia = (posicionPx - centro).distance;
      if (distancia <= mejorDistancia) {
        mejorDistancia = distancia;
        mejorIndice = i;
      }
    }
    return mejorIndice;
  }

  Rect? _rectanguloEnPixeles(Size tamano) {
    if (widget.puntos.length != 4) return null;
    final bbox = RegionInteres(
      tipo: TipoRegionInteres.rectangulo,
      puntos: widget.puntos,
    ).boundingBox;
    return Rect.fromLTRB(
      bbox.left * tamano.width,
      bbox.top * tamano.height,
      bbox.right * tamano.width,
      bbox.bottom * tamano.height,
    );
  }

  void _limpiarGesto() {
    if (_indiceArrastrado != null ||
        _moviendoRectangulo ||
        _puntoDownPx != null ||
        _inicioPanPx != null ||
        _anclaOpuestaRect != null ||
        _puntosAlIniciarPan != null) {
      setState(() {
        _indiceArrastrado = null;
        _moviendoRectangulo = false;
        _puntoDownPx = null;
        _inicioPanPx = null;
        _anclaOpuestaRect = null;
        _puntosAlIniciarPan = null;
      });
    }
  }

  void _alBajarDedo(DragDownDetails details) {
    _puntoDownPx = details.localPosition;
  }

  void _alTocarPoligono(TapUpDetails details, Size tamano) {
    _puntoDownPx = null;
    if (widget.modo != TipoRegionInteres.poligono) return;
    if (_buscarVerticeCercano(details.localPosition, tamano) != null) return;
    if (widget.puntos.length >= RegionInteres.maxPuntosPoligono) return;

    final nuevo = PuntoNormalizado.desdeOffset(details.localPosition, tamano);
    widget.alCambiar([...widget.puntos, nuevo]);
  }

  void _alIniciarArrastre(DragStartDetails details, Size tamano) {
    final pos = _puntoDownPx ?? details.localPosition;
    _puntoDownPx = null;

    if (widget.modo == TipoRegionInteres.poligono) {
      final idx = _buscarVerticeCercano(pos, tamano);
      if (idx != null) {
        setState(() => _indiceArrastrado = idx);
      }
      return;
    }

    // Modo rectángulo: 1) esquina cercana, 2) interior para mover, 3) nuevo trazo.
    if (widget.puntos.length == 4) {
      final esquina = _buscarVerticeCercano(pos, tamano);
      if (esquina != null) {
        setState(() {
          _indiceArrastrado = esquina;
          _anclaOpuestaRect = widget.puntos[(esquina + 2) % 4];
        });
        return;
      }

      final rectPx = _rectanguloEnPixeles(tamano);
      if (rectPx != null && rectPx.contains(pos)) {
        setState(() {
          _moviendoRectangulo = true;
          _inicioPanPx = pos;
          _puntosAlIniciarPan = List<PuntoNormalizado>.of(widget.puntos);
        });
        return;
      }
    }

    final ancla = PuntoNormalizado.desdeOffset(pos, tamano);
    setState(() {
      _anclaOpuestaRect = ancla;
      _indiceArrastrado = null;
      _moviendoRectangulo = false;
    });
    widget.alCambiar(
      RegionInteres.desdeRectangulo(
        Rect.fromPoints(Offset(ancla.x, ancla.y), Offset(ancla.x, ancla.y)),
      ).puntos,
    );
  }

  void _alActualizarArrastre(DragUpdateDetails details, Size tamano) {
    if (tamano.width <= 0 || tamano.height <= 0) return;
    final pos = details.localPosition;

    if (widget.modo == TipoRegionInteres.poligono) {
      final idx = _indiceArrastrado;
      if (idx == null || idx >= widget.puntos.length) return;
      final actualizado = PuntoNormalizado.desdeOffset(pos, tamano);
      final copia = List<PuntoNormalizado>.of(widget.puntos);
      copia[idx] = actualizado;
      widget.alCambiar(copia);
      return;
    }

    if (_moviendoRectangulo &&
        _inicioPanPx != null &&
        _puntosAlIniciarPan != null &&
        _puntosAlIniciarPan!.length == 4) {
      final dx = (pos.dx - _inicioPanPx!.dx) / tamano.width;
      final dy = (pos.dy - _inicioPanPx!.dy) / tamano.height;
      final bbox = RegionInteres(
        tipo: TipoRegionInteres.rectangulo,
        puntos: _puntosAlIniciarPan!,
      ).boundingBox;

      final dxAcotado = dx.clamp(-bbox.left, 1.0 - bbox.right).toDouble();
      final dyAcotado = dy.clamp(-bbox.top, 1.0 - bbox.bottom).toDouble();

      final trasladados = _puntosAlIniciarPan!
          .map((p) => PuntoNormalizado.acotado(p.x + dxAcotado, p.y + dyAcotado))
          .toList(growable: false);
      widget.alCambiar(trasladados);
      return;
    }

    final ancla = _anclaOpuestaRect;
    if (ancla != null) {
      final actual = PuntoNormalizado.desdeOffset(pos, tamano);
      final rect = Rect.fromPoints(
        Offset(ancla.x, ancla.y),
        Offset(actual.x, actual.y),
      );
      widget.alCambiar(RegionInteres.desdeRectangulo(rect).puntos);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tamano = constraints.biggest;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (d) => _alTocarPoligono(d, tamano),
          onPanDown: _alBajarDedo,
          onPanStart: (d) => _alIniciarArrastre(d, tamano),
          onPanUpdate: (d) => _alActualizarArrastre(d, tamano),
          onPanEnd: (_) => _limpiarGesto(),
          onPanCancel: _limpiarGesto,
          child: CustomPaint(
            painter: _PintorRoi(
              puntos: widget.puntos,
              valido: widget.valido,
              editable: true,
              indiceActivo: _indiceArrastrado,
            ),
            child: const SizedBox.expand(),
          ),
        );
      },
    );
  }
}

class _PintorRoi extends CustomPainter {
  const _PintorRoi({
    required this.puntos,
    required this.valido,
    required this.editable,
    required this.indiceActivo,
  });

  final List<PuntoNormalizado> puntos;
  final bool valido;
  final bool editable;
  final int? indiceActivo;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    canvas.save();
    canvas.clipRect(Offset.zero & size);

    final offsets = puntos.map((p) => p.aOffset(size)).toList(growable: false);
    final colorBorde = switch ((puntos.length >= 3, valido)) {
      (false, _) => OviColores.primaryLight,
      (true, true) => OviColores.exito,
      (true, false) => OviColores.peligro,
    };

    if (offsets.length >= 3) {
      final mascara = Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(Offset.zero & size)
        ..addPolygon(offsets, true);
      canvas.drawPath(
        mascara,
        Paint()..color = Colors.black.withValues(alpha: 0.45),
      );

      final poligono = Path()..addPolygon(offsets, true);
      canvas.drawPath(
        poligono,
        Paint()
          ..color = colorBorde.withValues(alpha: editable ? 0.14 : 0.08)
          ..style = PaintingStyle.fill,
      );

      // Halo oscuro sutil para legibilidad sobre fondos claros (ovejas/cielo).
      canvas.drawPath(
        poligono,
        Paint()
          ..color = Colors.black.withValues(alpha: 0.45)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4.5
          ..strokeJoin = StrokeJoin.round,
      );

      canvas.drawPath(
        poligono,
        Paint()
          ..color = colorBorde
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeJoin = StrokeJoin.round,
      );
    } else if (offsets.length == 2) {
      canvas.drawLine(
        offsets[0],
        offsets[1],
        Paint()
          ..color = colorBorde
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round,
      );
    }

    if (editable) {
      for (var i = 0; i < offsets.length; i++) {
        final centro = offsets[i];
        final activo = indiceActivo == i;
        final radio = activo ? 10.5 : 7.5;
        final relleno = !valido && puntos.length >= 3
            ? OviColores.peligro
            : OviColores.primary;

        canvas.drawCircle(
          centro,
          radio + 2,
          Paint()..color = Colors.black.withValues(alpha: 0.35),
        );
        canvas.drawCircle(centro, radio, Paint()..color = relleno);
        canvas.drawCircle(
          centro,
          radio,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2,
        );
      }
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _PintorRoi oldDelegate) {
    if (oldDelegate.valido != valido ||
        oldDelegate.editable != editable ||
        oldDelegate.indiceActivo != indiceActivo ||
        oldDelegate.puntos.length != puntos.length) {
      return true;
    }
    for (var i = 0; i < puntos.length; i++) {
      if (oldDelegate.puntos[i] != puntos[i]) return true;
    }
    return false;
  }
}

/// Convierte un conjunto arbitrario de puntos a un rectángulo envolvente acotado.
List<PuntoNormalizado> rectanguloDesdePuntos(List<PuntoNormalizado> puntos) {
  if (puntos.length < 2) return const [];
  var minX = puntos.first.x;
  var maxX = puntos.first.x;
  var minY = puntos.first.y;
  var maxY = puntos.first.y;
  for (final p in puntos.skip(1)) {
    minX = math.min(minX, p.x);
    maxX = math.max(maxX, p.x);
    minY = math.min(minY, p.y);
    maxY = math.max(maxY, p.y);
  }
  return RegionInteres.desdeRectangulo(Rect.fromLTRB(minX, minY, maxX, maxY)).puntos;
}
