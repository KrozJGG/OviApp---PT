import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../datos/animal.dart';
import '../rebano_proveedores.dart';

/// Pantalla 04 — Ficha individual del animal (RF_02, IF1-SAL).
class PantallaFichaAnimal extends ConsumerWidget {
  const PantallaFichaAnimal({super.key, required this.idAnimal});

  final String idAnimal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ficha = ref.watch(fichaAnimalProvider(idAnimal));

    return Scaffold(
      appBar: AppBar(
        title: Text(ficha.valueOrNull == null
            ? 'Ficha'
            : '#${ficha.value!.animal.numeroOreja}'),
        actions: [
          if (ficha.valueOrNull?.animal.estaActivo ?? false)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => context.goNamed(
                Rutas.animalEditar,
                pathParameters: {'id': idAnimal},
              ),
            ),
        ],
      ),
      body: OviAsync<FichaAnimal>(
        valor: ficha,
        alReintentar: () => ref.invalidate(fichaAnimalProvider(idAnimal)),
        enDatos: (f) => _Contenido(ficha: f, idAnimal: idAnimal),
      ),
    );
  }
}

class _Contenido extends ConsumerWidget {
  const _Contenido({required this.ficha, required this.idAnimal});

  final FichaAnimal ficha;
  final String idAnimal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final animal = ficha.animal;
    final esProductor = ref.watch(esProductorProvider);
    final texto = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        // Cabecera con el icono de sexo y el estado.
        Row(
          children: [
            OviIconoSexo(sexo: animal.sexo, tamano: 56),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('#${animal.numeroOreja}', style: texto.headlineSmall),
                  const SizedBox(height: 6),
                  OviChip.estadoAnimal(animal.estado),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const OviEncabezadoSeccion(titulo: 'Datos generales'),
              OviDato(etiqueta: 'Sexo', valor: Etiquetas.sexo(animal.sexo)),
              OviDato(etiqueta: 'Raza', valor: Fmt.oGuion(animal.raza)),
              OviDato(etiqueta: 'Color', valor: Fmt.oGuion(animal.color)),
              OviDato(etiqueta: 'Peso', valor: Fmt.peso(animal.pesoKg)),
              OviDato(
                etiqueta: 'Nacimiento',
                valor: animal.fechaNacimiento == null
                    ? '—'
                    : Fmt.fecha(animal.fechaNacimiento!),
              ),
              OviDato(
                etiqueta: 'Registrado por',
                valor: Fmt.oGuion(ficha.registrador?.nombre),
              ),
              if (animal.descripcion != null && animal.descripcion!.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Observaciones', style: texto.bodySmall),
                const SizedBox(height: 4),
                Text(animal.descripcion!, style: texto.bodyMedium),
              ],
            ],
          ),
        ),

        // RF_04 — los datos de baja solo existen si el animal está inactivo.
        if (!animal.estaActivo) ...[
          const SizedBox(height: 14),
          OviTarjeta(
            color: OviColores.neutroFondo,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const OviEncabezadoSeccion(titulo: 'Baja del rebaño'),
                OviDato(
                  etiqueta: 'Motivo',
                  valor: Etiquetas.motivoBaja(animal.motivoBaja),
                ),
                OviDato(
                  etiqueta: 'Fecha',
                  valor: animal.fechaBaja == null ? '—' : Fmt.fecha(animal.fechaBaja!),
                ),
                const SizedBox(height: 6),
                Text(
                  esProductor
                      ? 'El historial se conserva mientras el animal siga en el rebaño.'
                      : 'El historial se conserva de forma permanente para trazabilidad SAG.',
                  style: texto.bodySmall,
                ),
                // Segunda oportunidad de eliminarlo: el Productor pudo elegir
                // «dejar inactivo» al dar la baja y cambiar de opinión después.
                if (esProductor) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _confirmarEliminacion(context, ref, animal),
                    icon: const Icon(Icons.delete_outline_rounded, size: 20),
                    label: const Text('Eliminar del rebaño'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: OviColores.peligro,
                      side: const BorderSide(color: OviColores.peligro),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],

        const SizedBox(height: 14),
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OviEncabezadoSeccion(
                titulo: 'Bitácora',
                accion: TextButton(
                  onPressed: () => context.goNamed(
                    Rutas.animalBitacora,
                    pathParameters: {'id': idAnimal},
                    queryParameters: {'oreja': animal.numeroOreja},
                  ),
                  child: const Text('Ver todo'),
                ),
              ),
              if (ficha.ultimasEntradas.isEmpty)
                Text('Sin movimientos registrados.', style: texto.bodySmall)
              else
                for (final entrada in ficha.ultimasEntradas)
                  _FilaEntrada(entrada: entrada),
            ],
          ),
        ),

        // RF_04 — solo el Productor da de baja, y solo si está activo.
        if (esProductor && animal.estaActivo) ...[
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _confirmarBaja(context, ref, animal),
            icon: const Icon(Icons.remove_circle_outline_rounded, size: 20),
            label: const Text('Registrar baja'),
            style: OutlinedButton.styleFrom(
              foregroundColor: OviColores.peligro,
              side: const BorderSide(color: OviColores.peligro),
            ),
          ),
        ],
      ],
    );
  }
}

class _FilaEntrada extends StatelessWidget {
  const _FilaEntrada({required this.entrada});

  final EntradaResumida entrada;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 6, right: 12),
            decoration: const BoxDecoration(
              color: OviColores.primaryLight,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entrada.titulo, style: texto.titleSmall),
                Text(
                  '${Etiquetas.tipoBitacora(entrada.tipo)} · ${Fmt.fecha(entrada.fecha)}',
                  style: texto.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Hoja de confirmación de baja: pide motivo y fecha antes de ejecutar.
Future<void> _confirmarBaja(BuildContext context, WidgetRef ref, Animal animal) async {
  var motivo = 'VENTA';
  var fecha = DateTime.now();

  final confirmado = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: OviColores.superficie,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (hoja) => StatefulBuilder(
      builder: (hoja, refrescar) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.viewInsetsOf(hoja).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Dar de baja #${animal.numeroOreja}',
              style: Theme.of(hoja).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              'El animal sale del conteo activo. Su ficha y su historial se conservan.',
              style: Theme.of(hoja).textTheme.bodySmall,
            ),
            const SizedBox(height: 20),
            Text('Motivo', style: Theme.of(hoja).textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'VENTA', label: Text('Venta')),
                ButtonSegment(value: 'MUERTE', label: Text('Muerte')),
                ButtonSegment(value: 'FAENA', label: Text('Faena')),
              ],
              selected: {motivo},
              showSelectedIcon: false,
              onSelectionChanged: (s) => refrescar(() => motivo = s.first),
            ),
            const SizedBox(height: 20),
            Text('Fecha', style: Theme.of(hoja).textTheme.titleSmall),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              icon: const Icon(Icons.calendar_today_rounded, size: 18),
              label: Text(Fmt.fecha(fecha)),
              onPressed: () async {
                final elegida = await showDatePicker(
                  context: hoja,
                  initialDate: fecha,
                  firstDate: DateTime(2015),
                  lastDate: DateTime.now(),
                );
                if (elegida != null) refrescar(() => fecha = elegida);
              },
            ),
            const SizedBox(height: 24),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: OviColores.peligro),
              onPressed: () => Navigator.of(hoja).pop(true),
              child: const Text('Confirmar baja'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(hoja).pop(false),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    ),
  );

  if (confirmado != true || !context.mounted) return;

  try {
    await ref.read(rebanoRepositorioProvider).darDeBaja(
          animal.id,
          motivo: motivo,
          fecha: fecha,
        );
    ref.invalidate(fichaAnimalProvider(animal.id));
    ref.read(rebanoProvider.notifier).recargar();
    if (!context.mounted) return;
    mostrarMensaje(context, 'Baja registrada para #${animal.numeroOreja}.');
    await _ofrecerEliminacion(context, ref, animal);
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}

/// Recuadro que aparece justo despues de registrar la baja: el animal ya salio
/// del conteo activo, y aqui el Productor decide si conserva su ficha o lo
/// borra del rebano por completo.
Future<void> _ofrecerEliminacion(
  BuildContext context,
  WidgetRef ref,
  Animal animal,
) async {
  final eliminar = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: Text('#${animal.numeroOreja} dado de baja'),
      content: const Text(
        '¿Qué quieres hacer con su ficha?\n\n'
        '• Dejarlo inactivo: la ficha y la bitácora siguen disponibles para '
        'consulta y trazabilidad.\n'
        '• Eliminarlo del rebaño: se borra de la base de datos junto con su '
        'historial. No se puede deshacer.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Dejar inactivo'),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: OviColores.peligro),
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Eliminar del rebaño'),
        ),
      ],
    ),
  );

  if (eliminar != true || !context.mounted) return;
  await _confirmarEliminacion(context, ref, animal);
}

/// Eliminacion definitiva (DELETE). Se pide una confirmacion aparte porque
/// borra la ficha y su bitacora sin vuelta atras.
Future<void> _confirmarEliminacion(
  BuildContext context,
  WidgetRef ref,
  Animal animal,
) async {
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: const Text('Eliminar del rebaño'),
      content: Text(
        'Se borrará la ficha de #${animal.numeroOreja} y toda su bitácora. '
        'Esta acción no se puede deshacer.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogo).pop(false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: OviColores.peligro),
          onPressed: () => Navigator.of(dialogo).pop(true),
          child: const Text('Eliminar'),
        ),
      ],
    ),
  );

  if (confirmado != true || !context.mounted) return;

  try {
    await ref.read(rebanoRepositorioProvider).eliminar(animal.id);
    ref.invalidate(fichaAnimalProvider(animal.id));
    ref.read(rebanoProvider.notifier).recargar();
    if (!context.mounted) return;
    // La ficha que se esta mirando ya no existe: se vuelve al listado.
    context.goNamed(Rutas.rebano);
    mostrarMensaje(context, '#${animal.numeroOreja} eliminado del rebaño.');
  } catch (e) {
    if (context.mounted) {
      mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
    }
  }
}
