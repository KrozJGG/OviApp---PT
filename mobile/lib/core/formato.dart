import 'package:intl/intl.dart';

/// Formato de fechas, horas y cantidades para el usuario.
///
/// Todo en es_CL y en un solo lugar: los mockups muestran "Dom 28 jun",
/// "Hoy 03:42" y "Ayer 23:15", y esos formatos tienen que ser identicos en las
/// cuatro pantallas que los usan.
abstract final class Fmt {
  static const _locale = 'es';

  static final _diaMes = DateFormat('d MMM', _locale);
  static final _diaMesAno = DateFormat('d MMM y', _locale);
  static final _diaSemanaDia = DateFormat('EEEE d', _locale);
  static final _diaSemanaCorto = DateFormat('EEE d MMM', _locale);
  static final _mesAno = DateFormat('MMMM y', _locale);
  static final _hora = DateFormat('HH:mm', _locale);
  static final _peso = NumberFormat('#,##0.##', _locale);

  /// "28 ago"
  static String diaMes(DateTime f) => _diaMes.format(f.toLocal());

  /// "28 ago 2026"
  static String fecha(DateTime f) => _diaMesAno.format(f.toLocal());

  /// "domingo 28" — encabezado del detalle del dia en el calendario.
  static String diaSemana(DateTime f) => _capitalizar(_diaSemanaDia.format(f.toLocal()));

  /// "dom 28 ago"
  static String diaSemanaCorto(DateTime f) => _capitalizar(_diaSemanaCorto.format(f.toLocal()));

  /// "agosto 2026" — cabecera del mes en el calendario.
  static String mesAno(DateTime f) => _capitalizar(_mesAno.format(f.toLocal()));

  /// "09:00"
  static String hora(DateTime f) => _hora.format(f.toLocal());

  /// "Hoy 03:42", "Ayer 23:15", "27 jul 14:30" — historial de alertas (mockup 10).
  static String fechaHoraRelativa(DateTime f) {
    final local = f.toLocal();
    final dias = _diasDesdeHoy(local);
    return switch (dias) {
      0 => 'Hoy ${hora(local)}',
      1 => 'Ayer ${hora(local)}',
      _ => '${diaMes(local)} ${hora(local)}',
    };
  }

  /// "Hoy", "Ayer", "Mañana", "28 ago" — vencimiento de una tarea.
  static String fechaRelativa(DateTime f) {
    final local = f.toLocal();
    return switch (_diasDesdeHoy(local)) {
      0 => 'Hoy',
      1 => 'Ayer',
      -1 => 'Mañana',
      _ => diaMes(local),
    };
  }

  /// "Hace 5 min", "Hace 2 h", "Hace 3 d" — ultima deteccion del edge.
  static String hace(DateTime f) {
    final minutos = DateTime.now().difference(f.toLocal()).inMinutes;
    if (minutos < 1) return 'Hace instantes';
    if (minutos < 60) return 'Hace $minutos min';
    final horas = minutos ~/ 60;
    if (horas < 24) return 'Hace $horas h';
    return 'Hace ${horas ~/ 24} d';
  }

  /// "45 kg". Devuelve un guion cuando no hay dato, nunca "null".
  static String peso(num? kg) => kg == null ? '—' : '${_peso.format(kg)} kg';

  /// Fecha para la API: "2026-08-31".
  static String iso(DateTime f) =>
      '${f.year.toString().padLeft(4, '0')}-'
      '${f.month.toString().padLeft(2, '0')}-'
      '${f.day.toString().padLeft(2, '0')}';

  /// Texto opcional listo para pintar.
  static String oGuion(String? valor) =>
      (valor == null || valor.trim().isEmpty) ? '—' : valor.trim();

  /// Saludo del encabezado de inicio segun la hora (mockup 02).
  static String saludo([DateTime? ahora]) {
    final h = (ahora ?? DateTime.now()).hour;
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  static int _diasDesdeHoy(DateTime f) {
    final hoy = DateTime.now();
    final a = DateTime(hoy.year, hoy.month, hoy.day);
    final b = DateTime(f.year, f.month, f.day);
    return a.difference(b).inDays;
  }

  static String _capitalizar(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

/// Nombres legibles de los enumerados del dominio.
///
/// La API entrega `ATENCION_SANITARIA` y la interfaz muestra
/// "Atención sanitaria": la traduccion vive aqui y no repartida por pantallas.
abstract final class Etiquetas {
  static String tipoEvento(String tipo) => switch (tipo) {
        'ENCASTE' => 'Encaste',
        'ESQUILA' => 'Esquila',
        'ATENCION_SANITARIA' => 'Atención sanitaria',
        'OTRO' => 'Otro',
        _ => tipo,
      };

  static String sexo(String sexo) => sexo == 'HEMBRA' ? 'Hembra' : 'Macho';

  static String estadoAnimal(String estado) => estado == 'ACTIVO' ? 'Activo' : 'Inactivo';

  static String motivoBaja(String? motivo) => switch (motivo) {
        'VENTA' => 'Venta',
        'MUERTE' => 'Muerte',
        'FAENA' => 'Faena',
        _ => '—',
      };

  static String rol(String rol) => rol == 'PRODUCTOR' ? 'Productor' : 'Trabajador';

  static String estadoUsuario(String estado) =>
      estado == 'HABILITADO' ? 'Habilitado' : 'Inhabilitado';

  static String estadoTarea(String estado) => estado == 'COMPLETADA' ? 'Completada' : 'Activa';

  static String tipoAlerta(String tipo) => switch (tipo) {
        'CONTEO' => 'Conteo',
        'DISPERSION' => 'Dispersión anormal',
        'AMENAZA' => 'Intruso detectado',
        _ => tipo,
      };

  static String nivelAlerta(String nivel) => switch (nivel) {
        'INFO' => 'Informativa',
        'ADVERTENCIA' => 'Advertencia',
        'CRITICA' => 'Crítica',
        _ => nivel,
      };

  static String tipoBitacora(String tipo) => switch (tipo) {
        'ALTA' => 'Alta',
        'MODIFICACION' => 'Modificación',
        'BAJA' => 'Baja',
        'EVENTO' => 'Evento',
        'NOTA' => 'Nota',
        _ => tipo,
      };
}
