"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CABECERA_EDGE = void 0;
exports.partirApiKey = partirApiKey;
exports.autenticarEdge = autenticarEdge;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const errores_1 = require("../shared/errores");
/**
 * Autenticacion del modulo edge por API key (IF5-ENT).
 *
 * La key tiene la forma `<prefijo>.<secreto>`: el prefijo localiza el
 * dispositivo con un indice y el secreto se compara contra su hash bcrypt.
 * Asi la tabla no guarda nunca la key completa y la busqueda no requiere
 * recorrer todos los dispositivos.
 */
exports.CABECERA_EDGE = 'x-edge-key';
function partirApiKey(key) {
    const punto = key.indexOf('.');
    if (punto <= 0 || punto === key.length - 1)
        return null;
    return { prefijo: key.slice(0, punto), secreto: key.slice(punto + 1) };
}
async function autenticarEdge(req, _res, next) {
    const key = req.header(exports.CABECERA_EDGE);
    if (!key) {
        next(new errores_1.ErrorNoAutenticado('API_KEY_INVALIDA', 'Falta la API key del dispositivo.'));
        return;
    }
    const partes = partirApiKey(key);
    if (!partes) {
        next(new errores_1.ErrorNoAutenticado('API_KEY_INVALIDA', 'La API key del dispositivo no es valida.'));
        return;
    }
    try {
        const dispositivo = await prisma_1.prisma.dispositivoEdge.findUnique({
            where: { apiKeyPrefijo: partes.prefijo },
        });
        if (!dispositivo || !(await bcryptjs_1.default.compare(partes.secreto, dispositivo.apiKeyHash))) {
            next(new errores_1.ErrorNoAutenticado('API_KEY_INVALIDA', 'La API key del dispositivo no es valida.'));
            return;
        }
        req.edge = {
            idDispositivo: dispositivo.id,
            idPredio: dispositivo.idPredio,
            nombre: dispositivo.nombre,
        };
        next();
    }
    catch (e) {
        next(e);
    }
}
//# sourceMappingURL=autenticarEdge.js.map