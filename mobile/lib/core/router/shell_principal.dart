import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../proveedores.dart';
import '../tema/ovi_colores.dart';
import '../widgets/aviso_datos_en_cache.dart';

/// Contenedor de las cinco pestañas fijas de la aplicacion.
///
/// La barra inferior es la del mockup: Inicio, Rebaño, Calendario, Vigilancia y
/// Más, con el item activo en azul primary. Esta presente en todas las pantallas
/// de la app porque RNF_04 pide llegar a cualquier funcion principal en tres
/// interacciones o menos: la barra ya resuelve la primera.
class ShellPrincipal extends ConsumerWidget {
  const ShellPrincipal({super.key, required this.navegacion});

  final StatefulNavigationShell navegacion;

  static const _pestanas = <_Pestana>[
    _Pestana('Inicio', Icons.home_outlined, Icons.home_rounded),
    _Pestana('Rebaño', Icons.pets_outlined, Icons.pets_rounded),
    _Pestana('Calendario', Icons.calendar_today_outlined, Icons.calendar_month_rounded),
    _Pestana('Vigilancia', Icons.videocam_outlined, Icons.videocam_rounded),
    _Pestana('Más', Icons.more_horiz_outlined, Icons.more_horiz_rounded),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: navegacion,
      // El aviso de «datos del caché» va encima de la barra y no arriba de la
      // pantalla: asi no compite con la barra de estado ni con el padding que
      // cada pantalla ya calcula por su cuenta.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AvisoDatosEnCache(guardadoEn: ref.watch(clienteApiProvider).datosDeCache),
          DecoratedBox(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: OviColores.borde)),
            ),
            child: SafeArea(
              top: false,
              child: SizedBox(
                height: 62,
                child: Row(
                  children: [
                    for (var i = 0; i < _pestanas.length; i++)
                      Expanded(
                        child: _BotonPestana(
                          pestana: _pestanas[i],
                          activa: navegacion.currentIndex == i,
                          // Tocar la pestaña activa vuelve a su raiz: es la forma
                          // mas rapida de salir de un formulario a medio llenar.
                          alTocar: () => navegacion.goBranch(
                            i,
                            initialLocation: i == navegacion.currentIndex,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Pestana {
  const _Pestana(this.etiqueta, this.icono, this.iconoActivo);

  final String etiqueta;
  final IconData icono;
  final IconData iconoActivo;
}

class _BotonPestana extends StatelessWidget {
  const _BotonPestana({
    required this.pestana,
    required this.activa,
    required this.alTocar,
  });

  final _Pestana pestana;
  final bool activa;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final color = activa ? OviColores.primary : OviColores.textoSecundario;

    return Semantics(
      selected: activa,
      button: true,
      label: pestana.etiqueta,
      child: InkWell(
        onTap: alTocar,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(activa ? pestana.iconoActivo : pestana.icono, size: 24, color: color),
            const SizedBox(height: 3),
            Text(
              pestana.etiqueta,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                height: 1.1,
                color: color,
                fontWeight: activa ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
