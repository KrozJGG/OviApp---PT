import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/core/red/paginado.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/features/bitacora/bitacora_proveedores.dart';
import 'package:oviapp/features/bitacora/datos/entrada_bitacora.dart';
import 'package:oviapp/features/bitacora/pantallas/bitacora.dart';

void main() {
  Widget construirPantalla() => ProviderScope(
        overrides: [
          bitacoraProvider('a1').overrideWith(
            (ref) async => const Paginado<EntradaBitacora>(
              datos: [],
              meta: MetaPaginacion.vacio,
            ),
          ),
        ],
        child: MaterialApp(
          theme: OviTema.claro(),
          home: const PantallaBitacora(idAnimal: 'a1', numeroOreja: '1042'),
        ),
      );

  testWidgets('cerrar el dialogo de nueva nota no usa el TextEditingController tras dispose',
      (tester) async {
    await tester.pumpWidget(construirPantalla());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Nota'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Revisión general ok');
    await tester.pump();

    await tester.tap(find.text('Cancelar'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('guardar con texto vacio cierra el dialogo sin excepciones', (tester) async {
    await tester.pumpWidget(construirPantalla());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Nota'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Guardar'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
