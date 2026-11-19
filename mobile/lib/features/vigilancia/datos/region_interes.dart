import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';

/// Tipo de geometría soportada para delimitar la Región de Interés (ROI).
enum TipoRegionInteres {
  rectangulo('RECTANGULO', 'Rectángulo'),
  poligono('POLIGONO', 'Polígono');

  const TipoRegionInteres(this.codigoApi, this.etiqueta);

  final String codigoApi;
  final String etiqueta;

  static TipoRegionInteres? desdeCodigo(Object? valor) {
    if (valor is! String) return null;
    for (final tipo in values) {
      if (tipo.codigoApi == valor) return tipo;
    }
    return null;
  }
}

/// Coordenada normalizada dentro del fotograma `[0.0, 1.0]`.
@immutable
class PuntoNormalizado {
  const PuntoNormalizado(this.x, this.y);

  factory PuntoNormalizado.acotado(double x, double y) => PuntoNormalizado(
        x.clamp(0.0, 1.0).toDouble(),
        y.clamp(0.0, 1.0).toDouble(),
      );

  factory PuntoNormalizado.desdeOffset(Offset punto, Size tamano) {
    if (tamano.width <= 0 || tamano.height <= 0) {
      return const PuntoNormalizado(0, 0);
    }
    return PuntoNormalizado.acotado(
      punto.dx / tamano.width,
      punto.dy / tamano.height,
    );
  }

  final double x;
  final double y;

  Offset aOffset(Size tamano) => Offset(x * tamano.width, y * tamano.height);

  Map<String, double> aJson() => {
        'x': _redondear(x),
        'y': _redondear(y),
      };

  static double _redondear(double v) => (v.clamp(0.0, 1.0) * 10000).round() / 10000;

  static PuntoNormalizado? desdeJsonNulo(Object? valor) {
    if (valor is! Map) return null;
    final x = (valor['x'] as num?)?.toDouble();
    final y = (valor['y'] as num?)?.toDouble();
    if (x == null || y == null || !x.isFinite || !y.isFinite) return null;
    return PuntoNormalizado.acotado(x, y);
  }

  @override
  bool operator ==(Object other) =>
      other is PuntoNormalizado && other.x == x && other.y == y;

  @override
  int get hashCode => Object.hash(x, y);
}

/// Región de Interés normalizada asociada a una cámara de vigilancia.
@immutable
class RegionInteres {
  const RegionInteres({
    required this.tipo,
    required this.puntos,
  });

  static const int minPuntosPoligono = 3;
  static const int maxPuntosPoligono = 20;
  static const double areaMinima = 0.01;
  static const double ladoMinimoBbox = 0.05;
  static const double _eps = 1e-9;

  final TipoRegionInteres tipo;
  final List<PuntoNormalizado> puntos;

  /// Construye una ROI rectangular a partir de un `Rect` normalizado.
  factory RegionInteres.desdeRectangulo(Rect rect) {
    final izq = math.min(rect.left, rect.right).clamp(0.0, 1.0).toDouble();
    final der = math.max(rect.left, rect.right).clamp(0.0, 1.0).toDouble();
    final arr = math.min(rect.top, rect.bottom).clamp(0.0, 1.0).toDouble();
    final aba = math.max(rect.top, rect.bottom).clamp(0.0, 1.0).toDouble();
    return RegionInteres(
      tipo: TipoRegionInteres.rectangulo,
      puntos: [
        PuntoNormalizado(izq, arr),
        PuntoNormalizado(der, arr),
        PuntoNormalizado(der, aba),
        PuntoNormalizado(izq, aba),
      ],
    );
  }

  /// Convierte la ROI actual a polígono manteniendo sus vértices para ajuste fino.
  RegionInteres aPoligono() => RegionInteres(
        tipo: TipoRegionInteres.poligono,
        puntos: List<PuntoNormalizado>.unmodifiable(puntos),
      );

  Rect get boundingBox {
    if (puntos.isEmpty) return Rect.zero;
    var minX = puntos.first.x;
    var maxX = puntos.first.x;
    var minY = puntos.first.y;
    var maxY = puntos.first.y;

    for (final p in puntos.skip(1)) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    return Rect.fromLTRB(minX, minY, maxX, maxY);
  }

  /// Área normalizada del polígono (0.0 a 1.0) mediante la fórmula del zapatero.
  double get areaNormalizada {
    if (puntos.length < 3) return 0;
    var suma = 0.0;
    for (var i = 0; i < puntos.length; i++) {
      final actual = puntos[i];
      final siguiente = puntos[(i + 1) % puntos.length];
      suma += actual.x * siguiente.y - siguiente.x * actual.y;
    }
    return suma.abs() / 2;
  }

  /// Indica si alguna pareja de aristas no adyacentes se cruza o solapa.
  bool get tieneAutoInterseccion {
    final n = puntos.length;
    if (n < 4) return false;

    for (var i = 0; i < n; i++) {
      final a = puntos[i];
      final b = puntos[(i + 1) % n];
      for (var j = i + 1; j < n; j++) {
        if (j == i + 1 || (i == 0 && j == n - 1)) continue;
        final c = puntos[j];
        final d = puntos[(j + 1) % n];
        if (_segmentosSeCruzan(a, b, c, d)) return true;
      }
    }
    return false;
  }

  static double _orientacion(
    PuntoNormalizado a,
    PuntoNormalizado b,
    PuntoNormalizado c,
  ) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  static bool _puntoEnSegmento(
    PuntoNormalizado a,
    PuntoNormalizado b,
    PuntoNormalizado p,
  ) =>
      p.x >= math.min(a.x, b.x) - _eps &&
      p.x <= math.max(a.x, b.x) + _eps &&
      p.y >= math.min(a.y, b.y) - _eps &&
      p.y <= math.max(a.y, b.y) + _eps;

  static bool _segmentosSeCruzan(
    PuntoNormalizado a,
    PuntoNormalizado b,
    PuntoNormalizado c,
    PuntoNormalizado d,
  ) {
    final o1 = _orientacion(a, b, c);
    final o2 = _orientacion(a, b, d);
    final o3 = _orientacion(c, d, a);
    final o4 = _orientacion(c, d, b);

    if (((o1 > _eps && o2 < -_eps) || (o1 < -_eps && o2 > _eps)) &&
        ((o3 > _eps && o4 < -_eps) || (o3 < -_eps && o4 > _eps))) {
      return true;
    }

    if (o1.abs() <= _eps && _puntoEnSegmento(a, b, c)) return true;
    if (o2.abs() <= _eps && _puntoEnSegmento(a, b, d)) return true;
    if (o3.abs() <= _eps && _puntoEnSegmento(c, d, a)) return true;
    if (o4.abs() <= _eps && _puntoEnSegmento(c, d, b)) return true;

    return false;
  }

  /// Devuelve `null` si la ROI es válida, o un mensaje explicativo para mostrar al usuario.
  String? get mensajeValidacion {
    if (puntos.length < minPuntosPoligono) {
      return 'Marca al menos 3 puntos para cerrar la zona.';
    }
    if (tipo == TipoRegionInteres.rectangulo && puntos.length != 4) {
      return 'Dibuja un rectángulo sobre el video.';
    }
    if (puntos.length > maxPuntosPoligono) {
      return 'Máximo 20 puntos permitidos.';
    }
    if (tieneAutoInterseccion) {
      return 'Las líneas de la zona no pueden cruzarse.';
    }
    final bbox = boundingBox;
    if (bbox.width < ladoMinimoBbox ||
        bbox.height < ladoMinimoBbox ||
        areaNormalizada < areaMinima) {
      return 'El área seleccionada es demasiado pequeña.';
    }
    return null;
  }

  bool get esValida => mensajeValidacion == null;

  String get resumen => tipo == TipoRegionInteres.rectangulo
      ? 'Rectángulo'
      : 'Polígono (${puntos.length} puntos)';

  Map<String, dynamic> aJson() => {
        'tipo': tipo.codigoApi,
        'puntos': puntos.map((p) => p.aJson()).toList(growable: false),
      };

  static RegionInteres? desdeJsonNula(Object? valor) {
    if (valor is! Map) return null;
    final mapa = Map<String, dynamic>.from(valor);
    final tipo = TipoRegionInteres.desdeCodigo(mapa['tipo']);
    final lista = mapa['puntos'];
    if (tipo == null || lista is! List) return null;

    final puntos = lista
        .map(PuntoNormalizado.desdeJsonNulo)
        .whereType<PuntoNormalizado>()
        .toList(growable: false);

    if (puntos.length < minPuntosPoligono) return null;
    if (tipo == TipoRegionInteres.rectangulo && puntos.length != 4) return null;

    return RegionInteres(tipo: tipo, puntos: puntos);
  }

  @override
  bool operator ==(Object other) =>
      other is RegionInteres &&
      other.tipo == tipo &&
      listEquals(other.puntos, puntos);

  @override
  int get hashCode => Object.hash(tipo, Object.hashAll(puntos));
}
