import '../../../core/red/json.dart';

/// Entrada de la bitácora de un animal — Módulo 2 (RF_05, RF_06).
///
/// Es append-only: el sistema genera ALTA / MODIFICACION / BAJA / EVENTO, y el
/// usuario solo puede añadir NOTA. Ninguna se edita ni se borra.
class EntradaBitacora {
  const EntradaBitacora({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.fecha,
    required this.eventoEliminado,
    this.descripcion,
    this.datos,
    this.idEvento,
    this.usuario,
  });

  final String id;
  final String tipo;
  final String titulo;
  final DateTime fecha;

  /// RF_10 — queda en true cuando el evento de origen fue eliminado.
  final bool eventoEliminado;
  final String? descripcion;

  /// En MODIFICACION trae `{ campo, valorAnterior, valorNuevo }`.
  final Map<String, dynamic>? datos;
  final String? idEvento;
  final Referencia? usuario;

  bool get esAutomatica => tipo != 'NOTA';

  factory EntradaBitacora.desdeJson(Map<String, dynamic> j) => EntradaBitacora(
        id: j['id'] as String,
        tipo: (j['tipo'] as String?) ?? 'NOTA',
        titulo: (j['titulo'] as String?) ?? '',
        fecha: fechaDe(j['fecha']),
        eventoEliminado: (j['eventoEliminado'] as bool?) ?? false,
        descripcion: j['descripcion'] as String?,
        datos: j['datos'] is Map ? Map<String, dynamic>.from(j['datos'] as Map) : null,
        idEvento: j['idEvento'] as String?,
        usuario: Referencia.desdeJsonNula(j['usuario']),
      );
}
