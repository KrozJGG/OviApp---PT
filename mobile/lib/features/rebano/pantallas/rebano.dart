import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/animal.dart';
import '../rebano_proveedores.dart';

/// Pantalla 03 — Rebaño. Vista tipo lista con búsqueda y filtros.
///
/// El contador «47 animales activos» sale del `resumen` que acompaña al
/// paginado, no de contar la página actual.
class PantallaRebano extends ConsumerStatefulWidget {
  const PantallaRebano({super.key});

  @override
  ConsumerState<PantallaRebano> createState() => _PantallaRebanoState();
}

class _PantallaRebanoState extends ConsumerState<PantallaRebano> {
  final _busqueda = TextEditingController();
  final _scroll = ScrollController();
  Timer? _rebote;

  @override
  void initState() {
    super.initState();
    _busqueda.text = ref.read(filtroRebanoProvider).busqueda;
    _scroll.addListener(_alDesplazar);
  }

  @override
  void dispose() {
    _rebote?.cancel();
    _busqueda.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Carga la página siguiente al acercarse al final de la lista.
  void _alDesplazar() {
    if (!_scroll.hasClients) return;
    final cerca = _scroll.position.pixels >= _scroll.position.maxScrollExtent - 320;
    if (cerca) ref.read(rebanoProvider.notifier).cargarMas();
  }

  /// La búsqueda espera a que el usuario deje de escribir: en una red rural
  /// una petición por tecla es una petición perdida.
  void _alEscribir(String texto) {
    _rebote?.cancel();
    _rebote = Timer(const Duration(milliseconds: 400), () {
      ref.read(filtroRebanoProvider.notifier).buscar(texto);
    });
  }

  @override
  Widget build(BuildContext context) {
    final listado = ref.watch(rebanoProvider);
    final filtro = ref.watch(filtroRebanoProvider);
    final texto = Theme.of(context).textTheme;

    final activos = listado.valueOrNull?.resumen.activos;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Rebaño', style: texto.headlineSmall),
                  const SizedBox(height: 2),
                  Text(
                    activos == null
                        ? 'Cargando…'
                        : '$activos ${activos == 1 ? 'animal activo' : 'animales activos'}',
                    style: texto.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _busqueda,
                    onChanged: _alEscribir,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Buscar por N° de oreja…',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: filtro.busqueda.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Limpiar búsqueda',
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () {
                                _busqueda.clear();
                                _rebote?.cancel();
                                ref.read(filtroRebanoProvider.notifier).buscar('');
                              },
                            ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _FiltrosEstado(
                    estado: filtro.estado,
                    alElegir: (v) =>
                        ref.read(filtroRebanoProvider.notifier).filtrarPorEstado(v),
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            ),
            Expanded(
              child: OviAsync<ListadoRebano>(
                valor: listado,
                alReintentar: () => ref.read(rebanoProvider.notifier).recargar(),
                estaVacio: (l) => l.pagina.estaVacio,
                vacio: OviEstadoVacio(
                  mensaje: filtro.busqueda.isEmpty
                      ? 'Todavía no hay animales registrados'
                      : 'Sin resultados para «${filtro.busqueda}»',
                  detalle: filtro.busqueda.isEmpty
                      ? 'Usa el botón + para registrar el primero.'
                      : 'Revisa el número de oreja e inténtalo de nuevo.',
                  icono: filtro.busqueda.isEmpty
                      ? Icons.pets_outlined
                      : Icons.search_off_rounded,
                ),
                enDatos: (l) => RefreshIndicator(
                  onRefresh: () => ref.read(rebanoProvider.notifier).recargar(),
                  child: ListView.separated(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
                    itemCount: l.pagina.datos.length + (l.pagina.hayMas ? 1 : 0),
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      if (i >= l.pagina.datos.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: OviCargando(),
                        );
                      }
                      return _TarjetaAnimal(animal: l.pagina.datos[i]);
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.goNamed(Rutas.animalNuevo),
        tooltip: 'Registrar animal',
        child: const Icon(Icons.add_rounded, size: 28),
      ),
    );
  }
}

/// Chips «Todos · Activos · Inactivos» del mockup.
class _FiltrosEstado extends StatelessWidget {
  const _FiltrosEstado({required this.estado, required this.alElegir});

  final String? estado;
  final ValueChanged<String?> alElegir;

  @override
  Widget build(BuildContext context) {
    const opciones = <(String, String?)>[
      ('Todos', null),
      ('Activos', 'ACTIVO'),
      ('Inactivos', 'INACTIVO'),
    ];

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: opciones.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (etiqueta, valor) = opciones[i];
          final activo = estado == valor;
          return ChoiceChip(
            label: Text(etiqueta),
            selected: activo,
            onSelected: (_) => alElegir(valor),
            showCheckmark: false,
            labelStyle: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: activo ? Colors.white : OviColores.textoSecundario,
            ),
          );
        },
      ),
    );
  }
}

/// Tarjeta de animal: icono de sexo, número de oreja, estado y datos básicos.
class _TarjetaAnimal extends StatelessWidget {
  const _TarjetaAnimal({required this.animal});

  final Animal animal;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    final detalle = [
      Fmt.oGuion(animal.raza),
      Etiquetas.sexo(animal.sexo),
      Fmt.peso(animal.pesoKg),
    ].join(' · ');

    return OviTarjeta(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      atenuada: !animal.estaActivo,
      alTocar: () => context.goNamed(
        Rutas.animalFicha,
        pathParameters: {'id': animal.id},
      ),
      child: Row(
        children: [
          OviIconoSexo(sexo: animal.sexo),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('#${animal.numeroOreja}', style: texto.titleMedium),
                    const SizedBox(width: 8),
                    OviChip.estadoAnimal(animal.estado),
                  ],
                ),
                const SizedBox(height: 2),
                Text(detalle, style: texto.bodySmall),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: OviColores.textoSecundario),
        ],
      ),
    );
  }
}
