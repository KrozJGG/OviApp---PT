"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarResponsables = validarResponsables;
exports.validarAnimales = validarAnimales;
exports.validarFechaLimite = validarFechaLimite;
exports.exigirActiva = exigirActiva;
exports.crearTarea = crearTarea;
exports.listarTareas = listarTareas;
exports.obtenerTarea = obtenerTarea;
exports.editarTarea = editarTarea;
exports.completarTarea = completarTarea;
exports.eliminarTarea = eliminarTarea;
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
const fechas_1 = require("../../shared/fechas");
const paginacion_1 = require("../../shared/paginacion");
/**
 * Reglas de negocio de Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 *
 * Este modulo NO escribe bitacora: la bitacora es la historia del animal
 * (RF_06) y una tarea es del predio, no de un animal, aunque pueda referenciar
 * varios (H10).
 *
 * Todas las consultas filtran por `ctx.idPredio`. Una tarea de otro predio se
 * responde con 404 y no con 403: distinguirlas filtraria informacion entre
 * predios (RNF_08).
 *
 * REGLA DEL ADAPTADOR: dentro de `$transaction` no se leen relaciones. Una
 * transaccion interactiva se sostiene sobre UN solo cliente `pg`, y el
 * interprete de consultas de Prisma 7 resuelve cada relacion de un `include`
 * con una consulta aparte que dispara en paralelo. Sobre el pool eso es
 * correcto, pero sobre el cliente unico de la transaccion desincroniza el
 * protocolo del servidor y termina cayendo el proceso. Por eso cada mutacion
 * escribe dentro de la transaccion y devuelve solo el id: la lectura del DTO
 * (`leerTareaCompleta`) va despues, fuera de la transaccion, donde cada
 * consulta toma su propio cliente del pool.
 */
/** Relaciones que arma el DTO. Se reutiliza en todas las lecturas. */
const inclusionTarea = {
    creador: { select: { id: true, nombre: true } },
    completadaPor: { select: { id: true, nombre: true } },
    responsables: {
        select: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { usuario: { nombre: 'asc' } },
    },
    animales: {
        select: { animal: { select: { id: true, numeroOreja: true } } },
        orderBy: { animal: { numeroOreja: 'asc' } },
    },
};
// ─────────────────────────────────────────────────────────────────────────────
// Reglas de negocio
// ─────────────────────────────────────────────────────────────────────────────
/** Quita repetidos conservando el orden de llegada. */
function unicos(ids) {
    return [...new Set(ids)];
}
/**
 * RF_11 - "uno o mas usuarios responsables". Ademas verifica que todos sean
 * usuarios habilitados del predio: asignarle una tarea a alguien inhabilitado
 * (RF_22) la dejaria sin nadie que pueda completarla.
 */
async function validarResponsables(db, idPredio, idResponsables) {
    const ids = unicos(idResponsables);
    if (ids.length === 0) {
        throw new errores_1.ErrorReglaNegocio('RESPONSABLES_REQUERIDOS', 'Asigna al menos un responsable a la tarea.');
    }
    const encontrados = await db.usuario.count({
        where: { id: { in: ids }, idPredio, estado: 'HABILITADO' },
    });
    if (encontrados !== ids.length) {
        throw new errores_1.ErrorNoEncontrado('Alguno de los responsables no pertenece a este predio.');
    }
    return ids;
}
/**
 * H10 - vincular animales es OPCIONAL en una tarea. Si vienen, todos tienen que
 * ser del predio del usuario (RNF_08).
 */
async function validarAnimales(db, idPredio, idAnimales) {
    const ids = unicos(idAnimales);
    if (ids.length === 0) {
        return ids;
    }
    const encontrados = await db.animal.count({ where: { id: { in: ids }, idPredio } });
    if (encontrados !== ids.length) {
        throw new errores_1.ErrorNoEncontrado('Alguno de los animales no pertenece a este predio.');
    }
    return ids;
}
/**
 * RF_11 / RF_12 - la fecha limite no puede quedar en el pasado. "Hoy" se
 * calcula en la zona del predio (`fechaLocalISO`), no en UTC.
 */
function validarFechaLimite(fechaLimite) {
    if ((0, fechas_1.esPasada)(fechaLimite)) {
        throw new errores_1.ErrorReglaNegocio('FECHA_PASADA', 'La fecha de término debe ser hoy o posterior.');
    }
    return (0, fechas_1.aFechaSolo)(fechaLimite);
}
/** RF_12 / RF_13 - una tarea completada ya no se edita ni se vuelve a completar. */
function exigirActiva(tarea, accion) {
    if (tarea.estado === 'COMPLETADA') {
        throw new errores_1.ErrorConflicto('TAREA_COMPLETADA', `No se puede ${accion} una tarea ya completada.`);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Operaciones
// ─────────────────────────────────────────────────────────────────────────────
/** Localiza la tarea dentro del predio del usuario o lanza 404 (RNF_08). */
async function tareaDelPredio(db, id, idPredio) {
    const tarea = await db.tarea.findFirst({
        where: { id, idPredio },
        select: { id: true, estado: true },
    });
    if (!tarea) {
        throw new errores_1.ErrorNoEncontrado('No se encontró la tarea solicitada.');
    }
    return tarea;
}
/** Lee el DTO completo de una tarea. Siempre fuera de una transaccion. */
async function leerTareaCompleta(id) {
    return db_1.prisma.tarea.findUniqueOrThrow({ where: { id }, include: inclusionTarea });
}
/**
 * RF_11 - Crear tarea. Ambos roles.
 *
 * Las dos colecciones hijas (`responsables` y `animales`) se escriben en
 * llamadas separadas y secuenciales, no como escrituras anidadas del mismo
 * `create`: dos bloques anidados en una sola operacion tambien harian que el
 * interprete emita ambos INSERT en paralelo sobre el cliente de la transaccion.
 */
async function crearTarea(ctx, datos) {
    const id = await db_1.prisma.$transaction(async (tx) => {
        const responsables = await validarResponsables(tx, ctx.idPredio, datos.idResponsables);
        const animales = await validarAnimales(tx, ctx.idPredio, datos.idAnimales ?? []);
        const fechaLimite = validarFechaLimite(datos.fechaLimite);
        const creada = await tx.tarea.create({
            data: {
                idPredio: ctx.idPredio,
                idCreador: ctx.idUsuario,
                titulo: datos.titulo,
                descripcion: datos.descripcion ?? null,
                fechaLimite,
            },
            select: { id: true },
        });
        await asignarResponsables(tx, creada.id, responsables);
        await asignarAnimales(tx, creada.id, animales);
        return creada.id;
    });
    return leerTareaCompleta(id);
}
/** Inserta las filas de `tarea_usuario` de una tarea. Secuencial a proposito. */
async function asignarResponsables(db, idTarea, ids) {
    if (ids.length === 0)
        return;
    await db.tareaUsuario.createMany({ data: ids.map((idUsuario) => ({ idTarea, idUsuario })) });
}
/** Inserta las filas de `tarea_animal` de una tarea (H10). Secuencial a proposito. */
async function asignarAnimales(db, idTarea, ids) {
    if (ids.length === 0)
        return;
    await db.tareaAnimal.createMany({ data: ids.map((idAnimal) => ({ idTarea, idAnimal })) });
}
/** Listado del predio, filtrable por estado, rango de fecha limite y responsable. */
async function listarTareas(ctx, filtros) {
    const rango = {};
    if (filtros.desde)
        rango.gte = (0, fechas_1.aFechaSolo)(filtros.desde);
    if (filtros.hasta)
        rango.lte = (0, fechas_1.aFechaSolo)(filtros.hasta);
    const where = {
        idPredio: ctx.idPredio,
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.desde || filtros.hasta ? { fechaLimite: rango } : {}),
        ...(filtros.idResponsable
            ? { responsables: { some: { idUsuario: filtros.idResponsable } } }
            : {}),
    };
    const [filas, total] = await Promise.all([
        db_1.prisma.tarea.findMany({
            where,
            include: inclusionTarea,
            orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'asc' }],
            ...(0, paginacion_1.aSkipTake)(filtros),
        }),
        db_1.prisma.tarea.count({ where }),
    ]);
    return { filas, total };
}
/** Detalle de una tarea del predio. */
async function obtenerTarea(ctx, id) {
    const tarea = await db_1.prisma.tarea.findFirst({
        where: { id, idPredio: ctx.idPredio },
        include: inclusionTarea,
    });
    if (!tarea) {
        throw new errores_1.ErrorNoEncontrado('No se encontró la tarea solicitada.');
    }
    return tarea;
}
/** RF_12 - Editar tarea. Ambos roles. Prohibida sobre una tarea completada. */
async function editarTarea(ctx, id, datos) {
    await db_1.prisma.$transaction(async (tx) => {
        const actual = await tareaDelPredio(tx, id, ctx.idPredio);
        exigirActiva(actual, 'editar');
        const responsables = datos.idResponsables === undefined
            ? undefined
            : await validarResponsables(tx, ctx.idPredio, datos.idResponsables);
        const animales = datos.idAnimales === undefined
            ? undefined
            : await validarAnimales(tx, ctx.idPredio, datos.idAnimales);
        // Las asignaciones se reemplazan por completo: la lista que llega es la
        // lista final, no un incremento. Igual que en `crearTarea`, las dos
        // colecciones se reescriben en llamadas secuenciales y no como escrituras
        // anidadas del `update`, para no emitir INSERT concurrentes sobre el mismo
        // cliente de la transaccion.
        if (responsables) {
            await tx.tareaUsuario.deleteMany({ where: { idTarea: id } });
        }
        if (animales) {
            await tx.tareaAnimal.deleteMany({ where: { idTarea: id } });
        }
        await tx.tarea.update({
            where: { id },
            data: {
                ...(datos.titulo !== undefined ? { titulo: datos.titulo } : {}),
                ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion } : {}),
                ...(datos.fechaLimite !== undefined
                    ? { fechaLimite: validarFechaLimite(datos.fechaLimite) }
                    : {}),
            },
        });
        if (responsables)
            await asignarResponsables(tx, id, responsables);
        if (animales)
            await asignarAnimales(tx, id, animales);
    });
    return leerTareaCompleta(id);
}
/**
 * RF_13 - Completar tarea. Ambos roles.
 * Se registra cuando se completo y quien la marco; la tarea sigue visible en el
 * listado, no se borra ni se oculta.
 */
async function completarTarea(ctx, id) {
    await db_1.prisma.$transaction(async (tx) => {
        const actual = await tareaDelPredio(tx, id, ctx.idPredio);
        exigirActiva(actual, 'completar');
        await tx.tarea.update({
            where: { id },
            data: {
                estado: 'COMPLETADA',
                completadaEn: new Date(),
                idCompletadaPor: ctx.idUsuario,
            },
        });
    });
    return leerTareaCompleta(id);
}
/**
 * RF_14 - Eliminar tarea "de forma permanente". Ambos roles.
 * Es un borrado real, no un soft delete: las filas de `tarea_usuario` y
 * `tarea_animal` caen por ON DELETE CASCADE.
 */
async function eliminarTarea(ctx, id) {
    await tareaDelPredio(db_1.prisma, id, ctx.idPredio);
    await db_1.prisma.tarea.delete({ where: { id } });
}
//# sourceMappingURL=tareas.servicio.js.map