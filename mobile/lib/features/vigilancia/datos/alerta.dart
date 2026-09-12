import '../../../core/red/json.dart';

/// Alerta generada por el módulo de detección — Módulo 6 (RF_17 a RF_19).
class Alerta {
  const Alerta({
    required this.id,
    required this.tipoAlerta,
    required this.nivel,
    required this.fechaHora,
    required this.estado,
    this.descripcion,
    this.conteoAnimales,
    this.conteoEsperado,
    this.fechaRevision,
    this.revisadoPor,
    this.dispositivo,
  });

  final String id;
  final String tipoAlerta;
  final String nivel;
  final DateTime fechaHora;
  final String estado;
  final String? descripcion;
  final int? conteoAnimales;
  final int? conteoEsperado;
  final DateTime? fechaRevision;
  final Referencia? revisadoPor;
  final Referencia? dispositivo;

  bool get estaRevisada => estado == 'REVISADA';

  /// Cuántos animales faltan respecto de la línea base, si ambos datos existen.
  int? get faltantes {
    if (conteoAnimales == null || conteoEsperado == null) return null;
    final diferencia = conteoEsperado! - conteoAnimales!;
    return diferencia > 0 ? diferencia : null;
  }

  factory Alerta.desdeJson(Map<String, dynamic> j) => Alerta(
        id: j['id'] as String,
        tipoAlerta: (j['tipoAlerta'] as String?) ?? 'CONTEO',
        nivel: (j['nivel'] as String?) ?? 'ADVERTENCIA',
        fechaHora: fechaDe(j['fechaHora']),
        estado: (j['estado'] as String?) ?? 'NUEVA',
        descripcion: j['descripcion'] as String?,
        conteoAnimales: enteroNulo(j['conteoAnimales']),
        conteoEsperado: enteroNulo(j['conteoEsperado']),
        fechaRevision: fechaNulaDe(j['fechaRevision']),
        revisadoPor: Referencia.desdeJsonNula(j['revisadoPor']),
        dispositivo: Referencia.desdeJsonNula(j['dispositivo']),
      );
}

/// Dispositivo edge del predio y su estado operativo (IF2-SAL).
class DispositivoEdge {
  const DispositivoEdge({
    required this.id,
    required this.nombre,
    required this.enLinea,
    this.ultimoHeartbeat,
    this.ultimoConteo,
    this.conteoEsperado,
  });

  final String id;
  final String nombre;

  /// El backend lo calcula: menos de 15 minutos desde el último latido.
  final bool enLinea;
  final DateTime? ultimoHeartbeat;
  final int? ultimoConteo;
  final int? conteoEsperado;

  /// El conteo cuadra con la línea base del rebaño.
  bool get conteoNormal =>
      ultimoConteo != null && conteoEsperado != null && ultimoConteo! >= conteoEsperado!;

  factory DispositivoEdge.desdeJson(Map<String, dynamic> j) => DispositivoEdge(
        id: j['id'] as String,
        nombre: (j['nombre'] as String?) ?? 'Cámara',
        enLinea: (j['enLinea'] as bool?) ?? false,
        ultimoHeartbeat: fechaNulaDe(j['ultimoHeartbeat']),
        ultimoConteo: enteroNulo(j['ultimoConteo']),
        conteoEsperado: enteroNulo(j['conteoEsperado']),
      );
}

/// `GET /vigilancia/estado` — la tarjeta superior del mockup 10.
class EstadoVigilancia {
  const EstadoVigilancia({
    required this.dispositivos,
    required this.alertasSinRevisar,
    this.ultimaAlerta,
  });

  final List<DispositivoEdge> dispositivos;
  final int alertasSinRevisar;
  final Alerta? ultimaAlerta;

  DispositivoEdge? get principal =>
      dispositivos.isEmpty ? null : dispositivos.first;

  factory EstadoVigilancia.desdeJson(Map<String, dynamic> j) => EstadoVigilancia(
        dispositivos: (j['dispositivos'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(DispositivoEdge.desdeJson)
            .toList(growable: false),
        alertasSinRevisar: enteroNulo(j['alertasSinRevisar']) ?? 0,
        ultimaAlerta: j['ultimaAlerta'] is Map
            ? Alerta.desdeJson(Map<String, dynamic>.from(j['ultimaAlerta'] as Map))
            : null,
      );
}
