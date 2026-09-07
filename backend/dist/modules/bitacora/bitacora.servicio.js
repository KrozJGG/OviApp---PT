"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarAlta = registrarAlta;
exports.registrarModificacion = registrarModificacion;
exports.registrarBaja = registrarBaja;
exports.registrarEventoEnAnimales = registrarEventoEnAnimales;
exports.sincronizarEventoEnAnimales = sincronizarEventoEnAnimales;
exports.marcarEventoEliminado = marcarEventoEliminado;
exports.agregarNota = agregarNota;
exports.etiquetaCampo = etiquetaCampo;
exports.etiquetaTipoEvento = etiquetaTipoEvento;
/** (a) Registro inicial del animal - RF_06.a, disparado por RF_01. */
async function registrarAlta(tx, args) {
    await tx.bitacoraEntrada.create({
        data: {
            idAnimal: args.idAnimal,
            idUsuario: args.idUsuario,
            tipo: 'ALTA',
            titulo: `Alta del animal #${args.numeroOreja}`,
            descripcion: 'Ingreso al rebano con sus datos iniciales.',
            datos: args.datosIniciales,
        },
    });
}
/**
 * (b) Modificacion de datos generales - RF_06.b, disparado por RF_03.
 * RF_03 exige dejar constancia de que campo cambio, su valor anterior, el nuevo,
 * quien lo hizo y cuando. Se genera una entrada por operacion de edicion, con
 * todos los cambios agrupados.
 */
async function registrarModificacion(tx, args) {
    if (args.cambios.length === 0)
        return;
    const resumen = args.cambios
        .map((c) => `${etiquetaCampo(c.campo)}: ${formatear(c.valorAnterior)} -> ${formatear(c.valorNuevo)}`)
        .join('; ');
    await tx.bitacoraEntrada.create({
        data: {
            idAnimal: args.idAnimal,
            idUsuario: args.idUsuario,
            tipo: 'MODIFICACION',
            titulo: args.cambios.length === 1
                ? `Se edito ${etiquetaCampo(args.cambios[0].campo)}`
                : `Se editaron ${args.cambios.length} campos`,
            descripcion: resumen,
            datos: { cambios: args.cambios },
        },
    });
}
/** (c) Baja del animal - RF_06.c, disparado por RF_04. */
async function registrarBaja(tx, args) {
    await tx.bitacoraEntrada.create({
        data: {
            idAnimal: args.idAnimal,
            idUsuario: args.idUsuario,
            tipo: 'BAJA',
            titulo: `Baja por ${etiquetaMotivo(args.motivo)}`,
            descripcion: `El animal fue dado de baja del rebano. Se conserva su historial completo para trazabilidad SAG.`,
            datos: { motivo: args.motivo, fecha: args.fecha.toISOString().slice(0, 10) },
            fechaEvento: args.fecha,
        },
    });
}
/**
 * (d) Asociacion a un evento del Modulo 3 - RF_06.d, disparado por RF_07/RF_09.
 * Crea una entrada en la bitacora de cada animal involucrado.
 */
async function registrarEventoEnAnimales(tx, args) {
    if (args.idAnimales.length === 0)
        return;
    await tx.bitacoraEntrada.createMany({
        data: args.idAnimales.map((idAnimal) => ({
            idAnimal,
            idUsuario: args.idUsuario,
            tipo: 'EVENTO',
            idEvento: args.idEvento,
            titulo: etiquetaTipoEvento(args.tipoEvento),
            descripcion: args.descripcion,
            datos: { tipoEvento: args.tipoEvento },
            fechaEvento: args.fechaEvento,
        })),
    });
}
/**
 * RF_09 - al editar un evento, la bitacora debe reflejar la lista de animales
 * resultante: se agregan entradas para los nuevos y se marcan como eliminadas
 * las de los que salieron. Nunca se borra una entrada (RF_06).
 */
async function sincronizarEventoEnAnimales(tx, args) {
    const existentes = await tx.bitacoraEntrada.findMany({
        where: { idEvento: args.idEvento, tipo: 'EVENTO' },
        select: { id: true, idAnimal: true, eventoEliminado: true },
    });
    const finales = new Set(args.idAnimalesFinal);
    const yaConEntradaVigente = new Set(existentes.filter((e) => !e.eventoEliminado).map((e) => e.idAnimal));
    // Animales que salieron del evento: su entrada queda marcada, no se borra.
    const aMarcar = existentes
        .filter((e) => !e.eventoEliminado && !finales.has(e.idAnimal))
        .map((e) => e.id);
    if (aMarcar.length > 0) {
        await tx.bitacoraEntrada.updateMany({
            where: { id: { in: aMarcar } },
            data: { eventoEliminado: true },
        });
    }
    // Animales que entraron al evento.
    const nuevos = args.idAnimalesFinal.filter((id) => !yaConEntradaVigente.has(id));
    await registrarEventoEnAnimales(tx, { ...args, idAnimales: nuevos });
    // Las entradas que siguen vigentes se actualizan para reflejar fecha y
    // descripcion nuevas del evento.
    const vigentes = existentes
        .filter((e) => !e.eventoEliminado && finales.has(e.idAnimal))
        .map((e) => e.id);
    if (vigentes.length > 0) {
        await tx.bitacoraEntrada.updateMany({
            where: { id: { in: vigentes } },
            data: {
                titulo: etiquetaTipoEvento(args.tipoEvento),
                descripcion: args.descripcion,
                fechaEvento: args.fechaEvento,
            },
        });
    }
}
/**
 * RF_10 - al eliminar un evento, sus entradas de bitacora se conservan como
 * registro historico, marcadas como "evento eliminado".
 */
async function marcarEventoEliminado(tx, idEvento) {
    await tx.bitacoraEntrada.updateMany({
        where: { idEvento },
        data: { eventoEliminado: true },
    });
}
/** Nota manual del usuario (`Nota_bitacora` del MER). */
async function agregarNota(db, args) {
    return db.bitacoraEntrada.create({
        data: {
            idAnimal: args.idAnimal,
            idUsuario: args.idUsuario,
            tipo: 'NOTA',
            titulo: 'Nota',
            descripcion: args.contenido,
        },
    });
}
// ─── Etiquetas legibles ──────────────────────────────────────────────────────
// La bitacora la lee un productor en terreno, no un desarrollador: las entradas
// se guardan ya redactadas en espanol para que la app solo tenga que mostrarlas.
const ETIQUETAS_CAMPO = {
    raza: 'la raza',
    color: 'el color',
    pesoKg: 'el peso',
    descripcion: 'las observaciones',
    sexo: 'el sexo',
    fechaNacimiento: 'la fecha de nacimiento',
};
function etiquetaCampo(campo) {
    return ETIQUETAS_CAMPO[campo] ?? campo;
}
const ETIQUETAS_MOTIVO = {
    VENTA: 'venta',
    MUERTE: 'muerte',
    FAENA: 'faena',
};
function etiquetaMotivo(motivo) {
    return ETIQUETAS_MOTIVO[motivo] ?? motivo.toLowerCase();
}
const ETIQUETAS_EVENTO = {
    ENCASTE: 'Encaste',
    ESQUILA: 'Esquila',
    ATENCION_SANITARIA: 'Atencion sanitaria',
    OTRO: 'Evento del predio',
};
function etiquetaTipoEvento(tipo) {
    return ETIQUETAS_EVENTO[tipo];
}
function formatear(v) {
    if (v === null || v === undefined || v === '')
        return 'sin dato';
    if (v instanceof Date)
        return v.toISOString().slice(0, 10);
    return String(v);
}
//# sourceMappingURL=bitacora.servicio.js.map