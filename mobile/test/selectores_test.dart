import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/core/widgets/selectores.dart';

/// Las hojas de seleccion se abren sobre el tema real de la app: el tema da a
/// los botones ancho infinito, y un boton asi dentro de un Row dejaba la hoja
/// sin pintar (solo se veia la barrera gris). Estas pruebas fijan que la hoja
/// se dibuja y devuelve lo elegido.
void main() {
  Future<List<String>?> abrirYConfirmar(WidgetTester tester) async {
    List<String>? resultado;

    await tester.pumpWidget(ProviderScope(
      overrides: [
        animalesActivosProvider.overrideWith((ref) async => const [
              AnimalSeleccionable(id: 'a1', numeroOreja: '101', sexo: 'HEMBRA', raza: 'Suffolk'),
              AnimalSeleccionable(id: 'a2', numeroOreja: '102', sexo: 'MACHO'),
            ]),
      ],
      child: MaterialApp(
        theme: OviTema.claro(),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async =>
                  resultado = await elegirAnimales(context, seleccionados: {}),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ));

    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('#101'));
    await tester.pump();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    return resultado;
  }

  testWidgets('la hoja de animales se dibuja y devuelve los elegidos', (tester) async {
    expect(await abrirYConfirmar(tester), ['a1']);
    expect(tester.takeException(), isNull);
  });
}
