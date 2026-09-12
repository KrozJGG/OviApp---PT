import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/fila_agenda.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../calendario_proveedores.dart';
import '../datos/agenda.dart';

/// Pantalla 06 — Calendario general (RF_16).
///
/// Vista mensual con un punto por día que tiene actividad y, debajo, el
/// detalle expandible del día seleccionado.
class PantallaCalendario extends ConsumerWidget {
  const PantallaCalendario({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agenda = ref.watch(agendaDelMesProvider);
    final mes = ref.watch(mesVisibleProvider);
    final dia = ref.watch(diaSeleccionadoProvider);
    final esProductor = ref.watch(esProductorProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendario'),
        actions: [
          IconButton(
            tooltip: 'Ver tareas',
            icon: const Icon(Icons.checklist_rounded),
            onPressed: () => context.goNamed(Rutas.tareas),
          ),
        ],
      ),
      body: OviAsync<AgendaDelRango>(
        valor: agenda,
        alReintentar: () => ref.invalidate(agendaDelMesProvider),
        enDatos: (datos) {
          final delDia = datos.deDia(dia);

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: OviTarjeta(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                  child: _Calendario(
                    mes: mes,
                    dia: dia,
                    agenda: datos,
                    alElegirDia: (elegido) {
                      ref.read(diaSeleccionadoProvider.notifier).elegir(elegido);
                    },
                    alCambiarMes: (nuevo) {
                      ref.read(mesVisibleProvider.notifier).ir(nuevo);
                    },
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        Fmt.diaSemana(dia),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    const _Leyenda(color: OviColores.primary, texto: 'Evento'),
                    const SizedBox(width: 12),
                    const _Leyenda(color: OviColores.exito, texto: 'Tarea'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: delDia.isEmpty
                    ? const OviEstadoVacio(
                        mensaje: 'Nada programado este día',
                        detalle: 'Usa el botón + para agregar un evento o una tarea.',
                        icono: Icons.event_available_outlined,
                      )
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(agendaDelMesProvider),
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
                          itemCount: delDia.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => FilaAgenda(item: delDia[i]),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _elegirQueAgregar(context, dia, esProductor),
        tooltip: 'Agregar',
        child: const Icon(Icons.add_rounded, size: 28),
      ),
    );
  }
}

/// Hoja de elección: evento (solo Productor, RF_07) o tarea (ambos, RF_11).
Future<void> _elegirQueAgregar(
  BuildContext context,
  DateTime dia,
  bool esProductor,
) async {
  final iso = Fmt.iso(dia);

  // El Trabajador solo puede crear tareas: se le abre directo el formulario en
  // lugar de ofrecerle una opción que el backend va a rechazar con 403.
  if (!esProductor) {
    context.goNamed(Rutas.tareaNueva, queryParameters: {'fecha': iso});
    return;
  }

  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: OviColores.superficie,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (hoja) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 16),
          Text(
            'Agregar a ${Fmt.diaSemana(dia).toLowerCase()}',
            style: Theme.of(hoja).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.event_rounded, color: OviColores.primary),
            title: const Text('Evento del ciclo productivo'),
            subtitle: const Text('Encaste, esquila o atención sanitaria'),
            onTap: () {
              Navigator.of(hoja).pop();
              context.goNamed(Rutas.eventoNuevo, queryParameters: {'fecha': iso});
            },
          ),
          ListTile(
            leading: const Icon(Icons.task_alt_rounded, color: OviColores.exito),
            title: const Text('Tarea del predio'),
            subtitle: const Text('Actividad con responsable y fecha de término'),
            onTap: () {
              Navigator.of(hoja).pop();
              context.goNamed(Rutas.tareaNueva, queryParameters: {'fecha': iso});
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );
}

/// Mes con marcadores. Separado para que el `build` de arriba se lea.
class _Calendario extends StatelessWidget {
  const _Calendario({
    required this.mes,
    required this.dia,
    required this.agenda,
    required this.alElegirDia,
    required this.alCambiarMes,
  });

  final DateTime mes;
  final DateTime dia;
  final AgendaDelRango agenda;
  final ValueChanged<DateTime> alElegirDia;
  final ValueChanged<DateTime> alCambiarMes;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return TableCalendar<ItemAgenda>(
      locale: 'es',
      firstDay: DateTime(2020),
      lastDay: DateTime(2035, 12, 31),
      focusedDay: _dentroDelMes(dia, mes) ? dia : mes,
      currentDay: DateTime.now(),
      selectedDayPredicate: (d) => isSameDay(d, dia),
      eventLoader: agenda.deDia,
      startingDayOfWeek: StartingDayOfWeek.monday,
      availableGestures: AvailableGestures.horizontalSwipe,
      daysOfWeekHeight: 28,
      rowHeight: 44,
      onDaySelected: (elegido, _) => alElegirDia(elegido),
      onPageChanged: alCambiarMes,
      headerStyle: HeaderStyle(
        formatButtonVisible: false,
        titleCentered: true,
        titleTextFormatter: (fecha, _) => Fmt.mesAno(fecha),
        titleTextStyle: texto.titleMedium ?? const TextStyle(),
        leftChevronIcon: const Icon(Icons.chevron_left_rounded),
        rightChevronIcon: const Icon(Icons.chevron_right_rounded),
        headerPadding: const EdgeInsets.symmetric(vertical: 6),
      ),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: texto.bodySmall ?? const TextStyle(),
        weekendStyle: texto.bodySmall ?? const TextStyle(),
      ),
      calendarStyle: CalendarStyle(
        outsideDaysVisible: false,
        defaultTextStyle: texto.bodyMedium ?? const TextStyle(),
        weekendTextStyle: texto.bodyMedium ?? const TextStyle(),
        todayDecoration: BoxDecoration(
          color: OviColores.superficieSecundaria,
          shape: BoxShape.circle,
        ),
        todayTextStyle: const TextStyle(
          color: OviColores.primaryDark,
          fontWeight: FontWeight.w600,
        ),
        selectedDecoration: const BoxDecoration(
          color: OviColores.primary,
          shape: BoxShape.circle,
        ),
        selectedTextStyle: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
        markersMaxCount: 0, // Los marcadores se dibujan a mano más abajo.
      ),
      calendarBuilders: CalendarBuilders<ItemAgenda>(
        markerBuilder: (_, _, items) {
          if (items.isEmpty) return null;
          // Un punto azul si hay eventos, uno verde si hay tareas.
          final hayEventos = items.any((i) => i.esEvento);
          final hayTareas = items.any((i) => !i.esEvento);

          return Padding(
            padding: const EdgeInsets.only(top: 30),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (hayEventos) const _Punto(color: OviColores.primary),
                if (hayEventos && hayTareas) const SizedBox(width: 3),
                if (hayTareas) const _Punto(color: OviColores.exito),
              ],
            ),
          );
        },
      ),
    );
  }

  static bool _dentroDelMes(DateTime d, DateTime mes) =>
      d.year == mes.year && d.month == mes.month;
}

class _Punto extends StatelessWidget {
  const _Punto({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: 5,
        height: 5,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

class _Leyenda extends StatelessWidget {
  const _Leyenda({required this.color, required this.texto});

  final Color color;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Punto(color: color),
        const SizedBox(width: 5),
        Text(texto, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
