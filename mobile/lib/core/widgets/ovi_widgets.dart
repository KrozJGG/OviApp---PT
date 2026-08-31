import 'package:flutter/material.dart';

import '../tema/ovi_colores.dart';
import '../tema/ovi_tema.dart';

/// Tarjeta base. Todas las superficies de contenido de la app son una de estas.
class OviTarjeta extends StatelessWidget {
  const OviTarjeta({
    super.key,
    required this.child,
    this.alTocar,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.atenuada = false,
  });

  final Widget child;
  final VoidCallback? alTocar;
  final EdgeInsetsGeometry padding;
  final Color? color;

  /// Los animales dados de baja se muestran atenuados en el listado (mockup 03).
  final bool atenuada;

  @override
  Widget build(BuildContext context) {
    final contenido = Container(
      decoration: BoxDecoration(
        color: color ?? OviColores.tarjeta,
        borderRadius: BorderRadius.circular(OviTema.radioTarjeta),
        border: Border.all(color: OviColores.borde),
      ),
      padding: padding,
      child: child,
    );

    final envuelto = alTocar == null
        ? contenido
        : Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: alTocar,
              borderRadius: BorderRadius.circular(OviTema.radioTarjeta),
              child: contenido,
            ),
          );

    return atenuada ? Opacity(opacity: 0.55, child: envuelto) : envuelto;
  }
}

/// Chip de estado. El color codifica significado, no decoracion.
class OviChip extends StatelessWidget {
  const OviChip({
    super.key,
    required this.texto,
    this.tono = TonoChip.neutro,
    this.icono,
  });

  final String texto;
  final TonoChip tono;
  final IconData? icono;

  /// Chip verde/gris de "Activo" / "Inactivo" del listado de rebaño.
  factory OviChip.estadoAnimal(String estado) => OviChip(
        texto: estado == 'ACTIVO' ? 'Activo' : 'Inactivo',
        tono: estado == 'ACTIVO' ? TonoChip.exito : TonoChip.neutro,
      );

  @override
  Widget build(BuildContext context) {
    final (fondo, tinta) = switch (tono) {
      TonoChip.exito => (OviColores.exitoFondo, const Color(0xFF15803D)),
      TonoChip.peligro => (OviColores.peligroFondo, const Color(0xFFC2381C)),
      TonoChip.advertencia => (OviColores.advertenciaFondo, const Color(0xFFB45309)),
      TonoChip.info => (OviColores.superficieSecundaria, OviColores.primaryDark),
      TonoChip.neutro => (OviColores.neutroFondo, OviColores.textoSecundario),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icono != null) ...[
            Icon(icono, size: 13, color: tinta),
            const SizedBox(width: 4),
          ],
          Text(
            texto,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tinta),
          ),
        ],
      ),
    );
  }
}

enum TonoChip { exito, peligro, advertencia, info, neutro }

/// Metrica del "Resumen de hoy" de la pantalla de inicio (mockup 02).
class OviMetrica extends StatelessWidget {
  const OviMetrica({
    super.key,
    required this.valor,
    required this.etiqueta,
    this.color = OviColores.primary,
    this.alTocar,
  });

  final String valor;
  final String etiqueta;
  final Color color;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final contenido = Column(
      children: [
        Text(
          valor,
          style: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w700,
            color: color,
            height: 1.1,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          etiqueta,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            color: OviColores.textoSecundario,
            height: 1.25,
          ),
        ),
      ],
    );

    if (alTocar == null) return contenido;
    return InkWell(
      onTap: alTocar,
      borderRadius: BorderRadius.circular(12),
      child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: contenido),
    );
  }
}

/// Encabezado de seccion con accion opcional a la derecha.
class OviEncabezadoSeccion extends StatelessWidget {
  const OviEncabezadoSeccion({super.key, required this.titulo, this.accion, this.detalle});

  final String titulo;
  final String? detalle;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(titulo, style: Theme.of(context).textTheme.titleMedium),
          ),
          if (detalle != null)
            Text(detalle!, style: Theme.of(context).textTheme.bodySmall),
          if (accion != null) accion!,
        ],
      ),
    );
  }
}

/// Fila etiqueta / valor de las pantallas de detalle.
class OviDato extends StatelessWidget {
  const OviDato({super.key, required this.etiqueta, required this.valor, this.icono});

  final String etiqueta;
  final String valor;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icono != null) ...[
            Icon(icono, size: 17, color: OviColores.textoSecundario),
            const SizedBox(width: 10),
          ],
          SizedBox(
            width: 118,
            child: Text(etiqueta, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(
            child: Text(
              valor,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Icono de sexo del animal, como en las tarjetas del mockup 03.
class OviIconoSexo extends StatelessWidget {
  const OviIconoSexo({super.key, required this.sexo, this.tamano = 40});

  final String sexo;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final esHembra = sexo == 'HEMBRA';
    return Container(
      width: tamano,
      height: tamano,
      decoration: const BoxDecoration(
        color: OviColores.superficieSecundaria,
        shape: BoxShape.circle,
      ),
      child: Icon(
        esHembra ? Icons.female_rounded : Icons.male_rounded,
        size: tamano * 0.55,
        color: OviColores.primary,
      ),
    );
  }
}

/// Muestra un error de la API como SnackBar, con el mensaje ya redactado.
void mostrarMensaje(BuildContext context, String mensaje, {bool esError = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(mensaje),
        backgroundColor: esError ? OviColores.peligro : OviColores.textoPrimario,
      ),
    );
}
