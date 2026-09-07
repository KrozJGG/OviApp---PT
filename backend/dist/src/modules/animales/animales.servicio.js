"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aDto = aDto;
exports.crear = crear;
exports.listar = listar;
exports.obtenerFicha = obtenerFicha;
exports.editar = editar;
exports.calcularCambios = calcularCambios;
exports.darDeBaja = darDeBaja;
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
const fechas_1 = require("../../shared/fechas");
const paginacion_1 = require("../../shared/paginacion");
const bitacora_servicio_1 = require("../bitacora/bitacora.servicio");
/** `pesoKg` es Decimal en la base; la app espera un numero. */
function aDto(a) {
    return {
        id: a.id,
        numeroOreja: a.numeroOreja,
        sexo: a.sexo,
        raza: a.raza,
        color: a.color,
        pesoKg: a.pesoKg === null ? null : Number(a.pesoKg),
        fechaNacimiento: a.fechaNacimiento,
        descripcion: a.descripcion,
        estado: a.estado,
        motivoBaja: a.motivoBaja,
        fechaBaja: a.fechaBaja,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
    };
}
/** Cuantas entradas de bitacora se adjuntan a la ficha (RF_02, mockup 04). */
const ENTRADAS_EN_FICHA = 5;
// --- RF_01 - Registrar animal ------------------------------------------------
async function crear(ctx, datos) {
    const numeroOreja = datos.numeroOreja;
    if (typeof datos.fechaNacimiento === 'string') {
        exigirNoFutura(datos.fechaNacimiento, 'La fecha de nacimiento no puede ser posterior a hoy.');
    }
    // El indice uq_animal_oreja ya lo garantiza, pero se comprueba antes para
    // poder decir cual es el numero repetido en vez de dar un 409 generico.
    const existente = await db_1.prisma.animal.findUnique({
        where: { idPredio_numeroOreja: { idPredio: ctx.idPredio, numeroOreja } },
        select: { id: true },
    });
    if (existente)
        throw errorOrejaDuplicada(numeroOreja);
    try {
        return await db_1.prisma.$transaction(async (tx) => {
            const animal = await tx.animal.create({
                data: {
                    idPredio: ctx.idPredio,
                    idRegistrador: ctx.idUsuario,
                    numeroOreja,
                    sexo: datos.sexo,
                    raza: normalizarTexto(datos.raza) ?? null,
                    color: normalizarTexto(datos.color) ?? null,
                    pesoKg: datos.pesoKg ?? null,
                    fechaNacimiento: typeof datos.fechaNacimiento === 'string' ? (0, fechas_1.aFechaSolo)(datos.fechaNacimiento) : null,
                    descripcion: normalizarTexto(datos.descripcion) ?? null,
                },
            });
            // RF_06.a - la ficha nace con su primera entrada de bitacora.
            await (0, bitacora_servicio_1.registrarAlta)(tx, {
                idAnimal: animal.id,
                idUsuario: ctx.idUsuario,
                numeroOreja: animal.numeroOreja,
                datosIniciales: datosIniciales(animal),
            });
            return aDto(animal);
        });
    }
    catch (e) {
        // Carrera entre la comprobacion de arriba y el INSERT: gana la base.
        if (codigoPrisma(e) === 'P2002')
            throw errorOrejaDuplicada(numeroOreja);
        throw e;
    }
}
// --- Listado del rebano (mockup 03) ------------------------------------------
async function listar(ctx, filtros) {
    const where = {
        idPredio: ctx.idPredio,
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        // Busqueda por prefijo: en terreno se teclea el inicio de la caravana.
        ...(filtros.q ? { numeroOreja: { startsWith: filtros.q, mode: 'insensitive' } } : {}),
    };
    const delPredio = { idPredio: ctx.idPredio };
    const [filas, total, activos, inactivos] = await Promise.all([
        db_1.prisma.animal.findMany({ where, orderBy: { numeroOreja: 'asc' }, ...(0, paginacion_1.aSkipTake)(filtros) }),
        db_1.prisma.animal.count({ where }),
        db_1.prisma.animal.count({ where: { ...delPredio, estado: 'ACTIVO' } }),
        db_1.prisma.animal.count({ where: { ...delPredio, estado: 'INACTIVO' } }),
    ]);
    // El resumen cuenta el rebano completo, no la pagina: es el subtitulo de la
    // pantalla ("47 animales activos") y no debe cambiar al paginar ni al filtrar.
    return { ...(0, paginacion_1.paginar)(filas.map(aDto), total, filtros), resumen: { activos, inactivos } };
}
// --- RF_02 - Consultar ficha -------------------------------------------------
async function obtenerFicha(ctx, id) {
    // Sin filtrar por estado: RF_02 exige poder consultar tambien la ficha de un
    // animal dado de baja.
    const animal = await db_1.prisma.animal.findFirst({
        where: { id, idPredio: ctx.idPredio },
        include: { registrador: { select: { id: true, nombre: true } } },
    });
    if (!animal)
        throw errorAnimalNoEncontrado();
    const entradas = await db_1.prisma.bitacoraEntrada.findMany({
        where: { idAnimal: animal.id },
        orderBy: [{ fechaEvento: 'desc' }, { createdAt: 'desc' }],
        take: ENTRADAS_EN_FICHA,
        select: { id: true, tipo: true, titulo: true, descripcion: true, fechaEvento: true },
    });
    return {
        ...aDto(animal),
        registrador: animal.registrador,
        ultimasEntradas: entradas.map((e) => ({
            id: e.id,
            tipo: e.tipo,
            titulo: e.titulo,
            descripcion: e.descripcion,
            fecha: e.fechaEvento,
        })),
    };
}
// --- RF_03 - Editar datos generales ------------------------------------------
async function editar(ctx, id, datos) {
    // H7 - el numero de oreja identifica al animal en el registro SAG: cambiarlo
    // romperia la trazabilidad, asi que no se ignora en silencio, se rechaza.
    if (datos.numeroOreja !== undefined) {
        throw new errores_1.ErrorConflicto('IDENTIFICADOR_INMUTABLE', 'El número de oreja no se puede modificar.');
    }
    const animal = await buscarDelPredio(id, ctx.idPredio);
    if (animal.estado === 'INACTIVO') {
        throw new errores_1.ErrorConflicto('ANIMAL_INACTIVO', 'No se pueden editar los datos de un animal dado de baja.');
    }
    if (typeof datos.fechaNacimiento === 'string') {
        exigirNoFutura(datos.fechaNacimiento, 'La fecha de nacimiento no puede ser posterior a hoy.');
    }
    const { cambios, data } = calcularCambios(animal, datos);
    // Sin cambios reales no hay nada que registrar: una entrada de bitacora vacia
    // solo ensuciaria el historial que se le muestra al productor.
    if (cambios.length === 0)
        return aDto(animal);
    return db_1.prisma.$transaction(async (tx) => {
        const actualizado = await tx.animal.update({ where: { id: animal.id }, data });
        // RF_06.b - queda constancia de que campo cambio, desde que valor y a cual.
        await (0, bitacora_servicio_1.registrarModificacion)(tx, { idAnimal: animal.id, idUsuario: ctx.idUsuario, cambios });
        return aDto(actualizado);
    });
}
/**
 * Compara el animal guardado con los datos recibidos y devuelve solo los
 * cambios REALES: los campos que no vinieron, o que vinieron con el mismo
 * valor, no generan entrada de bitacora ni se tocan en la base.
 */
function calcularCambios(animal, datos) {
    const cambios = [];
    const data = {};
    const cambio = (campo, anterior, nuevo) => {
        if (anterior === nuevo)
            return false;
        cambios.push({ campo, valorAnterior: anterior, valorNuevo: nuevo });
        return true;
    };
    if (datos.sexo !== undefined && cambio('sexo', animal.sexo, datos.sexo)) {
        data.sexo = datos.sexo;
    }
    const raza = normalizarTexto(datos.raza);
    if (raza !== undefined && cambio('raza', animal.raza, raza)) {
        data.raza = raza;
    }
    const color = normalizarTexto(datos.color);
    if (color !== undefined && cambio('color', animal.color, color)) {
        data.color = color;
    }
    const descripcion = normalizarTexto(datos.descripcion);
    if (descripcion !== undefined && cambio('descripcion', animal.descripcion, descripcion)) {
        data.descripcion = descripcion;
    }
    if (datos.pesoKg !== undefined) {
        // Decimal vs number: sin convertir, 45 y Decimal(45) nunca serian iguales
        // y toda edicion registraria un cambio de peso que no ocurrio.
        const anterior = animal.pesoKg === null ? null : Number(animal.pesoKg);
        if (cambio('pesoKg', anterior, datos.pesoKg))
            data.pesoKg = datos.pesoKg;
    }
    if (datos.fechaNacimiento !== undefined) {
        const anterior = animal.fechaNacimiento === null ? null : aIsoSolo(animal.fechaNacimiento);
        if (cambio('fechaNacimiento', anterior, datos.fechaNacimiento)) {
            data.fechaNacimiento =
                datos.fechaNacimiento === null ? null : (0, fechas_1.aFechaSolo)(datos.fechaNacimiento);
        }
    }
    return { cambios, data };
}
// --- RF_04 - Registrar baja --------------------------------------------------
async function darDeBaja(ctx, id, datos) {
    const animal = await buscarDelPredio(id, ctx.idPredio);
    if (animal.estado === 'INACTIVO') {
        throw new errores_1.ErrorConflicto('ANIMAL_YA_INACTIVO', 'Este animal ya fue dado de baja.');
    }
    exigirNoFutura(datos.fecha, 'La fecha de baja no puede ser posterior a hoy.');
    const fechaBaja = (0, fechas_1.aFechaSolo)(datos.fecha);
    return db_1.prisma.$transaction(async (tx) => {
        // El animal y su historial se conservan siempre: la baja es un cambio de
        // estado, nunca un borrado (RF_04, trazabilidad SAG).
        const actualizado = await tx.animal.update({
            where: { id: animal.id },
            data: { estado: 'INACTIVO', motivoBaja: datos.motivo, fechaBaja },
        });
        // RF_06.c
        await (0, bitacora_servicio_1.registrarBaja)(tx, {
            idAnimal: animal.id,
            idUsuario: ctx.idUsuario,
            motivo: datos.motivo,
            fecha: fechaBaja,
        });
        return aDto(actualizado);
    });
}
// --- Apoyo -------------------------------------------------------------------
/**
 * Busca el animal dentro del predio del usuario.
 * Si existe pero es de otro predio responde 404 igual que si no existiera:
 * distinguirlos filtraria informacion entre predios (RNF_08).
 */
async function buscarDelPredio(id, idPredio) {
    const animal = await db_1.prisma.animal.findFirst({ where: { id, idPredio } });
    if (!animal)
        throw errorAnimalNoEncontrado();
    return animal;
}
function errorAnimalNoEncontrado() {
    return new errores_1.ErrorNoEncontrado('No se encontró el animal solicitado.');
}
function errorOrejaDuplicada(numeroOreja) {
    return new errores_1.ErrorConflicto('OREJA_DUPLICADA', `Ya existe un animal con el número de oreja ${numeroOreja} en este predio.`);
}
/** Ninguna de estas fechas puede estar en el futuro: describen algo ya ocurrido. */
function exigirNoFutura(iso, mensaje) {
    if (iso > (0, fechas_1.fechaLocalISO)())
        throw new errores_1.ErrorReglaNegocio('FECHA_FUTURA', mensaje);
}
/** undefined = el campo no vino; null o cadena vacia = el usuario borro el dato. */
function normalizarTexto(valor) {
    if (valor === undefined)
        return undefined;
    if (valor === null || valor === '')
        return null;
    return valor;
}
/** Los campos @db.Date se guardan a medianoche UTC: basta con recortar. */
function aIsoSolo(fecha) {
    return fecha.toISOString().slice(0, 10);
}
/** Foto de los datos con los que nacio la ficha, para la entrada de ALTA. */
function datosIniciales(a) {
    return {
        numeroOreja: a.numeroOreja,
        sexo: a.sexo,
        raza: a.raza,
        color: a.color,
        pesoKg: a.pesoKg === null ? null : Number(a.pesoKg),
        fechaNacimiento: a.fechaNacimiento === null ? null : aIsoSolo(a.fechaNacimiento),
        descripcion: a.descripcion,
    };
}
function codigoPrisma(e) {
    if (typeof e !== 'object' || e === null)
        return undefined;
    const codigo = e.code;
    return typeof codigo === 'string' ? codigo : undefined;
}
//# sourceMappingURL=animales.servicio.js.map