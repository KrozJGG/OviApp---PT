import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/tema/ovi_colores.dart';

class SegmentoBarra {
  const SegmentoBarra({
    required this.valor,
    required this.color,
  });

  final int valor;
  final Color color;
}

class ColumnaGrafico {
  const ColumnaGrafico({
    required this.etiqueta,
    required this.segmentos,
  });

  final String etiqueta;
  final List<SegmentoBarra> segmentos;

  int get total => segmentos.fold<int>(0, (acc, s) => acc + s.valor);
}

class LeyendaGrafico {
  const LeyendaGrafico({required this.etiqueta, required this.color});

  final String etiqueta;
  final Color color;
}

/// Gráfico de barras verticales apiladas liviano y de alto contraste, adaptado
/// a pantallas móviles pequeñas (RNF04 / RNF05) sin dependencias externas.
class GraficoBarrasMensual extends StatelessWidget {
  const GraficoBarrasMensual({
    super.key,
    required this.columnas,
    required this.leyenda,
    this.mensajeVacio = 'Sin movimientos en este período',
    this.alturaBarras = 128,
  });

  final List<ColumnaGrafico> columnas;
  final List<LeyendaGrafico> leyenda;
  final String mensajeVacio;
  final double alturaBarras;

  @override
  Widget build(BuildContext context) {
    final maximo = columnas.fold<int>(0, (acc, c) => math.max(acc, c.total));

    if (columnas.isEmpty || maximo == 0) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: Text(
            mensajeVacio,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (leyenda.isNotEmpty) ...[
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              for (final item in leyenda)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: item.color,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      item.etiqueta,
                      style: const TextStyle(
                        fontSize: 12,
                        color: OviColores.textoSecundario,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 14),
        ],
        SizedBox(
          height: alturaBarras + 42,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final anchoMinimo = columnas.length * 46.0;
              final anchoContenido = math.max(constraints.maxWidth, anchoMinimo);

              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: anchoContenido,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (final col in columnas)
                        Expanded(
                          child: _ColumnaBarra(
                            columna: col,
                            maximo: maximo,
                            alturaMaxima: alturaBarras,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ColumnaBarra extends StatelessWidget {
  const _ColumnaBarra({
    required this.columna,
    required this.maximo,
    required this.alturaMaxima,
  });

  final ColumnaGrafico columna;
  final int maximo;
  final double alturaMaxima;

  @override
  Widget build(BuildContext context) {
    final total = columna.total;
    final proporcionTotal = maximo > 0 ? total / maximo : 0.0;
    final alturaColumna =
        total == 0 ? 4.0 : math.max(8.0, proporcionTotal * alturaMaxima);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            '$total',
            style: TextStyle(
              fontSize: 11,
              fontWeight: total > 0 ? FontWeight.w600 : FontWeight.w400,
              color: total > 0
                  ? OviColores.textoPrimario
                  : OviColores.textoSecundario,
            ),
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              width: 24,
              height: alturaColumna,
              child: total == 0
                  ? const ColoredBox(color: OviColores.borde)
                  : Column(
                      children: [
                        for (final seg in columna.segmentos.reversed)
                          if (seg.valor > 0)
                            Expanded(
                              flex: seg.valor,
                              child: ColoredBox(color: seg.color),
                            ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            columna.etiqueta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              color: OviColores.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// Barra horizontal con etiqueta y detalle a la derecha (responsables, razas).
class BarraProgresoEtiquetada extends StatelessWidget {
  const BarraProgresoEtiquetada({
    super.key,
    required this.titulo,
    required this.detalle,
    required this.fraccion,
    this.color = OviColores.primary,
  });

  final String titulo;
  final String detalle;
  final double fraccion;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final clamped = fraccion.clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  titulo,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ),
              Text(detalle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: clamped,
              minHeight: 7,
              backgroundColor: OviColores.superficie,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
}
