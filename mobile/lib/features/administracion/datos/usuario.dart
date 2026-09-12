/// Usuario del predio — Módulo 7 (RF_20 a RF_22).
class Usuario {
  const Usuario({
    required this.id,
    required this.nombre,
    required this.email,
    required this.rol,
    required this.estado,
    this.rut,
    this.telefono,
  });

  final String id;
  final String nombre;
  final String email;
  final String rol;
  final String estado;
  final String? rut;
  final String? telefono;

  bool get estaHabilitado => estado == 'HABILITADO';
  bool get esProductor => rol == 'PRODUCTOR';

  factory Usuario.desdeJson(Map<String, dynamic> j) => Usuario(
        id: j['id'] as String,
        nombre: (j['nombre'] as String?) ?? '',
        email: (j['email'] as String?) ?? '',
        rol: (j['rol'] as String?) ?? 'TRABAJADOR',
        estado: (j['estado'] as String?) ?? 'HABILITADO',
        rut: j['rut'] as String?,
        telefono: j['telefono'] as String?,
      );
}
