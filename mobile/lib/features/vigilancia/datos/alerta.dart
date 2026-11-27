import '../../../core/red/json.dart';
import 'region_interes.dart';

/// Dispositivo edge del predio y su estado operativo (IF2-SAL).
class DispositivoEdge {
  const DispositivoEdge({
    required this.id,
    required this.nombre,
    required this.enLinea,
    this.ultimoHeartbeat,
    this.ultimoConteo,
    this.conteoEsperado,
    this.regionInteres,
    this.regionInteresUpdatedAt,
  });

  final String id;
  final String nombre;

  /// Lo calcula el backend, según cuán reciente sea el último latido.
  final bool enLinea;
  final DateTime? ultimoHeartbeat;
  final int? ultimoConteo;
  final int? conteoEsperado;
  final RegionInteres? regionInteres;
  final DateTime? regionInteresUpdatedAt;

  /// El conteo cuadra con la línea base del rebaño.
  bool get conteoNormal =>
      ultimoConteo != null && conteoEsperado != null && ultimoConteo! >= conteoEsperado!;

  bool get tieneRoi => regionInteres != null;

  String get resumenRoi => regionInteres?.resumen ?? 'Imagen completa';

  factory DispositivoEdge.desdeJson(Map<String, dynamic> j) => DispositivoEdge(
        id: j['id'] as String,
        nombre: (j['nombre'] as String?) ?? 'Cámara',
        enLinea: (j['enLinea'] as bool?) ?? false,
        ultimoHeartbeat: fechaNulaDe(j['ultimoHeartbeat']),
        ultimoConteo: enteroNulo(j['ultimoConteo']),
        conteoEsperado: enteroNulo(j['conteoEsperado']),
        regionInteres: RegionInteres.desdeJsonNula(j['regionInteres']),
        regionInteresUpdatedAt: fechaNulaDe(j['regionInteresUpdatedAt']),
      );
}

/// `GET /vigilancia/estado` — tarjeta de estado del monitoreo en vivo.
class EstadoVigilancia {
  const EstadoVigilancia({
    required this.dispositivos,
  });

  final List<DispositivoEdge> dispositivos;

  DispositivoEdge? get principal =>
      dispositivos.isEmpty ? null : dispositivos.first;

  factory EstadoVigilancia.desdeJson(Map<String, dynamic> j) => EstadoVigilancia(
        dispositivos: (j['dispositivos'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(DispositivoEdge.desdeJson)
            .toList(growable: false),
      );
}

/// Alerta generada por el sistema de vigilancia (`GET /api/v1/alertas`).
class AlertaVigilancia {
  const AlertaVigilancia({
    required this.id,
    required this.idDispositivoEdge,
    required this.dispositivo,
    required this.tipo,
    required this.estado,
    required this.conteoDetectado,
    required this.conteoEsperado,
    required this.descripcion,
    required this.fechaDeteccion,
    this.normalizadaEn,
    this.revisadoPor,
    this.fechaRevision,
  });

  final String id;
  final String idDispositivoEdge;
  final Referencia dispositivo;
  final String tipo;
  final String estado;
  final int conteoDetectado;
  final int conteoEsperado;
  final String descripcion;
  final DateTime fechaDeteccion;

  /// No nulo cuando el conteo se normalizo por 2 heartbeats consecutivos
  /// (alerta silenciada definitivamente por posible oclusion).
  final DateTime? normalizadaEn;
  final Referencia? revisadoPor;
  final DateTime? fechaRevision;

  bool get esPendiente => estado == 'PENDIENTE';
  bool get esNormalizada => normalizadaEn != null;

  factory AlertaVigilancia.desdeJson(Map<String, dynamic> j) => AlertaVigilancia(
        id: (j['id'] as String?) ?? '',
        idDispositivoEdge: (j['idDispositivoEdge'] as String?) ?? '',
        dispositivo:
            Referencia.desdeJsonNula(j['dispositivo']) ??
            const Referencia(id: '', nombre: 'Cámara'),
        tipo: (j['tipo'] as String?) ?? 'CONTEO',
        estado: (j['estado'] as String?) ?? 'PENDIENTE',
        conteoDetectado: enteroNulo(j['conteoDetectado']) ?? 0,
        conteoEsperado: enteroNulo(j['conteoEsperado']) ?? 0,
        descripcion: (j['descripcion'] as String?) ?? '',
        fechaDeteccion: fechaDe(j['fechaDeteccion']),
        normalizadaEn: fechaNulaDe(j['normalizadaEn']),
        revisadoPor: Referencia.desdeJsonNula(j['revisadoPor']),
        fechaRevision: fechaNulaDe(j['fechaRevision']),
      );
}
