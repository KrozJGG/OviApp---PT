import type { ResumenReporte } from './reportes.servicio';

/**
 * Generadores de exportacion PDF y CSV para el Modulo 8 (RF24 / IF4-SAL).
 *
 * Ambos generadores son puros y sin dependencias externas pesadas:
 *  - CSV: RFC 4180 en UTF-8 con BOM para compatibilidad directa con Excel en espanol.
 *  - PDF: documento PDF 1.4 valido con codificacion WinAnsiEncoding (acentos y ñ
 *    nativos en Helvetica), paleta corporativa OviApp (#061991 / #2050F0 / #EEF2FE),
 *    tarjetas KPI, tablas con cabeceras sombreadas y paginacion automatica.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Exportador CSV
// ─────────────────────────────────────────────────────────────────────────────

export function generarCsvReporte(r: ResumenReporte): Buffer {
  const filas: string[] = [];
  const fila = (...celdas: Array<string | number | null | undefined>) =>
    filas.push(celdas.map(escaparCsv).join(','));

  fila('REPORTE CONSOLIDADO DEL PREDIO - OVIAPP');
  fila('Predio', r.predio.nombre);
  fila('Ubicación', r.predio.ubicacion ?? 'Sin especificar');
  fila('Período', `${r.periodo.desde} a ${r.periodo.hasta}`);
  fila('Generado en', r.generadoEn);
  filas.push('');

  fila('1. INVENTARIO Y PRODUCCIÓN');
  fila('Indicador', 'Valor');
  fila('Animales activos', r.inventario.activos);
  fila('Animales inactivos (histórico)', r.inventario.inactivos);
  fila('Machos activos', r.inventario.machos);
  fila('Hembras activas', r.inventario.hembras);
  fila('Peso promedio (kg)', r.inventario.pesoPromedioKg ?? 'Sin datos');
  fila('Biomasa total estimada (kg)', r.inventario.pesoTotalKg);
  fila('Altas en el período', r.inventario.altasPeriodo);
  fila('Bajas en el período (total)', r.inventario.bajasPeriodo.total);
  fila('Bajas por venta', r.inventario.bajasPeriodo.venta);
  fila('Bajas por muerte', r.inventario.bajasPeriodo.muerte);
  fila('Bajas por faena', r.inventario.bajasPeriodo.faena);
  fila('Tasa de mortalidad (%)', r.inventario.tasaMortalidadPct);
  fila('Tasa de extracción comercial (%)', r.inventario.tasaExtraccionPct);
  filas.push('');

  fila('2. SERIE MENSUAL CONSOLIDADA');
  fila(
    'Mes',
    'Altas',
    'Bajas Total',
    'Bajas Venta',
    'Bajas Muerte',
    'Bajas Faena',
    'Tareas Cumplidas',
    'Tareas a Tiempo',
    'Tareas Vencidas',
    'Eventos Sanitarios',
    'Eventos Productivos',
    'Eventos IA Total',
    'Discrepancias IA',
    'Desconexiones IA',
  );
  for (const m of r.serieMensual) {
    fila(
      m.etiqueta,
      m.altas,
      m.bajasTotal,
      m.bajasVenta,
      m.bajasMuerte,
      m.bajasFaena,
      m.tareasCompletadas,
      m.tareasATiempo,
      m.tareasVencidas,
      m.eventosSanitarios,
      m.eventosProductivos,
      m.eventosIA,
      m.discrepanciasIA,
      m.desconexionesIA,
    );
  }
  filas.push('');

  fila('3. GESTIÓN SANITARIA Y PRODUCTIVA');
  fila('Tipo de evento', 'Cantidad', 'Animales únicos atendidos');
  fila('Atención sanitaria', r.eventos.porTipo.ATENCION_SANITARIA, r.eventos.animalesAtendidosPorTipo.ATENCION_SANITARIA);
  fila('Encaste', r.eventos.porTipo.ENCASTE, r.eventos.animalesAtendidosPorTipo.ENCASTE);
  fila('Esquila', r.eventos.porTipo.ESQUILA, r.eventos.animalesAtendidosPorTipo.ESQUILA);
  fila('Otro', r.eventos.porTipo.OTRO, r.eventos.animalesAtendidosPorTipo.OTRO);
  fila('Notas manuales en bitácora', r.eventos.notasBitacora, '');
  fila('Modificaciones de ficha en bitácora', r.eventos.modificacionesBitacora, '');
  filas.push('');

  fila('4. CUMPLIMIENTO OPERATIVO POR RESPONSABLE');
  fila('Responsable', 'Asignadas', 'Completadas', 'Cumplimiento (%)');
  for (const u of r.tareas.porResponsable) {
    fila(u.nombre, u.asignadas, u.completadas, u.tasaCumplimientoPct);
  }
  filas.push('');

  fila('5. VIGILANCIA Y MONITOREO IA');
  fila('Total eventos IA período', r.vigilancia.eventosPeriodo.total);
  fila('Discrepancias de conteo', r.vigilancia.eventosPeriodo.discrepancias);
  fila('Desconexiones de cámara', r.vigilancia.eventosPeriodo.desconexiones);
  fila('Promedio brecha en discrepancias (cabezas)', r.vigilancia.eventosPeriodo.promedioDiferenciaCabezas);
  fila('Cámara', 'Estado', 'Último conteo', 'Esperado', 'Brecha actual', 'ROI activa');
  for (const d of r.vigilancia.dispositivos) {
    fila(
      d.nombre,
      d.enLinea ? 'En línea' : 'Sin señal',
      d.ultimoConteo ?? 'Sin datos',
      d.conteoEsperado,
      d.brechaActual ?? '—',
      d.tieneRoi ? 'Sí' : 'No',
    );
  }

  return Buffer.from(`\uFEFF${filas.join('\r\n')}\r\n`, 'utf8');
}

function escaparCsv(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportador PDF 1.4 (WinAnsiEncoding, multipagina, paleta OviApp)
// ─────────────────────────────────────────────────────────────────────────────

const ANCHO_PAGINA = 595.28; // A4 portrait (pt)
const ALTO_PAGINA = 841.89;
const MARGEN = 42;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const PIE_Y = 38;

const COLOR_NAVY = '0.024 0.098 0.569'; // #061991
const COLOR_PRIMARY = '0.125 0.314 0.941'; // #2050F0
const COLOR_FONDO = '0.933 0.949 0.996'; // #EEF2FE
const COLOR_ZEBRA = '0.969 0.976 0.992';
const COLOR_BORDE = '0.820 0.855 0.941';
const COLOR_TEXTO = '0.102 0.102 0.180'; // #1A1A2E
const COLOR_SECUNDARIO = '0.420 0.447 0.502'; // #6B7280
const COLOR_BLANCO = '1 1 1';

class ConstructorPdf {
  private paginas: string[][] = [];
  private actual: string[] = [];
  private y = ALTO_PAGINA - MARGEN;

  constructor(private readonly subtituloPie: string) {
    this.nuevaPagina();
  }

  private nuevaPagina(): void {
    this.actual = [];
    this.paginas.push(this.actual);
    this.y = ALTO_PAGINA - MARGEN;
  }

  asegurarEspacio(altoNecesario: number): void {
    if (this.y - altoNecesario < PIE_Y + 18) {
      this.nuevaPagina();
    }
  }

  encabezadoPrincipal(titulo: string, subtitulo: string, meta: string): void {
    const alto = 68;
    const topY = this.y;
    const bottomY = topY - alto;
    this.actual.push(`${COLOR_NAVY} rg ${MARGEN} ${bottomY.toFixed(2)} ${ANCHO_UTIL.toFixed(2)} ${alto} re f`);
    this.texto(MARGEN + 14, topY - 24, titulo, 16, true, COLOR_BLANCO);
    this.texto(MARGEN + 14, topY - 41, subtitulo, 10, false, '0.835 0.875 0.996');
    this.texto(MARGEN + 14, topY - 56, meta, 8.5, false, '0.835 0.875 0.996');
    this.y = bottomY - 16;
  }

  tituloSeccion(titulo: string): void {
    this.asegurarEspacio(28);
    this.texto(MARGEN, this.y - 12, titulo, 11.5, true, COLOR_PRIMARY);
    const lineaY = this.y - 17;
    this.actual.push(
      `${COLOR_BORDE} RG 0.8 w ${MARGEN} ${lineaY.toFixed(2)} m ${(MARGEN + ANCHO_UTIL).toFixed(2)} ${lineaY.toFixed(2)} l S`,
    );
    this.y = lineaY - 10;
  }

  tarjetasKpi(items: Array<{ etiqueta: string; valor: string; detalle?: string }>): void {
    const alto = 48;
    this.asegurarEspacio(alto + 10);
    const gap = 8;
    const ancho = (ANCHO_UTIL - gap * (items.length - 1)) / items.length;
    const bottomY = this.y - alto;

    items.forEach((item, idx) => {
      const x = MARGEN + idx * (ancho + gap);
      this.actual.push(
        `${COLOR_FONDO} rg ${COLOR_BORDE} RG 0.6 w ${x.toFixed(2)} ${bottomY.toFixed(2)} ${ancho.toFixed(2)} ${alto} re B`,
      );
      this.texto(x + 8, this.y - 14, item.etiqueta, 7.8, false, COLOR_SECUNDARIO);
      this.texto(x + 8, this.y - 31, item.valor, 14, true, COLOR_NAVY);
      if (item.detalle) {
        this.texto(x + 8, this.y - 42, truncar(item.detalle, 24), 7.2, false, COLOR_SECUNDARIO);
      }
    });

    this.y = bottomY - 12;
  }

  lineaTexto(contenido: string): void {
    this.asegurarEspacio(15);
    this.texto(MARGEN, this.y - 10, contenido, 9, false, COLOR_TEXTO);
    this.y -= 14;
  }

  tabla(
    columnas: Array<{ titulo: string; ancho: number; alinear?: 'izq' | 'der' }>,
    filas: string[][],
  ): void {
    const altoCabecera = 20;
    const altoFila = 17;

    const pintarCabecera = () => {
      this.asegurarEspacio(altoCabecera + altoFila);
      const bottomY = this.y - altoCabecera;
      this.actual.push(
        `${COLOR_NAVY} rg ${MARGEN} ${bottomY.toFixed(2)} ${ANCHO_UTIL.toFixed(2)} ${altoCabecera} re f`,
      );
      let x = MARGEN;
      for (const col of columnas) {
        this.textoCelda(x, col.ancho, this.y - 13.5, col.titulo, 8, true, COLOR_BLANCO, col.alinear ?? 'izq');
        x += col.ancho;
      }
      this.y = bottomY;
    };

    pintarCabecera();

    if (filas.length === 0) {
      const bottomY = this.y - altoFila;
      this.actual.push(
        `${COLOR_ZEBRA} rg ${MARGEN} ${bottomY.toFixed(2)} ${ANCHO_UTIL.toFixed(2)} ${altoFila} re f`,
      );
      this.texto(MARGEN + 6, this.y - 12, 'Sin registros en el período seleccionado.', 8.2, false, COLOR_SECUNDARIO);
      this.y = bottomY - 10;
      return;
    }

    filas.forEach((fila, idx) => {
      if (this.y - altoFila < PIE_Y + 14) {
        this.nuevaPagina();
        pintarCabecera();
      }
      const bottomY = this.y - altoFila;
      if (idx % 2 === 1) {
        this.actual.push(
          `${COLOR_ZEBRA} rg ${MARGEN} ${bottomY.toFixed(2)} ${ANCHO_UTIL.toFixed(2)} ${altoFila} re f`,
        );
      }
      this.actual.push(
        `${COLOR_BORDE} RG 0.4 w ${MARGEN} ${bottomY.toFixed(2)} m ${(MARGEN + ANCHO_UTIL).toFixed(2)} ${bottomY.toFixed(2)} l S`,
      );

      let x = MARGEN;
      columnas.forEach((col, cIdx) => {
        const valor = fila[cIdx] ?? '';
        const maxChars = Math.max(4, Math.floor((col.ancho - 8) / 4.6));
        this.textoCelda(
          x,
          col.ancho,
          this.y - 12,
          truncar(valor, maxChars),
          8.2,
          false,
          COLOR_TEXTO,
          col.alinear ?? 'izq',
        );
        x += col.ancho;
      });
      this.y = bottomY;
    });

    this.y -= 12;
  }

  private textoCelda(
    x: number,
    ancho: number,
    y: number,
    texto: string,
    tamano: number,
    negrita: boolean,
    color: string,
    alinear: 'izq' | 'der',
  ): void {
    if (alinear === 'der') {
      const anchoEstimado = texto.length * tamano * 0.52;
      const xDer = Math.max(x + 4, x + ancho - 6 - anchoEstimado);
      this.texto(xDer, y, texto, tamano, negrita, color);
    } else {
      this.texto(x + 5, y, texto, tamano, negrita, color);
    }
  }

  private texto(
    x: number,
    y: number,
    contenido: string,
    tamano: number,
    negrita: boolean,
    color: string,
  ): void {
    const fuente = negrita ? '/F2' : '/F1';
    this.actual.push(
      `BT ${color} rg ${fuente} ${tamano} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${codificarWinAnsi(contenido)}) Tj ET`,
    );
  }

  compilar(): Buffer {
    const totalPaginas = this.paginas.length;

    // Agregar pie de pagina a cada hoja
    this.paginas.forEach((comandos, idx) => {
      comandos.push(
        `${COLOR_BORDE} RG 0.5 w ${MARGEN} ${(PIE_Y + 10).toFixed(2)} m ${(MARGEN + ANCHO_UTIL).toFixed(2)} ${(PIE_Y + 10).toFixed(2)} l S`,
      );
      comandos.push(
        `BT ${COLOR_SECUNDARIO} rg /F1 8 Tf 1 0 0 1 ${MARGEN} ${PIE_Y - 2} Tm (${codificarWinAnsi(this.subtituloPie)}) Tj ET`,
      );
      const etiquetaPag = `Página ${idx + 1} de ${totalPaginas}`;
      const xPag = MARGEN + ANCHO_UTIL - etiquetaPag.length * 4.4;
      comandos.push(
        `BT ${COLOR_SECUNDARIO} rg /F1 8 Tf 1 0 0 1 ${xPag.toFixed(2)} ${PIE_Y - 2} Tm (${codificarWinAnsi(etiquetaPag)}) Tj ET`,
      );
    });

    // Objetos PDF:
    // 1: Catalog, 2: Pages, 3: Helvetica (F1), 4: Helvetica-Bold (F2),
    // luego por cada pagina: Content stream + Page dict.
    const objetos: string[] = [];
    const idsPaginas: number[] = [];

    objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
    objetos.push(''); // placeholder para Pages (obj 2)
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    for (const comandos of this.paginas) {
      const stream = comandos.join('\n');
      const idContenido = objetos.length + 1;
      const longitudBytes = Buffer.byteLength(stream, 'latin1');
      objetos.push(`<< /Length ${longitudBytes} >>\nstream\n${stream}\nendstream`);

      const idPagina = objetos.length + 1;
      idsPaginas.push(idPagina);
      objetos.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idContenido} 0 R >>`,
      );
    }

    objetos[1] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${idsPaginas.length} >>`;

    const partes: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets: number[] = [0];
    let posicion = partes[0]!.length;

    objetos.forEach((cuerpo, idx) => {
      offsets.push(posicion);
      const bloque = Buffer.from(`${idx + 1} 0 obj\n${cuerpo}\nendobj\n`, 'latin1');
      partes.push(bloque);
      posicion += bloque.length;
    });

    const inicioXref = posicion;
    const lineasXref = [`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`];
    for (let i = 1; i <= objetos.length; i += 1) {
      lineasXref.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    lineasXref.push(
      `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`,
    );
    partes.push(Buffer.from(lineasXref.join(''), 'latin1'));

    return Buffer.concat(partes);
  }
}

export function generarPdfReporte(r: ResumenReporte): Buffer {
  const fechaGeneracion = r.generadoEn.slice(0, 10);
  const pdf = new ConstructorPdf(`OviApp · Reporte consolidado (${r.predio.nombre}) · Emitido ${fechaGeneracion}`);

  pdf.encabezadoPrincipal(
    'OviApp - Reporte Consolidado del Predio',
    `${r.predio.nombre}${r.predio.ubicacion ? ` · ${r.predio.ubicacion}` : ''}`,
    `Período analizado: ${r.periodo.desde} al ${r.periodo.hasta} (${r.periodo.meses} meses) · Generado: ${fechaGeneracion}`,
  );

  // ── 1. Resumen ejecutivo ────────────────────────────────────────────────
  pdf.tituloSeccion('1. Resumen Ejecutivo del Período');
  pdf.tarjetasKpi([
    {
      etiqueta: 'Rebaño activo',
      valor: `${r.inventario.activos}`,
      detalle: `${r.inventario.hembras} H / ${r.inventario.machos} M · +${r.inventario.altasPeriodo} altas`,
    },
    {
      etiqueta: 'Bajas del período',
      valor: `${r.inventario.bajasPeriodo.total}`,
      detalle: `Mort. ${r.inventario.tasaMortalidadPct}% · Ext. ${r.inventario.tasaExtraccionPct}%`,
    },
    {
      etiqueta: 'Tareas cumplidas',
      valor: `${r.tareas.tasaCumplimientoPct}%`,
      detalle: `${r.tareas.completadasPeriodo}/${r.tareas.totalPeriodo} · ${r.tareas.tasaATiempoPct}% a tiempo`,
    },
    {
      etiqueta: 'Eventos vigilancia IA',
      valor: `${r.vigilancia.eventosPeriodo.total}`,
      detalle: `${r.vigilancia.eventosPeriodo.discrepancias} disc. · ${r.vigilancia.eventosPeriodo.desconexiones} desc.`,
    },
  ]);

  const pesoTexto =
    r.inventario.pesoPromedioKg === null
      ? 'Sin pesos registrados'
      : `${r.inventario.pesoPromedioKg} kg promedio (${r.inventario.pesoTotalKg} kg biomasa activa)`;
  pdf.lineaTexto(
    `Peso del rebaño: ${pesoTexto} | Bajas por motivo: Venta (${r.inventario.bajasPeriodo.venta}), Muerte (${r.inventario.bajasPeriodo.muerte}), Faena (${r.inventario.bajasPeriodo.faena}).`,
  );

  // ── 2. Evolución mensual ────────────────────────────────────────────────
  pdf.tituloSeccion('2. Evolución Mensual (Producción, Tareas, Sanidad e IA)');
  pdf.tabla(
    [
      { titulo: 'Mes', ancho: 66 },
      { titulo: 'Altas', ancho: 42, alinear: 'der' },
      { titulo: 'Bajas', ancho: 42, alinear: 'der' },
      { titulo: 'Venta', ancho: 42, alinear: 'der' },
      { titulo: 'Muerte', ancho: 46, alinear: 'der' },
      { titulo: 'Faena', ancho: 42, alinear: 'der' },
      { titulo: 'Tareas OK', ancho: 56, alinear: 'der' },
      { titulo: 'Sanid.', ancho: 46, alinear: 'der' },
      { titulo: 'Prod.', ancho: 45, alinear: 'der' },
      { titulo: 'Ev. IA', ancho: 44, alinear: 'der' },
      { titulo: 'Venc.', ancho: 40.28, alinear: 'der' },
    ],
    r.serieMensual.map((m) => [
      m.etiqueta,
      String(m.altas),
      String(m.bajasTotal),
      String(m.bajasVenta),
      String(m.bajasMuerte),
      String(m.bajasFaena),
      String(m.tareasCompletadas),
      String(m.eventosSanitarios),
      String(m.eventosProductivos),
      String(m.eventosIA),
      String(m.tareasVencidas),
    ]),
  );

  // ── 3. Gestión sanitaria y productiva ───────────────────────────────────
  pdf.tituloSeccion('3. Gestión Sanitaria, Productiva y Bitácora');
  pdf.tabla(
    [
      { titulo: 'Categoría de evento', ancho: 230 },
      { titulo: 'Eventos en período', ancho: 140, alinear: 'der' },
      { titulo: 'Animales únicos atendidos', ancho: 141.28, alinear: 'der' },
    ],
    [
      ['Atención sanitaria', String(r.eventos.porTipo.ATENCION_SANITARIA), String(r.eventos.animalesAtendidosPorTipo.ATENCION_SANITARIA)],
      ['Encaste', String(r.eventos.porTipo.ENCASTE), String(r.eventos.animalesAtendidosPorTipo.ENCASTE)],
      ['Esquila', String(r.eventos.porTipo.ESQUILA), String(r.eventos.animalesAtendidosPorTipo.ESQUILA)],
      ['Otro evento', String(r.eventos.porTipo.OTRO), String(r.eventos.animalesAtendidosPorTipo.OTRO)],
    ],
  );
  pdf.lineaTexto(
    `Eventos programados: ${r.eventos.programados} · Realizados: ${r.eventos.realizados} · Notas manuales en bitácora: ${r.eventos.notasBitacora} · Actualizaciones de ficha: ${r.eventos.modificacionesBitacora}.`,
  );

  // ── 4. Cumplimiento operativo por responsable ───────────────────────────
  pdf.tituloSeccion('4. Cumplimiento de Tareas por Responsable');
  pdf.tabla(
    [
      { titulo: 'Integrante del predio', ancho: 250 },
      { titulo: 'Asignadas', ancho: 85, alinear: 'der' },
      { titulo: 'Completadas', ancho: 85, alinear: 'der' },
      { titulo: 'Cumplimiento', ancho: 91.28, alinear: 'der' },
    ],
    r.tareas.porResponsable.map((u) => [
      u.nombre,
      String(u.asignadas),
      String(u.completadas),
      `${u.tasaCumplimientoPct}%`,
    ]),
  );

  // ── 5. Vigilancia y monitoreo IA ────────────────────────────────────────
  pdf.tituloSeccion('5. Vigilancia y Monitoreo con Visión por Computadora');
  pdf.lineaTexto(
    `Eventos IA en el período: ${r.vigilancia.eventosPeriodo.total} (${r.vigilancia.eventosPeriodo.discrepancias} discrepancias de conteo, ${r.vigilancia.eventosPeriodo.desconexiones} desconexiones; brecha promedio: ${r.vigilancia.eventosPeriodo.promedioDiferenciaCabezas} cabezas).`,
  );
  pdf.tabla(
    [
      { titulo: 'Cámara / Dispositivo Edge', ancho: 185 },
      { titulo: 'Estado', ancho: 80 },
      { titulo: 'Detectadas', ancho: 80, alinear: 'der' },
      { titulo: 'Esperadas', ancho: 80, alinear: 'der' },
      { titulo: 'ROI', ancho: 86.28, alinear: 'der' },
    ],
    r.vigilancia.dispositivos.map((d) => [
      d.nombre,
      d.enLinea ? 'En línea' : 'Sin señal',
      d.ultimoConteo === null ? 'Sin datos' : String(d.ultimoConteo),
      String(d.conteoEsperado),
      d.tieneRoi ? 'Configurada' : 'Completa',
    ]),
  );

  return pdf.compilar();
}

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, Math.max(1, max - 1))}.`;
}

/**
 * Codifica una cadena Unicode a literal PDF en WinAnsiEncoding (Windows-1252),
 * escapando parentesis, barras y caracteres no-ASCII como octales de 3 digitos.
 */
function codificarWinAnsi(texto: string): string {
  let salida = '';
  for (const ch of texto) {
    const code = ch.codePointAt(0) ?? 0x20;
    let byte = 0x3f; // '?'

    if (code >= 0x20 && code <= 0x7e) {
      if (ch === '(' || ch === ')' || ch === '\\') {
        salida += `\\${ch}`;
      } else {
        salida += ch;
      }
      continue;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (code === 0x2013) {
      byte = 0x96; // en-dash
    } else if (code === 0x2014) {
      byte = 0x97; // em-dash
    } else if (code === 0x2022) {
      byte = 0x95; // bullet
    }

    salida += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return salida;
}
