import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/features/auth/pantallas/registro.dart';
import 'package:oviapp/features/auth/sesion.dart';

void main() {
  group('TrabajadorRegistro.aJson', () {
    test('recorta textos y omite RUT y teléfono cuando están vacíos', () {
      const t = TrabajadorRegistro(
        nombre: '  Rosa Millán  ',
        email: '  rosa@oviapp.cl ',
        password: 'Password123!',
        rut: '   ',
        telefono: null,
      );

      final json = t.aJson();
      expect(json['nombre'], 'Rosa Millán');
      expect(json['email'], 'rosa@oviapp.cl');
      expect(json['password'], 'Password123!');
      expect(json['rol'], 'TRABAJADOR');
      expect(json.containsKey('rut'), isFalse);
      expect(json.containsKey('telefono'), isFalse);
    });
  });

  group('PantallaRegistro', () {
    testWidgets(
      'muestra campos del productor, predio opcional y permite agregar y quitar trabajadores',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              theme: OviTema.claro(),
              home: const PantallaRegistro(),
            ),
          ),
        );

        expect(find.text('Registrar nuevo predio'), findsOneWidget);
        expect(find.text('Nombre del predio (opcional)'), findsOneWidget);
        expect(find.text('Agregar trabajador'), findsOneWidget);
        expect(find.text('Trabajador #1'), findsNothing);

        final botonAgregar = find.text('Agregar trabajador');
        await tester.ensureVisible(botonAgregar);
        await tester.tap(botonAgregar);
        await tester.pumpAndSettle();

        expect(find.text('Trabajador #1'), findsOneWidget);

        final botonQuitar = find.byTooltip('Quitar trabajador');
        await tester.ensureVisible(botonQuitar);
        await tester.tap(botonQuitar);
        await tester.pumpAndSettle();

        expect(find.text('Trabajador #1'), findsNothing);
      },
    );
  });
}

