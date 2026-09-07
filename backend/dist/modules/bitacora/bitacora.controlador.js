"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listar = listar;
exports.crearNota = crearNota;
const zod_1 = require("zod");
const db_1 = require("../../shared/db");
const contexto_1 = require("../../shared/contexto");
const errores_1 = require("../../shared/errores");
const paginacion_1 = require("../../shared/paginacion");
const validacion_1 = require("../../shared/validacion");
const bitacora_servicio_1 = require("./bitacora.servicio");
const esquemaParams = zod_1.z.object({
    idAnimal: zod_1.z.uuid('El identificador del animal no es valido.'),
});
const esquemaNota = zod_1.z.object({
    contenido: zod_1.z
        .string()
        .trim()
        .min(1, 'La nota no puede estar vacia.')
        .max(1000, 'La nota no puede superar los 1000 caracteres.'),
});
const esquemaListado = paginacion_1.esquemaPaginacion.extend({
    tipo: zod_1.z.enum(['ALTA', 'MODIFICACION', 'BAJA', 'EVENTO', 'NOTA']).optional(),
});
/**
 * Confirma que el animal existe y pertenece al predio del usuario.
 * Si es de otro predio se responde 404 igual que si no existiera: distinguirlos
 * filtraria informacion entre predios (RNF_08).
 */
async function animalDelPredio(idAnimal, idPredio) {
    const animal = await db_1.prisma.animal.findFirst({
        where: { id: idAnimal, idPredio },
        select: { id: true, numeroOreja: true },
    });
    if (!animal) {
        throw new errores_1.ErrorNoEncontrado('No se encontro el animal solicitado.');
    }
    return animal;
}
/** GET /animales/:idAnimal/bitacora - RF_05 */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { idAnimal } = (0, validacion_1.validarParams)(esquemaParams, req);
    const filtros = (0, validacion_1.validarQuery)(esquemaListado, req);
    await animalDelPredio(idAnimal, ctx.idPredio);
    const where = { idAnimal, ...(filtros.tipo ? { tipo: filtros.tipo } : {}) };
    const [entradas, total] = await Promise.all([
        db_1.prisma.bitacoraEntrada.findMany({
            where,
            orderBy: [{ fechaEvento: 'desc' }, { createdAt: 'desc' }],
            include: { usuario: { select: { id: true, nombre: true } } },
            ...(0, paginacion_1.aSkipTake)(filtros),
        }),
        db_1.prisma.bitacoraEntrada.count({ where }),
    ]);
    res.json((0, paginacion_1.paginar)(entradas.map(aDto), total, filtros));
}
/** POST /animales/:idAnimal/bitacora - nota manual (Nota_bitacora del MER) */
async function crearNota(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { idAnimal } = (0, validacion_1.validarParams)(esquemaParams, req);
    const { contenido } = (0, validacion_1.validarCuerpo)(esquemaNota, req);
    await animalDelPredio(idAnimal, ctx.idPredio);
    const entrada = await (0, bitacora_servicio_1.agregarNota)(db_1.prisma, {
        idAnimal,
        idUsuario: ctx.idUsuario,
        contenido,
    });
    const conUsuario = await db_1.prisma.bitacoraEntrada.findUniqueOrThrow({
        where: { id: entrada.id },
        include: { usuario: { select: { id: true, nombre: true } } },
    });
    res.status(201).json(aDto(conUsuario));
}
function aDto(e) {
    return {
        id: e.id,
        tipo: e.tipo,
        titulo: e.titulo,
        descripcion: e.descripcion,
        datos: e.datos,
        idEvento: e.idEvento,
        eventoEliminado: e.eventoEliminado,
        fecha: e.fechaEvento,
        registradaEn: e.createdAt,
        usuario: e.usuario,
    };
}
//# sourceMappingURL=bitacora.controlador.js.map