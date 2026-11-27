import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/core/almacenamiento/almacen_sesion.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/features/auth/sesion.dart';
import 'package:oviapp/features/mas/pantallas/mas.dart';
import 'package:oviapp/features/reportes/datos/reporte.dart';
import 'package:oviapp/features/reportes/pantallas/reportes.dart';
import 'package:oviapp/features/reportes/reportes_proveedores.dart';

ResumenReporte _reporteDemo() => const ResumenReporte(
      nombrePredio: 'Fundo El Manzano',
      ubicacionPredio: 'Ñuble',
      desde: '2026-01-01',
      hasta: '2026-03-31',
      meses: 3,
      generadoEn: '2026-03-31T12:00:00.000Z',
      inventario: InventarioReporte(
        activos: 47,
        inactivos: 3,
        totalHistorico: 50,
        machos: 11,
        hembras: 36,
        pesoPromedioKg: 48.5,
        pesoTotalKg: 2279.5,
        porRaza: [
          RazaCantidad(raza: 'Suffolk', cantidad: 20),
          RazaCantidad(raza: 'Corriedale', cantidad: 15),
        ],
        altasPeriodo: 4,
        bajasTotal: 3,
        bajasVenta: 1,
        bajasMuerte: 1,
        bajasFaena: 1,
        tasaMortalidadPct: 2.0,
        tasaExtraccionPct: 4.0,
      ),
      eventos: EventosReporte(
        total: 4,
        programados: 1,
        realizados: 3,
        porTipo: {
          'ATENCION_SANITARIA': 2,
          'ESQUILA': 1,
          'ENCASTE': 1,
          'OTRO': 0,
        },
        animalesAtendidosPorTipo: {
          'ATENCION_SANITARIA': 30,
          'ESQUILA': 47,
          'ENCASTE': 12,
          'OTRO': 0,
        },
        notasBitacora: 5,
        modificacionesBitacora: 3,
      ),
      tareas: TareasReporte(
        totalPeriodo: 6,
        completadasPeriodo: 5,
        activasPendientes: 1,
        vencidas: 0,
        completadasATiempo: 4,
        completadasAtrasadas: 1,
        tasaCumplimientoPct: 83.3,
        tasaATiempoPct: 80.0,
        porResponsable: [
          CumplimientoResponsable(
            idUsuario: 'u1',
            nombre: 'Rosa Millán',
            asignadas: 4,
            completadas: 4,
            tasaCumplimientoPct: 100,
          ),
        ],
      ),
      vigilancia: VigilanciaReporte(
        dispositivos: [
          DispositivoReporte(
            id: 'd1',
            nombre: 'Cámara Hato Norte',
            enLinea: true,
            ultimoConteo: 45,
            conteoEsperado: 47,
            brechaActual: 2,
            tieneRoi: true,
          ),
        ],
        totalEventos: 3,
        discrepancias: 2,
        desconexiones: 1,
        promedioDiferenciaCabezas: 2.5,
      ),
      serieMensual: [
        PuntoMensualReporte(
          mes: '2026-01',
          etiqueta: 'Ene 2026',
          altas: 2,
          bajasTotal: 2,
          bajasVenta: 1,
          bajasMuerte: 1,
          bajasFaena: 0,
          tareasCompletadas: 2,
          tareasATiempo: 2,
          tareasVencidas: 0,
          eventosTotal: 2,
          eventosSanitarios: 1,
          eventosProductivos: 1,
          eventosIA: 1,
          discrepanciasIA: 1,
          desconexionesIA: 0,
        ),
        PuntoMensualReporte(
          mes: '2026-02',
          etiqueta: 'Feb 2026',
          altas: 1,
          bajasTotal: 0,
          bajasVenta: 0,
          bajasMuerte: 0,
          bajasFaena: 0,
          tareasCompletadas: 2,
          tareasATiempo: 1,
          tareasVencidas: 0,
          eventosTotal: 1,
          eventosSanitarios: 1,
          eventosProductivos: 0,
          eventosIA: 1,
          discrepanciasIA: 0,
          desconexionesIA: 1,
        ),
        PuntoMensualReporte(
          mes: '2026-03',
          etiqueta: 'Mar 2026',
          altas: 1,
          bajasTotal: 1,
          bajasVenta: 0,
          bajasMuerte: 0,
          bajasFaena: 1,
          tareasCompletadas: 1,
          tareasATiempo: 1,
          tareasVencidas: 0,
          eventosTotal: 1,
          eventosSanitarios: 0,
          eventosProductivos: 1,
          eventosIA: 1,
          discrepanciasIA: 1,
          desconexionesIA: 0,
        ),
      ],
    );

void main() {
  testWidgets('PantallaReportes muestra KPIs, graficos y botones de exportacion',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          resumenReporteProvider.overrideWith((ref) async => _reporteDemo()),
        ],
        child: MaterialApp(
          theme: OviTema.claro(),
          home: const PantallaReportes(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Reportes y métricas'), findsOneWidget);
    expect(find.text('47'), findsOneWidget);
    expect(find.text('83.3%'), findsOneWidget);
    expect(find.text('Exportar PDF'), findsOneWidget);
    expect(find.text('Exportar CSV'), findsOneWidget);
    expect(find.text('Bajas por mes y motivo'), findsOneWidget);

    // Desplazar el ListView principal para verificar los bloques inferiores.
    await tester.scrollUntilVisible(
      find.text('Notificaciones y eventos IA'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Notificaciones y eventos IA'), findsOneWidget);
    expect(find.text('En línea'), findsOneWidget);
  });

  testWidgets('PantallaMas muestra Reportes solo para Productor y lo oculta para Trabajador',
      (tester) async {
    Widget construirMas(String rol) => ProviderScope(
          overrides: [
            usuarioActualProvider.overrideWithValue(
              SesionGuardada(
                accessToken: 'a',
                refreshToken: 'r',
                usuario: {
                  'nombre': 'Usuario Test',
                  'email': 'u@oviapp.cl',
                  'rol': rol,
                },
              ),
            ),
            esProductorProvider.overrideWithValue(rol == 'PRODUCTOR'),
          ],
          child: MaterialApp(
            theme: OviTema.claro(),
            home: const PantallaMas(),
          ),
        );

    await tester.pumpWidget(construirMas('PRODUCTOR'));
    await tester.pumpAndSettle();
    expect(find.text('Reportes y métricas'), findsOneWidget);

    await tester.pumpWidget(construirMas('TRABAJADOR'));
    await tester.pumpAndSettle();
    expect(find.text('Reportes y métricas'), findsNothing);
  });
}
