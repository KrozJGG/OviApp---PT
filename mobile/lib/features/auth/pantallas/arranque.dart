import 'package:flutter/material.dart';

import '../../../core/tema/ovi_colores.dart';

/// Pantalla de arranque: se muestra mientras se lee la sesion guardada.
///
/// Dura lo que tarda el almacenamiento seguro en responder. Existe para que la
/// app no parpadee entre login y inicio en cada apertura.
class PantallaArranque extends StatelessWidget {
  const PantallaArranque({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: OviColores.superficie,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            LogoOviApp(tamano: 88),
            SizedBox(height: 28),
            SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// Marca de la aplicacion: oveja estilizada sobre el azul corporativo.
///
/// Se dibuja con iconografia y no con un archivo de imagen para que el logotipo
/// definitivo de la tesis (figura 6.2) pueda reemplazarlo sin tocar pantallas.
class LogoOviApp extends StatelessWidget {
  const LogoOviApp({super.key, this.tamano = 64, this.conNombre = true});

  final double tamano;
  final bool conNombre;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: tamano,
          height: tamano,
          decoration: BoxDecoration(
            color: OviColores.primary,
            borderRadius: BorderRadius.circular(tamano * 0.28),
          ),
          child: Icon(Icons.pets_rounded, size: tamano * 0.5, color: Colors.white),
        ),
        if (conNombre) ...[
          SizedBox(height: tamano * 0.22),
          Text(
            'OviApp',
            style: TextStyle(
              fontSize: tamano * 0.32,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              color: OviColores.primaryDark,
            ),
          ),
        ],
      ],
    );
  }
}
