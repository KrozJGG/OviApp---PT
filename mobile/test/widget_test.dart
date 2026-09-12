import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/core/widgets/ovi_widgets.dart';
import 'package:oviapp/features/rebano/datos/animal.dart';
import 'package:oviapp/features/tareas/datos/tarea.dart';

/// Pruebas de los bloques que sostienen las pantallas: el mapeo de la API y
/// los widgets compartidos que se repiten en los seis módulos.
void main() {
  setUpAll(() => initializeDateFormatting('es'));

  group('Animal.desdeJson', () {
    test('lee la ficha completa que entrega la API', () {
      final animal = Animal.desdeJson(const {
        'id': 'a1',
        'numeroOreja': '0042',
        'sexo': 'HEMBRA',
        'raza': 'Suffolk',
        'color': 'Blanco',
        'pesoKg': 45,
        'fechaNacimiento': '2024-03-24T00:00:00.000Z',
        'estado': 'ACTIVO',
        'motivoBaja': null,
        'fechaBaja': null,
      });

      expect(animal.numeroOreja, '0042');
      expect(animal.pesoKg, 45);
      expect(animal.estaActivo, isTrue);
      expect(animal.fechaNacimiento?.year, 2024);
    });

    test('un animal dado de baja conserva motivo y fecha', () {
      final animal = Animal.desdeJson(const {
        'id': 'a2',
        'numeroOreja': '0007',
        'sexo': 'HEMBRA',
        'estado': 'INACTIVO',
        'motivoBaja': 'VENTA',
        'fechaBaja': '2026-08-06T00:00:00.000Z',
      });

      expect(animal.estaActivo, isFalse);
      expect(animal.motivoBaja, 'VENTA');
      expect(animal.fechaBaja, isNotNull);
    });

    test('tolera los campos opcionales ausentes sin lanzar', () {
      final animal = Animal.desdeJson(const {'id': 'a3', 'numeroOreja': '0001'});

      expect(animal.raza, isNull);
      expect(animal.pesoKg, isNull);
      expect(animal.estado, 'ACTIVO');
    });
  });

  group('ListadoRebano', () {
    test('separa la página del resumen del rebaño', () {
      final listado = ListadoRebano.desdeJson(const {
        'datos': [
          {'id': 'a1', 'numeroOreja': '0042', 'sexo': 'HEMBRA', 'estado': 'ACTIVO'},
        ],
        'meta': {'pagina': 1, 'tamano': 20, 'total': 50, 'totalPaginas': 3},
        'resumen': {'activos': 47, 'inactivos': 3},
      });

      expect(listado.pagina.datos, hasLength(1));
      expect(listado.resumen.activos, 47);
      expect(listado.pagina.hayMas, isTrue);
    });
  });

  group('Tarea', () {
    test('una tarea activa con plazo pasado se marca como vencida', () {
      final tarea = Tarea.desdeJson({
        'id': 't1',
        'titulo': 'Revisar cercos',
        'fechaLimite':
            DateTime.now().subtract(const Duration(days: 3)).toIso8601String(),
        'estado': 'ACTIVA',
        'responsables': const [],
        'animales': const [],
      });

      expect(tarea.estaVencida, isTrue);
      expect(tarea.estaCompletada, isFalse);
    });

    test('una tarea completada nunca se muestra como vencida', () {
      final tarea = Tarea.desdeJson({
        'id': 't2',
        'titulo': 'Preparar galpón',
        'fechaLimite':
            DateTime.now().subtract(const Duration(days: 10)).toIso8601String(),
        'estado': 'COMPLETADA',
        'responsables': const [
          {'id': 'u1', 'nombre': 'Pedro Huenchual'},
        ],
        'animales': const [],
      });

      expect(tarea.estaVencida, isFalse);
      expect(tarea.responsables.single.nombre, 'Pedro Huenchual');
    });
  });

  group('OviChip.estadoAnimal', () {
    testWidgets('muestra Activo o Inactivo según el estado', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: OviTema.claro(),
            home: Scaffold(
              body: Column(
                children: [
                  OviChip.estadoAnimal('ACTIVO'),
                  OviChip.estadoAnimal('INACTIVO'),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.text('Activo'), findsOneWidget);
      expect(find.text('Inactivo'), findsOneWidget);
    });
  });
}
