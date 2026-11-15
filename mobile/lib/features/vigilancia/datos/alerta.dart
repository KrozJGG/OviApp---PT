import '../../../core/red/json.dart';

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

  /// Lo calcula el backend, según cuán reciente sea el último latido.
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
