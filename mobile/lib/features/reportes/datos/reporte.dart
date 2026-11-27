/// Modelos del Modulo 8 — Reportes y Paneles de Informacion (RF23, RF24).
class RangoReporte {
  const RangoReporte({
    required this.desde,
    required this.hasta,
    required this.preset,
  });

  final String desde;
  final String hasta;
  final PresetRango preset;

  factory RangoReporte.desdePreset(PresetRango preset, {DateTime? referencia}) {
    final ahora = referencia ?? DateTime.now();
    final hoy = DateTime(ahora.year, ahora.month, ahora.day);
    final mesesAtras = switch (preset) {
      PresetRango.mes1 => 0,
      PresetRango.meses3 => 2,
      PresetRango.meses6 => 5,
      PresetRango.anio1 => 11,
      PresetRango.personalizado => 5,
    };
    final inicio = DateTime(hoy.year, hoy.month - mesesAtras, 1);
    return RangoReporte(
      desde: _iso(inicio),
      hasta: _iso(hoy),
      preset: preset,
    );
  }

  static String _iso(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  @override
  bool operator ==(Object other) =>
      other is RangoReporte &&
      other.desde == desde &&
      other.hasta == hasta &&
      other.preset == preset;

  @override
  int get hashCode => Object.hash(desde, hasta, preset);
}

enum PresetRango {
  mes1('1M'),
  meses3('3M'),
  meses6('6M'),
  anio1('1A'),
  personalizado('Rango');

  const PresetRango(this.etiqueta);
  final String etiqueta;
}

class ResumenReporte {
  const ResumenReporte({
    required this.nombrePredio,
    required this.ubicacionPredio,
    required this.desde,
    required this.hasta,
    required this.meses,
    required this.generadoEn,
    required this.inventario,
    required this.eventos,
    required this.tareas,
    required this.vigilancia,
    required this.serieMensual,
  });

  final String nombrePredio;
  final String? ubicacionPredio;
  final String desde;
  final String hasta;
  final int meses;
  final String generadoEn;
  final InventarioReporte inventario;
  final EventosReporte eventos;
  final TareasReporte tareas;
  final VigilanciaReporte vigilancia;
  final List<PuntoMensualReporte> serieMensual;

  factory ResumenReporte.desdeJson(Map<String, dynamic> j) {
    final predio = j['predio'] as Map<String, dynamic>;
    final periodo = j['periodo'] as Map<String, dynamic>;
    final serie = (j['serieMensual'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(PuntoMensualReporte.desdeJson)
        .toList();

    return ResumenReporte(
      nombrePredio: predio['nombre'] as String? ?? 'Predio',
      ubicacionPredio: predio['ubicacion'] as String?,
      desde: periodo['desde'] as String,
      hasta: periodo['hasta'] as String,
      meses: (periodo['meses'] as num).toInt(),
      generadoEn: j['generadoEn'] as String? ?? '',
      inventario: InventarioReporte.desdeJson(j['inventario'] as Map<String, dynamic>),
      eventos: EventosReporte.desdeJson(j['eventos'] as Map<String, dynamic>),
      tareas: TareasReporte.desdeJson(j['tareas'] as Map<String, dynamic>),
      vigilancia: VigilanciaReporte.desdeJson(j['vigilancia'] as Map<String, dynamic>),
      serieMensual: serie,
    );
  }
}

class InventarioReporte {
  const InventarioReporte({
    required this.activos,
    required this.inactivos,
    required this.totalHistorico,
    required this.machos,
    required this.hembras,
    required this.pesoPromedioKg,
    required this.pesoTotalKg,
    required this.porRaza,
    required this.altasPeriodo,
    required this.bajasTotal,
    required this.bajasVenta,
    required this.bajasMuerte,
    required this.bajasFaena,
    required this.tasaMortalidadPct,
    required this.tasaExtraccionPct,
  });

  final int activos;
  final int inactivos;
  final int totalHistorico;
  final int machos;
  final int hembras;
  final double? pesoPromedioKg;
  final double pesoTotalKg;
  final List<RazaCantidad> porRaza;
  final int altasPeriodo;
  final int bajasTotal;
  final int bajasVenta;
  final int bajasMuerte;
  final int bajasFaena;
  final double tasaMortalidadPct;
  final double tasaExtraccionPct;

  factory InventarioReporte.desdeJson(Map<String, dynamic> j) {
    final bajas = j['bajasPeriodo'] as Map<String, dynamic>;
    final razas = (j['porRaza'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map((r) => RazaCantidad(
              raza: r['raza'] as String,
              cantidad: (r['cantidad'] as num).toInt(),
            ))
        .toList();

    return InventarioReporte(
      activos: (j['activos'] as num).toInt(),
      inactivos: (j['inactivos'] as num).toInt(),
      totalHistorico: (j['totalHistorico'] as num).toInt(),
      machos: (j['machos'] as num).toInt(),
      hembras: (j['hembras'] as num).toInt(),
      pesoPromedioKg: (j['pesoPromedioKg'] as num?)?.toDouble(),
      pesoTotalKg: (j['pesoTotalKg'] as num?)?.toDouble() ?? 0,
      porRaza: razas,
      altasPeriodo: (j['altasPeriodo'] as num).toInt(),
      bajasTotal: (bajas['total'] as num).toInt(),
      bajasVenta: (bajas['venta'] as num).toInt(),
      bajasMuerte: (bajas['muerte'] as num).toInt(),
      bajasFaena: (bajas['faena'] as num).toInt(),
      tasaMortalidadPct: (j['tasaMortalidadPct'] as num).toDouble(),
      tasaExtraccionPct: (j['tasaExtraccionPct'] as num).toDouble(),
    );
  }
}

class RazaCantidad {
  const RazaCantidad({required this.raza, required this.cantidad});
  final String raza;
  final int cantidad;
}

class EventosReporte {
  const EventosReporte({
    required this.total,
    required this.programados,
    required this.realizados,
    required this.porTipo,
    required this.animalesAtendidosPorTipo,
    required this.notasBitacora,
    required this.modificacionesBitacora,
  });

  final int total;
  final int programados;
  final int realizados;
  final Map<String, int> porTipo;
  final Map<String, int> animalesAtendidosPorTipo;
  final int notasBitacora;
  final int modificacionesBitacora;

  factory EventosReporte.desdeJson(Map<String, dynamic> j) {
    Map<String, int> mapaEnteros(Map<String, dynamic> m) =>
        m.map((k, v) => MapEntry(k, (v as num).toInt()));

    return EventosReporte(
      total: (j['total'] as num).toInt(),
      programados: (j['programados'] as num).toInt(),
      realizados: (j['realizados'] as num).toInt(),
      porTipo: mapaEnteros(j['porTipo'] as Map<String, dynamic>),
      animalesAtendidosPorTipo:
          mapaEnteros(j['animalesAtendidosPorTipo'] as Map<String, dynamic>),
      notasBitacora: (j['notasBitacora'] as num).toInt(),
      modificacionesBitacora: (j['modificacionesBitacora'] as num).toInt(),
    );
  }
}

class TareasReporte {
  const TareasReporte({
    required this.totalPeriodo,
    required this.completadasPeriodo,
    required this.activasPendientes,
    required this.vencidas,
    required this.completadasATiempo,
    required this.completadasAtrasadas,
    required this.tasaCumplimientoPct,
    required this.tasaATiempoPct,
    required this.porResponsable,
  });

  final int totalPeriodo;
  final int completadasPeriodo;
  final int activasPendientes;
  final int vencidas;
  final int completadasATiempo;
  final int completadasAtrasadas;
  final double tasaCumplimientoPct;
  final double tasaATiempoPct;
  final List<CumplimientoResponsable> porResponsable;

  factory TareasReporte.desdeJson(Map<String, dynamic> j) {
    final resp = (j['porResponsable'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(CumplimientoResponsable.desdeJson)
        .toList();

    return TareasReporte(
      totalPeriodo: (j['totalPeriodo'] as num).toInt(),
      completadasPeriodo: (j['completadasPeriodo'] as num).toInt(),
      activasPendientes: (j['activasPendientes'] as num).toInt(),
      vencidas: (j['vencidas'] as num).toInt(),
      completadasATiempo: (j['completadasATiempo'] as num).toInt(),
      completadasAtrasadas: (j['completadasAtrasadas'] as num).toInt(),
      tasaCumplimientoPct: (j['tasaCumplimientoPct'] as num).toDouble(),
      tasaATiempoPct: (j['tasaATiempoPct'] as num).toDouble(),
      porResponsable: resp,
    );
  }
}

class CumplimientoResponsable {
  const CumplimientoResponsable({
    required this.idUsuario,
    required this.nombre,
    required this.asignadas,
    required this.completadas,
    required this.tasaCumplimientoPct,
  });

  final String idUsuario;
  final String nombre;
  final int asignadas;
  final int completadas;
  final double tasaCumplimientoPct;

  factory CumplimientoResponsable.desdeJson(Map<String, dynamic> j) =>
      CumplimientoResponsable(
        idUsuario: j['idUsuario'] as String,
        nombre: j['nombre'] as String,
        asignadas: (j['asignadas'] as num).toInt(),
        completadas: (j['completadas'] as num).toInt(),
        tasaCumplimientoPct: (j['tasaCumplimientoPct'] as num).toDouble(),
      );
}

class VigilanciaReporte {
  const VigilanciaReporte({
    required this.dispositivos,
    required this.totalEventos,
    required this.discrepancias,
    required this.desconexiones,
    required this.promedioDiferenciaCabezas,
  });

  final List<DispositivoReporte> dispositivos;
  final int totalEventos;
  final int discrepancias;
  final int desconexiones;
  final double promedioDiferenciaCabezas;

  factory VigilanciaReporte.desdeJson(Map<String, dynamic> j) {
    final ev = j['eventosPeriodo'] as Map<String, dynamic>;
    final disp = (j['dispositivos'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(DispositivoReporte.desdeJson)
        .toList();

    return VigilanciaReporte(
      dispositivos: disp,
      totalEventos: (ev['total'] as num).toInt(),
      discrepancias: (ev['discrepancias'] as num).toInt(),
      desconexiones: (ev['desconexiones'] as num).toInt(),
      promedioDiferenciaCabezas:
          (ev['promedioDiferenciaCabezas'] as num).toDouble(),
    );
  }
}

class DispositivoReporte {
  const DispositivoReporte({
    required this.id,
    required this.nombre,
    required this.enLinea,
    required this.ultimoConteo,
    required this.conteoEsperado,
    required this.brechaActual,
    required this.tieneRoi,
  });

  final String id;
  final String nombre;
  final bool enLinea;
  final int? ultimoConteo;
  final int conteoEsperado;
  final int? brechaActual;
  final bool tieneRoi;

  factory DispositivoReporte.desdeJson(Map<String, dynamic> j) =>
      DispositivoReporte(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        enLinea: j['enLinea'] as bool? ?? false,
        ultimoConteo: (j['ultimoConteo'] as num?)?.toInt(),
        conteoEsperado: (j['conteoEsperado'] as num).toInt(),
        brechaActual: (j['brechaActual'] as num?)?.toInt(),
        tieneRoi: j['tieneRoi'] as bool? ?? false,
      );
}

class PuntoMensualReporte {
  const PuntoMensualReporte({
    required this.mes,
    required this.etiqueta,
    required this.altas,
    required this.bajasTotal,
    required this.bajasVenta,
    required this.bajasMuerte,
    required this.bajasFaena,
    required this.tareasCompletadas,
    required this.tareasATiempo,
    required this.tareasVencidas,
    required this.eventosTotal,
    required this.eventosSanitarios,
    required this.eventosProductivos,
    required this.eventosIA,
    required this.discrepanciasIA,
    required this.desconexionesIA,
  });

  final String mes;
  final String etiqueta;
  final int altas;
  final int bajasTotal;
  final int bajasVenta;
  final int bajasMuerte;
  final int bajasFaena;
  final int tareasCompletadas;
  final int tareasATiempo;
  final int tareasVencidas;
  final int eventosTotal;
  final int eventosSanitarios;
  final int eventosProductivos;
  final int eventosIA;
  final int discrepanciasIA;
  final int desconexionesIA;

  String get mesCorto => etiqueta.split(' ').first;

  factory PuntoMensualReporte.desdeJson(Map<String, dynamic> j) =>
      PuntoMensualReporte(
        mes: j['mes'] as String,
        etiqueta: j['etiqueta'] as String,
        altas: (j['altas'] as num).toInt(),
        bajasTotal: (j['bajasTotal'] as num).toInt(),
        bajasVenta: (j['bajasVenta'] as num).toInt(),
        bajasMuerte: (j['bajasMuerte'] as num).toInt(),
        bajasFaena: (j['bajasFaena'] as num).toInt(),
        tareasCompletadas: (j['tareasCompletadas'] as num).toInt(),
        tareasATiempo: (j['tareasATiempo'] as num).toInt(),
        tareasVencidas: (j['tareasVencidas'] as num).toInt(),
        eventosTotal: (j['eventosTotal'] as num).toInt(),
        eventosSanitarios: (j['eventosSanitarios'] as num).toInt(),
        eventosProductivos: (j['eventosProductivos'] as num).toInt(),
        eventosIA: (j['eventosIA'] as num).toInt(),
        discrepanciasIA: (j['discrepanciasIA'] as num).toInt(),
        desconexionesIA: (j['desconexionesIA'] as num).toInt(),
      );
}
